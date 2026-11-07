import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import type {RecordInput} from '../src/core/models.ts';
import {scanGaps, scanProjectGaps} from '../src/projects/gaps.ts';

const put = (file: string, text: string) => {
  mkdirSync(resolve(file, '..'), {recursive: true});
  writeFileSync(file, text);
};
const style = (overrides: Partial<RecordInput>): RecordInput => ({
  kind: 'preference',
  domain: 'coding',
  title: 'Style',
  summary: '',
  content: 'Rule',
  tags: [],
  priority: 50,
  status: 'active',
  checks: [],
  backend: null,
  ...overrides,
});

test('gap scan reports missing skills, unavailable dependencies, unusable tools and dev tooling', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-gaps-'));
  const repo = join(dir, 'repo'),
    home = join(dir, 'home'),
    db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    const dependency = db.create(style({title: 'Archived dependency'}));
    const tool = db.create(
      style({
        kind: 'tool',
        domain: 'tools',
        title: 'Linter tool',
        backend: {command: 'pb-no-such-command', args: [], toolName: 'lint', enabled: true},
      }),
    );
    const main = db.create(
      style({
        title: 'Main',
        externalSkills: ['installed-skill', 'missing-skill'],
        skillBindings: [{name: 'optional-skill', required: false, fallback: 'Review manually.'}],
        requiredIds: [dependency.id, tool.id],
      }),
    );
    // Archived after creation: dependencies are validated only when a style is saved.
    db.db
      .prepare('UPDATE records SET status = ?, snapshot = json_set(snapshot, ?, ?) WHERE id = ?')
      .run('archived', '$.status', 'archived', dependency.id);
    const typescript = db.create(
      style({title: 'Development — TypeScript', standardLanguage: 'typescript'}),
    );
    put(
      join(repo, '.claude/skills/installed-skill/SKILL.md'),
      '---\nname: installed-skill\n---\nBody',
    );
    put(join(repo, 'tsconfig.json'), '{}');
    put(join(repo, 'package.json'), '{"prettier": {}}');

    const result = scanGaps(db, [main.id, typescript.id], repo, undefined, home);
    const byName = new Map(result.gaps.map((g) => [g.name, g]));

    assert.equal(byName.has('installed-skill'), false);
    assert.equal(byName.get('missing-skill')?.required, true);
    assert.match(byName.get('missing-skill')!.setup, /\.claude\/skills\/missing-skill\/SKILL\.md/);
    assert.equal(byName.get('optional-skill')?.required, false);
    assert.match(byName.get('optional-skill')!.setup, /Review manually\./);
    assert.equal(byName.get('Archived dependency')?.type, 'dependency');
    assert.equal(byName.get('Archived dependency')?.status, 'archived');
    assert.equal(byName.get('lint')?.status, 'command not found');
    // tsconfig.json and package.json "prettier" satisfy two of the three TypeScript tools.
    assert.deepEqual(
      result.gaps.filter((g) => g.type === 'dev-tool').map((g) => g.name),
      ['ESLint'],
    );

    const noFolder = scanGaps(db, [typescript.id], undefined, undefined, home);
    assert.ok(noFolder.gaps.every((g) => g.status === 'not checked'));
    assert.throws(() => scanGaps(db, 'not-a-list'), /recordIds/);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('project gap scan uses saved selections and reports a clean project as gap-free', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-gaps-project-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    const plain = db.create(style({title: 'Plain'}));
    const project = db.saveProject({
      name: 'Clean',
      description: '',
      assignments: [{recordId: plain.id, override: null}],
    });
    const result = scanProjectGaps(db, project.id, join(dir, 'home'));
    assert.deepEqual(
      result.scannedStyles.map((s) => s.title),
      ['Plain'],
    );
    assert.deepEqual(result.gaps, []);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

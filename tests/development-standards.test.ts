import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {seedGlobalStyles} from '../src/styles/global-style-seed.ts';
import {globalStyleCatalog, previousCatalog} from '../src/styles/global-style-catalog.ts';
import {
  applyStandardsMigration,
  previewStandardsMigration,
  rollbackStandardsMigration,
  standardInput,
} from '../src/styles/standards-migration.ts';
import {resolveInstructions} from '../src/instructions/resolve.ts';
import {callTool, tools} from '../src/agents/mcp.ts';
import {validateTaskContext, validateApplicability} from '../src/core/preference-contract.ts';
import {validateRequirements} from '../src/core/requirements.ts';
import {exportLibrary, importLibrary, previewLibraryImport} from '../src/core/library-transfer.ts';

function fixture() {
  const folder = mkdtempSync(join(tmpdir(), 'pb-standards-'));
  const db = new BrainDB(join(folder, 'brain.sqlite'));
  seedGlobalStyles(db);
  const record = (key: string) => db.styleByKey(key)!;
  const project = (keys: string[]) =>
    db.saveProject({
      name: 'Test',
      description: '',
      assignments: keys.map((key) => ({recordId: record(key).id, override: null})),
    });
  return {
    db,
    folder,
    record,
    project,
    close() {
      db.close();
      rmSync(folder, {recursive: true, force: true});
    },
  };
}
function restorePreviousCatalog(f: ReturnType<typeof fixture>) {
  f.db.updateBatch(
    previousCatalog.map((source) => ({
      id: f.record(source.keyId!).id,
      expectedVersion: f.record(source.keyId!).version,
      input: {
        ...standardInput(source, (key) => f.record(key).id),
        compatibility: undefined,
        standardLanguage: undefined,
        appliesWhen: undefined,
      },
    })),
  );
  for (const record of f.db.list({limit: 300}).filter((record) => record.standardLanguage)) {
    f.db.db.prepare('DELETE FROM revisions WHERE record_id=?').run(record.id);
    f.db.db.prepare('DELETE FROM records WHERE id=?').run(record.id);
  }
}
const context = {activity: 'implement', formats: [], languages: [], frameworks: [], targets: []};

test('STD-01/07/15 one common standard, seven language children and independent language settings', () => {
  const f = fixture();
  try {
    const languages = f.db.list({limit: 300}).filter((record) => record.standardLanguage);
    assert.deepEqual(languages.map((record) => record.standardLanguage).sort(), [
      'csharp',
      'dart',
      'java',
      'kotlin',
      'python',
      'swift',
      'typescript',
    ]);
    for (const record of languages) {
      assert.deepEqual(record.requiredIds, [f.record('development').id]);
    }
    const p = f.project(['development', 'coding-typescript', 'coding-csharp']);
    const result = resolveInstructions(f.db, p.id, {
      task: 'Change types',
      recordIds: p.assignments.map((a) => a.recordId),
      context,
    });
    assert.equal(result.records.filter((record) => record.keyId === 'development').length, 1);
    assert.equal(result.records.length, 3);
    assert.equal(result.unresolved.length, 0);
    assert.equal(result.decisions.find((d) => d.key === 'typescript.indent')?.value, '2');
    assert.equal(result.decisions.find((d) => d.key === 'csharp.indent')?.value, '4');
    assert.deepEqual(f.record('development').requiredIds, []);
    assert.doesNotMatch(JSON.stringify(f.record('thinking')), /at least three options/i);
  } finally {
    f.close();
  }
});

test('standards migration preserves project overrides and refuses rollback over later edits', () => {
  const f = fixture();
  try {
    restorePreviousCatalog(f);
    const coding = f.record('coding-style');
    const project = f.db.saveProject({
      name: 'Override',
      description: '',
      assignments: [{recordId: coding.id, override: 'Project naming convention'}],
    });
    assert.ok(previewStandardsMigration(f.db).conflicts.includes('coding-style'));
    f.db.saveProject(
      {...project, assignments: [{recordId: coding.id, override: null}]},
      project.id,
      project.version,
    );
    const result = applyStandardsMigration(f.db, previewStandardsMigration(f.db).fingerprint);
    const common = f.record('development');
    f.db.update(common.id, {content: 'A later personal change'}, common.version);
    assert.throws(() => rollbackStandardsMigration(f.db, result.migrationId!), /later edits/);
    assert.equal(f.record('development').content, 'A later personal change');
  } finally {
    f.close();
  }
});

test('STD-02/03/04/05/06/08/09 conditional framework checks do not leak into SDKs and CLIs', () => {
  const f = fixture();
  try {
    for (const [key, frameworks, target] of [
      ['typescript', ['react'], 'web'],
      ['typescript', ['node'], 'cli'],
      ['typescript', [], 'sdk'],
      ['csharp', [], 'sdk'],
      ['csharp', ['aspnetcore', 'efcore'], 'api'],
      ['swift', ['swiftui'], 'mobile'],
      ['kotlin', ['compose'], 'mobile'],
      ['dart', ['flutter'], 'mobile'],
      ['python', [], 'cli'],
      ['java', [], 'sdk'],
    ] as const) {
      const p = f.project(['coding-' + key]);
      const result = resolveInstructions(f.db, p.id, {
        task: 'Implement',
        recordIds: [p.assignments[0].recordId],
        context: {...context, languages: [key], frameworks: [...frameworks], targets: [target]},
      });
      assert.equal(result.unresolved.length, 0);
      assert.equal(result.records.length, 2);
      const applicable = result.requirementChecklist.filter(
        (item) => item.applicability === 'applicable',
      );
      if (target === 'sdk' || target === 'cli') {
        assert.ok(
          !applicable.some((item) => item.id === 'req-dev-ui' || item.id === 'req-dev-service'),
        );
        assert.ok(
          !applicable.some(
            (item) => item.label.includes('React rules') || item.label.includes('ASP.NET'),
          ),
        );
      }
    }
    const p = f.project(['coding-typescript']);
    const unresolved = resolveInstructions(f.db, p.id, {
      task: 'Implement',
      recordIds: [p.assignments[0].recordId],
    });
    assert.ok(unresolved.unresolved.length);
    assert.throws(() => validateTaskContext({languages: 'typescript'}));
    assert.throws(() => validateApplicability({frameworks: []}));
  } finally {
    f.close();
  }
});

test('STD-10/12/13/14 overrides retain common rules; multiple formats and Word templates work', async () => {
  const f = fixture();
  try {
    const p = f.project([
      'coding-typescript',
      'doc-markdown',
      'doc-html',
      'drawio',
      'mermaid',
      'doc-word',
    ]);
    const result = resolveInstructions(f.db, p.id, {
      task: 'Produce requested outputs',
      recordIds: p.assignments.map((a) => a.recordId),
      context: {
        ...context,
        formats: ['markdown', 'html', 'drawio', 'mermaid', 'dotx'],
        preferences: [{key: 'typescript.indent', value: '4'}],
      },
    });
    assert.equal(result.decisions.find((d) => d.key === 'typescript.indent')?.value, '4');
    assert.ok(result.records.some((record) => record.keyId === 'development'));
    for (const key of ['doc-markdown', 'doc-html', 'drawio', 'mermaid', 'doc-word']) {
      assert.ok(result.records.some((record) => record.keyId === key));
    }
    assert.deepEqual(
      validateRequirements([
        {id: 'req-word', label: 'Word', type: 'artifact', extensions: ['.docx', '.dotx']},
      ])[0].extensions,
      ['.docx', '.dotx'],
    );
    assert.throws(() =>
      validateRequirements([
        {id: 'req-word', label: 'Word', type: 'manual', extensions: ['.docx']},
      ]),
    );
    assert.throws(() =>
      validateRequirements([
        {id: 'req-word', label: 'Word', type: 'artifact', extensions: ['../bad']},
      ]),
    );
    assert.throws(() =>
      validateRequirements([{id: 'req-word', label: 'Word', type: 'manual', when: null}]),
    );
    const onlyHtml = resolveInstructions(f.db, p.id, {
      task: 'HTML only',
      recordIds: [f.record('doc-html').id, f.record('doc-markdown').id],
      context: {...context, formats: ['html']},
    });
    assert.ok(!onlyHtml.records.some((record) => record.keyId === 'doc-markdown'));
    const {linkRepository} = await import('../src/projects/project-scope.ts');
    linkRepository(f.folder, p.id);
    f.db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run('repository:' + p.id, f.folder);
    writeFileSync(join(f.folder, 'template.dotx'), 'fixture');
    const report = await callTool(f.db, 'brain_review', {
      projectId: p.id,
      task: 'Word template',
      recordIds: [f.record('doc-word').id],
      context: {...context, formats: ['dotx']},
      artifacts: ['template.dotx'],
    });
    const parsed = JSON.parse(report.content[0].text);
    assert.equal(
      parsed.results.find((r: {id: string}) => r.id === 'req-word-source').status,
      'pass',
    );
    assert.equal(
      parsed.results.find((r: {id: string}) => r.id === 'req-word-source').verification,
      'file-presence-only',
    );
    const wrongFormat = await callTool(f.db, 'brain_review', {
      projectId: p.id,
      task: 'Word document',
      recordIds: [f.record('doc-word').id],
      context: {...context, formats: ['docx']},
      artifacts: ['template.dotx'],
    });
    assert.equal(
      JSON.parse(wrongFormat.content[0].text).results.find(
        (r: {id: string}) => r.id === 'req-word-source',
      ).status,
      'fail',
    );
  } finally {
    f.close();
  }
});

test('STD-16/18/19/20/24 migration is atomic, versioned, idempotent, reversible and seed-equivalent', () => {
  const f = fixture();
  try {
    restorePreviousCatalog(f);
    const p = f.project(['development', 'coding-style']);
    const original = f.db.list({limit: 300});
    const preview = previewStandardsMigration(f.db);
    assert.deepEqual(preview.conflicts, []);
    assert.equal(preview.items.filter((item) => item.action === 'create').length, 7);
    const result = applyStandardsMigration(f.db, preview.fingerprint);
    assert.equal(result.created, 7);
    assert.ok(result.changed > 0);
    assert.deepEqual(f.db.project(p.id), p);
    assert.deepEqual(f.record('development').requiredIds, []);
    assert.deepEqual(f.record('coding-style').requiredIds, [f.record('development').id]);
    assert.equal(
      previewStandardsMigration(f.db).items.every((item) => item.action === 'keep'),
      true,
    );
    assert.equal(
      applyStandardsMigration(f.db, previewStandardsMigration(f.db).fingerprint).changed,
      0,
    );
    const all = f.db.list({limit: 300});
    for (const source of globalStyleCatalog) {
      assert.deepEqual(
        standardInput(f.record(source.keyId!), (id) => all.find((r) => r.id === id)!.keyId!),
        standardInput(source, (key) => key),
      );
    }
    assert.ok(f.db.history(f.record('development').id).length >= 3);
    rollbackStandardsMigration(f.db, result.migrationId!);
    assert.equal(f.record('coding-typescript').status, 'archived');
    for (const record of original) {
      assert.equal(f.db.get(record.id)!.content, record.content);
    }
    assert.deepEqual(f.db.project(p.id), p);
  } finally {
    f.close();
  }
});

test('STD-17/18 personal edits, overrides and concurrent changes prevent mutation', () => {
  const f = fixture();
  try {
    restorePreviousCatalog(f);
    const coding = f.record('coding-style');
    const p = f.project(['coding-style']);
    const privateRecord = f.db.personalizeRecord(
      p.id,
      coding.id,
      {content: 'Private rules'},
      coding.version,
      p.version,
    );
    const preview = previewStandardsMigration(f.db);
    f.db.update(coding.id, {content: 'My rules'}, coding.version);
    assert.throws(() => applyStandardsMigration(f.db, preview.fingerprint), /changed/);
    const current = previewStandardsMigration(f.db);
    assert.ok(current.conflicts.includes('coding-style'));
    assert.throws(() => applyStandardsMigration(f.db, current.fingerprint), /personal edits/);
    assert.equal(f.db.get(privateRecord.id)!.content, 'Private rules');
    assert.equal(f.record('coding-typescript'), undefined);
    const development = f.record('development');
    assert.throws(
      () =>
        f.db.updateBatch([
          {
            id: development.id,
            expectedVersion: development.version,
            input: {requiredIds: [development.id]},
          },
        ]),
      /cycle/,
    );
    assert.equal(f.db.get(development.id)!.version, development.version);
  } finally {
    f.close();
  }
});

test('STD-19/21 discovery, MCP schemas and transfer preserve the new contract', async () => {
  const f = fixture();
  const other = fixture();
  try {
    const p = f.project([
      'coding-typescript',
      'coding-python',
      'coding-java',
      'eng-backend-typescript',
    ]);
    const matches = f.db.discover('Python Java TypeScript development', undefined, 30, p.id, {
      ...context,
      languages: ['python'],
    });
    assert.ok(matches.some((record) => record.keyId === 'coding-python'));
    assert.ok(
      !matches.some(
        (record) => record.keyId === 'coding-java' || record.keyId === 'eng-backend-typescript',
      ),
    );
    const prepared = await callTool(f.db, 'brain_prepare', {
      projectId: p.id,
      task: 'Python CLI',
      recordIds: [f.record('coding-python').id],
      context: {...context, languages: ['python'], targets: ['cli']},
    });
    assert.ok(!('isError' in prepared));
    const schema = tools().find((tool) => tool.name === 'brain_prepare')!.inputSchema;
    const contextSchema = schema.properties.context as {properties: Record<string, unknown>};
    assert.ok(contextSchema.properties.languages);
    const bundle = exportLibrary(f.db, [f.record('coding-typescript').id]);
    const record = bundle.records.find((record) => record.standardLanguage === 'typescript')!;
    assert.ok(
      record.requirements!.some((requirement) => requirement.when?.frameworks?.includes('react')),
    );
    const importPreview = previewLibraryImport(other.db, bundle);
    const imported = importLibrary(other.db, bundle, [record.id], importPreview.fingerprint);
    assert.ok(imported.kept > 0);
    assert.equal(other.record('coding-typescript').standardLanguage, 'typescript');
  } finally {
    f.close();
    other.close();
  }
});

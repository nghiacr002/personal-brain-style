import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {installBaQcStyles} from '../src/styles/ba-qc-styles.ts';
import {installProjectDefaults} from '../src/projects/project-defaults.ts';
import {seedGlobalStyles} from '../src/styles/global-style-seed.ts';

test('solution architecture is selected for fresh and previously seeded new-project defaults', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-defaults-sa-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    seedGlobalStyles(db);
    const architecture = db.list({limit: 300}).find((r) => r.keyId === 'solution-architecture')!;
    const existing = db.saveProject({name: 'Existing', description: '', assignments: []});
    assert.ok(db.projectDefaultStyleIds().includes(architecture.id));
    const legacyIds = db.projectDefaultStyleIds().filter((id) => id !== architecture.id);
    db.db
      .prepare("UPDATE meta SET value=? WHERE key='new_project_style_defaults_v1'")
      .run(JSON.stringify(legacyIds));
    const ids = db.projectDefaultStyleIds();
    assert.deepEqual(ids, [...legacyIds, architecture.id]);
    assert.deepEqual(db.summary().projectDefaultStyleIds, ids);
    assert.deepEqual(db.projectDefaultStyleIds(), ids);
    assert.deepEqual(db.project(existing.id).assignments, []);
    assert.equal(db.project(existing.id).version, 1);
    db.update(architecture.id, {...architecture, status: 'archived'}, architecture.version);
    assert.deepEqual(db.projectDefaultStyleIds(), legacyIds);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('new project starter set is complete and does not mutate existing selections', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-defaults-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    const p = db.saveProject({name: 'Existing', description: '', assignments: []});
    installBaQcStyles(db);
    installProjectDefaults(db);
    const ids = db.projectDefaultStyleIds();
    assert.equal(ids.length, 5);
    for (const id of ids) {
      const r = db.get(id)!;
      assert.equal(r.status, 'active');
      assert.ok(r.principles?.length);
      assert.ok(r.examples?.length);
      assert.ok(r.reviewCriteria?.length);
    }
    assert.equal(db.project(p.id).assignments.length, 0);
    assert.equal(db.project(p.id).version, 1);
    installProjectDefaults(db);
    assert.deepEqual(db.projectDefaultStyleIds(), ids);
    const r = db.get(ids[0])!;
    db.update(r.id, {...r, status: 'archived'}, r.version);
    assert.equal(db.projectDefaultStyleIds().length, 4);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test("templates: Starter keeps today's list, styles toggle one per slot, custom templates CRUD", () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-defaults-toggle-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    seedGlobalStyles(db);
    const architecture = db.list({limit: 300}).find((r) => r.keyId === 'solution-architecture')!;
    db.saveDomain('Test cap');
    const make = (title: string, extra: Record<string, unknown> = {}) =>
      db.create({
        kind: 'preference',
        domain: 'test-cap',
        title,
        summary: 's',
        content: 'c',
        status: 'active',
        priority: 50,
        tags: ['t'],
        requiredIds: [],
        checks: [],
        backend: null,
        ...extra,
      });
    const a = make('Writing A'),
      b = make('Writing B');
    db.setTemplateStyle('starter', a.id, true);
    assert.ok(db.projectDefaultStyleIds().includes(a.id));
    // Same slot: B replaces A.
    assert.deepEqual(db.setTemplateStyle('starter', b.id, true).replaced, [a.id]);
    assert.ok(!db.projectDefaultStyleIds().includes(a.id));
    assert.ok(db.projectDefaultStyleIds().includes(b.id));
    // Turning off the auto-added architecture default sticks.
    db.setTemplateStyle('starter', architecture.id, false);
    assert.ok(!db.projectDefaultStyleIds().includes(architecture.id));
    const draft = make('Draft', {status: 'draft'});
    assert.throws(() => db.setTemplateStyle('starter', draft.id, true), /Only active/);
    const p = db.saveProject({name: 'P', description: '', assignments: []});
    const own = db.createProjectStyle(
      p.id,
      {title: 'Own', domain: 'test-cap', summary: 's', content: 'c'},
      p.version,
    );
    assert.throws(
      () => db.setTemplateStyle('starter', own.record.id, true),
      /Shared style not found/,
    );
    assert.throws(() => db.setTemplateStyle('starter', b.id, 'yes'), /true or false/);
    // Custom templates start from a list, can be renamed and deleted; Starter cannot be deleted.
    const t = db.saveProjectTemplate({name: 'Docs only', styleIds: [b.id, a.id, 'missing']});
    assert.deepEqual(t.styleIds, [b.id], 'unknown and same-slot styles are dropped');
    assert.throws(() => db.saveProjectTemplate({name: 'docs ONLY'}), /already exists/);
    assert.throws(() => db.saveProjectTemplate({name: ' '}), /1–80/);
    assert.equal(db.saveProjectTemplate({name: 'Docs'}, t.id).styleIds[0], b.id);
    // Starter first, then the seeded templates and custom ones by name.
    assert.deepEqual(
      db.projectTemplates().map((x) => x.name),
      [
        'Starter',
        'Analysis & design only',
        'Build & verify — development from agreed design',
        'Docs',
        'Full delivery — analysis to release',
        'Research & proof of concept',
      ],
    );
    assert.throws(() => db.deleteProjectTemplate('starter'), /cannot be deleted/);
    db.deleteProjectTemplate(t.id);
    assert.throws(() => db.projectTemplate(t.id), /not found/);
    assert.deepEqual(db.summary().projectTemplates[0].styleIds, db.projectDefaultStyleIds());
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

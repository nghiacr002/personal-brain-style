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

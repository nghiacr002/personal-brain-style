import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {installPersonalBrainStyles} from '../src/styles/personal-brain-styles.ts';

test('Personal Brain receives three assigned styles once without changing other projects or later edits', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-personal-styles-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    const other = db.saveProject({name: 'Another project', description: '', assignments: []});
    assert.equal(installPersonalBrainStyles(db), 0);
    const p = {...other, id: 'b3937377-32ad-43a8-9adc-c21d06a9b4a4', name: 'Personal Brain'};
    db.db.prepare('INSERT INTO projects(id,snapshot) VALUES(?,?)').run(p.id, JSON.stringify(p));
    assert.equal(installPersonalBrainStyles(db), 3);
    const selected = db.scopedRecords(p.id);
    assert.deepEqual(selected.map((r) => r.domain).sort(), ['coding', 'design', 'technology']);
    assert.ok(selected.every((r) => r.source === 'Project selection' && r.status === 'active'));
    assert.deepEqual(db.project(other.id), other);
    const record = selected[0];
    db.update(record.id, {...record, content: 'My revised instructions'}, record.version);
    const version = db.project(p.id).version;
    assert.equal(installPersonalBrainStyles(db), 0);
    assert.equal(db.project(p.id).version, version);
    assert.equal(db.get(record.id)?.content, 'My revised instructions');
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('legacy project styles become private without losing IDs, history or selections', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-private-legacy-')),
    db = new BrainDB(join(dir, 'db'));
  try {
    const p = db.saveProject({name: 'Personal Brain', description: '', assignments: []});
    const r = db.create({
      kind: 'preference',
      domain: 'coding',
      title: 'Project code',
      summary: '',
      content: 'Keep my edits',
      tags: ['personal-brain-project-coding'],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
    });
    db.saveProject(
      {...p, assignments: [{recordId: r.id, override: 'Keep override'}]},
      p.id,
      p.version,
    );
    const legacy = db.create({
      kind: 'preference',
      domain: 'coding',
      title: 'Older global record',
      summary: '',
      content: 'Legacy',
      tags: [],
      priority: 1,
      status: 'active',
      checks: [],
      backend: null,
    });
    const snapshot = {...legacy};
    delete snapshot.requiredIds;
    db.db
      .prepare('UPDATE records SET snapshot=? WHERE id=?')
      .run(JSON.stringify(snapshot), legacy.id);
    assert.equal(db.privatizeLegacyProjectStyles(p.id), 1);
    assert.ok(!db.list().some((x) => x.id === r.id));
    assert.equal(db.get(r.id)!.projectId, p.id);
    assert.equal(db.history(r.id).length, 2);
    assert.equal(db.scopedRecords(p.id)[0].content, 'Keep override');
    assert.equal(db.privatizeLegacyProjectStyles(p.id), 0);
    db.restore(r.id, 1, 2);
    assert.equal(db.get(r.id)!.projectId, p.id);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('legacy scope migration preserves styles consumed by another project', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-shared-legacy-')),
    db = new BrainDB(join(dir, 'db'));
  try {
    const p = db.saveProject({name: 'Personal Brain', description: '', assignments: []});
    const r = db.create({
      kind: 'preference',
      domain: 'coding',
      title: 'Shared code',
      summary: '',
      content: 'Shared instructions',
      tags: ['personal-brain-project-coding'],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
    });
    db.saveProject({
      name: 'Other project',
      description: '',
      assignments: [{recordId: r.id, override: null}],
    });
    assert.equal(db.privatizeLegacyProjectStyles(p.id), 0);
    assert.equal(db.get(r.id)!.projectId, undefined);
    assert.equal(db.get(r.id)!.version, 1);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

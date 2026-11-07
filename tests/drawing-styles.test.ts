import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {installDrawingStyles, upgradeVisualDrawing} from '../src/styles/drawing-styles.ts';

test('drawing formats share standards, remain discoverable, and preserve edits and project selections', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-drawing-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    const project = db.saveProject({name: 'Existing', description: '', assignments: []});
    assert.equal(installDrawingStyles(db), 3);
    const records = db.list();
    assert.equal(records.length, 3);
    const common = records.find((r) => r.domain === 'diagrams')!;
    for (const format of ['drawio', 'mermaid']) {
      const style = records.find((r) => r.domain === format)!;
      assert.equal(style.status, 'active');
      assert.equal(style.projectId, undefined);
      assert.deepEqual(style.requiredIds, [common.id]);
      assert.equal(style.externalSkills!.length, 1);
      assert.ok(style.useWhen);
      assert.ok(style.examples!.length);
      assert.ok(style.reviewCriteria!.length);
      assert.ok(db.discover(format + ' ERD').some((r) => r.id === style.id));
      assert.deepEqual(
        db.requiredRecords([style]).map((r) => r.id),
        [common.id, style.id],
      );
    }
    assert.deepEqual(db.project(project.id).assignments, []);
    db.update(common.id, {content: 'My customized standard'}, common.version);
    assert.equal(installDrawingStyles(db), 0);
    assert.equal(db.get(common.id)!.content, 'My customized standard');
    const preview = db.deletionPreview('record', common.id);
    db.deleteWithPreview('record', common.id, preview.fingerprint);
    assert.equal(installDrawingStyles(db), 0);
    assert.equal(db.get(common.id), null);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('visual drawing amendment preserves private copies, dependencies and later edits', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-visual-drawing-')),
    db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    installDrawingStyles(db);
    const shared = db.list().find((r) => r.domain === 'drawio')!;
    const p = db.saveProject({
      name: 'Private',
      description: '',
      assignments: [{recordId: shared.id, override: null}],
    });
    const local = db.personalizeRecord(
      p.id,
      shared.id,
      {content: 'Private diagram conventions'},
      shared.version,
      p.version,
    );
    const assignments = db.project(p.id).assignments;
    assert.equal(upgradeVisualDrawing(db), 3);
    const updated = db.get(shared.id)!;
    assert.ok(updated.content.startsWith(shared.content));
    assert.match(updated.content, /VISUAL ARCHITECTURE COMPOSITION/);
    assert.deepEqual(updated.requiredIds, shared.requiredIds);
    assert.deepEqual(updated.externalSkills, shared.externalSkills);
    assert.equal(updated.version, shared.version + 1);
    assert.equal(db.get(local.id)!.content, 'Private diagram conventions');
    assert.deepEqual(db.project(p.id).assignments, assignments);
    db.update(updated.id, {content: updated.content + '\nLater personal edit'}, updated.version);
    assert.equal(upgradeVisualDrawing(db), 0);
    assert.ok(db.get(updated.id)!.content.endsWith('Later personal edit'));
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

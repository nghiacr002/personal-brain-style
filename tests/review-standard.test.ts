import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {installReviewStandard} from '../src/styles/review-standard.ts';

test('restores Review, selects standard and required rules, and respects later deletion', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-review-')),
    db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    const preview = db.deletionPreview('domain', 'reviews');
    db.deleteWithPreview('domain', 'reviews', preview.fingerprint);
    const a = db.saveProject({name: 'A', description: '', assignments: []});
    const b = db.saveProject({name: 'B', description: '', assignments: []});
    assert.equal(installReviewStandard(db), 2);
    assert.equal(db.domains().find((d) => d.id === 'reviews')!.name, 'Review');
    const style = db.list().find((r) => r.tags.includes('shared-review-standard'))!;
    assert.equal(style.requiredIds.length, 1);
    assert.ok(style.examples!.length);
    assert.ok(style.externalSkills!.length);
    assert.match(db.get(style.requiredIds[0])!.content, /correctness, security/);
    assert.match(db.get(style.requiredIds[0])!.content, /workflows and artifact/);
    for (const project of [a, b]) {
      const effective = db.scopedRecords(project.id);
      assert.ok(effective.some((r) => r.id === style.id));
      for (const id of style.requiredIds) {
        assert.ok(effective.some((r) => r.id === id));
      }
    }
    assert.equal(installReviewStandard(db), 0);
    const removal = db.deletionPreview('domain', 'reviews');
    db.deleteWithPreview('domain', 'reviews', removal.fingerprint);
    assert.equal(installReviewStandard(db), 0);
    assert.equal(db.hasDomain('reviews'), false);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

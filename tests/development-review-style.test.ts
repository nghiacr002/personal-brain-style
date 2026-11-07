import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {requireDevelopmentReview} from '../src/styles/development-review-style.ts';
test('review gate extends relevant styles once without changing scope', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-review-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    const r = db.create({
      kind: 'preference',
      domain: 'coding',
      title: 'Coding',
      summary: 'Code',
      content: 'Existing rules',
      tags: ['personal-brain-project-coding'],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
    });
    const p = db.saveProject({
      name: 'Code',
      description: '',
      assignments: [{recordId: r.id, override: null}],
    });
    assert.equal(requireDevelopmentReview(db), 1);
    assert.equal(requireDevelopmentReview(db), 0);
    const updated = db.scopedRecords(p.id)[0];
    assert.equal(updated.version, 2);
    assert.ok(updated.content.startsWith('Existing rules'));
    assert.match(updated.content, /During implementation/);
    assert.match(updated.content, /Before completion/);
    assert.ok(updated.externalSkills?.some((s) => s.includes('ponytail-review')));
    assert.equal(updated.reviewCriteria?.length, 5);
    assert.equal(db.project(p.id).version, 1);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

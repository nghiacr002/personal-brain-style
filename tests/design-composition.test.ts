import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {upgradeDesignComposition} from '../src/styles/personal-brain-styles.ts';
test('composition rules extend the existing style once and preserve assignments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-design-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    assert.equal(upgradeDesignComposition(db), 0);
    const style = db.create({
      kind: 'preference',
      domain: 'design',
      title: 'My UI',
      summary: 'Mine',
      content: 'Keep my instructions',
      tags: ['personal-brain-project-design'],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
      principles: ['Existing principle'],
      reviewCriteria: ['Existing review'],
    });
    const project = db.saveProject({
      name: 'UI',
      description: '',
      assignments: [{recordId: style.id, override: null}],
    });
    assert.equal(upgradeDesignComposition(db), 1);
    const updated = db.get(style.id)!;
    assert.ok(updated.content.startsWith(style.content));
    assert.equal(updated.version, 2);
    assert.equal(updated.principles!.length, 11);
    assert.equal(updated.reviewCriteria!.length, 7);
    assert.match(updated.content, /BEFORE IMPLEMENTATION/);
    assert.match(updated.content, /Search and filtering should be immediate/);
    assert.equal(db.scopedRecords(project.id)[0].version, 2);
    assert.equal(upgradeDesignComposition(db), 0);
    assert.equal(db.get(style.id)!.version, 2);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

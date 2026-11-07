import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {installResearchStyle} from '../src/styles/research-style.ts';
import {installDevelopmentStructureStyle} from '../src/styles/development-structure-style.ts';

test('development structure is a reusable global style and preserves user choices', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-structure-')),
    db = new BrainDB(join(dir, 'db'));
  try {
    installResearchStyle(db);
    const project = db.saveProject({name: 'Existing project', description: '', assignments: []});
    assert.equal(installDevelopmentStructureStyle(db), 1);
    const style = db.list().find((r) => r.tags.includes('shared-development-structure'))!;
    assert.equal(
      style.title,
      'Development structure — frontend and backend boundaries for typescript',
    );
    assert.equal(style.projectId, undefined);
    assert.equal(style.domain, 'development-structure');
    assert.equal(db.get(style.requiredIds![0])!.domain, 'research');
    assert.match(style.content, /FRONTEND/);
    assert.match(style.content, /BACKEND/);
    assert.equal(style.examples!.length, 4);
    assert.deepEqual(db.project(project.id), project);
    db.update(
      style.id,
      {
        title: 'Development structure — frontend and backend boundaries',
        content: 'User customization',
      },
      style.version,
    );
    db.db.prepare('DELETE FROM meta WHERE key=?').run('development_structure_typescript_title_v1');
    assert.equal(installDevelopmentStructureStyle(db), 0);
    assert.equal(
      db.get(style.id)!.title,
      'Development structure — frontend and backend boundaries for typescript',
    );
    assert.equal(db.get(style.id)!.content, 'User customization');
    const preview = db.deletionPreview('record', style.id);
    db.deleteWithPreview('record', style.id, preview.fingerprint);
    assert.equal(installDevelopmentStructureStyle(db), 0);
    assert.equal(db.get(style.id), null);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

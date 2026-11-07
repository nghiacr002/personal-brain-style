import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {callTool, tools} from '../src/agents/mcp.ts';
test('MCP creates and selects private styles atomically with duplicate and scope protection', async () => {
  const root = mkdtempSync(join(tmpdir(), 'brain-create-')),
    db = new BrainDB(join(root, 'brain.sqlite'));
  try {
    const p = db.saveProject({name: 'One', description: '', assignments: []});
    const other = db.saveProject({name: 'Two', description: '', assignments: []});
    const style = {
      domain: 'design',
      title: 'UI rules',
      summary: 'Project UI',
      content: 'Use existing components',
    };
    const args = {projectId: p.id, expectedProjectVersion: p.version, style};
    assert.ok(tools().some((t) => t.name === 'brain_create_project_style'));
    const result = await callTool(db, 'brain_create_project_style', args);
    assert.ok(!('isError' in result));
    const payload = JSON.parse(result.content[0].text);
    assert.equal(payload.record.projectId, p.id);
    assert.equal(payload.selected, true);
    assert.equal(db.scopedRecords(p.id)[0].id, payload.record.id);
    assert.equal(db.list().length, 0);
    assert.equal(db.scopedRecords(other.id).length, 0);
    const count = db.list({projectId: p.id}).length;
    for (const input of [
      args,
      {
        ...args,
        expectedProjectVersion: payload.projectVersion,
        style: {...style, title: 'Other UI'},
      },
      {
        ...args,
        expectedProjectVersion: payload.projectVersion,
        style: {...style, projectId: other.id},
      },
    ]) {
      assert.equal((await callTool(db, 'brain_create_project_style', input)).isError, true);
      assert.equal(db.list({projectId: p.id}).length, count);
    }
    const alternative = await callTool(db, 'brain_create_project_style', {
      ...args,
      expectedProjectVersion: payload.projectVersion,
      select: false,
      style: {...style, title: 'Alternative UI'},
    });
    assert.ok(!('isError' in alternative));
    assert.equal(db.scopedRecords(p.id).length, 1);
  } finally {
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
});

test('legacy privatization distinguishes the old original without deleting either history', () => {
  const root = mkdtempSync(join(tmpdir(), 'brain-legacy-')),
    db = new BrainDB(join(root, 'brain.sqlite'));
  try {
    const p = db.saveProject({name: 'Project', description: '', assignments: []});
    const input = {
      kind: 'preference',
      domain: 'design',
      title: 'UI/UX preferences',
      summary: 'UI',
      content: 'Original rules',
      tags: ['personal-brain-project-design'],
      priority: 90,
      status: 'active',
      requiredIds: [],
      checks: [],
      backend: null,
    };
    const old = db.create(input),
      local = db.create({...input, projectId: p.id, keyId: 'project-ui', content: 'Project rules'});
    db.saveProject({...p, assignments: [{recordId: local.id, override: null}]}, p.id, p.version);
    db.privatizeLegacyProjectStyles(p.id);
    assert.equal(db.get(old.id)!.title, 'UI/UX preferences (legacy copy)');
    assert.equal(db.get(old.id)!.content, 'Original rules');
    assert.equal(db.get(local.id)!.title, 'UI/UX preferences');
    assert.equal(db.scopedRecords(p.id)[0].id, local.id);
    const version = db.get(old.id)!.version;
    db.privatizeLegacyProjectStyles(p.id);
    assert.equal(db.get(old.id)!.version, version);
  } finally {
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
});

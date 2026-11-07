import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {callTool} from '../src/agents/mcp.ts';
import {complianceInstructions, instructionRecovery} from '../src/instructions/compliance.ts';

test('prepared instructions bind review to task, project, effective overrides and dependency versions', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-instructions-')),
    db = new BrainDB(join(dir, 'db'));
  const record = (title: string, domain = 'coding') =>
    db.create({
      kind: 'preference',
      domain,
      title,
      content: title,
      summary: title,
      tags: [],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
      reviewCriteria: ['Inspect actual output'],
    });
  try {
    const dependency = record('Review', 'reviews'),
      style = record('Code');
    db.update(style.id, {requiredIds: [dependency.id]}, style.version);
    const project = db.saveProject({
      name: 'A',
      description: '',
      assignments: [{recordId: style.id, override: 'Project instructions'}],
    });
    const other = db.saveProject({name: 'B', description: '', assignments: []});
    const prepared = await callTool(db, 'brain_prepare', {
      projectId: project.id,
      task: 'Implement a change',
      recordIds: [style.id],
    });
    assert.ok(!('isError' in prepared));
    const set = JSON.parse(prepared.content[0].text);
    assert.equal(set.records.length, 2);
    assert.equal(
      set.records.find((r: {id: string}) => r.id === style.id).content,
      'Project instructions',
    );
    const args = {projectId: project.id, instructionSetId: set.instructionSetId};
    const review = await callTool(db, 'brain_review', args);
    assert.ok(!('isError' in review));
    assert.equal(JSON.parse(review.content[0].text).status, 'not_verified');
    assert.equal(
      (await callTool(db, 'brain_review', {...args, projectId: other.id})).isError,
      true,
    );
    assert.equal(
      (await callTool(db, 'brain_review', {...args, recordIds: [dependency.id]})).isError,
      true,
    );
    db.update(dependency.id, {content: 'New requirement'}, dependency.version);
    const stale = await callTool(db, 'brain_review', args);
    assert.equal(stale.isError, true);
    assert.match(stale.content[0].text, /changed/);
    const fresh = JSON.parse(
      (
        await callTool(db, 'brain_prepare', {
          projectId: project.id,
          task: 'Implement a change',
          recordIds: [style.id],
        })
      ).content[0].text,
    );
    db.saveProject(
      {...project, assignments: [{recordId: style.id, override: 'Different override'}]},
      project.id,
      project.version,
    );
    assert.equal(
      (
        await callTool(db, 'brain_review', {
          ...args,
          instructionSetId: fresh.instructionSetId,
        })
      ).isError,
      true,
    );
    const preview = db.deletionPreview('record', dependency.id);
    db.deleteWithPreview('record', dependency.id, preview.fingerprint);
    assert.equal(
      db.db.prepare("SELECT count(*) n FROM meta WHERE key LIKE 'instruction-set:%'").get()!.n,
      0,
    );
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('REC-01 unavailable IDs identify project and give bounded recovery without changing selections', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-recovery-'));
  const db = new BrainDB(join(dir, 'db'));
  try {
    const style = db.create({
      kind: 'preference',
      domain: 'coding',
      title: 'Code',
      summary: 'Code',
      content: 'Code',
      tags: [],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
    });
    const project = db.saveProject({
      name: 'Recovery',
      description: '',
      assignments: [{recordId: style.id, override: null}],
    });
    const args = {projectId: project.id, task: 'Code', recordIds: ['stale-record-id']};
    for (const tool of ['brain_prepare', 'brain_resolve']) {
      const result = await callTool(db, tool, args);
      assert.equal(result.isError, true);
      const message = result.content[0].text;
      assert.ok(message.includes('stale-record-id'));
      assert.ok(message.includes(project.id));
      assert.ok(message.includes(instructionRecovery));
    }
    assert.match(instructionRecovery, /at most two recovery retries per task/);
    assert.match(instructionRecovery, /stop retrying and continue the user task/);
    assert.match(instructionRecovery, /same project scope/);
    assert.match(instructionRecovery, /Not verified/);
    assert.ok(complianceInstructions.includes(instructionRecovery));
    assert.deepEqual(db.project(project.id), project);
    assert.equal(
      db.db.prepare("SELECT count(*) n FROM meta WHERE key LIKE 'instruction-set:%'").get()!.n,
      0,
    );

    const discovery = await callTool(db, 'brain_discover', {projectId: project.id, task: 'Code'});
    const matches = JSON.parse(discovery.content[0].text);
    const recovered = await callTool(db, 'brain_prepare', {
      ...args,
      recordIds: matches.map((r: {id: string}) => r.id),
    });
    assert.ok(!('isError' in recovered));
    assert.ok(JSON.parse(recovered.content[0].text).instructionSetId);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

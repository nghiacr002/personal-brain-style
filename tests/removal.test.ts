import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {createBrainHttpServer} from '../src/server/http.ts';
const input = (title: string, domain = 'writing') => ({
  kind: 'preference',
  domain,
  title,
  summary: '',
  content: 'Instructions',
  tags: [],
  priority: 70,
  status: 'active',
  checks: [],
  backend: null,
});
test('capability deletion cascades owned records and history, unlinks survivors and remains deleted after reopening', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-delete-')),
    file = join(dir, 'brain.sqlite');
  let db = new BrainDB(file);
  try {
    const r = db.create(input('Writing')),
      other = db.create({...input('Coding', 'coding'), requiredIds: [r.id]});
    const p = db.saveProject({
      name: 'Project',
      description: '',
      assignments: [
        {recordId: r.id, override: null},
        {recordId: other.id, override: null},
      ],
    });
    db.addFeedback({recordId: r.id, rating: 'accepted', note: 'Good'});
    db.trace({
      agent: 'codex',
      channel: 'mcp',
      eventType: 'test',
      recordIds: [r.id],
      metadata: {projectId: p.id},
    });
    const preview = db.deletionPreview('domain', 'writing');
    assert.equal(preview.records.length, 1);
    assert.equal(preview.linkedRecords.length, 1);
    db.update(other.id, {...other, summary: 'Changed'}, 1);
    assert.throws(
      () => db.deleteWithPreview('domain', 'writing', preview.fingerprint),
      /Data changed/,
    );
    assert.ok(db.get(r.id));
    db.deleteWithPreview('domain', 'writing', db.deletionPreview('domain', 'writing').fingerprint);
    assert.equal(db.get(r.id), null);
    assert.deepEqual(db.get(other.id)?.requiredIds, []);
    assert.equal(db.project(p.id).assignments.length, 1);
    assert.equal(db.scopedRecords(p.id).length, 1);
    assert.equal(
      (db.db.prepare('SELECT COUNT(*) n FROM revisions WHERE record_id=?').get(r.id) as {n: number})
        .n,
      0,
    );
    assert.equal(db.listFeedback().length, 0);
    assert.equal(db.listTrace({}).length, 0);
    db.close();
    db = new BrainDB(file);
    assert.equal(db.hasDomain('writing'), false);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});
test('reset restores pre-customization shared selections, clears overrides and removes all private records', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-reset-')),
    db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    const r = db.create(input('Shared')),
      parent = db.create({...input('Parent', 'coding'), requiredIds: [r.id]});
    const p = db.saveProject({
      name: 'Project',
      description: '',
      assignments: [{recordId: parent.id, override: null}],
    });
    const local = db.personalizeRecord(p.id, r.id, {content: 'Custom'}, 1, p.version);
    const unselected = db.create({...input('Unselected'), projectId: p.id, status: 'draft'});
    const preview = db.deletionPreview('reset', p.id);
    assert.equal(preview.records.length, 3);
    assert.equal(preview.restored[0].recordId, parent.id);
    db.deleteWithPreview('reset', p.id, preview.fingerprint);
    assert.equal(db.get(local.id), null);
    assert.equal(db.get(unselected.id), null);
    assert.deepEqual(db.project(p.id).assignments, [{recordId: parent.id, override: null}]);
    assert.equal(db.scopedRecords(p.id).length, 2);
    assert.equal(db.get(r.id)?.content, 'Instructions');
    assert.ok(db.db.prepare('SELECT 1 FROM meta WHERE key=?').get('discovery-paused:' + p.id));
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});
test('project deletion preserves shared records and other projects, removes private history and project traces', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-project-delete-')),
    db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    const shared = db.create(input('Shared'));
    const p = db.saveProject({name: 'Delete', description: '', assignments: []}),
      q = db.saveProject({
        name: 'Keep',
        description: '',
        assignments: [{recordId: shared.id, override: null}],
      });
    const privateRecord = db.create({...input('Private'), projectId: p.id});
    db.trace({agent: 'codex', channel: 'hook', eventType: 'session', metadata: {projectId: p.id}});
    db.deleteWithPreview('project', p.id, db.deletionPreview('project', p.id).fingerprint);
    assert.equal(db.get(privateRecord.id), null);
    assert.ok(db.get(shared.id));
    assert.equal(db.project(q.id).assignments.length, 1);
    assert.throws(() => db.project(p.id), /not found/);
    assert.equal(db.listTrace({}).length, 0);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});
test('removal API requires a fresh preview and context token estimate excludes demo and failed hooks', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-remove-api-')),
    db = new BrainDB(join(dir, 'brain.sqlite')),
    server = createBrainHttpServer(db);
  const request = (url: string, method = 'GET', payload?: unknown) =>
    new Promise<{status: number; data: any}>((resolve) => {
      let status = 0;
      server.emit(
        'request',
        {
          url,
          method,
          headers: {},
          async *[Symbol.asyncIterator]() {
            if (payload) {
              yield JSON.stringify(payload);
            }
          },
        },
        {
          setHeader() {},
          writeHead(n: number) {
            status = n;
          },
          end(t: string) {
            resolve({status, data: JSON.parse(t)});
          },
        },
      );
    });
  try {
    const r = db.create(input('Delete via API', 'foundations'));
    const url = '/api/removal/record/' + r.id;
    assert.equal((await request(url, 'POST', {})).status, 409);
    const preview = await request(url);
    assert.equal((await request(url, 'POST', {fingerprint: preview.data.fingerprint})).status, 200);
    assert.equal(db.get(r.id), null);
    db.trace({
      agent: 'codex',
      channel: 'hook',
      eventType: 'hook.session.context',
      outcome: 'emitted',
      metadata: {contextChars: 1001},
    });
    db.trace({
      agent: 'codex',
      channel: 'hook',
      eventType: 'hook.session.context',
      outcome: 'error',
      metadata: {contextChars: 9000},
    });
    db.trace({
      agent: 'codex',
      channel: 'hook',
      eventType: 'hook.session.context',
      outcome: 'emitted',
      metadata: {contextChars: 9000},
      demo: true,
    });
    assert.equal(db.traceStats().estimatedContextTokens, 251);
    assert.match(db.traceStats().tokenUsageNote, /Not model input/);
  } finally {
    server.close();
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

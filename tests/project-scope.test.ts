import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {resolveProjectScope, linkRepository} from '../src/projects/project-scope.ts';
import {BrainDB} from '../src/core/database.ts';
import {callTool} from '../src/agents/mcp.ts';

test('repository scope honors precedence, nearest file and invalid-file errors without overwriting links', () => {
  const root = mkdtempSync(join(tmpdir(), 'pb-repository-'));
  const child = join(root, 'nested');
  mkdirSync(child);
  try {
    assert.equal(resolveProjectScope(undefined, root, '').projectId, undefined);
    linkRepository(root, 'parent');
    assert.equal(resolveProjectScope(undefined, child, '').projectId, 'parent');
    linkRepository(child, 'child');
    assert.equal(resolveProjectScope(undefined, child, '').projectId, 'child');
    assert.equal(resolveProjectScope('explicit', child, 'environment').projectId, 'explicit');
    assert.equal(resolveProjectScope(undefined, child, 'environment').projectId, 'environment');
    assert.throws(() => linkRepository(child, 'different'), /already linked/);
    assert.equal(
      JSON.parse(readFileSync(join(child, '.personal-brain.json'), 'utf8')).projectId,
      'child',
    );
    writeFileSync(join(child, '.personal-brain.json'), 'bad JSON');
    assert.throws(() => resolveProjectScope(undefined, child, ''), /Invalid repository/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('MCP and real hooks detect repository project and omit unrelated defaults', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pb-repository-agent-'));
  const db = new BrainDB(join(root, 'brain.sqlite'));
  try {
    const style = db.create({
      kind: 'preference',
      domain: 'coding',
      title: 'Project coding',
      summary: 'Code',
      content: 'Use scoped coding',
      tags: [],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
    });
    const p = db.saveProject({
      name: 'Repo',
      description: '',
      assignments: [{recordId: style.id, override: null}],
    });
    linkRepository(root, p.id);
    const result = await callTool(db, 'brain_get', {id: style.id, cwd: root});
    assert.match(result.content[0].text, /Use scoped coding/);
    const runner = resolve('scripts/run.mjs'),
      entry = resolve('src/cli.ts');
    const hook = spawnSync(process.execPath, [runner, entry, 'hook', 'codex', 'session'], {
      cwd: root,
      env: {...process.env, PB_HOME: root, PB_PROJECT_ID: ''},
      input: JSON.stringify({cwd: root, thread_id: 'actual-thread'}),
      encoding: 'utf8',
    });
    assert.equal(hook.status, 0);
    assert.match(hook.stdout, /Project coding/);
    assert.doesNotMatch(hook.stdout, /Use scoped coding/);
    assert.match(hook.stdout, /brain_get/);
    assert.ok(hook.stdout.includes(p.id));
    assert.equal(db.projectActivity(p.id).linked, 1);
    writeFileSync(join(root, '.personal-brain.json'), JSON.stringify({projectId: 'missing'}));
    assert.equal((await callTool(db, 'brain_bootstrap', {cwd: root})).isError, true);
  } finally {
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
});

test('repository HTTP actions link safely and verify the selected project', async () => {
  const {createBrainHttpServer} = await import('../src/server/http.ts');
  const root = mkdtempSync(join(tmpdir(), 'pb-repository-api-'));
  const db = new BrainDB(join(root, 'brain.sqlite'));
  const server = createBrainHttpServer(db);
  const request = (id: string, payload: unknown, method = 'POST') =>
    new Promise<{status: number; data: any}>((resolve) => {
      let status = 0;
      server.emit(
        'request',
        {
          url: `/api/projects/${id}/repository`,
          method,
          headers: {},
          async *[Symbol.asyncIterator]() {
            yield JSON.stringify(payload);
          },
        },
        {
          setHeader() {},
          writeHead(n: number) {
            status = n;
          },
          end(text: string) {
            resolve({status, data: JSON.parse(text)});
          },
        },
      );
    });
  try {
    const p = db.saveProject({name: 'Repo', description: '', assignments: []});
    assert.equal((await request(p.id, {folder: root, action: 'test'})).data.matches, false);
    assert.equal((await request(p.id, {folder: root, action: 'link'})).status, 200);
    assert.equal((await request(p.id, {folder: root, action: 'test'})).data.matches, true);
    const state = await request(p.id, {}, 'GET');
    assert.equal(state.data.linked, true);
    assert.equal(state.data.folder, root);
    const q = db.saveProject({name: 'Other', description: '', assignments: []});
    assert.equal((await request(q.id, {folder: root, action: 'link'})).status, 409);
  } finally {
    server.close();
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn, spawnSync, type ChildProcess} from 'node:child_process';
import {mkdtempSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {seed} from '../src/styles/seed.ts';

const app = resolve('src/cli.ts');
const runner = resolve('scripts/run.mjs');

// Test view of JSON-RPC responses: each call reads only the fields its method returns.
type RpcResponse = {
  id: number;
  error: {code: number};
  result: {
    serverInfo: {name: string; version: string};
    protocolVersion: string;
    tools: Array<{name: string; annotations: {readOnlyHint?: boolean}}>;
    content: Array<{text: string}>;
    contents: Array<{text: string}>;
    prompts: Array<{name: string}>;
    isError?: boolean;
  };
};
// Windows keeps the database locked until the server process exits, so wait before deleting.
async function stopServer(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.stdin?.end();
  const timer = setTimeout(() => child.kill(), 3000);
  await exited;
  clearTimeout(timer);
}

test(
  'TC-REL-001 MCP stdio initialization, discovery, resources and prompts',
  {timeout: 12000},
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pb-mcp-'));
    const db = new BrainDB(join(dir, 'brain.sqlite'));
    seed(db);
    db.close();
    const child = spawn(process.execPath, [runner, app, 'mcp'], {
      cwd: dir,
      env: {...process.env, PB_HOME: dir},
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let buffer = '';
    const waiter = new Map<number, (x: RpcResponse) => void>();
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, i);
        buffer = buffer.slice(i + 1);
        if (!line.trim()) {
          continue;
        }
        const msg = JSON.parse(line) as RpcResponse;
        waiter.get(msg.id)?.(msg);
        waiter.delete(msg.id);
      }
    });
    let id = 0;
    function call(method: string, params: Record<string, unknown> = {}) {
      const reqId = ++id;
      return new Promise<RpcResponse>((done, reject) => {
        const timeout = setTimeout(
          () => reject(new Error(`MCP response timeout ${method}: ${stderr}`)),
          5000,
        );
        waiter.set(reqId, (msg) => {
          clearTimeout(timeout);
          done(msg);
        });
        child.stdin.write(JSON.stringify({jsonrpc: '2.0', id: reqId, method, params}) + '\n');
      });
    }
    try {
      const init = await call('initialize', {
        protocolVersion: '2099-01-01',
        capabilities: {},
        clientInfo: {name: 'test', version: '0'},
      });
      assert.equal(init.result.serverInfo.name, 'personal-brain-style');
      assert.equal(
        init.result.serverInfo.version,
        JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version,
      );
      assert.equal(init.result.protocolVersion, '2025-11-25');
      assert.equal((await call('initialize', {protocolVersion: 42})).error.code, -32602);
      child.stdin.write(
        JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n',
      );
      const list = await call('tools/list');
      assert.ok(list.result.tools.some((t) => t.name === 'brain_discover'));
      const search = await call('tools/call', {
        name: 'brain_discover',
        arguments: {task: 'drawio architecture'},
      });
      const matching = JSON.parse(search.result.content[0].text);
      assert.ok(matching.some((x: {kind: string}) => x.kind === 'skill'));
      const resource = await call('resources/read', {uri: 'brain://style/baseline'});
      assert.match(resource.result.contents[0].text, /PERSONAL BRAIN STYLE BASELINE/);
      const prompts = await call('prompts/list');
      assert.equal(prompts.result.prompts[0].name, 'personalized_task');
      const missing = await call('tools/call', {name: 'brain_get', arguments: {id: 'missing'}});
      assert.equal(missing.result.isError, true);
    } finally {
      await stopServer(child);
      rmSync(dir, {recursive: true, force: true, maxRetries: 10, retryDelay: 100});
    }
  },
);

test('TC-REL-005 malformed JSON-RPC envelopes do not terminate the server', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-mcp-invalid-'));
  try {
    const input =
      ['{', 'null', '[]', '42', JSON.stringify({jsonrpc: '2.0', id: 1, method: 'ping'})].join(
        '\n',
      ) + '\n';
    const result = spawnSync(process.execPath, [runner, app, 'mcp'], {
      cwd: dir,
      env: {...process.env, PB_HOME: dir, PB_PROJECT_ID: ''},
      input,
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    const responses = result.stdout
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      responses.slice(0, 4).map((r) => r.error.code),
      [-32700, -32600, -32600, -32600],
    );
    assert.deepEqual(responses[4], {jsonrpc: '2.0', id: 1, result: {}});
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('ChatGPT MCP is read-only and pinned to its selected project', {timeout: 12000}, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-mcp-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  seed(db);
  const available = db.scopedRecords();
  const selected = available[0],
    foreign = available[1];
  const project = db.saveProject({
    name: 'Chat only',
    description: '',
    assignments: [{recordId: selected.id, override: null}],
  });
  db.close();
  const child = spawn(process.execPath, [runner, app, 'mcp', 'chatgpt', project.id], {
    cwd: dir,
    env: {...process.env, PB_HOME: dir},
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let buffer = '';
  const waiter = new Map<number, (x: RpcResponse) => void>();
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i);
      buffer = buffer.slice(i + 1);
      if (!line.trim()) {
        continue;
      }
      const msg = JSON.parse(line) as RpcResponse;
      waiter.get(msg.id)?.(msg);
      waiter.delete(msg.id);
    }
  });
  let id = 0;
  function call(method: string, params: Record<string, unknown> = {}) {
    const reqId = ++id;
    return new Promise<RpcResponse>((done, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`MCP response timeout ${method}: ${stderr}`)),
        5000,
      );
      waiter.set(reqId, (msg) => {
        clearTimeout(timeout);
        done(msg);
      });
      child.stdin.write(JSON.stringify({jsonrpc: '2.0', id: reqId, method, params}) + '\n');
    });
  }
  try {
    const init = await call('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: {name: 'test', version: '0'},
    });
    assert.equal(init.result.serverInfo.name, 'personal-brain-style');
    child.stdin.write(JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n');
    const list = await call('tools/list');
    assert.ok(list.result.tools.some((t) => t.name === 'brain_discover'));
    assert.deepEqual(
      list.result.tools.map((t) => t.name).sort(),
      ['brain_bootstrap', 'brain_discover', 'brain_get', 'brain_resolve', 'brain_style'].sort(),
    );
    assert.ok(list.result.tools.every((t) => t.annotations.readOnlyHint));
    const search = await call('tools/call', {
      name: 'brain_discover',
      arguments: {task: 'drawio architecture'},
    });
    assert.ok(
      JSON.parse(search.result.content[0].text).every((r: {id: string}) => r.id === selected.id),
    );
    const loaded = JSON.parse(
      (await call('tools/call', {name: 'brain_get', arguments: {id: selected.id}})).result
        .content[0].text,
    );
    assert.equal(loaded.id, selected.id);
    assert.equal(loaded.skillAvailability, undefined);
    assert.match(loaded.complianceInstructions, /READ-ONLY PREFERENCES/);
    assert.doesNotMatch(loaded.complianceInstructions, /Submit brain_review/);
    const resolved = JSON.parse(
      (
        await call('tools/call', {
          name: 'brain_resolve',
          arguments: {
            task: 'Work',
            recordIds: [selected.id],
            context: {activity: 'plan', formats: []},
          },
        })
      ).result.content[0].text,
    );
    assert.equal(resolved.projectId, project.id);
    assert.match(resolved.complianceInstructions, /READ-ONLY PREFERENCES/);
    assert.ok(
      (
        await call('tools/call', {
          name: 'brain_resolve',
          arguments: {projectId: 'other', task: 'Work', recordIds: [selected.id]},
        })
      ).error,
    );
    assert.equal(
      (await call('tools/call', {name: 'brain_get', arguments: {id: foreign.id}})).result.isError,
      true,
    );
    for (const name of [
      'brain_projects',
      'brain_update_project_style',
      'brain_get_installed_skill',
      'brain_call_tool',
    ]) {
      assert.ok((await call('tools/call', {name, arguments: {}})).error);
    }
    assert.ok(
      (await call('tools/call', {name: 'brain_bootstrap', arguments: {projectId: 'other'}})).error,
    );
    assert.ok((await call('tools/call', {name: 'brain_bootstrap', arguments: {cwd: dir}})).error);
    const missing = await call('tools/call', {name: 'brain_get', arguments: {id: 'missing'}});
    assert.equal(missing.result.isError, true);
    const resource = await call('resources/read', {uri: 'brain://style/baseline'});
    const check = new BrainDB(join(dir, 'brain.sqlite'));
    try {
      assert.equal(resource.result.contents[0].text, check.bootstrap(3500, project.id));
    } finally {
      check.close();
    }
  } finally {
    await stopServer(child);
    rmSync(dir, {recursive: true, force: true, maxRetries: 10, retryDelay: 100});
  }
});

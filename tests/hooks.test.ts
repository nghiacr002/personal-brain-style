import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {BrainDB} from '../src/core/database.ts';
import {seed} from '../src/styles/seed.ts';
import {simulateHook, taskContext} from '../src/agents/hooks.ts';
import {manageHookConfig} from '../src/agents/hook-install.ts';
import {pathToFileURL} from 'node:url';

type HookGroup = {hooks: Array<{statusMessage?: string; command?: string}>};

test('OpenCode V2 default definition registers MCP and injects typed session context', async () => {
  const home = mkdtempSync(join(tmpdir(), 'pb-opencode-v2-'));
  try {
    const entry = join(home, 'fake-cli.mjs');
    writeFileSync(
      entry,
      `let input='';for await(const chunk of process.stdin)input+=chunk;const data=JSON.parse(input);console.log(JSON.stringify({hookSpecificOutput:{additionalContext:process.argv.at(-1)+':'+data.session_id+':'+(data.prompt||'')}}));`,
    );
    manageHookConfig('install', 'opencode', {home, entry, node: process.execPath});
    const generated = join(home, 'plugin.mjs');
    writeFileSync(
      generated,
      readFileSync(join(home, '.config/opencode/plugins/personal-brain.js'), 'utf8'),
    );
    const plugin = (await import(pathToFileURL(generated).href)).default;
    assert.equal(plugin.id, 'personal-brain');
    assert.equal(typeof plugin.server, 'function');
    const handlers = new Map();
    const servers = new Map();
    const ctx = {
      location: {directory: home},
      mcp: {
        async transform(
          edit: (store: {
            get(key: string): unknown;
            set(key: string, value: unknown): unknown;
          }) => void,
        ) {
          edit({
            get: (key: string) => servers.get(key),
            set: (key: string, value: unknown) => servers.set(key, value),
          });
        },
      },
      session: {
        async hook(name: string, handler: unknown) {
          handlers.set(name, handler);
        },
      },
    };
    await plugin.setup(ctx);
    assert.deepEqual([...handlers.keys()], ['prompt', 'context']);
    assert.equal(servers.get('personal-brain').protocol, 'legacy');
    assert.equal(servers.get('personal-brain').cwd, home);
    assert.deepEqual(servers.get('personal-brain').command.slice(-2), ['mcp', 'opencode']);
    const event = {sessionID: 'one', prompt: {text: 'Research architecture'}};
    await handlers.get('prompt')(event);
    assert.equal(event.prompt.text, 'Research architecture');
    const output = {sessionID: 'one', system: []};
    await handlers.get('context')(output);
    assert.deepEqual(output.system, [
      {type: 'text', text: 'session:one:'},
      {type: 'text', text: 'prompt:one:Research architecture'},
    ]);
    const other = {sessionID: 'two', system: []};
    await handlers.get('context')(other);
    assert.deepEqual(other.system, []);
    servers.set('personal-brain', {disabled: true});
    await plugin.setup(ctx);
    assert.deepEqual(servers.get('personal-brain'), {disabled: true});
  } finally {
    rmSync(home, {recursive: true, force: true});
  }
});

test('SessionStart automatically injects personal baseline for Claude and Codex', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-auto-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    seed(db);
    for (const agent of ['claude', 'codex'] as const) {
      const data = JSON.parse(simulateHook(db, agent, 'session', {source: 'startup'}));
      assert.equal(data.hookSpecificOutput.hookEventName, 'SessionStart');
      assert.match(data.hookSpecificOutput.additionalContext, /PERSONAL BRAIN AUTO ACTIVATION/);
      assert.match(data.hookSpecificOutput.additionalContext, /PERSONAL BRAIN STYLE BASELINE/);
    }
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('UserPromptSubmit injects relevant drawing skill, not unrelated prompt', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-intent-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    seed(db);
    for (const agent of ['claude', 'codex'] as const) {
      const raw = simulateHook(db, agent, 'prompt', {
        prompt: 'Draw a system architecture diagram in draw.io',
      });
      const ctx = JSON.parse(raw).hookSpecificOutput.additionalContext as string;
      assert.match(ctx, /Create an editable system diagram/);
      assert.match(ctx, /Editable draw.io architecture style/);
      assert.doesNotMatch(ctx, /orthogonal connectors/);
      assert.match(ctx, /brain_get/);
      assert.equal(simulateHook(db, agent, 'prompt', {prompt: 'hello'}), '');
    }
    const reviews =
      taskContext(db, 'Review the business requirements and check acceptance criteria') || '';
    assert.match(reviews, /Independent design review|Review against explicit evidence/);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('hook installer preserves other settings, is idempotent, and removes only its own hooks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-hooks-config-'));
  const opts = {home: dir, node: '/tmp/node', entry: '/tmp/personal-brain/src/cli.ts'};
  const claude = join(dir, '.claude', 'settings.json');
  mkdirSync(join(dir, '.claude'), {recursive: true});
  const original = {
    permissions: {allow: ['Read']},
    hooks: {SessionStart: [{hooks: [{type: 'command', command: 'echo existing'}]}]},
  };
  writeFileSync(claude, JSON.stringify(original));
  try {
    for (const agent of ['claude', 'codex'] as const) {
      assert.equal(manageHookConfig('install', agent, opts).installed, true);
      assert.equal(manageHookConfig('install', agent, opts).changed, false);
      const file = agent === 'claude' ? claude : join(dir, '.codex', 'hooks.json');
      const data = JSON.parse(readFileSync(file, 'utf8'));
      assert.equal(
        data.hooks.SessionStart.filter((group: HookGroup) =>
          group.hooks.some((h) => h.statusMessage === 'personal-brain-style'),
        ).length,
        1,
      );
      assert.equal(data.hooks.UserPromptSubmit.length, 1);
      const handler = data.hooks.SessionStart.find((g: HookGroup) =>
        g.hooks.some((h) => h.statusMessage === 'personal-brain-style'),
      ).hooks[0];
      let invocation = handler.command;
      if (agent === 'claude') {
        invocation = handler.args[0];
      } else if (process.platform === 'win32') {
        invocation = Buffer.from(handler.command.split(' ').at(-1), 'base64').toString('utf16le');
      }
      assert.match(invocation, /scripts[\\/]run\.mjs/);
      if (agent === 'claude') {
        assert.deepEqual(data.permissions, original.permissions);
        assert.ok(
          data.hooks.SessionStart.some((g: HookGroup) => g.hooks[0]?.command === 'echo existing'),
        );
      }
      assert.equal(manageHookConfig('remove', agent, opts).installed, false);
      const after = JSON.parse(readFileSync(file, 'utf8'));
      assert.ok(!after.hooks?.UserPromptSubmit);
      if (agent === 'claude') {
        assert.ok(
          after.hooks.SessionStart.some((g: HookGroup) => g.hooks[0]?.command === 'echo existing'),
        );
      }
    }
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('real hook CLI reads JSON stdin and outputs host hook format', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-actual-hook-'));
  try {
    const db = new BrainDB(join(dir, 'brain.sqlite'));
    seed(db);
    db.close();
    const out = spawnSync(
      process.execPath,
      [resolve('scripts/run.mjs'), resolve('src/cli.ts'), 'hook', 'codex', 'prompt'],
      {
        cwd: dir,
        env: {...process.env, PB_HOME: dir},
        input: JSON.stringify({
          hook_event_name: 'UserPromptSubmit',
          prompt: 'Draw architecture diagram with drawio',
        }),
        encoding: 'utf8',
      },
    );
    assert.equal(out.status, 0, out.stderr);
    const result = JSON.parse(out.stdout);
    assert.equal(result.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
    assert.doesNotMatch(result.hookSpecificOutput.additionalContext, /orthogonal connectors/);
    assert.match(result.hookSpecificOutput.additionalContext, /INDEX ONLY/);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('editing a style updates the next injected task context without restarting the service', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-refresh-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    seed(db);
    const item = db
      .list({kind: 'preference', status: 'active'})
      .find((x) => x.title === 'Editable draw.io architecture style');
    assert.ok(item);
    const before = taskContext(db, 'Create a drawio architecture diagram') || '';
    const newContent = item.content + ' Add a specific approved spacing token GRID_42 for testing.';
    db.update(
      item.id,
      {
        kind: item.kind,
        domain: item.domain,
        title: item.title,
        summary: item.summary,
        content: newContent,
        tags: item.tags,
        priority: item.priority,
        status: item.status,
        checks: item.checks,
        backend: item.backend,
      },
      item.version,
    );
    const after = taskContext(db, 'Create a drawio architecture diagram') || '';
    assert.doesNotMatch(before, /GRID_42/);
    assert.doesNotMatch(after, /GRID_42/);
    assert.match(db.get(item.id)!.content, /GRID_42/);
    assert.match(after, /version 2/);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('lazy hook indexes stay bounded and leave dependency bodies for retrieval', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-lazy-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    const input = {
      kind: 'preference',
      domain: 'coding',
      title: 'Coding conventions',
      summary: 'Coding',
      content: 'SECRET_BODY ' + 'Long instruction. '.repeat(2000),
      tags: ['code'],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
    };
    const linked = db.create({
      ...input,
      title: 'Required conventions',
      externalSkills: ['EXTERNAL_SKILL_BODY'],
    });
    const root = db.create({...input, requiredIds: [linked.id]});
    const startup = JSON.parse(simulateHook(db, 'codex', 'session', {})).hookSpecificOutput
      .additionalContext;
    const prompt = taskContext(db, 'Implement code')!;
    assert.ok(startup.length < 2400);
    assert.ok(prompt.length < 2000);
    for (const text of [startup, prompt]) {
      assert.doesNotMatch(text, /SECRET_BODY|EXTERNAL_SKILL_BODY/);
      assert.match(text, /brain_get/);
      assert.match(text, /version 1/);
    }
    assert.equal(db.requiredRecords([root]).length, 2);
    assert.match(db.requiredRecords([root])[0].content, /SECRET_BODY/);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('both agents receive compliance instructions and MCP preserves review scope', async () => {
  const {callTool} = await import('../src/agents/mcp.ts');
  const {complianceInstructions, complianceReminder} =
    await import('../src/instructions/compliance.ts');
  const dir = mkdtempSync(join(tmpdir(), 'pb-compliance-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    seed(db);
    for (const agent of ['codex', 'claude'] as const) {
      for (const phase of ['session', 'prompt'] as const) {
        const output = JSON.parse(
          simulateHook(db, agent, phase, {prompt: 'draw architecture diagram'}),
        );
        assert.ok(output.hookSpecificOutput.additionalContext.includes(complianceReminder));
      }
    }
    const bootstrap = await callTool(db, 'brain_bootstrap');
    assert.ok(bootstrap.content[0].text.includes(complianceInstructions));
    const record = db.scopedRecords().find((r) => r.status === 'active')!;
    const get = JSON.parse((await callTool(db, 'brain_get', {id: record.id})).content[0].text);
    assert.equal(get.complianceInstructions, complianceInstructions);
    assert.ok(Array.isArray(get.requiredLinked));
    const review = JSON.parse(
      (await callTool(db, 'brain_review', {content: 'Example artifact'})).content[0].text,
    );
    assert.equal(review.complianceInstructions, complianceInstructions);
    assert.match(review.complianceInstructions, /not overall style compliance/);
    assert.match(review.complianceInstructions, /HTML or an image cannot replace it/);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('opencode plugin installs once, refuses foreign files and removes cleanly', () => {
  const home = mkdtempSync(join(tmpdir(), 'pb-opencode-'));
  try {
    const file = join(home, '.config', 'opencode', 'plugins', 'personal-brain.js');
    assert.equal(manageHookConfig('status', 'opencode', {home}).installed, false);
    assert.equal(manageHookConfig('install', 'opencode', {home}).changed, true);
    const source = readFileSync(file, 'utf8');
    assert.match(source, /"hook", "opencode", phase/);
    assert.match(source, /config\.mcp\["personal-brain"\]/);
    assert.match(source, /experimental\.chat\.system\.transform/);
    assert.equal(manageHookConfig('install', 'opencode', {home}).changed, false);
    writeFileSync(file, "// someone else's plugin\n");
    assert.throws(() => manageHookConfig('install', 'opencode', {home}), /not managed/);
    rmSync(file);
    manageHookConfig('install', 'opencode', {home});
    assert.deepEqual(manageHookConfig('remove', 'opencode', {home}), {
      agent: 'opencode',
      file,
      installed: false,
      changed: true,
    });
    assert.equal(existsSync(file), false);
  } finally {
    rmSync(home, {recursive: true, force: true});
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {BrainDB} from '../src/core/database.ts';
import {seed} from '../src/styles/seed.ts';
import {
  inlineStyles,
  instructionRefreshContext,
  simulateHook,
  taskContext,
} from '../src/agents/hooks.ts';
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
      // Only Claude hides MCP tools behind tool search.
      assert.equal(
        data.hookSpecificOutput.additionalContext.includes('select:mcp__personal-brain__brain_get'),
        agent === 'claude',
      );
    }
    db.trace({
      agent: 'codex',
      channel: 'mcp',
      eventType: 'mcp.brain_review',
      outcome: 'error',
      metadata: {error: 'Unknown requirement x'},
    });
    const row = db.db
      .prepare("SELECT metadata FROM trace_events WHERE event_type='mcp.brain_review'")
      .get() as {metadata: string};
    assert.equal(JSON.parse(row.metadata).error, 'Unknown requirement x');
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
      simulateHook(db, agent, 'session', {session_id: 'intent-test'});
      const raw = simulateHook(db, agent, 'prompt', {
        session_id: 'intent-test',
        prompt: 'Draw a system architecture diagram in draw.io',
      });
      const ctx = JSON.parse(raw).hookSpecificOutput.additionalContext as string;
      assert.match(ctx, /Create an editable system diagram/);
      assert.match(ctx, /Editable draw.io architecture style/);
      assert.doesNotMatch(ctx, /orthogonal connectors/);
      assert.match(ctx, /brain_get/);
      assert.equal(
        simulateHook(db, agent, 'prompt', {session_id: 'intent-test', prompt: 'hello'}),
        '',
      );
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
      assert.equal(!!data.hooks.PreToolUse, agent === 'claude', 'edit gate is Claude-only');
      const tool = data.hooks.PostToolUse[0];
      assert.match(tool.matcher, /apply_patch\|mcp__personal-brain__/);
      assert.equal(tool.hooks[0].additionalContextLimit, undefined);
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
      assert.ok(!after.hooks?.PostToolUse);
      assert.ok(!after.hooks?.PreToolUse);
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
          prompt: 'Plan the release and write the security review',
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

test('tool hook records edits and style loads per session, ignoring other tools', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-tool-hook-'));
  try {
    const run = (agent: string, tool_name: string, session_id = 'w1') =>
      spawnSync(
        process.execPath,
        [resolve('scripts/run.mjs'), resolve('src/cli.ts'), 'hook', agent, 'tool'],
        {
          cwd: dir,
          env: {...process.env, PB_HOME: dir},
          input: JSON.stringify({session_id, tool_name}),
          encoding: 'utf8',
        },
      );
    for (const [agent, tool, session] of [
      ['claude', 'Edit', 'w1'],
      ['claude', 'mcp__personal-brain__brain_prepare', 'w1'],
      ['claude', 'Write', 'w2'],
      ['claude', 'Read', 'w3'],
      ['codex', 'apply_patch', 'c1'],
    ]) {
      const out = run(agent, tool, session);
      assert.equal(out.status, 0, out.stderr);
      assert.equal(out.stdout, '', 'tool hook adds no context');
    }
    const db = new BrainDB(join(dir, 'brain.sqlite'));
    try {
      const by = Object.fromEntries(db.adoption().map((a) => [a.agent, a]));
      assert.deepEqual([by.claude.workSessions, by.claude.coveredSessions], [2, 1]);
      assert.deepEqual([by.codex.workSessions, by.codex.coveredSessions], [1, 0]);
      // Codex fires no tool hook for MCP calls; its traced brain_prepare in the session counts.
      db.trace({
        agent: 'codex',
        channel: 'mcp',
        eventType: 'mcp.brain_prepare',
        outcome: 'success',
        runId: 'codex:c1',
      });
      const codex = db.adoption().find((a) => a.agent === 'codex')!;
      assert.deepEqual([codex.workSessions, codex.coveredSessions], [1, 1]);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('real hook processes persist refresh state and warn when scope is unavailable', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-process-refresh-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    seed(db);
    const invoke = (agent: string, phase: string, projectId = '') => {
      const result = spawnSync(
        process.execPath,
        [resolve('scripts/run.mjs'), resolve('src/cli.ts'), 'hook', agent, phase],
        {
          cwd: dir,
          env: {...process.env, PB_HOME: dir, PB_PROJECT_ID: projectId},
          input: JSON.stringify({thread_id: 'live-session', prompt: 'ok'}),
          encoding: 'utf8',
        },
      );
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    for (const agent of ['codex', 'claude']) {
      invoke(agent, 'session');
      assert.equal(invoke(agent, 'prompt'), '');
    }
    const record = db.scopedRecords()[0];
    db.update(record.id, {...record, content: record.content + '\nChanged'}, record.version);
    for (const agent of ['codex', 'claude']) {
      assert.match(invoke(agent, 'prompt'), /INSTRUCTION REFRESH/);
      assert.equal(invoke(agent, 'prompt'), '');
      assert.match(invoke(agent, 'prompt', 'missing-project'), /REFRESH UNAVAILABLE/);
    }
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('short prompts refresh changed instructions independently for each active agent session', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-short-refresh-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    seed(db);
    const record = db.scopedRecords()[0];
    for (const agent of ['codex', 'claude'] as const) {
      simulateHook(db, agent, 'session', {session_id: 'shared-id'});
      assert.equal(simulateHook(db, agent, 'prompt', {session_id: 'shared-id', prompt: 'ok'}), '');
    }
    db.update(
      record.id,
      {...record, content: record.content + '\nNew instruction'},
      record.version,
    );
    for (const agent of ['codex', 'claude'] as const) {
      const input = {session_id: 'shared-id', prompt: 'ok'};
      const result = JSON.parse(simulateHook(db, agent, 'prompt', input));
      assert.match(result.hookSpecificOutput.additionalContext, /INSTRUCTION REFRESH/);
      assert.match(result.hookSpecificOutput.additionalContext, /full task intent/);
      assert.equal(simulateHook(db, agent, 'prompt', input), '');
      assert.match(simulateHook(db, agent, 'prompt', {prompt: 'ok'}), /INSTRUCTION REFRESH/);
      assert.match(simulateHook(db, agent, 'prompt', {prompt: 'ok'}), /INSTRUCTION REFRESH/);
    }
    const current = db.get(record.id)!;
    db.update(current.id, {...current, status: 'archived'}, current.version);
    assert.match(
      simulateHook(db, 'codex', 'prompt', {session_id: 'shared-id', prompt: 'continue'}),
      /INSTRUCTION REFRESH/,
    );
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('refresh detects overrides and scope switches without reacting to unrelated projects', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-scope-refresh-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    seed(db);
    const record = db.scopedRecords()[0];
    const project = db.saveProject({
      name: 'Scoped',
      description: '',
      assignments: [{recordId: record.id, override: null}],
    });
    const refresh = () => instructionRefreshContext(db, 'codex', 'prompt', 'session', project.id);
    assert.match(refresh()!, /INSTRUCTION REFRESH/);
    assert.equal(refresh(), null);
    db.saveProject({name: 'Unrelated', description: '', assignments: []});
    assert.equal(refresh(), null);
    db.saveProject(
      {...project, assignments: [{recordId: record.id, override: 'Project override'}]},
      project.id,
      project.version,
    );
    assert.match(refresh()!, /INSTRUCTION REFRESH/);
    assert.equal(refresh(), null);
    assert.match(
      instructionRefreshContext(db, 'codex', 'prompt', 'session')!,
      /Current scope: global/,
    );
    assert.match(refresh()!, /INSTRUCTION REFRESH/);
    const updated = db.project(project.id);
    db.saveProject({...updated, assignments: []}, updated.id, updated.version);
    assert.match(refresh()!, /INSTRUCTION REFRESH/);
  } finally {
    db.close();
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

test('prompt hook asks the agent to capture standing preferences, not one-off tasks', () => {
  const db = new BrainDB(':memory:');
  try {
    for (const said of [
      'when making document, let use default output is html',
      'From now on write commit messages under 50 characters',
      'từ nay tài liệu mặc định là html',
    ]) {
      assert.match(taskContext(db, said) || '', /PERSONAL BRAIN LEARN[\s\S]*brain_remember/, said);
    }
    for (const oneOff of [
      'Fix the login bug',
      'Use pnpm instead of npm for this script',
      'sửa lỗi này luôn đi',
      'Generated plan:\n' + 'Always run the steps below. '.repeat(80),
    ]) {
      assert.doesNotMatch(
        taskContext(db, oneOff) || '',
        /PERSONAL BRAIN LEARN/,
        oneOff.slice(0, 40),
      );
    }
  } finally {
    db.close();
  }
});

test('Claude gets a digest of strongly matched styles once per session and version', () => {
  const db = new BrainDB(':memory:');
  try {
    const r = db.create({
      kind: 'preference',
      domain: 'coding',
      title: 'Commit messages',
      summary: 'Short imperative commit subjects.',
      content: 'Long body that must not be sent. '.repeat(40),
      tags: ['commit', 'git'],
      principles: ['Subject under 50 characters'],
      requirements: [{id: 'req-subject', label: 'Subject line checked', type: 'manual'}],
      reviewCriteria: ['Subject is imperative'],
      priority: 50,
      status: 'active',
      checks: [],
      backend: null,
    });
    const strong = 'write the commit message for this git change';
    const text = inlineStyles(db, 'claude', 's1', [r], strong);
    assert.match(
      text,
      /STYLE DIGEST[\s\S]*Short imperative[\s\S]*- Subject under 50[\s\S]*- Subject line checked[\s\S]*1 review criteria/,
    );
    assert.doesNotMatch(text, /Long body/);
    assert.equal(inlineStyles(db, 'claude', 's1', [r], strong), '', 'once per session');
    assert.equal(inlineStyles(db, 'codex', 's2', [r], strong), '');
    assert.equal(inlineStyles(db, 'claude', null, [r], strong), '');
    // One shared word is a weak match: index only.
    assert.equal(inlineStyles(db, 'claude', 's3', [r], 'why is this commit slow'), '');
    const next = db.update(r.id, {summary: 'Imperative subjects, 60 characters.'}, r.version);
    assert.match(inlineStyles(db, 'claude', 's1', [next], strong), /60 characters/);
  } finally {
    db.close();
  }
});

test('always-apply styles reach Claude at session start and gate edits until loaded', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-always-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    seed(db);
    const record = db.scopedRecords().find((r) => r.kind === 'preference')!;
    db.update(record.id, {...record, alwaysApply: true}, record.version);
    assert.equal(db.get(record.id)!.alwaysApply, true);
    const invoke = (phase: string, extra: Record<string, unknown> = {}) => {
      const result = spawnSync(
        process.execPath,
        [resolve('scripts/run.mjs'), resolve('src/cli.ts'), 'hook', 'claude', phase],
        {
          cwd: dir,
          env: {...process.env, PB_HOME: dir, PB_PROJECT_ID: ''},
          input: JSON.stringify({session_id: 's1', ...extra}),
          encoding: 'utf8',
        },
      );
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    const denied = (out: string) =>
      out ? JSON.parse(out).hookSpecificOutput.permissionDecision === 'deny' : false;
    const session = invoke('session');
    assert.match(session, /ALWAYS APPLY/);
    assert.ok(session.includes(record.id));
    assert.doesNotMatch(invoke('prompt', {prompt: 'ok'}), /ALWAYS APPLY/, 'sent once per version');
    const gate = invoke('gate', {tool_name: 'Edit'});
    assert.ok(denied(gate));
    assert.ok(gate.includes(record.id) && gate.includes('always apply'));
    assert.equal(invoke('gate', {tool_name: 'Read'}), '', 'only edits are gated');
    invoke('tool', {tool_name: 'mcp__personal-brain__brain_get', tool_input: {id: record.id}});
    assert.equal(invoke('gate', {tool_name: 'Edit'}), '');
    // A prompt that matches styles blocks edits until they load; two denials, then edits pass.
    invoke('prompt', {prompt: 'Plan the release and write the security review'});
    assert.ok(denied(invoke('gate', {tool_name: 'Write'})));
    assert.ok(denied(invoke('gate', {tool_name: 'Write'})));
    assert.equal(invoke('gate', {tool_name: 'Write'}), '');
    // Every matched style must be loaded: one load is not enough, all of them pass.
    const notice = invoke('prompt', {
      prompt: 'Plan the release and write the security review again',
    });
    assert.match(notice, /REQUIRED BEFORE EDITING/, 'Claude is told up front');
    const reason = JSON.parse(invoke('gate', {tool_name: 'Edit'})).hookSpecificOutput
      .permissionDecisionReason as string;
    const wanted = [...reason.matchAll(/id ([0-9a-f-]{36})/g)].map((m) => m[1]);
    assert.ok(
      wanted.every((id) => notice.includes(id)),
      'the notice names everything the gate blocks on',
    );
    assert.ok(wanted.length > 1, 'several matched styles listed');
    invoke('tool', {tool_name: 'mcp__personal-brain__brain_get', tool_input: {id: wanted[0]}});
    assert.ok(denied(invoke('gate', {tool_name: 'Edit'})), 'one load is not enough');
    invoke('prompt', {prompt: 'Plan the release and write the security review once more'});
    invoke('tool', {
      tool_name: 'mcp__personal-brain__brain_prepare',
      tool_input: {recordIds: wanted.slice(1)},
    });
    assert.equal(invoke('gate', {tool_name: 'Edit'}), '');
    const changed = db.get(record.id)!;
    db.update(record.id, {...changed, content: changed.content + '\nv2'}, changed.version);
    assert.match(invoke('prompt', {prompt: 'ok'}), /ALWAYS APPLY/, 'resent on a new version');
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('unchecking always apply clears it; partial updates keep it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-always-clear-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    seed(db);
    const r = db.scopedRecords().find((x) => x.kind === 'preference')!;
    const on = db.update(r.id, {...r, alwaysApply: true}, r.version);
    const kept = db.update(r.id, {summary: on.summary + '.'}, on.version);
    assert.equal(kept.alwaysApply, true);
    const off = db.update(r.id, {...kept, alwaysApply: false}, kept.version);
    assert.equal(db.get(off.id)!.alwaysApply, undefined);
    assert.throws(() => db.update(r.id, {...off, alwaysApply: 'yes'}, off.version), /Always apply/);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

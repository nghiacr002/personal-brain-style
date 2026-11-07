import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {commandLine, connectAgent, launcher, mcpAddArgs} from '../src/agents/launcher.ts';

const npx = '/Users/a/.npm/_npx/1a2b/node_modules/personal-brain-style/dist/src/agents';
const global = '/usr/local/lib/node_modules/personal-brain-style/dist/src/agents';

test('commands match how Personal Brain was installed', () => {
  assert.deepEqual(launcher(npx).argv, ['npx', '--yes', 'personal-brain-style']);
  assert.equal(commandLine(npx, false).cli, 'personal-brain');
  assert.equal(commandLine(npx, false).onPath, false);
  assert.equal(
    launcher(global).argv[1],
    '/usr/local/lib/node_modules/personal-brain-style/dist/scripts/run.mjs',
  );
  const source = commandLine(undefined, true);
  assert.equal(source.mode, 'source');
  assert.match(source.npx, /^npx --yes personal-brain-style@\d/);
  assert.match(source.raw, /scripts\/run\.mjs .*src\/cli\.ts$/);
  // An npx copy registers MCP through npx, so clearing the npx cache cannot break it.
  assert.deepEqual(mcpAddArgs('codex', npx), [
    'mcp',
    'add',
    'personal-brain',
    '--',
    'npx',
    '--yes',
    'personal-brain-style',
    'mcp',
    'codex',
  ]);
});

test('connect installs hooks and registers MCP through the agent CLI; disconnect removes both', () => {
  const home = mkdtempSync(join(tmpdir(), 'pb-connect-'));
  const calls: string[][] = [];
  const run = (cmd: string, args: string[]) => {
    calls.push([cmd, ...args]);
    return {status: 0};
  };
  try {
    const steps = connectAgent('connect', 'claude', run, {home}, () => true);
    assert.ok(
      steps.every((s) => s.ok),
      JSON.stringify(steps),
    );
    assert.match(
      readFileSync(join(home, '.claude', 'settings.json'), 'utf8'),
      /personal-brain-style/,
    );
    assert.deepEqual(
      calls.map((c) => c.slice(0, 3)),
      [
        ['claude', 'mcp', 'remove'],
        ['claude', 'mcp', 'add'],
      ],
    );
    const missing = connectAgent('connect', 'codex', run, {home}, () => false);
    assert.equal(missing[1].ok, false);
    assert.match(missing[1].detail, /codex CLI not found.*Run: codex mcp add personal-brain/);
    assert.ok(connectAgent('disconnect', 'claude', run, {home}, () => true).every((s) => s.ok));
    assert.doesNotMatch(
      readFileSync(join(home, '.claude', 'settings.json'), 'utf8'),
      /personal-brain-style/,
    );
    assert.ok(connectAgent('connect', 'opencode', run, {home}).every((s) => s.ok));
  } finally {
    rmSync(home, {recursive: true, force: true});
  }
});

import test from 'node:test';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {executable} from '../src/agents/executable.ts';
import {hookCommand} from '../src/agents/hook-install.ts';

test('Windows npm shim resolution preserves arguments without invoking a shell', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-cli space-'));
  try {
    writeFileSync(join(dir, 'agent.cmd'), '@ECHO off\r\n"%dp0%/agent.js" %*');
    writeFileSync(join(dir, 'agent.js'), 'console.log(JSON.stringify(process.argv.slice(2)))');
    const args = ['--schema', '{"value":"& | %PATH%"}'];
    assert.deepEqual(executable('agent', args, 'win32', dir), {
      command: process.execPath,
      args: [join(dir, 'agent.js'), ...args],
    });
    const launch = executable('agent', args, 'win32', dir);
    const child = spawnSync(launch.command, launch.args, {encoding: 'utf8'});
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), args);
    assert.throws(() => executable('absent', [], 'win32', dir), /Cannot launch/);
    writeFileSync(join(dir, 'custom.cmd'), 'echo unsafe');
    assert.throws(() => executable('custom', [], 'win32', dir), /Cannot launch/);
    assert.deepEqual(executable('agent', args, 'darwin'), {command: 'agent', args});
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
test('Windows shell hooks encode paths and propagate the child exit code', () => {
  const command = hookCommand('codex', 'session', {
    node: 'C:/Program Files/node.exe',
    entry: "C:/O'Brien/app/cli.ts",
    platform: 'win32',
  });
  const script = Buffer.from(command.split(' ').at(-1)!, 'base64').toString('utf16le');
  assert.match(command, /^powershell.exe/);
  assert.ok(script.includes("'C:/O''Brien/app/cli.ts'"));
  assert.match(script, /exit \$LASTEXITCODE$/);
});

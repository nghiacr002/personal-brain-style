import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {configureDesktop, desktopConfigPath} from '../src/agents/desktop-install.ts';

test('Desktop config resolves macOS, Linux XDG and Windows roaming paths', () => {
  assert.equal(
    desktopConfigPath('linux', '/home/user', {}),
    '/home/user/.config/Claude/claude_desktop_config.json',
  );
  assert.equal(
    desktopConfigPath('linux', '/home/user', {XDG_CONFIG_HOME: '/config'}),
    '/config/Claude/claude_desktop_config.json',
  );
  assert.equal(
    desktopConfigPath('darwin', '/Users/me', {}),
    '/Users/me/Library/Application Support/Claude/claude_desktop_config.json',
  );
  assert.equal(
    desktopConfigPath('win32', 'C:/Users/me', {APPDATA: 'D:/Roaming'}),
    'D:\\Roaming\\Claude\\claude_desktop_config.json',
  );
});
test('Desktop preview, install, repair and removal preserve unrelated configuration', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-desktop-')),
    file = join(dir, 'config.json'),
    options = {file, dataDir: join(dir, 'data')};
  try {
    assert.equal(configureDesktop('preview', options).changed, false);
    assert.equal(existsSync(file), false);
    writeFileSync(file, JSON.stringify({theme: 'dark', mcpServers: {other: {command: 'other'}}}));
    const first = configureDesktop('install', options);
    assert.ok(first.changed);
    assert.ok(existsSync(first.backup!));
    assert.equal(configureDesktop('install', options).changed, false);
    let config = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(config.theme, 'dark');
    assert.equal(config.mcpServers.other.command, 'other');
    assert.equal(config.mcpServers['personal-brain'].command, process.execPath);
    for (const path of config.mcpServers['personal-brain'].args.slice(0, 2)) {
      assert.ok(existsSync(path));
    }
    configureDesktop('repair', {...options, projectId: 'project-a'});
    config = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(config.mcpServers['personal-brain'].env.PB_PROJECT_ID, 'project-a');
    assert.equal(configureDesktop('repair', {...options, projectId: 'project-a'}).changed, false);
    configureDesktop('remove', options);
    config = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(config.mcpServers['personal-brain'], undefined);
    assert.ok(config.mcpServers.other);
    writeFileSync(file, '{bad');
    assert.throws(() => configureDesktop('repair', options));
    assert.equal(readFileSync(file, 'utf8'), '{bad');
    writeFileSync(
      file,
      JSON.stringify({mcpServers: {'personal-brain': {command: 'foreign', args: []}}}),
    );
    assert.throws(() => configureDesktop('repair', options), /another installation/);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

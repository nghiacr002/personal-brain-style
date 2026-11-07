import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync, realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {folderDialogCommand, selectedFolderPath} from '../src/projects/folder-browser.ts';

test('native folder dialogs use fixed arguments and preserve cancellation', () => {
  const mac = folderDialogCommand('darwin');
  assert.equal(mac.command, '/usr/bin/osascript');
  assert.match(mac.args[1], /choose folder/);
  assert.match(mac.args[1], /error number -128/);
  const windows = folderDialogCommand('win32');
  assert.equal(windows.command, 'powershell.exe');
  assert.ok(windows.args.includes('-STA'));
  const script = Buffer.from(windows.args.at(-1)!, 'base64').toString('utf16le');
  assert.match(script, /FolderBrowserDialog/);
  assert.match(script, /SelectedPath/);
  assert.match(script, /Encoding.*UTF8/);
  assert.deepEqual(folderDialogCommand('linux'), {
    command: 'zenity',
    args: ['--file-selection', '--directory', '--title=Select repository folder'],
  });
  assert.throws(() => folderDialogCommand('aix'), /Paste the absolute/);
  assert.deepEqual(selectedFolderPath('\n'), {path: null});
  const root = mkdtempSync(join(tmpdir(), 'pb-native-folder-'));
  try {
    assert.equal(selectedFolderPath(root + '\n').path, realpathSync(root));
    assert.throws(() => selectedFolderPath('relative'), /not an accessible/);
    const file = join(root, 'file.txt');
    writeFileSync(file, '');
    assert.throws(() => selectedFolderPath(file), /not an accessible/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

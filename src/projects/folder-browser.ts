import {execFile} from 'node:child_process';
import {realpathSync, statSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {BrainError} from '../core/models.ts';

export function folderDialogCommand(platform: NodeJS.Platform) {
  if (platform === 'darwin') {
    return {
      command: '/usr/bin/osascript',
      args: [
        '-e',
        'try\nreturn POSIX path of (choose folder with prompt "Select repository folder")\non error number -128\nreturn ""\nend try',
      ],
    };
  }
  if (platform === 'win32') {
    const script =
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $picker = New-Object System.Windows.Forms.FolderBrowserDialog; $picker.Description = "Select repository folder"; $picker.ShowNewFolderButton = $false; try { if ($picker.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($picker.SelectedPath) } } finally { $picker.Dispose() }';
    return {
      command: 'powershell.exe',
      args: [
        '-NoProfile',
        '-NonInteractive',
        '-STA',
        '-EncodedCommand',
        Buffer.from(script, 'utf16le').toString('base64'),
      ],
    };
  }
  if (platform === 'linux') {
    return {
      command: 'zenity',
      args: ['--file-selection', '--directory', '--title=Select repository folder'],
    };
  }
  throw new BrainError(
    'Folder dialog is unavailable on this platform. Paste the absolute folder path instead.',
  );
}
export function selectedFolderPath(output: string) {
  const path = output.replace(/[\r\n]+$/, '');
  if (!path) {
    return {path: null};
  }
  if (!isAbsolute(path) || !statSync(path).isDirectory()) {
    throw new BrainError('The selected path is not an accessible folder.');
  }
  return {path: realpathSync(path)};
}
let selecting = false;
export async function selectFolder() {
  if (selecting) {
    throw new BrainError(
      'A folder dialog is already open. Select a folder or cancel it.',
      'CONFLICT',
      409,
    );
  }
  const launch = folderDialogCommand(process.platform);
  selecting = true;
  try {
    const output = await new Promise<string>((resolve, reject) => {
      execFile(
        launch.command,
        launch.args,
        {encoding: 'utf8', timeout: 120000, maxBuffer: 65536, windowsHide: false},
        (error, stdout, stderr) => {
          if (error) {
            if (process.platform === 'linux' && String(error.code) === '1' && !stderr.trim()) {
              return resolve('');
            }
            return reject(
              new BrainError(
                'Could not open or complete the system folder dialog. It opens on the computer running Personal Brain. Try again or paste the absolute folder path. Linux requires Zenity and a graphical session.',
              ),
            );
          }
          resolve(stdout);
        },
      );
    });
    return selectedFolderPath(output);
  } finally {
    selecting = false;
  }
}

import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, resolve, sep} from 'node:path';

// Windows npm shims are batch files; launch their Node entry directly without a shell.
export function executable(
  command: string,
  args: string[],
  platform = process.platform,
  searchPath = process.env.PATH || '',
) {
  if (platform !== 'win32') {
    return {command, args};
  }
  const directories = /[\\/]/.test(command)
    ? ['']
    : searchPath
        .split(';')
        .filter(Boolean)
        .map((p) => p.replace(/^"|"$/g, ''));
  for (const directory of directories) {
    for (const suffix of /\.(exe|cmd|bat)$/i.test(command) ? [''] : ['.exe', '.cmd', '']) {
      const file = directory ? join(directory, command + suffix) : resolve(command + suffix);
      if (!existsSync(file) || !statSync(file).isFile()) {
        continue;
      }
      if (/\.exe$/i.test(file)) {
        return {command: file, args};
      }
      if (/\.cmd$/i.test(file)) {
        const shim = readFileSync(file, 'utf8');
        const script = shim.match(/"%dp0%[\\/]([^"\r\n]+\.(?:js|mjs|cjs))"/i)?.[1];
        if (script) {
          const entry = resolve(dirname(file), script.replace(/[\\/]/g, sep));
          if (existsSync(entry)) {
            return {command: process.execPath, args: [entry, ...args]};
          }
        }
      }
    }
  }
  throw new Error(
    'Cannot launch ' +
      command +
      ' on Windows. Install a native executable or a standard npm CLI; for custom tools configure node.exe with the script path.',
  );
}

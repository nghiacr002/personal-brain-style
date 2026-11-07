#!/usr/bin/env node
/** Version-aware launcher for macOS, Linux and Windows. */
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {supported, needsTypeStripFlag} from './runtime-compat.mjs';

const version = process.versions.node;
if (!supported(version)) {
  console.error(`\nPersonal Brain requires Node.js 22.13+ or 24 LTS. Current: ${process.version}`);
  console.error(`Executable: ${process.execPath}`);
  console.error('Use Node 24 LTS: nvm install 24 && nvm use 24');
  console.error('If Node 24 is already installed, check: which -a node; node -v');
  process.exit(1);
}
if (process.argv[2] === '--check') {
  console.log(`Personal Brain runtime OK: Node ${process.version} (${process.execPath})`);
  process.exit(0);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv
  .slice(2)
  .map((arg) => (arg === 'src/cli.ts' ? resolve(root, 'src/cli.ts') : arg));
if (args.length === 0) {
  console.error(
    'Usage: node scripts/run.mjs src/cli.ts serve|mcp|seed|... OR --test tests/*.test.ts',
  );
  process.exit(2);
}
const child = spawn(
  process.execPath,
  [...(needsTypeStripFlag(version) ? ['--experimental-strip-types'] : []), ...args],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  },
);
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}
child.on('error', (error) => {
  console.error(`Personal Brain failed to start: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) {
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
  } else {
    process.exitCode = code ?? 1;
  }
});

import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const build = spawnSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.web.json'],
  {cwd: root, stdio: 'inherit'},
);
if (build.status !== 0) {
  process.exit(build.status || 1);
}
const children = [
  spawn(
    process.execPath,
    [
      'node_modules/typescript/bin/tsc',
      '--project',
      'tsconfig.web.json',
      '--watch',
      '--preserveWatchOutput',
    ],
    {cwd: root, stdio: 'inherit'},
  ),
  spawn(process.execPath, ['--experimental-strip-types', '--watch', 'src/cli.ts', 'serve'], {
    cwd: root,
    stdio: 'inherit',
    env: {...process.env, PB_DEV_RELOAD: '1'},
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) {
    return;
  }
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    child.kill('SIGTERM');
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stop());
}
for (const child of children) {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) {
      stop(code || 1);
    }
  });
}
console.log('Watching server and frontend sources. Browser pages reload after successful changes.');

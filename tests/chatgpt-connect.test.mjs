import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test(
  'ChatGPT helper validates credentials and stops on failed checks',
  {skip: process.platform === 'win32' ? 'POSIX shell fixture; run on macOS CI' : false},
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'pb-tunnel-'));
    const log = join(dir, 'calls');
    writeFileSync(
      join(dir, 'tunnel-client'),
      '#!/bin/bash\nprintf "%s\\n" "$@" >> "$TEST_LOG"\nif [[ "$1" == doctor && "${FAIL_DOCTOR:-}" == 1 ]]; then exit 3; fi\n',
      {mode: 0o700},
    );
    const env = {
      ...process.env,
      PATH: dir + ':' + process.env.PATH,
      TEST_LOG: log,
      CONTROL_PLANE_TUNNEL_ID: 'tunnel_' + 'a'.repeat(32),
      CONTROL_PLANE_API_KEY: 'test-secret',
    };
    const run = (extra = {}) =>
      spawnSync(
        'bash',
        [
          resolve('scripts/connect-chatgpt.sh'),
          "node '/path with spaces/server' mcp chatgpt project",
        ],
        {env: {...env, ...extra}, encoding: 'utf8'},
      );
    try {
      let result = run();
      assert.equal(result.status, 0);
      const calls = readFileSync(log, 'utf8');
      assert.match(calls, /doctor/);
      assert.match(calls, /run/);
      assert.match(calls, /path with spaces/);
      assert.doesNotMatch(calls, /test-secret/);
      writeFileSync(log, '');
      result = run({FAIL_DOCTOR: '1'});
      assert.equal(result.status, 3);
      assert.doesNotMatch(readFileSync(log, 'utf8'), /^run/m);
      result = run({CONTROL_PLANE_TUNNEL_ID: 'invalid'});
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Invalid tunnel ID/);
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  },
);

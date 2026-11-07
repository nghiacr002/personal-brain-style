import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVersion, supported, needsTypeStripFlag} from '../scripts/runtime-compat.mjs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

test('version compatibility', () => {
  assert.deepEqual(parseVersion('v22.16.0'), {major: 22, minor: 16, patch: 0});
  for (const v of ['18.20.0', '20.19.0', '22.12.0', '23.4.0']) {
    assert.equal(supported(v), false);
  }
  for (const v of ['22.13.0', '22.16.0', '22.18.0', '23.6.0', '24.0.0', '26.7.0']) {
    assert.equal(supported(v), true);
  }
  assert.equal(needsTypeStripFlag('22.16.0'), true);
  assert.equal(needsTypeStripFlag('22.18.0'), false);
  assert.equal(needsTypeStripFlag('24.1.0'), false);
});

test('launcher reports active runtime', () => {
  const r = spawnSync(process.execPath, [resolve('scripts/run.mjs'), '--check'], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Personal Brain runtime OK/);
});

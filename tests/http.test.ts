import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {createBrainHttpServer, installInfo} from '../src/server/http.ts';

test('local HTTP UI is served and API opens without a token', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-http-')),
    db = new BrainDB(join(dir, 'brain.sqlite'));
  const server = createBrainHttpServer(db);
  try {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const a = server.address();
    if (typeof a !== 'object' || !a) {
      throw new Error('Missing server address');
    }
    const base = `http://127.0.0.1:${a.port}`;
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Personal Brain/);
    const denied = await fetch(base + '/api/summary');
    assert.equal(denied.status, 200);
    const ok = await fetch(base + '/api/summary', {headers: {Authorization: 'Bearer test-secret'}});
    assert.equal(ok.status, 200);
    const crossOrigin = await fetch(base + '/api/summary', {
      headers: {Authorization: 'Bearer test-secret', Origin: 'https://bad.example'},
    });
    assert.equal(crossOrigin.status, 403);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('install info reports version, build time and a command for this copy', () => {
  const info = installInfo();
  assert.equal(info.mode, 'source');
  assert.match(info.version, /^\d+\.\d+\.\d+/);
  assert.match(info.raw, /scripts\/run\.mjs .*src\/cli\.ts$/);
});

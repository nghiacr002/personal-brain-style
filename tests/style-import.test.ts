import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {seed} from '../src/styles/seed.ts';
import {createBrainHttpServer} from '../src/server/http.ts';

test('server installs requested architecture styles without generic samples; explicit imports remain available', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-style-api-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  const server = createBrainHttpServer(db);
  const request = (url: string, authorization = '', method = 'GET', origin?: string) =>
    new Promise<{status: number; data: any}>((resolve) => {
      let status = 0;
      const response = {
        setHeader() {},
        writeHead(code: number) {
          status = code;
        },
        end(body: string) {
          resolve({status, data: JSON.parse(body)});
        },
      };
      server.emit('request', {url, method, headers: {authorization, origin}}, response);
    });
  try {
    const installed = db.list({limit: 300});
    assert.equal(installed.filter((r) => /(^|-)architecture$/.test(r.domain)).length, 9);
    assert.ok(installed.every((r) => !r.tags.includes('style-recipe')));
    assert.equal(db.listTrace({includeDemo: true}).length, 0);
    const seeded = seed(db);
    const blocked = await request('/api/items', '', 'GET', 'https://unrelated.example');
    assert.equal(blocked.status, 403);
    const denied = await request('/api/items', '');
    assert.equal(denied.status, 200);
    const all = await request('/api/items');
    assert.equal(all.status, 200);
    assert.equal(all.data.length, installed.length + seeded);
    for (const kind of ['preference', 'skill', 'example', 'review', 'tool']) {
      assert.ok(all.data.some((r: any) => r.kind === kind));
    }
    assert.equal(db.listTrace({includeDemo: true}).length, 0);
    assert.equal(
      all.data.filter((r: any) => r.tags.includes('style-recipe') && r.status === 'draft').length,
      11,
    );
    const thinking = await request('/api/items?kind=preference&domain=thinking');
    assert.ok(thinking.data.some((r: any) => r.title === 'Evidence-led thinking'));
    const repeated = await request('/api/styles/seed', 'Bearer test-token', 'POST');
    assert.equal(repeated.data.created, 0);
    assert.ok(all.data.some((r: any) => r.domain === 'coding'));
    assert.ok(all.data.some((r: any) => r.title === 'Constraint-led technology selection'));
  } finally {
    server.close();
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

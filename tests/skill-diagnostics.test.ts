import test from 'node:test';
import assert from 'node:assert/strict';
import {BrainDB} from '../src/core/database.ts';
import {createBrainHttpServer} from '../src/server/http.ts';

test('skill diagnostics validates project scope and excludes repository evidence', async () => {
  const db = new BrainDB(':memory:');
  const server = createBrainHttpServer(db);
  const request = (url: string) =>
    new Promise<{status: number; data: any}>((resolve) => {
      let status = 200;
      server.emit(
        'request',
        {url, method: 'GET', headers: {}},
        {
          setHeader() {},
          writeHead(code: number) {
            status = code;
          },
          end(body: string) {
            resolve({status, data: JSON.parse(body)});
          },
        },
      );
    });
  try {
    const p = db.saveProject({name: 'Skills', description: '', assignments: []});
    const result = await request('/api/skills?projectId=' + p.id);
    assert.equal(result.status, 200);
    assert.ok(Array.isArray(result.data.skills));
    assert.deepEqual(result.data.references, []);
    assert.equal('evidence' in result.data, false);
    assert.equal('files' in result.data, false);
    const invalid = await request('/api/skills?projectId=unknown');
    assert.equal(invalid.status, 404);
  } finally {
    server.close();
    db.close();
  }
});

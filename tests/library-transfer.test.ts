import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {exportLibrary, previewLibraryImport, importLibrary} from '../src/core/library-transfer.ts';
import {createBrainHttpServer} from '../src/server/http.ts';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'pb-transfer-'));
  const db = new BrainDB(join(dir, 'db'));
  return {
    db,
    close() {
      db.close();
      rmSync(dir, {recursive: true, force: true});
    },
  };
}
const record = (title: string, extra: object = {}) => ({
  kind: 'preference',
  domain: 'coding',
  title,
  summary: title,
  content: title,
  tags: [],
  priority: 70,
  status: 'active',
  checks: [],
  backend: null,
  ...extra,
});
test('multi-item export/import remaps links, includes dependencies and skips duplicates without overwriting', () => {
  const a = fixture(),
    b = fixture();
  try {
    const child = a.db.create(record('Child'));
    const root = a.db.create(
      record('Root', {
        requiredIds: [child.id],
        supportingLinks: [{recordId: child.id, when: {activities: ['test']}}],
      }),
    );
    const other = a.db.create(record('Other'));
    a.db.create(record('Not selected'));
    const bundle = exportLibrary(a.db, [root.id, other.id]);
    assert.equal(bundle.records.length, 3);
    const preview = previewLibraryImport(b.db, bundle);
    assert.equal(b.db.list().length, 0);
    const result = importLibrary(b.db, bundle, [root.id], preview.fingerprint);
    assert.equal(result.created, 2);
    const imported = b.db.styleByKey('root')!,
      linked = b.db.styleByKey('child')!;
    assert.notEqual(imported.id, root.id);
    assert.deepEqual(imported.requiredIds, [linked.id]);
    assert.equal(imported.supportingLinks![0].recordId, linked.id);
    assert.equal(b.db.styleByKey('other'), undefined);
    b.db.update(imported.id, {content: 'Personal edit'}, imported.version);
    const again = previewLibraryImport(b.db, bundle);
    assert.equal(importLibrary(b.db, bundle, [root.id], again.fingerprint).kept, 1);
    assert.equal(b.db.get(imported.id)!.content, 'Personal edit');
  } finally {
    a.close();
    b.close();
  }
});
test('invalid graphs, stale previews and private exports fail without partial writes', () => {
  const a = fixture(),
    b = fixture();
  try {
    const one = a.db.create(record('One')),
      two = a.db.create(record('Two'));
    const bundle = exportLibrary(a.db, [one.id, two.id]);
    const preview = previewLibraryImport(b.db, bundle);
    b.db.create(record('One'));
    assert.throws(() => importLibrary(b.db, bundle, [two.id], preview.fingerprint), /changed/);
    const next = previewLibraryImport(b.db, bundle);
    assert.throws(
      () => importLibrary(b.db, bundle, [two.id, 'missing'], next.fingerprint),
      /not in/,
    );
    assert.equal(b.db.styleByKey('two'), undefined);
    assert.throws(
      () =>
        previewLibraryImport(b.db, {
          ...bundle,
          records: bundle.records.map((r) => ({...r, requiredIds: ['missing']})),
        }),
      /Linked items/,
    );
    assert.throws(
      () =>
        previewLibraryImport(b.db, {
          ...bundle,
          records: bundle.records.map((r) => ({...r, requiredIds: [r.id]})),
        }),
      /cycle/,
    );
    const p = a.db.saveProject({
      name: 'Private',
      description: '',
      assignments: [{recordId: one.id, override: null}],
    });
    const copy = a.db.personalizeRecord(p.id, one.id, {content: 'Private'}, one.version, p.version);
    assert.throws(() => exportLibrary(a.db, [copy.id]), /shared library/);
  } finally {
    a.close();
    b.close();
  }
});
test('capability metadata survives renamed domains; tool imports are disabled', () => {
  const a = fixture(),
    b = fixture();
  try {
    const domain = a.db.saveDomain('Custom name');
    a.db.saveDomain('Renamed capability', domain.id, domain.name, true);
    const tool = a.db.create(
      record('Tool', {
        kind: 'tool',
        domain: domain.id,
        backend: {command: 'example', args: [], toolName: 'tool', enabled: true},
      }),
    );
    const bundle = exportLibrary(a.db, [tool.id]);
    assert.equal(bundle.records[0].backend!.enabled, false);
    bundle.records[0].backend!.enabled = true;
    const preview = previewLibraryImport(b.db, bundle);
    importLibrary(b.db, bundle, [tool.id], preview.fingerprint);
    assert.equal(b.db.styleByKey('tool')!.backend!.enabled, false);
    assert.equal(b.db.domains().find((d) => d.id === domain.id)!.name, 'Renamed capability');
  } finally {
    a.close();
    b.close();
  }
});

test('HTTP transfer endpoints preview without writes and enforce origin checks', async () => {
  const f = fixture(),
    server = createBrainHttpServer(f.db);
  const request = <T = unknown>(url: string, data: unknown, origin?: string) =>
    new Promise<{status: number; data: T}>((resolve) => {
      let status = 0;
      server.emit(
        'request',
        {
          url,
          method: 'POST',
          headers: {origin, host: '127.0.0.1:4188'},
          async *[Symbol.asyncIterator]() {
            const bytes = Buffer.from(JSON.stringify(data));
            const split = Math.max(1, bytes.findIndex((b) => b >= 128) + 1);
            yield bytes.subarray(0, split);
            yield bytes.subarray(split);
          },
        },
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
    const item = f.db.create(
      record('HTTP transfer item', {domain: 'engineering-standards', content: 'こんにちは🙂'}),
    );
    const exported = await request('/api/library/export', {ids: [item.id]});
    assert.equal(exported.status, 200);
    const count = f.db.list({limit: 300}).length;
    const preview = await request<{items: Array<{content: string}>; fingerprint: string}>(
      '/api/library/import/preview',
      {bundle: exported.data},
    );
    assert.equal(preview.status, 200);
    assert.equal(preview.data.items[0].content, 'こんにちは🙂');
    assert.equal(f.db.list({limit: 300}).length, count);
    const denied = await request(
      '/api/library/import',
      {bundle: exported.data, ids: [item.id], fingerprint: preview.data.fingerprint},
      'https://other.example',
    );
    assert.equal(denied.status, 403);
    const kept = await request<{kept: number}>('/api/library/import', {
      bundle: exported.data,
      ids: [item.id],
      fingerprint: preview.data.fingerprint,
    });
    assert.equal(kept.status, 200);
    assert.equal(kept.data.kept, 1);
    assert.equal(
      (await request('/api/library/import/preview', {bundle: {version: 99}})).status,
      400,
    );
  } finally {
    server.close();
    f.close();
  }
});

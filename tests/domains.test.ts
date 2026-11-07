import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {callTool, tools} from '../src/agents/mcp.ts';

test('domain registry persists names without breaking records, revisions or project scope', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-domains-')),
    file = join(dir, 'brain.sqlite');
  let db = new BrainDB(file);
  try {
    const domain = db.saveDomain('Data engineering');
    assert.equal(domain.id, 'data-engineering');
    assert.throws(() => db.saveDomain('DATA ENGINEERING'), /already exists/);
    assert.throws(() => db.saveDomain(' '), /1-60/);
    assert.throws(() => db.saveDomain('all'), /starting/);
    const input = {
      kind: 'preference',
      domain: domain.id,
      title: 'Data style',
      summary: 'Data',
      content: 'Validate schemas',
      tags: [],
      priority: 80,
      status: 'active',
      checks: [],
      backend: null,
    };
    assert.throws(() => db.create({...input, domain: 'unregistered'}), /Register/);
    const r = db.create(input),
      p = db.saveProject({
        name: 'Data',
        description: '',
        assignments: [{recordId: r.id, override: null}],
      });
    db.saveDomain('Data & analytics', domain.id, domain.name);
    assert.throws(() => db.saveDomain('Stale', domain.id, domain.name), /changed/);
    assert.equal(db.scopedRecords(p.id)[0].id, r.id);
    assert.equal(db.history(r.id).length, 1);
    const result = await callTool(db, 'brain_style', {domain: domain.id, projectId: p.id});
    assert.ok(!result.isError);
    assert.match(result.content[0].text, /Validate schemas/);
    assert.equal(
      (tools().find((t) => t.name === 'brain_style')!.inputSchema.properties.domain as any).enum,
      undefined,
    );
    db.saveDomain('UI/UX', 'design', 'UI/UX Design');
    db.close();
    db = new BrainDB(file);
    assert.equal(db.domains().find((d) => d.id === domain.id)?.name, 'Data & analytics');
    assert.equal(db.domains().find((d) => d.id === 'design')?.name, 'UI/UX');
    assert.equal(db.list({domain: domain.id})[0].id, r.id);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('combinable capabilities let a project stack styles; switching back is refused while styles stack', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-combinable-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    db.saveDomain('Engineering standards', undefined, undefined, true);
    const input = {
      kind: 'preference' as const,
      domain: 'engineering-standards',
      summary: 's',
      content: 'c',
      tags: [],
      priority: 70,
      status: 'active' as const,
      checks: [],
      backend: null,
    };
    const base = db.create({...input, title: 'Frontend'}),
      ts = db.create({...input, title: 'Frontend TS', requiredIds: [base.id]}),
      be = db.create({...input, title: 'Backend TS'});
    const p = db.saveProject({
      name: 'P',
      description: '',
      assignments: [ts, be].map((r) => ({recordId: r.id, override: null})),
    });
    assert.deepEqual(
      db
        .scopedRecords(p.id)
        .map((r) => r.title)
        .sort(),
      ['Backend TS', 'Frontend', 'Frontend TS'],
    );
    assert.throws(
      () =>
        db.saveDomain(
          'Engineering standards',
          'engineering-standards',
          'Engineering standards',
          false,
        ),
      /conflict/i,
    );
    assert.equal(db.domains().find((d) => d.id === 'engineering-standards')!.combinable, true);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

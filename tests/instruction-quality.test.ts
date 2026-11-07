import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {seedGlobalStyles} from '../src/styles/global-style-seed.ts';
import {callTool} from '../src/agents/mcp.ts';

// Authored task labels, not generated from catalog keywords. Keep failures visible.
const cases: Record<string, string[]> = {
  'doc-brd': [
    'Write a BRD',
    'Document business requirements',
    'Define business scope and stakeholders',
    'Prepare business requirements for approval',
    'Describe business objectives and acceptance criteria',
    'Create a business requirements document',
  ],
  'doc-hld': [
    'Write an HLD',
    'Create a high-level design',
    'Describe system architecture and integrations',
    'Document architecture boundaries and deployment',
    'Prepare the high level design document',
    'Explain architectural decisions and system components',
  ],
  'doc-lld': [
    'Write an LLD',
    'Create a low-level design',
    'Specify implementation details and interfaces',
    'Document classes and sequence flows',
    'Prepare detailed component design',
    'Describe algorithms and error handling',
  ],
  research: [
    'Research product improvements',
    'Compare alternatives using primary sources',
    'Investigate evidence for a technical decision',
    'Research current official documentation',
    'Assess conflicting sources and confidence',
    'Prepare research findings and recommendations',
  ],
  development: [
    'Implement a feature',
    'Fix a bug in existing code',
    'Refactor a shared function',
    'Make a code change with regression tests',
    'Validate inputs and handle failures',
    'Implement a backward-compatible API change',
  ],
};

test('TC-REL-004 instruction selection baseline and scoped retrieval', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-quality-')),
    db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    seedGlobalStyles(db);
    const records = db.scopedRecords();
    const results: Array<{task: string; expected: string; hit: boolean; rank: number | null}> = [];
    for (const [key, tasks] of Object.entries(cases)) {
      const root = records.find((r) => r.keyId === key);
      assert.ok(root, `Missing catalog style ${key}`);
      const project = db.saveProject({
        name: key,
        description: 'Synthetic evaluation',
        assignments: [{recordId: root.id, override: null}],
      });
      for (const task of tasks) {
        const found = db.discover(task, undefined, 30);
        const rank = found.findIndex((r) => r.id === root.id) + 1;
        results.push({task, expected: key, hit: rank > 0 && rank <= 3, rank: rank || null});
        const scoped = db.discover(task, undefined, 30, project.id);
        const allowed = new Set(db.scopedRecords(project.id).map((r) => r.id));
        assert.ok(
          scoped.every((r) => allowed.has(r.id)),
          'Discovery escaped project scope',
        );
      }
      const loaded = await callTool(db, 'brain_get', {projectId: project.id, id: root.id});
      assert.ok(!loaded.isError);
      const content = JSON.parse(loaded.content[0].text);
      assert.equal(content.content, root.content);
      assert.deepEqual(
        new Set(content.requiredLinked.map((r: {id: string}) => r.id)),
        new Set(
          db
            .requiredRecords([root], project.id)
            .filter((r) => r.id !== root.id)
            .map((r) => r.id),
        ),
      );
      const unselected = records.find(
        (r) => !db.scopedRecords(project.id).some((s) => s.id === r.id),
      );
      assert.ok(unselected);
      assert.equal(
        (await callTool(db, 'brain_get', {projectId: project.id, id: unselected.id})).isError,
        true,
      );
    }
    const hits = results.filter((r) => r.hit).length;
    t.diagnostic(
      JSON.stringify({
        metric: 'catalog expected-style hit@3',
        hits,
        total: results.length,
        misses: results.filter((r) => !r.hit),
      }),
    );
    // Baseline threshold is set from the first recorded run; it is not a quality target.
    assert.equal(results.length, 30);
    assert.ok(hits >= 22, `Retrieval regressed below the 22/30 baseline: ${hits}/30`);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

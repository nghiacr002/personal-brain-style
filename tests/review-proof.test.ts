import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {callTool} from '../src/agents/mcp.ts';
import {linkRepository} from '../src/projects/project-scope.ts';
import {compactForAgent} from '../src/instructions/compact.ts';
import type {BrainRecord} from '../src/core/models.ts';

test('a manual pass counts only with proof; file proofs are checked; unclaimed review criteria are advisory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-proof-')),
    db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    const style = db.create({
      kind: 'preference',
      domain: 'coding',
      title: 'Checked style',
      summary: 'S',
      content: 'C',
      tags: [],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
      requirements: [
        {id: 'req-tests', label: 'Tests pass', type: 'manual', verify: 'command'},
        {
          id: 'req-doc',
          label: 'Runbook names the log level procedure',
          type: 'manual',
          verify: 'file',
        },
        {id: 'req-log', label: 'Log line has trace_id', type: 'manual', verify: 'sample'},
        {id: 'req-plain', label: 'Design agreed', type: 'manual'},
      ],
      reviewCriteria: ['Reviewer criterion nobody claimed'],
    });
    const p = db.saveProject({
      name: 'P',
      description: '',
      assignments: [{recordId: style.id, override: null}],
    });
    linkRepository(dir, p.id);
    db.db
      .prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)')
      .run('repository:' + p.id, dir);
    writeFileSync(join(dir, 'runbook.md'), '# Runbook\nChange the log level at runtime\n');
    const set = JSON.parse(
      (
        await callTool(db, 'brain_prepare', {
          projectId: p.id,
          task: 'Ship it',
          recordIds: [style.id],
        })
      ).content[0].text,
    );
    const ev = (requirementId: string, extra: Record<string, unknown>) => ({
      recordId: style.id,
      recordVersion: style.version,
      requirementId,
      status: 'pass',
      note: 'done',
      ...extra,
    });
    const review = async (evidence: unknown[]) => {
      const r = await callTool(db, 'brain_review', {
        projectId: p.id,
        instructionSetId: set.instructionSetId,
        evidence,
      });
      assert.ok(!('isError' in r), r.content[0].text);
      const report = JSON.parse(r.content[0].text);
      return {
        status: report.status,
        by: Object.fromEntries(
          report.results.map((x: {id: string; status: string}) => [x.id, x.status]),
        ),
      };
    };
    // Nothing claimed: still not verified, and the unclaimed criterion is only advisory.
    const empty = await review([]);
    assert.equal(empty.status, 'not_verified');
    assert.equal(empty.by['review-1'], 'advisory');
    // All proofs present and right: pass.
    const good = await review([
      ev('req-tests', {proof: {kind: 'command', command: 'npm test', exitCode: 0}}),
      ev('req-doc', {proof: {kind: 'file', path: 'runbook.md', contains: 'log level'}}),
      ev('req-log', {proof: {kind: 'sample', excerpt: '{"level":"info","trace_id":"abc"}'}}),
      ev('req-plain', {proof: {kind: 'sample', excerpt: 'Approved in docs/plan.md'}}),
    ]);
    assert.deepEqual(
      [good.status, good.by['req-tests'], good.by['req-doc'], good.by['req-log']],
      ['pass', 'pass', 'pass', 'pass'],
    );
    // A pass without proof, a wrong proof kind, a failing command and a file without the text.
    const bad = await review([
      ev('req-tests', {proof: {kind: 'command', command: 'npm test', exitCode: 1}}),
      ev('req-doc', {proof: {kind: 'file', path: 'runbook.md', contains: 'restore drill'}}),
      ev('req-log', {proof: {kind: 'command', command: 'cat log', exitCode: 0}}),
      ev('req-plain', {}),
    ]);
    assert.deepEqual(
      [bad.status, bad.by['req-tests'], bad.by['req-doc'], bad.by['req-log'], bad.by['req-plain']],
      ['fail', 'fail', 'fail', 'not_verified', 'not_verified'],
    );
    // A file proof cannot leave the repository.
    const escape = await callTool(db, 'brain_review', {
      projectId: p.id,
      instructionSetId: set.instructionSetId,
      evidence: [ev('req-doc', {proof: {kind: 'file', path: '../etc/passwd'}})],
    });
    assert.equal(escape.isError, true);
    // A review from a known host and thread is traced to that session, not as unlinked.
    await callTool(db, 'brain_review', {
      projectId: p.id,
      instructionSetId: set.instructionSetId,
      host: 'codex',
      threadId: 'thread-9',
    });
    const linked = db.db
      .prepare(
        "SELECT count(*) AS n FROM trace_events WHERE event_type='compliance.review' AND run_id='codex:thread-9'",
      )
      .get() as {n: number};
    assert.equal(linked.n, 1);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('agents get records without shared boilerplate or sections that repeat other fields', () => {
  const record = {
    summary: 'Short summary.',
    useWhen: 'Use when testing.',
    principles: ['One', 'Two'],
    content:
      'Apply this specialist guidance only to the task and artifacts actually in scope. Scale evidence to the change; do not create formal documents, infrastructure, integrations or tool installations solely because this record is available. Existing project decisions and explicit task instructions take precedence over defaults.\n\nPERSONAL PREFERENCES\nShort summary.\n\nAPPLIES WHEN\nUse when testing.\n\nPREFERRED OUTCOMES\n- One\n- Two\n\nRULES\n- Keep this.\n\nPROCEDURES\nUse relevant installed skills for technical steps. Their incidental defaults do not override explicit task choices or applicable personal preferences. A missing optional skill is not a reason to invent verification.',
  } as unknown as BrainRecord;
  assert.equal(compactForAgent(record).content, 'RULES\n- Keep this.');
  const changed = {...record, principles: ['Different']};
  assert.match(
    compactForAgent(changed).content,
    /PREFERRED OUTCOMES\n- One/,
    'a section that differs from the field stays',
  );
});

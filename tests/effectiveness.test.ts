import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {
  benchPrompt,
  benchRuns,
  cancelBenchRun,
  parseChecks,
  saveBenchTask,
  score,
  startBenchRun,
} from '../src/instructions/benchmark.ts';

function withDb(cb: (db: BrainDB) => Promise<void> | void) {
  const dir = mkdtempSync(join(tmpdir(), 'pb-effect-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  return Promise.resolve(cb(db)).finally(() => {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  });
}
const until = async (ok: () => boolean) => {
  for (let i = 0; i < 200 && !ok(); i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
};

test('daily effectiveness counts corrections only where recorded, and repeats of approved lessons', () =>
  withDb((db) => {
    const prompt = (cue?: boolean) =>
      db.trace({
        agent: 'claude',
        channel: 'hook',
        eventType: 'hook.prompt.context',
        runId: 'claude:s1',
        metadata: cue === undefined ? {} : {preferenceCue: cue},
      });
    prompt(true);
    prompt(false);
    prompt(false);
    prompt(); // before the flag was recorded
    const remember = (content: string) =>
      db.capture({
        action: 'remember',
        rating: 'correction',
        note: content,
        proposedContent: content,
        proposal: {title: content.slice(0, 20), domain: 'coding'},
      }).feedback!;
    const first = remember('Default document output is HTML with a diagram');
    db.decideFeedback(first.id, 'accept');
    remember('Use HTML as the default document output with a diagram');
    remember('Prefer tabs for indentation');
    const [week] = db.effectiveness();
    assert.equal(week.prompts, 4);
    assert.equal(week.corrections, 1);
    assert.equal(week.recordedPrompts, 3);
    assert.equal(week.lessons, 3);
    assert.equal(week.repeats, 1, 'only the paraphrase of the approved lesson repeats');
    // Adoption: Claude had 4 prompts and no style loads; Codex loaded once, one call failed.
    for (const [eventType, outcome] of [
      ['mcp.brain_get', 'success'],
      ['mcp.brain_review', 'error'],
    ]) {
      db.trace({agent: 'codex', channel: 'mcp', eventType, outcome});
    }
    const byAgent = Object.fromEntries(db.adoption().map((a) => [a.agent, a]));
    assert.deepEqual([byAgent.claude.prompts, byAgent.claude.loads], [4, 0]);
    assert.deepEqual([byAgent.codex.loads, byAgent.codex.errors], [1, 1]);
  }));

test('checks parse strictly and score case-insensitively', () => {
  const checks = parseChecks('contains: <HTML\nnot: TODO\nregex: flow(chart)?\n');
  assert.deepEqual(
    checks.map((c) => c.kind),
    ['contains', 'absent', 'regex'],
  );
  assert.deepEqual(score('<html> flowchart', checks), {passed: 3, total: 3, failed: []});
  assert.deepEqual(score('todo', checks).failed, [
    'contains: <HTML',
    'absent: TODO',
    'regex: flow(chart)?',
  ]);
  assert.throws(() => parseChecks('must have html'), /contains:, absent: or regex:/);
  assert.throws(() => parseChecks('regex: ('), /Invalid regex/);
  assert.throws(() => parseChecks(''), /1–20 checks/);
});

test('comparison runs each task with and without styles and scores both the same way', () =>
  withDb(async (db) => {
    const p = db.saveProject({name: 'P', description: '', assignments: []});
    db.createProjectStyle(
      p.id,
      {title: 'Docs', domain: 'coding', summary: 's', content: 'Always answer in HTML.'},
      p.version,
    );
    const task = saveBenchTask(db, {
      title: 'Release note',
      projectId: p.id,
      prompt: 'Write a release note.',
      checks: 'contains: <html',
    });
    const withPrompt = benchPrompt(db, task, 'with'),
      without = benchPrompt(db, task, 'without');
    assert.match(withPrompt, /Always answer in HTML[\s\S]*Write a release note/);
    assert.doesNotMatch(without, /Always answer in HTML/);
    assert.ok(withPrompt.endsWith(without), 'the styles are the only difference');

    const seen: string[] = [];
    // Fake agent: follows the styles when given them; Claude fails once to show errors are kept.
    const runner = async (agent: string, prompt: string) => {
      seen.push(agent);
      if (agent === 'claude' && seen.filter((a) => a === 'claude').length === 1) {
        throw new Error('not logged in');
      }
      return prompt.includes('Always answer in HTML') ? '<html>note</html>' : 'note';
    };
    assert.throws(
      () => startBenchRun(db, {taskIds: [task.id], agents: ['codex'], runs: 9}, runner),
      /1–5/,
    );
    assert.throws(
      () => startBenchRun(db, {taskIds: [task.id], agents: ['gpt'], runs: 1}, runner),
      /Codex, Claude/,
    );
    const job = startBenchRun(
      db,
      {taskIds: [task.id], agents: ['codex', 'claude'], runs: 2},
      runner,
    );
    assert.equal(job.planned, 8);
    assert.throws(
      () => startBenchRun(db, {taskIds: [task.id], agents: ['codex'], runs: 1}, runner),
      /already running/,
    );
    await until(() => benchRuns(db)[0].status !== 'running');
    const run = benchRuns(db)[0];
    assert.equal(run.status, 'ready');
    assert.equal(run.results.length, 8);
    const rate = (agent: string, condition: string) =>
      run.results
        .filter((r) => r.agent === agent && r.condition === condition && !r.error)
        .map((r) => r.passed / r.total);
    assert.deepEqual(rate('codex', 'with'), [1, 1]);
    assert.deepEqual(rate('codex', 'without'), [0, 0]);
    assert.equal(run.results.filter((r) => r.error).length, 1);
    assert.match(run.results.find((r) => r.error)!.error!, /not logged in/);
  }));

test('a comparison can be stopped and the cap on agent calls holds', () =>
  withDb(async (db) => {
    const p = db.saveProject({name: 'P', description: '', assignments: []});
    const ids = Array.from(
      {length: 8},
      (_, i) =>
        saveBenchTask(db, {title: 'T' + i, projectId: p.id, prompt: 'x', checks: 'contains: x'}).id,
    );
    assert.throws(
      () => startBenchRun(db, {taskIds: ids, agents: ['codex', 'claude'], runs: 2}),
      /64 agent calls/,
    );
    let release = () => {};
    const job = startBenchRun(
      db,
      {taskIds: ids.slice(0, 1), agents: ['codex'], runs: 3},
      () =>
        new Promise<string>((resolve) => {
          release = () => resolve('x');
        }),
    );
    cancelBenchRun(job.id);
    release();
    await until(() => benchRuns(db)[0].status !== 'running');
    assert.equal(benchRuns(db)[0].status, 'cancelled');
    assert.ok(benchRuns(db)[0].results.length < job.planned);
  }));

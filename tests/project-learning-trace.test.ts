import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {
  learningInput,
  validateLearning,
  applyLearningProposal,
  startLearningRun,
  learningRun,
  parseAgentJson,
  rejectLearningProposal,
  cancelLearningRun,
  syncLearningRuns,
  learningRunDetails,
  decideLearningItem,
  autoLearnFromProjects,
  projectLearningStatus,
} from '../src/instructions/project-learning.ts';
import {installResearchStyle} from '../src/styles/research-style.ts';

test('Learning from projects reads one complete JSON response with CLI prose or fences, but rejects ambiguous or broken output', () => {
  const value = {
    proposals: [
      {
        content: 'Braces { } and escaped "quotes" and slash \\ remain literal',
        nested: {items: [1, 2]},
      },
    ],
  };
  const json = JSON.stringify(value);
  for (const output of [
    json,
    json + '\nAnalysis complete.',
    'Here is the result:\n```json\n' + json + '\n```\nReview before publishing.',
  ]) {
    assert.deepEqual(parseAgentJson(output), value);
  }
  assert.throws(() => parseAgentJson(json + '\n{"proposals":[]}'), /ambiguous/);
  assert.throws(() => parseAgentJson(json.slice(0, -1)), /incomplete/);
  assert.throws(() => parseAgentJson('{"proposals":broken}'), /invalid/);
  assert.throws(() => parseAgentJson('No result'), /no proposal JSON/);
  assert.throws(() => validateLearning(parseAgentJson('{"wrong":[]}\nDone'), [], []), /proposals/);
});

test('trace project scope isolates events and aggregate counts including no-project events', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-trace-scope-')),
    db = new BrainDB(join(dir, 'db'));
  try {
    const a = db.saveProject({name: 'A', description: '', assignments: []}),
      b = db.saveProject({name: 'B', description: '', assignments: []});
    for (const id of [a.id, b.id, undefined]) {
      db.trace({
        runId: 'r',
        agent: 'codex',
        channel: 'hook',
        eventType: 'hook.session.context',
        outcome: 'emitted',
        metadata: {...(id ? {projectId: id} : {}), contextChars: 100},
      });
    }
    assert.equal(db.listTrace({projectId: a.id}).length, 1);
    assert.equal(db.traceStats(a.id).events, 1);
    assert.equal(db.traceStats(a.id).estimatedContextTokens, 25);
    assert.equal(db.listTrace({projectId: 'unscoped'}).length, 1);
    assert.equal(db.traceStats('unscoped').events, 1);
    assert.equal(db.traceStats().events, 3);
    assert.throws(() => db.listTrace({projectId: 'missing'}));
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('Learning from projects rejects fabricated sources/conflicts/stale sources and publishes only a new shared version', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-learning-')),
    db = new BrainDB(join(dir, 'db'));
  try {
    const r = db.create({
      kind: 'preference',
      domain: 'coding',
      title: 'Code',
      summary: 'Original',
      content: 'Original',
      tags: [],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
    });
    const p = db.saveProject({
      name: 'A',
      description: '',
      assignments: [{recordId: r.id, override: null}],
    });
    const local = db.personalizeRecord(
      p.id,
      r.id,
      {content: 'Private source'},
      r.version,
      p.version,
    );
    const input = learningInput(db, [p.id]);
    assert.ok(input.sources.some((s) => s.recordId === local.id));
    assert.ok(input.targets.every((s) => !s.projectId));
    const proposal = {
      targetId: r.id,
      title: 'Code',
      summary: 'Better',
      content: 'Reusable methods',
      principles: ['Simple'],
      examples: ['Example'],
      externalSkills: [],
      reviewCriteria: ['Check'],
      rationale: 'Evidence',
      conflicts: [],
      sourceIds: [p.id + ':' + local.id],
    };
    assert.throws(() =>
      validateLearning(
        {proposals: [{...proposal, sourceIds: ['fake']}]},
        input.sources,
        input.targets,
      ),
    );
    const proposals = validateLearning({proposals: [proposal]}, input.sources, input.targets);
    const job = {
      id: 'test',
      status: 'ready',
      sources: input.sources,
      targets: input.targets,
      proposals,
      applied: [],
    };
    const save = () =>
      db.db
        .prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('learning-run:test',?)")
        .run(JSON.stringify(job));
    save();
    const updated = applyLearningProposal(db, 'test', r.id);
    assert.equal(updated.version, 2);
    assert.equal(db.get(local.id)!.content, 'Private source');
    assert.throws(() => applyLearningProposal(db, 'test', r.id));
    job.targets = [updated];
    job.applied = [];
    job.proposals = [{...proposals[0], conflicts: ['Conflict']}];
    save();
    assert.throws(() => applyLearningProposal(db, 'test', r.id));
    job.proposals = proposals;
    save();
    db.update(local.id, {content: 'Changed'}, local.version);
    assert.throws(() => applyLearningProposal(db, 'test', r.id), /Source style changed/);
    assert.throws(
      () => applyLearningProposal(db, 'test', r.id, {content: 'Edited', resolution: 'Reviewed'}),
      /Source style changed/,
    );
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('Learning from projects proposals land in Learning feedback once and are decided through their own checks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-learning-inbox-')),
    db = new BrainDB(join(dir, 'db'));
  try {
    const r = db.create({
      kind: 'preference',
      domain: 'coding',
      title: 'Code',
      summary: 'Original',
      content: 'Original',
      tags: [],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
    });
    const p = db.saveProject({
      name: 'Alpha',
      description: '',
      assignments: [{recordId: r.id, override: null}],
    });
    const local = db.personalizeRecord(p.id, r.id, {content: 'Private'}, r.version, p.version);
    const input = learningInput(db, [p.id]);
    const proposals = validateLearning(
      {
        proposals: [
          {
            targetId: r.id,
            title: 'Code',
            summary: 'Better',
            content: 'Reusable methods',
            principles: [],
            examples: [],
            externalSkills: [],
            reviewCriteria: [],
            rationale: 'Evidence',
            conflicts: [],
            sourceIds: [p.id + ':' + local.id],
          },
        ],
      },
      input.sources,
      input.targets,
    );
    const put = (id: string, targets = input.targets) =>
      db.db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(
        'learning-run:' + id,
        JSON.stringify({
          id,
          status: 'ready',
          sources: input.sources,
          targets,
          proposals,
          applied: [],
        }),
      );
    put('job1');
    syncLearningRuns(db);
    syncLearningRuns(db);
    const items = db.inbox({source: 'projects'});
    assert.equal(items.length, 1, 'copied once');
    const [item] = items;
    assert.equal(item.recordId, r.id);
    assert.equal(item.proposedContent, 'Reusable methods');
    assert.match(item.note, /Evidence[\s\S]*1 style\(s\) in 1 project/);
    assert.equal(learningRunDetails(db, item)!.sources[0].project, 'Alpha');
    assert.equal(learningRunDetails(db, item)!.sources[0].projectId, input.projects[0].id);
    assert.throws(() => db.decideFeedback(item.id, 'accept'), /decideLearningItem/);
    assert.throws(() => db.consolidateFeedback([item.id, item.id + 'x']), /distinct|consolidated/);
    assert.throws(
      () => decideLearningItem(db, item.id, 'accept', {scope: 'project'}),
      /shared style/,
    );
    const done = decideLearningItem(db, item.id, 'accept');
    assert.equal(done.status, 'accepted');
    assert.equal(done.appliedVersion, 2);
    assert.equal(db.get(r.id)!.content, 'Reusable methods');
    assert.equal(db.get(local.id)!.content, 'Private', 'private copies are untouched');
    assert.deepEqual(learningRun(db, 'job1').applied, [r.id]);
    db.purgeFeedback([item.id]);
    syncLearningRuns(db);
    assert.equal(db.inbox({source: 'projects'}).length, 0, 'purged items are not recreated');

    put('job2', [db.get(r.id)!]);
    syncLearningRuns(db);
    const second = db.inbox({source: 'projects'})[0];
    assert.equal(decideLearningItem(db, second.id, 'dismiss').status, 'dismissed');
    assert.deepEqual(learningRun(db, 'job2').rejected, [r.id]);
    assert.equal(db.get(r.id)!.version, 2);

    const mandatory = 'Never expose secrets.';
    db.update(r.id, {content: mandatory}, 2);
    proposals[0].conflicts = ['Compact rows vs responsive layout'];
    put('job3', [db.get(r.id)!]);
    syncLearningRuns(db);
    const edited = db.inbox({source: 'projects'}).find((i) => i.status === 'pending')!;
    const edit = {
      content: mandatory + ' Wrap controls when needed.',
      conflictResolution: 'Wrapping takes precedence on narrow screens.',
    };
    assert.throws(
      () => decideLearningItem(db, edited.id, 'accept', {content: edit.content}),
      /conflicting guidance/,
    );
    assert.throws(
      () =>
        decideLearningItem(db, edited.id, 'accept', {
          ...edit,
          content: 'Wrap controls',
        }),
      /mandatory statements/,
    );
    assert.throws(
      () => decideLearningItem(db, edited.id, 'accept', {conflictResolution: 42}),
      /Conflict resolution/,
    );
    db.saveFixtures(r.id, {keep: [], avoid: ['Wrap controls']});
    assert.throws(() => decideLearningItem(db, edited.id, 'accept', edit), /Regression fixtures/);
    assert.equal(db.get(r.id)!.version, 3);
    assert.equal(db.feedbackItem(edited.id)!.status, 'pending');
    assert.equal(
      learningRun(db, 'job3').proposals[0].manualReview,
      undefined,
      'failed edits roll back',
    );
    db.saveFixtures(r.id, {keep: [], avoid: []});
    const applied = decideLearningItem(db, edited.id, 'accept', edit);
    assert.equal(applied.status, 'accepted');
    assert.equal(db.get(r.id)!.content, edit.content);
    assert.equal(db.feedbackItem(edited.id)!.proposedContent, edit.content);
    assert.equal(
      learningRun(db, 'job3').proposals[0].manualReview!.resolution,
      edit.conflictResolution,
    );
    assert.equal(
      learningRun(db, 'job3').proposals[0].manualReview!.originalContent,
      'Reusable methods',
    );
    assert.equal(db.get(local.id)!.content, 'Private');
    assert.throws(() => decideLearningItem(db, edited.id, 'accept', edit), /already decided/);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('Research installs once and is required by architecture without selecting a palette', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-research-')),
    db = new BrainDB(join(dir, 'db'));
  try {
    const r = db.create({
      kind: 'preference',
      domain: 'architecture',
      title: 'Architecture',
      summary: '',
      content: 'Existing',
      tags: [],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
    });
    const p = db.saveProject({
      name: 'A',
      description: '',
      assignments: [{recordId: r.id, override: null}],
    });
    installResearchStyle(db);
    const research = db.list().find((s) => s.domain === 'research')!;
    assert.ok(db.get(r.id)!.requiredIds!.includes(research.id));
    assert.ok(db.scopedRecords(p.id).some((s) => s.id === research.id));
    const version = db.project(p.id).version;
    installResearchStyle(db);
    assert.equal(db.project(p.id).version, version);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('Learning from projects reports missing CLI as a persisted failure without changing styles', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-learning-cli-')),
    db = new BrainDB(join(dir, 'db')),
    path = process.env.PATH;
  try {
    const p = db.saveProject({name: 'A', description: '', assignments: []});
    assert.throws(
      () => startLearningRun(db, null as unknown as Parameters<typeof startLearningRun>[1]),
      /Choose Codex or Claude/,
    );
    process.env.PATH = dir;
    const run = startLearningRun(db, {agent: 'codex', projectIds: [p.id]});
    for (let i = 0; i < 100 && learningRun(db, run.id).status === 'running'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const job = learningRun(db, run.id);
    assert.equal(job.status, 'failed');
    assert.match(job.error!, /Cannot start codex/);
    assert.deepEqual(db.list(), []);
  } finally {
    process.env.PATH = path;
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('Learning from projects retains different overrides, excludes unselected styles, rejects drift and rolls back failed publication', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-learning-boundaries-')),
    db = new BrainDB(join(dir, 'db'));
  try {
    const r = db.create({
      kind: 'preference',
      domain: 'coding',
      title: 'Code',
      summary: 'Original',
      content: 'Original',
      tags: ['code'],
      useWhen: 'When coding',
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
      reviewCriteria: ['Keep this check'],
      requirements: [
        {id: 'req-output', label: 'Editable output', type: 'artifact', extension: '.txt'},
      ],
    });
    const a = db.saveProject({
      name: 'A',
      description: '',
      assignments: [{recordId: r.id, override: 'A convention'}],
    });
    const b = db.saveProject({
      name: 'B',
      description: '',
      assignments: [{recordId: r.id, override: 'B convention'}],
    });
    db.create({
      kind: 'preference',
      domain: 'design',
      projectId: a.id,
      title: 'Unselected',
      summary: '',
      content: 'Do not learn this',
      tags: [],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
    });
    const input = learningInput(db, [a.id, b.id, a.id]);
    assert.equal(input.sources.length, 2);
    assert.equal(input.projects.length, 2);
    assert.deepEqual(
      input.sources.map((r) => r.content),
      ['A convention', 'B convention'],
    );
    assert.notEqual(input.sources[0].id, input.sources[1].id);
    const proposal = {
      targetId: r.id,
      title: 'Code',
      summary: 'Better',
      content: 'Reusable convention',
      principles: [],
      examples: [],
      externalSkills: [],
      reviewCriteria: ['Keep this check'],
      rationale: 'Compare evidence',
      conflicts: [],
      sourceIds: [input.sources[0].id],
    };
    assert.throws(
      () =>
        validateLearning(
          {proposals: [{...proposal, externalSkills: ['invented']}]},
          input.sources,
          input.targets,
        ),
      /invents/,
    );
    assert.throws(
      () =>
        validateLearning(
          {proposals: [{...proposal, content: 'Run npm install renderer then write mxGeometry'}]},
          input.sources,
          input.targets,
        ),
      /technical recipe/,
    );
    assert.throws(
      () =>
        validateLearning(
          {proposals: [{...proposal, reviewCriteria: []}]},
          input.sources,
          input.targets,
        ),
      /removes/,
    );
    const proposals = validateLearning({proposals: [proposal]}, input.sources, input.targets);
    const job = {
      id: 'atomic',
      status: 'ready',
      sources: input.sources,
      targets: input.targets,
      proposals,
      applied: [],
    };
    db.db
      .prepare("INSERT INTO meta(key,value) VALUES('learning-run:atomic',?)")
      .run(JSON.stringify(job));
    db.db.exec(
      "CREATE TRIGGER fail_learning_run BEFORE UPDATE ON meta WHEN NEW.key='learning-run:atomic' BEGIN SELECT RAISE(ABORT,'forced failure'); END;",
    );
    assert.throws(() => applyLearningProposal(db, 'atomic', r.id), /forced failure/);
    assert.equal(db.get(r.id)!.version, 1);
    assert.equal(db.history(r.id).length, 1);
    db.db.exec('DROP TRIGGER fail_learning_run');
    db.saveProject(
      {...a, assignments: [{recordId: r.id, override: 'Changed override'}]},
      a.id,
      a.version,
    );
    assert.throws(() => applyLearningProposal(db, 'atomic', r.id), /selection changed/);
    rejectLearningProposal(db, 'atomic', r.id);
    assert.throws(() => applyLearningProposal(db, 'atomic', r.id), /already decided/);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('Learning from projects CLI completes, cancels and does not recreate deleted project history', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-learning-lifecycle-')),
    db = new BrainDB(join(dir, 'db')),
    path = process.env.PATH;
  const windowsAgent = (delay: number) => {
    writeFileSync(join(dir, 'claude.cmd'), '@ECHO off\r\n"%dp0%/agent.cjs" %*');
    writeFileSync(
      join(dir, 'agent.cjs'),
      `process.stdin.resume();process.stdin.on('end',()=>setTimeout(()=>console.log('{"proposals":[]}'),${delay}));`,
    );
  };
  const wait = async (id: string) => {
    for (let i = 0; i < 500; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      const row = db.db.prepare('SELECT value FROM meta WHERE key=?').get('learning-run:' + id) as
        {value: string} | undefined;
      if (!row || JSON.parse(row.value).status !== 'running') {
        return;
      }
    }
  };
  try {
    const project = db.saveProject({name: 'A', description: '', assignments: []});
    writeFileSync(
      join(dir, 'claude'),
      `#!/bin/sh\n/bin/cat >/dev/null\nprintf '{"proposals":[]}\\n'\n`,
      {mode: 0o755},
    );
    if (process.platform === 'win32') {
      windowsAgent(0);
    }
    process.env.PATH = dir;
    const ready = startLearningRun(db, {agent: 'claude', projectIds: [project.id]});
    await wait(ready.id);
    assert.equal(learningRun(db, ready.id).status, 'ready');
    writeFileSync(join(dir, 'claude'), '#!/bin/sh\n/bin/cat >/dev/null\nexec /bin/sleep 30\n', {
      mode: 0o755,
    });
    if (process.platform === 'win32') {
      windowsAgent(30000);
    }
    const cancelled = startLearningRun(db, {agent: 'claude', projectIds: [project.id]});
    assert.equal(cancelLearningRun(db, cancelled.id).status, 'cancelled');
    writeFileSync(
      join(dir, 'claude'),
      `#!/bin/sh\n/bin/cat >/dev/null\n/bin/sleep 0.05\nprintf '{"proposals":[]}\\n'\n`,
      {mode: 0o755},
    );
    if (process.platform === 'win32') {
      windowsAgent(50);
    }
    const deleted = startLearningRun(db, {agent: 'claude', projectIds: [project.id]});
    const preview = db.deletionPreview('project', project.id);
    db.deleteWithPreview('project', project.id, preview.fingerprint);
    assert.equal(
      db.db.prepare("SELECT count(*) n FROM meta WHERE key LIKE 'learning-run:%'").get()!.n,
      0,
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.throws(() => learningRun(db, deleted.id), /not found/);
  } finally {
    process.env.PATH = path;
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test(
  'Learning from projects agent finishing after the database closed does not throw',
  {skip: process.platform === 'win32' && 'POSIX shell fixture'},
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pb-learning-closed-')),
      db = new BrainDB(join(dir, 'db')),
      path = process.env.PATH;
    try {
      const project = db.saveProject({name: 'A', description: '', assignments: []});
      writeFileSync(
        join(dir, 'claude'),
        `#!/bin/sh\n/bin/cat >/dev/null\n/bin/sleep 0.2\nprintf '{"proposals":[]}\\n'\n`,
        {mode: 0o755},
      );
      process.env.PATH = dir;
      // An earlier test's agent may still be exiting; only one analysis runs at a time.
      for (let attempt = 0; ; attempt++) {
        try {
          startLearningRun(db, {agent: 'claude', projectIds: [project.id]});
          break;
        } catch (error) {
          if (attempt > 100 || !/Another project analysis is running/.test(String(error))) {
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
      db.close();
      // An uncaught "database is not open" error here fails this test in node:test.
      await new Promise((resolve) => setTimeout(resolve, 600));
    } finally {
      process.env.PATH = path;
      rmSync(dir, {recursive: true, force: true});
    }
  },
);

test('Learning from projects uses preference evidence and preserves required skill references', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-learning-evidence-')),
    db = new BrainDB(join(dir, 'db'));
  try {
    const base = {
      domain: 'coding',
      title: 'Code',
      summary: 'Summary',
      content: 'Instructions',
      tags: [],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
    };
    const review = db.create({...base, kind: 'review', title: 'Review evidence'});
    const style = db.create({
      ...base,
      kind: 'preference',
      externalSkills: ['verified-reference'],
      requiredIds: [review.id],
    });
    // Only customized styles are evidence; an unchanged shared style is already a target.
    const plain = db.saveProject({
      name: 'Plain',
      description: '',
      assignments: [{recordId: style.id, override: null}],
    });
    assert.equal(learningInput(db, [plain.id]).sources.length, 0);
    const project = db.saveProject({
      name: 'A',
      description: '',
      assignments: [{recordId: style.id, override: 'Project instructions'}],
    });
    const input = learningInput(db, [project.id]);
    assert.ok(!input.sources.some((r) => r.recordId === review.id && r.kind === 'review'));
    const proposal = {
      targetId: style.id,
      title: 'Code',
      summary: 'Improved',
      content: 'Improved instructions',
      principles: [],
      examples: [],
      externalSkills: [],
      reviewCriteria: [],
      rationale: 'Evidence',
      conflicts: [],
      sourceIds: [project.id + ':' + style.id],
    };
    assert.throws(
      () => validateLearning({proposals: [proposal]}, input.sources, input.targets),
      /removes a required skill/,
    );
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('runs and items saved by earlier versions join the learning loop on open', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-learning-legacy-'));
  try {
    let db = new BrainDB(join(dir, 'db'));
    const run = {id: 'run1', status: 'ready', proposals: [], applied: []};
    db.db
      .prepare('INSERT INTO meta(key,value) VALUES(?,?)')
      .run('old-analysis:run1', JSON.stringify(run));
    db.db
      .prepare('INSERT INTO meta(key,value) VALUES(?,?)')
      .run('instruction-set:keep', JSON.stringify({id: 'keep', recordIds: []}));
    db.db
      .prepare(
        "INSERT INTO feedback(id,rating,note,created_at,source,source_event_id,diagnosis,status,action) VALUES('f1','correction','n','2026-11-01','older-source','old-analysis:run1:t1','missing','pending','revise')",
      )
      .run();
    db.close();
    db = new BrainDB(join(dir, 'db'));
    assert.equal(learningRun(db, 'run1').id, 'run1');
    assert.ok(
      db.db.prepare('SELECT 1 FROM meta WHERE key=?').get('instruction-set:keep'),
      'other metadata untouched',
    );
    const item = db.feedbackItem('f1')!;
    assert.equal(item.source, 'projects');
    assert.equal(item.sourceEventId, 'learning-run:run1:t1');
    db.close();
    db = new BrainDB(join(dir, 'db'));
    assert.equal(db.feedbackItem('f1')!.sourceEventId, 'learning-run:run1:t1', 'idempotent');
    db.close();
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('automatic learning compares projects only when they have customizations that changed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-learning-auto-')),
    db = new BrainDB(join(dir, 'db')),
    path = process.env.PATH;
  try {
    const r = db.create({
      kind: 'preference',
      domain: 'coding',
      title: 'Code',
      summary: '',
      content: 'Shared',
      tags: [],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
    });
    const p = db.saveProject({
      name: 'A',
      description: '',
      assignments: [{recordId: r.id, override: null}],
    });
    assert.equal(db.learningSettings().autoProjectsAsked, false, 'the user has not been asked yet');
    assert.equal(autoLearnFromProjects(db), 'off', 'off by default: never calls an agent');
    db.saveLearningSettings({...db.learningSettings(), autoProjects: true});
    assert.equal(
      autoLearnFromProjects(db),
      'nothing-to-compare',
      'shared styles unchanged: no agent call',
    );
    db.saveLearningSettings({...db.learningSettings(), autoProjects: false});
    db.personalizeRecord(p.id, r.id, {content: 'Private'}, r.version, p.version);
    process.env.PATH = dir;
    assert.equal(projectLearningStatus(db).state, 'off', 'off until the user turns it on');
    db.saveLearningSettings({...db.learningSettings(), autoProjects: true, agent: 'codex'});
    assert.equal(db.learningSettings().autoProjectsAsked, true);
    db.saveLearningSettings({...db.learningSettings(), agent: ''});
    assert.equal(projectLearningStatus(db).state, 'no-agent');
    db.saveLearningSettings({...db.learningSettings(), agent: 'codex'});
    assert.equal(projectLearningStatus(db).customizedStyles, 1);
    let result = autoLearnFromProjects(db);
    for (let i = 0; i < 1000 && result === 'busy'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      result = autoLearnFromProjects(db);
    }
    assert.equal(result, 'started');
    for (let i = 0; i < 1000 && projectLearningStatus(db).state === 'running'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(
      projectLearningStatus(db).last?.status,
      'failed',
      'missing CLI is shown, not retried',
    );
    assert.equal(autoLearnFromProjects(db), 'unchanged');
    assert.equal(
      projectLearningStatus(db).lastCheck?.result,
      'unchanged',
      'each check is recorded',
    );
    assert.equal(projectLearningStatus(db).intervalMinutes, 2);
    db.saveLearningSettings({...db.learningSettings(), autoProjects: false});
    assert.equal(autoLearnFromProjects(db, true), 'off');
  } finally {
    process.env.PATH = path;
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('Approved global lessons are folded into a main style, archived on apply, and agent reviews count as evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-lesson-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    const base = {
      kind: 'preference' as const,
      domain: 'coding',
      summary: 'S',
      priority: 50,
      status: 'active',
      checks: [],
      backend: null,
    };
    const main = db.create({...base, title: 'Code', content: 'Readable code.', tags: []});
    const lesson = db.create({
      ...base,
      title: 'Tabs',
      content: 'Use tabs.',
      tags: ['remembered'],
    });
    const input = learningInput(db, []);
    assert.deepEqual(
      input.sources.map((s) => s.id),
      ['global:' + lesson.id],
    );
    assert.ok(!input.targets.some((t) => t.id === lesson.id), 'a lesson is not a merge target');
    const proposals = validateLearning(
      {
        proposals: [
          {
            targetId: main.id,
            title: 'Code',
            summary: 'S',
            content: 'Readable code. Use tabs.',
            principles: [],
            examples: [],
            externalSkills: [],
            reviewCriteria: [],
            rationale: 'global:' + lesson.id,
            conflicts: [],
            sourceIds: ['global:' + lesson.id],
          },
        ],
      },
      input.sources,
      input.targets,
    );
    db.db
      .prepare('INSERT INTO meta(key,value) VALUES(?,?)')
      .run(
        'learning-run:j',
        JSON.stringify({id: 'j', status: 'ready', ...input, proposals, applied: []}),
      );
    syncLearningRuns(db);
    const [item] = db.inbox({source: 'projects'});
    assert.match(learningRunDetails(db, item)!.sources[0].project, /Approved lesson/);

    db.trace({
      agent: 'claude',
      channel: 'review',
      eventType: 'compliance.review',
      outcome: 'not_verified',
      metadata: {
        complianceReport: JSON.stringify({
          results: [
            {recordId: main.id, recordVersion: 1, status: 'not_verified', agentReported: 'pass'},
            {recordId: main.id, recordVersion: 1, status: 'fail', agentReported: 'pass'},
            {recordId: main.id, recordVersion: 1, status: 'not_verified'},
          ],
        }),
      },
    });
    assert.deepEqual(db.inbox({source: 'projects'})[0].evidence.reviews, {
      passed: 1,
      failed: 1,
      agents: {claude: {passed: 1, failed: 1}},
    });
    assert.deepEqual(
      db.learningHealth().styleChecks.map((r) => [r.title, r.passed, r.failed]),
      [['Code', 1, 1]],
    );

    decideLearningItem(db, item.id, 'accept');
    assert.equal(db.get(main.id)!.content, 'Readable code. Use tabs.');
    assert.equal(db.get(lesson.id)!.status, 'archived');
    assert.deepEqual(db.learningHealth().styleChecks, [], 'old-version results do not carry over');
    assert.throws(() => learningInput(db, []), /Select 1–30 projects/, 'no lessons left');
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

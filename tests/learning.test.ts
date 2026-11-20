import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {learningRun} from '../src/instructions/project-learning.ts';
import {looksLikeCredential, lostObligations} from '../src/core/learning.ts';
import type {RecordInput} from '../src/core/models.ts';
import {exportLibrary, previewLibraryImport, importLibrary} from '../src/core/library-transfer.ts';
import {
  handoffPreview,
  handoffWrite,
  setAutoExport,
  staleExports,
  syncExports,
} from '../src/projects/handoff.ts';

const style = (content = 'Use tabs. Never compress code into one line.'): RecordInput => ({
  kind: 'preference',
  domain: 'coding',
  title: 'Readable code',
  summary: 'Readability',
  content,
  tags: [],
  priority: 90,
  status: 'active',
  checks: [],
  backend: null,
});
function withDb(cb: (db: BrainDB, path: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'pb-learn-'));
  const path = join(dir, 'brain.sqlite');
  const db = new BrainDB(path);
  try {
    cb(db, path);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
}

test('helpers detect credentials and dropped obligations', () => {
  assert.ok(looksLikeCredential('api_key = abcdef123456'));
  assert.ok(looksLikeCredential('token: abcdefghijk'));
  assert.ok(looksLikeCredential('Authorization: Bearer abcdefghijklmnopqrstuvwxyz'));
  assert.ok(!looksLikeCredential('Prefer readable keys in maps'));
  assert.deepEqual(lostObligations('Use tabs. Never compress code.', 'Use tabs.'), [
    'Never compress code.',
  ]);
  assert.deepEqual(lostObligations('Never compress code.', 'never  COMPRESS code. Tabs.'), []);
});

test('capture respects off mode and project pause (F01)', () =>
  withDb((db) => {
    const p = db.saveProject({name: 'P', description: '', assignments: []});
    db.saveLearningSettings({mode: 'off', retentionDays: 90, pausedProjects: []});
    assert.equal(db.capture({rating: 'correction', note: 'x'}).recorded, false);
    db.saveLearningSettings({mode: 'suggest', retentionDays: 90, pausedProjects: [p.id]});
    assert.equal(db.capture({rating: 'correction', note: 'x', projectId: p.id}).recorded, false);
    assert.equal(db.capture({rating: 'correction', note: 'x'}).recorded, true);
    assert.equal(db.listFeedback().length, 1);
  }));

test('remember waits for review in suggest mode and survives restart (A01, F02)', () =>
  withDb((db, path) => {
    const p = db.saveProject({name: 'P', description: '', assignments: []});
    const other = db.saveProject({name: 'Q', description: '', assignments: []});
    const r = db.capture({
      action: 'remember',
      rating: 'correction',
      note: 'User asked',
      projectId: p.id,
      proposedContent: 'Use the existing formatter',
      proposal: {title: 'Formatter', domain: 'coding'},
    });
    assert.equal(r.feedback?.status, 'pending');
    const done = db.decideFeedback(r.feedback!.id, 'accept');
    const reopened = new BrainDB(path);
    try {
      const saved = reopened.get(done.recordId!);
      assert.equal(saved?.content, 'Use the existing formatter');
      assert.ok(reopened.scopedRecords(p.id).some((x) => x.id === saved!.id));
      assert.ok(!reopened.scopedRecords(other.id).some((x) => x.id === saved!.id));
    } finally {
      reopened.close();
    }
  }));

test('explicit mode commits remember and in-scope forget immediately (F02)', () =>
  withDb((db) => {
    db.saveLearningSettings({mode: 'explicit', retentionDays: 90, pausedProjects: []});
    const remembered = db.capture({
      action: 'remember',
      rating: 'correction',
      note: 'User asked',
      proposedContent: 'Write short status updates',
      proposal: {title: 'Status updates', domain: 'writing'},
    }).feedback!;
    assert.equal(remembered.status, 'accepted');
    const forgot = db.capture({
      action: 'forget',
      rating: 'rejected',
      note: 'User asked',
      recordId: remembered.recordId,
    }).feedback!;
    assert.equal(forgot.status, 'accepted');
    assert.equal(db.get(remembered.recordId!)?.status, 'archived');
  }));

test('source integrity, dedupe and secrets (A02, F03, F04)', () =>
  withDb((db) => {
    const r = db.create(style());
    const a = db.capture({rating: 'correction', note: 'x', recordId: r.id, sourceEventId: 'e1'});
    const b = db.capture({rating: 'correction', note: 'x', recordId: r.id, sourceEventId: 'e1'});
    assert.equal(a.feedback!.id, b.feedback!.id);
    assert.equal(a.feedback!.source, 'agent');
    assert.equal(db.get(r.id)?.version, 1);
    assert.throws(
      () => db.capture({rating: 'correction', note: 'password: hunter22'}),
      /credential/,
    );
  }));

test('diagnosis separates execution issues from revisions (A03)', () =>
  withDb((db) => {
    const r = db.create(style());
    assert.equal(
      db.addFeedback({rating: 'correction', note: 'x', recordId: r.id}).diagnosis,
      'execution',
    );
    assert.equal(
      db.addFeedback({rating: 'correction', note: 'x', recordId: r.id, proposedContent: 'y'})
        .diagnosis,
      'revision',
    );
    assert.equal(db.addFeedback({rating: 'correction', note: 'x'}).diagnosis, 'missing');
  }));

test('condensation that drops obligations needs acknowledgement (A04, F08)', () =>
  withDb((db) => {
    const r = db.create(style());
    const f = db.addFeedback({
      rating: 'correction',
      note: 'shorter',
      recordId: r.id,
      proposedContent: 'Use tabs.',
    });
    assert.throws(() => db.decideFeedback(f.id, 'accept'), /drops mandatory/);
    assert.equal(db.get(r.id)?.version, 1);
    assert.equal(db.decideFeedback(f.id, 'accept', {acknowledgeRemovals: true}).appliedVersion, 2);
  }));

test('stale proposals conflict and keep the newer edit (A05)', () =>
  withDb((db) => {
    const r = db.create(style());
    const f = db.addFeedback({
      rating: 'correction',
      note: 'x',
      recordId: r.id,
      proposedContent: 'Use tabs. Never compress code into one line. Prefer early returns.',
    });
    db.update(r.id, {content: 'Use spaces. Never compress code into one line.'}, 1);
    assert.throws(() => db.decideFeedback(f.id, 'accept'), /Version conflict/);
    assert.equal(db.inbox().find((i) => i.id === f.id)?.stale, true);
  }));

test('consolidation keeps sources and can be split back (F07)', () =>
  withDb((db) => {
    const r = db.create(style());
    const ids = ['one', 'two'].map(
      (note) => db.addFeedback({rating: 'correction', note, recordId: r.id}).id,
    );
    const merged = db.consolidateFeedback(
      ids,
      'Use tabs. Never compress code into one line. Wrap at 100.',
    );
    assert.deepEqual(merged.evidenceIds, ids);
    const listed = db.inbox();
    assert.equal(listed.find((i) => i.id === merged.id)?.evidence.independent, 2);
    assert.ok(ids.every((id) => listed.find((i) => i.id === id)?.status === 'superseded'));
    db.decideFeedback(merged.id, 'split');
    assert.ok(ids.every((id) => db.inbox().find((i) => i.id === id)?.status === 'pending'));
  }));

test('dismissal suppresses recurrence until suppressions are cleared (F15)', () =>
  withDb((db) => {
    const r = db.create(style());
    const input = {rating: 'correction', note: 'x', recordId: r.id, proposedContent: 'Same idea'};
    db.decideFeedback(db.capture(input).feedback!.id, 'dismiss');
    assert.equal(db.capture(input).recorded, false);
    assert.equal(db.clearSuppressions().cleared, 1);
    assert.equal(db.capture(input).recorded, true);
  }));

test('project-only apply leaves the shared style unchanged (F09)', () =>
  withDb((db) => {
    const shared = db.create(style());
    const p = db.saveProject({
      name: 'P',
      description: '',
      assignments: [{recordId: shared.id, override: null}],
    });
    const f = db.addFeedback({
      rating: 'correction',
      note: 'x',
      recordId: shared.id,
      projectId: p.id,
      proposedContent: 'Use tabs. Never compress code into one line. Use the repo formatter.',
    });
    const done = db.decideFeedback(f.id, 'accept', {scope: 'project'});
    assert.notEqual(done.recordId, shared.id);
    assert.equal(db.get(shared.id)?.version, 1);
    assert.equal(db.get(done.recordId!)?.projectId, p.id);
  }));

test('bulk decisions report per-item results (F10)', () =>
  withDb((db) => {
    const ok = db.addFeedback({rating: 'correction', note: 'x'}).id;
    const results = db.decideMany([ok, '00000000-0000-0000-0000-000000000000'], 'dismiss');
    assert.deepEqual(
      results.map((r) => r.ok),
      [true, false],
    );
  }));

test('purge, retention expiry and health measures (A07, A12, F19)', () =>
  withDb((db) => {
    const r = db.create(style());
    const applied = db.addFeedback({
      rating: 'correction',
      note: 'x',
      recordId: r.id,
      proposedContent: 'Use tabs. Never compress code into one line. Short functions.',
    });
    db.decideFeedback(applied.id, 'accept');
    db.restore(r.id, 1, 2);
    const health = db.learningHealth();
    assert.equal(health.applied, 1);
    assert.equal(health.reverted, 1);
    const pending = db.addFeedback({rating: 'correction', note: 'keep me'});
    assert.equal(db.expireEvidence(Date.now() + 91 * 86400000), 1);
    assert.deepEqual(
      db.listFeedback().map((f) => f.id),
      [pending.id],
    );
    assert.equal(db.purgeFeedback([pending.id]).purged, 1);
    assert.equal(db.listFeedback().length, 0);
  }));

test('MCP remember/forget/feedback tools go through capture', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-learn-mcp-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    const {callTool} = await import('../src/agents/mcp.ts');
    const body = async (name: string, args: Record<string, unknown>) =>
      JSON.parse((await callTool(db, name, args)).content[0].text);
    const remembered = await body('brain_remember', {
      title: 'Design docs',
      content: 'Give design documents adequate detail',
      domain: 'writing',
      reason: 'User said so',
    });
    assert.equal(remembered.feedback.status, 'pending');
    assert.equal(remembered.feedback.source, 'agent');
    db.saveLearningSettings({mode: 'off', retentionDays: 90, pausedProjects: []});
    assert.equal((await body('brain_feedback', {rating: 'correction', note: 'x'})).recorded, false);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('regression fixtures block activation without override (A04, F08)', () =>
  withDb((db) => {
    const r = db.create(style());
    assert.throws(() => db.saveFixtures(r.id, {keep: ['not in content']}), /current version/);
    db.saveFixtures(r.id, {keep: ['use tabs'], avoid: ['one-liners are fine']});
    const f = db.addFeedback({
      rating: 'correction',
      note: 'x',
      recordId: r.id,
      proposedContent: 'Never compress code into one line. One-liners are fine.',
    });
    assert.ok(db.inbox().find((i) => i.id === f.id)!.fixtureFailures.length === 2);
    assert.throws(
      () => db.decideFeedback(f.id, 'accept', {acknowledgeRemovals: true}),
      /Regression fixtures failed/,
    );
    assert.equal(db.get(r.id)?.version, 1);
  }));

test('high-entropy tokens count as credentials', () => {
  assert.ok(looksLikeCredential('use aZ3kP9qL2mX7vB4nR8tY1wE6 for auth'));
  assert.ok(!looksLikeCredential('prefer-readable-variable-names-everywhere'));
});

test('explain reports scope, status and delivery (F13)', () =>
  withDb((db) => {
    const r = db.create(style());
    const p = db.saveProject({name: 'P', description: '', assignments: []});
    assert.equal(db.explainRecord(r.id).applied, true);
    assert.match(db.explainRecord(r.id, p.id).reason, /not selected/);
    db.update(r.id, {status: 'archived'}, 1);
    assert.match(db.explainRecord(r.id).reason, /archived/);
  }));

test('bounded automation folds identical proposals and can be split (Phase 4)', () =>
  withDb((db) => {
    const r = db.create(style());
    db.saveLearningSettings({
      mode: 'suggest',
      retentionDays: 90,
      pausedProjects: [],
      autoConsolidate: true,
    });
    const input = {
      rating: 'correction',
      note: 'n',
      recordId: r.id,
      proposedContent: 'Use tabs. Never compress code into one line. Prefer guards.',
    };
    db.capture({...input, sourceEventId: 'a'});
    db.capture({...input, sourceEventId: 'b'});
    const third = db.capture({...input, sourceEventId: 'c'}).feedback!;
    assert.equal(third.evidenceIds.length, 3);
    assert.equal(db.inbox({status: 'pending'}).length, 1);
    assert.equal(db.learningHealth().recentAutomatic.length, 2);
    db.decideFeedback(third.id, 'split');
    assert.equal(db.inbox({status: 'pending'}).length, 3);
    assert.deepEqual(
      db.inbox({recordId: r.id}).map((i) => i.id),
      db
        .inbox()
        .filter((i) => i.recordId === r.id)
        .map((i) => i.id),
    );
    assert.equal(db.inbox({recordId: '00000000-0000-0000-0000-000000000000'}).length, 0);
  }));

test('deleted items are not restored by import; remembered imports are drafts (A07, F18)', () =>
  withDb((db) => {
    const gone = db.create(style());
    const remembered = db.create({
      ...style(),
      title: 'Remembered',
      keyId: 'remembered-x',
      tags: ['remembered'],
    });
    const bundle = exportLibrary(db, [gone.id, remembered.id]);
    db.deleteWithPreview('record', gone.id, db.deletionPreview('record', gone.id).fingerprint);
    // Simulate importing into a library that never had the remembered item.
    db.db.prepare('DELETE FROM records WHERE id=?').run(remembered.id);
    const preview = previewLibraryImport(db, bundle);
    assert.equal(preview.items.find((i) => i.id === gone.id)?.action, 'forgotten');
    assert.throws(
      () => importLibrary(db, bundle, [gone.id], preview.fingerprint),
      /deleted this item/,
    );
    const imported = importLibrary(db, bundle, [remembered.id], preview.fingerprint);
    assert.equal(db.get(imported.recordIds[0])?.status, 'draft');
  }));

test('handoff writes only the previewed file into the linked repository (F20)', () =>
  withDb((db, path) => {
    const repo = join(path, '..', 'repo');
    const p = db.saveProject({name: 'P', description: '', assignments: []});
    assert.throws(() => handoffPreview(db, p.id), /repository/);
    db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run('repository:' + p.id, repo);
    db.createProjectStyle(
      p.id,
      {title: 'Formatter', domain: 'coding', summary: 's', content: 'Use black'},
      p.version,
    );
    const preview = handoffPreview(db, p.id);
    assert.throws(() => handoffWrite(db, p.id, 'stale', null), /preview again/);
    handoffWrite(db, p.id, preview.contentHash, preview.existingHash);
    assert.match(readFileSync(join(repo, preview.path), 'utf8'), /Use black/);
    assert.equal(handoffPreview(db, p.id).unchanged, true);
  }));

test('learning health counts only failed agent learning calls, and unknown domains list valid ones', () =>
  withDb((db) => {
    db.trace({
      agent: 'claude',
      channel: 'mcp',
      eventType: 'mcp.brain_remember',
      outcome: 'success',
    });
    db.trace({agent: 'claude', channel: 'mcp', eventType: 'mcp.brain_remember', outcome: 'error'});
    const [claude] = db.learningHealth().integrations;
    assert.equal(claude.events, 2);
    assert.equal(claude.failures, 1);
    assert.throws(
      () =>
        db.capture({
          action: 'remember',
          rating: 'correction',
          note: 'x',
          proposedContent: 'x',
          proposal: {title: 'T', domain: 'nope'},
        }),
      /Unknown domain\. Use one of: .*coding/,
    );
  }));

test('handoff writes native agent files, keeping user content outside the managed block', () =>
  withDb((db, path) => {
    const repo = join(path, '..', 'repo');
    const p = db.saveProject({name: 'P', description: '', assignments: []});
    db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run('repository:' + p.id, repo);
    const style = db.createProjectStyle(
      p.id,
      {title: 'Formatter', domain: 'coding', summary: 's', content: 'Use black'},
      p.version,
    ).record;
    const write = (target: string) => {
      const preview = handoffPreview(db, p.id, target);
      handoffWrite(db, p.id, preview.contentHash, preview.existingHash, target);
      return readFileSync(join(repo, preview.path), 'utf8');
    };
    mkdirSync(repo, {recursive: true});
    writeFileSync(join(repo, 'AGENTS.md'), '# Team rules\n\nRun tests.\n');
    const first = write('agents');
    assert.match(
      first,
      /^# Team rules\n\nRun tests\.\n\n<!-- personal-brain:start[\s\S]*Use black/,
    );
    // A second write replaces only the block; text after it survives too.
    writeFileSync(join(repo, 'AGENTS.md'), first + '\nFooter\n');
    assert.deepEqual(staleExports(db), []);
    db.update(style.id, {content: 'Use ruff'}, style.version);
    assert.deepEqual(
      staleExports(db).map((x) => x.path),
      ['AGENTS.md'],
    );
    const second = write('agents');
    assert.deepEqual(staleExports(db), []);
    assert.match(second, /^# Team rules[\s\S]*Use ruff[\s\S]*end -->\n\nFooter\n$/);
    assert.doesNotMatch(second, /Use black/);
    assert.equal(second.match(/personal-brain:start/g)!.length, 1);
    // Opted-in files follow style changes; others only report as out of date.
    assert.deepEqual(setAutoExport(db, p.id, 'agents', true), {target: 'agents', autoUpdate: true});
    const latest = db.update(style.id, {content: 'Use ruff format'}, style.version + 1);
    assert.deepEqual(
      syncExports(db).map((r) => r.path),
      ['AGENTS.md'],
    );
    assert.match(readFileSync(join(repo, 'AGENTS.md'), 'utf8'), /Use ruff format[\s\S]*Footer/);
    assert.deepEqual(syncExports(db), []);
    setAutoExport(db, p.id, 'agents', false);
    db.update(style.id, {content: 'Use ruff'}, latest.version);
    assert.deepEqual(syncExports(db), []);
    assert.deepEqual(
      staleExports(db).map((x) => x.path),
      ['AGENTS.md'],
    );
    write('agents');
    assert.throws(() => setAutoExport(db, p.id, '../x', true), /Unknown file target/);
    assert.match(write('cursor'), /^---\n[\s\S]*alwaysApply: true[\s\S]*Use ruff/);
    assert.match(write('copilot'), /^<!-- personal-brain:start/);
    assert.ok(handoffPreview(db, p.id, 'claude').approxTokens > 0);
    assert.throws(() => handoffPreview(db, p.id, '../etc'), /Unknown file target/);
    writeFileSync(join(repo, 'GEMINI.md'), '<!-- personal-brain:start broken');
    assert.throws(() => handoffPreview(db, p.id, 'gemini'), /no end marker/);
    // A symlinked folder on the way to the file is refused.
    rmSync(join(repo, '.github'), {recursive: true});
    symlinkSync(path, join(repo, '.github'));
    const preview = handoffPreview(db, p.id, 'copilot');
    assert.throws(
      () => handoffWrite(db, p.id, preview.contentHash, preview.existingHash, 'copilot'),
      /symbolic link/,
    );
  }));

test('agent failures fixed by a retry are not counted; an interrupted comparison retries', () =>
  withDb((db) => {
    const at = (min: number) => new Date(Date.UTC(2026, 10, 13, 7, min)).toISOString();
    const event = (min: number, outcome: string) =>
      db.db
        .prepare(
          "INSERT INTO trace_events(id,occurred_at,run_id,agent,channel,event_type,outcome,record_ids,record_versions,metadata,demo) VALUES (?,?,'r','claude','mcp','mcp.brain_remember',?,'[]','{}','{}',0)",
        )
        .run(`e${min}`, at(min), outcome);
    event(0, 'error'); // retried a minute later: nothing lost
    event(1, 'success');
    event(30, 'error'); // never retried
    const claude = db.learningHealth().integrations.find((i) => i.agent === 'claude')!;
    assert.equal(claude.failures, 1);
    // A comparison left running by a restart is failed and the next check may run it again.
    db.db
      .prepare('INSERT INTO meta(key,value) VALUES(?,?)')
      .run('learning-projects-fingerprint', 'seen');
    const job = {
      id: 'j1',
      agent: 'codex',
      status: 'running',
      projectIds: [],
      sources: [],
      targets: [],
      proposals: [],
      applied: [],
      createdAt: at(0),
    };
    db.db
      .prepare('INSERT INTO meta(key,value) VALUES(?,?)')
      .run('learning-run:j1', JSON.stringify(job));
    assert.equal(learningRun(db, 'j1').status, 'failed');
    assert.equal(
      db.db.prepare("SELECT 1 FROM meta WHERE key='learning-projects-fingerprint'").get(),
      undefined,
    );
  }));

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {seedGlobalStyles, installCatalogAdditions} from '../src/styles/global-style-seed.ts';
import {globalStyleCatalog, catalogDomains} from '../src/styles/global-style-catalog.ts';
import {createBrainHttpServer} from '../src/server/http.ts';
import {catalogTemplates} from '../src/styles/catalog-updates.ts';

test('fresh startup installs the complete global catalog and remaps dependencies without private data', () => {
  const root = mkdtempSync(join(tmpdir(), 'brain-seed-')),
    db = new BrainDB(join(root, 'brain.sqlite'));
  try {
    createBrainHttpServer(db).close();
    const records = db.list({limit: 300});
    assert.equal(records.length, globalStyleCatalog.length);
    assert.equal(records.filter((r) => r.standardLanguage).length, 7);
    assert.equal(records.filter((r) => r.keyId === 'development').length, 1);
    assert.deepEqual(
      db
        .domains()
        .map((d) => d.id)
        .sort(),
      catalogDomains.map((d) => d.id).sort(),
    );
    for (const r of records.filter((r) => !r.compatibility)) {
      assert.ok(
        r.summary &&
          r.useWhen &&
          r.principles?.length &&
          r.reviewCriteria?.length &&
          r.examples?.length &&
          r.requirements?.length,
        r.title,
      );
      assert.ok(
        (r.skillBindings || []).every((s) => !s.name.includes(':')),
        r.title,
      );
    }
    assert.deepEqual(db.projects(), []);
    for (const source of globalStyleCatalog) {
      const record = records.find((r) => r.title === source.title)!;
      assert.equal(record.content, source.content);
      assert.ok(!record.projectId && !record.backend);
      assert.deepEqual(
        record.requiredIds!.map((id) => db.get(id)!.title),
        source.requiredIds!.map((id) => globalStyleCatalog.find((r) => r.id === id)!.title),
      );
    }
    // Required links never collide with a selection slot, so a project can select every catalog style.
    const all = db.saveProject({
      name: 'All',
      description: '',
      assignments: records
        .filter((r) => r.kind !== 'tool')
        .map((r) => ({recordId: r.id, override: null})),
    });
    assert.equal(db.scopedRecords(all.id).length, records.length);
    db.deleteWithPreview('project', all.id, db.deletionPreview('project', all.id).fingerprint);
    const ui = records.find((r) => r.keyId === 'ui-ux')!;
    const coding = records.find((record) => record.keyId === 'development')!;
    const development = records.find((record) => record.keyId === 'development')!;
    assert.deepEqual(development.requiredIds, []);
    assert.deepEqual(records.find((record) => record.keyId === 'coding-style')!.requiredIds, [
      development.id,
    ]);
    assert.equal(coding.kind, 'preference');
    assert.ok(!coding.projectId);
    for (const rule of [
      'not fewer physical lines',
      'one statement per line',
      'compressed legacy code is not a formatting convention',
      'flag the gap and propose setup',
      'enforced in repository CI',
      'Keep broad formatting cleanup separate',
      'Avoid hard-coded links and parameters wherever practical',
      'validate configuration',
      'Use named constants for true invariants',
    ]) {
      assert.ok(coding.content.includes(rule), rule);
      assert.ok(
        coding.principles!.some((principle) => principle.includes(rule)),
        rule,
      );
    }
    db.update(coding.id, {content: 'My personal readability rules'}, coding.version);
    assert.equal(seedGlobalStyles(db), 0);
    assert.equal(db.get(coding.id)!.content, 'My personal readability rules');
    assert.ok(ui.skillBindings!.some((s) => s.name === 'ui-ux-pro-max'));
    assert.ok(ui.skillBindings!.some((s) => s.name === 'design-taste-frontend'));
    assert.match(ui.content, /PREFERRED OUTCOMES/);
    assert.doesNotMatch(ui.content, /references\/app-screens.md/);
    db.update(ui.id, {...ui, content: 'My edit'}, ui.version);
    createBrainHttpServer(db).close();
    assert.equal(seedGlobalStyles(db), 0);
    assert.equal(db.get(ui.id)!.content, 'My edit');
  } finally {
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
});

test('seeding leaves an existing library untouched', () => {
  const root = mkdtempSync(join(tmpdir(), 'brain-seed-')),
    db = new BrainDB(join(root, 'brain.sqlite'));
  try {
    const record = db.create({
      ...globalStyleCatalog.find((r) => !r.requiredIds?.length)!,
      domain: 'coding',
      requiredIds: [],
    });
    assert.equal(seedGlobalStyles(db), 0);
    assert.equal(db.list().length, 1);
    assert.equal(db.get(record.id)!.version, 1);
  } finally {
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
});

test('existing libraries receive later catalog additions once, linked to their writing style', () => {
  const root = mkdtempSync(join(tmpdir(), 'brain-seed-')),
    db = new BrainDB(join(root, 'brain.sqlite'));
  try {
    seedGlobalStyles(db);
    const keys = ['doc-markdown', 'doc-html', 'doc-word'];
    for (const r of db.list({limit: 300}).filter((r) => keys.includes(r.keyId!))) {
      db.db.prepare('DELETE FROM records WHERE id=?').run(r.id);
    }
    db.db.prepare("DELETE FROM meta WHERE key='global_style_catalog_writing_formats_v1'").run();
    assert.equal(installCatalogAdditions(db), 3);
    const writing = db.list({limit: 300}).find((r) => r.keyId === 'writing')!;
    for (const key of keys) {
      assert.deepEqual(db.list({limit: 300}).find((r) => r.keyId === key)!.requiredIds, [
        writing.id,
      ]);
    }
    for (const r of db.list({limit: 300}).filter((r) => keys.includes(r.keyId!))) {
      db.db.prepare('DELETE FROM records WHERE id=?').run(r.id);
    }
    assert.equal(installCatalogAdditions(db), 0);
  } finally {
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
});

test('a fresh library gets the release templates, the agent roles style and no organization-specific CAB guidance', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-seed-templates-'));
  const db = new BrainDB(join(dir, 'brain.sqlite'));
  try {
    seedGlobalStyles(db);
    const templates = db.projectTemplates();
    assert.equal(templates[0].name, 'Starter');
    for (const t of catalogTemplates) {
      const seeded = templates.find((x) => x.name === t.name);
      assert.ok(seeded, t.name);
      assert.equal(seeded.styleIds.length, t.styleKeys.length, `${t.name} kept every style`);
    }
    const shared = db.list({limit: 300});
    const roles = shared.find((r) => r.keyId === 'agent-roles-claude-lead-codex-worker');
    assert.equal(roles?.alwaysApply, true, 'agent roles is always applied on a fresh install');
    assert.match(roles!.content, /Review limit: two rounds, then the leader decides/);
    assert.match(roles!.content, /Claude develops the UI\/UX in TypeScript itself/);
    assert.match(roles!.content, /Workers keep Personal Brain/);
    assert.match(roles!.content, /Claude starts the Codex tasks first/);
    // v14: workers load only their hand-off's styles, reviews follow risk, risk cases are tested first.
    assert.match(roles!.content, /Codex workers and reviewers do not load it/);
    assert.match(roles!.content, /Review by risk/);
    assert.match(roles!.content, /model_reasoning_effort/);
    assert.match(roles!.content, /interrupted or concurrent write/);
    // v15: routes by type of work, high risk as a modifier, large work in slices.
    for (const route of [
      'Quick',
      'Bug',
      'Feature',
      'Refactor',
      'Large or new project',
      'Review only',
    ]) {
      assert.match(roles!.content, new RegExp(`- ${route} \\(`), route);
    }
    assert.match(roles!.content, /A route never removes these/);
    assert.match(roles!.content, /thin vertical slices/);
    // v16: headless Claude coding workers run with Code Mode on.
    assert.match(roles!.content, /CLAUDE_CODE_EXPERIMENTAL_CODE_MODE/);
    assert.doesNotMatch(roles!.content, /codex exec review --base </);
    assert.ok(roles!.requirements?.some((q) => q.id === 'req-sandbox-checks'));
    assert.ok(roles!.requirements?.some((q) => q.id === 'req-review-limit'));
    assert.equal(shared.filter((r) => r.alwaysApply).length, 1);
    assert.doesNotMatch(JSON.stringify(shared), /\bCAB\b/);
    // Senior service standards: OpenTelemetry and log levels, performance and multi-instance scaling.
    const logging = shared.find((r) => r.keyId === 'logging-tracing');
    assert.match(logging!.content, /service\.instance\.id/);
    assert.match(logging!.content, /LOG LEVELS \(the default threshold in production is INFO/);
    assert.ok(logging!.requirements?.some((q) => q.id === 'req-otel-export-bounded'));
    const perf = shared.find((r) => r.keyId === 'performance-scaling');
    for (const section of [
      'MEMORY',
      'CONNECTIONS AND POOLS',
      'MULTIPLE INSTANCES',
      'RUNTIME NOTES',
    ]) {
      assert.match(perf!.content, new RegExp(`^${section}$`, 'm'), section);
    }
    const withPerf = templates.filter((t) => t.styleIds.includes(perf!.id)).map((t) => t.name);
    assert.deepEqual(withPerf.sort(), [
      'Build & verify — development from agreed design',
      'Full delivery — analysis to release',
    ]);
    const dev = shared.find((r) => r.keyId === 'development');
    // No persona tags: they split into words like "code" that matched every prompt.
    const {ROLE_TAGS} = await import('../src/styles/standards-catalog.ts');
    assert.deepEqual(
      shared.flatMap((r) => r.tags.filter((t) => ROLE_TAGS.has(t.toLowerCase()))),
      [],
    );
    // Language styles carry the service or app runtime rules, checked with captured proof.
    for (const key of ['coding-typescript', 'coding-csharp', 'coding-python', 'coding-java']) {
      const lang = shared.find((r) => r.keyId === key)!;
      assert.match(lang.content, /WHEN SERVICE RUNTIME/, key);
      const runtime = lang.requirements?.find((q) => q.id.endsWith('-runtime'));
      assert.equal(runtime?.verify, 'sample', key);
    }
    assert.equal(
      shared.find((r) => r.keyId === 'review-standard')!.requirements?.[0].verify,
      'file',
    );
    assert.match(dev!.content, /Production readiness is part of done/);
    const git = shared.find((r) => r.keyId === 'git');
    assert.ok(git?.requirements?.some((q) => q.id === 'req-git-safe-actions'));
    const withGit = templates.filter((t) => t.styleIds.includes(git!.id)).map((t) => t.name);
    assert.deepEqual(withGit.sort(), [
      'Build & verify — development from agreed design',
      'Full delivery — analysis to release',
      'Research & proof of concept',
      'Starter',
    ]);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

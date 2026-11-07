import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  realpathSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {
  createLinkedProject,
  inspectOnboardingFolder,
  onboardingFolder,
  validateRecommendations,
  recommendProjectStyles,
} from '../src/projects/onboarding.ts';
import {EventEmitter} from 'node:events';

test('wizard creates project and repository link together; failed and conflicting attempts preserve data', () => {
  const root = mkdtempSync(join(tmpdir(), 'pb-wizard-')),
    folder = join(root, 'repo');
  mkdirSync(folder);
  const db = new BrainDB(join(root, 'test.sqlite'));
  try {
    assert.throws(() => onboardingFolder('relative/path'), /absolute/);
    assert.throws(() => onboardingFolder(join(root, 'absent')), /does not exist/);
    assert.throws(
      () =>
        createLinkedProject(
          db,
          {name: 'Bad', description: '', assignments: [{recordId: 'missing', override: null}]},
          folder,
        ),
      /active library/,
    );
    assert.equal(db.projects().length, 0);
    assert.equal(existsSync(join(folder, '.personal-brain.json')), false);
    db.db.exec(
      "CREATE TRIGGER fail_repository BEFORE INSERT ON meta WHEN NEW.key LIKE 'repository:%' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
    );
    assert.throws(
      () => createLinkedProject(db, {name: 'Rollback', description: '', assignments: []}, folder),
      /fixture failure/,
    );
    assert.equal(db.projects().length, 0);
    assert.equal(existsSync(join(folder, '.personal-brain.json')), false);
    db.db.exec('DROP TRIGGER fail_repository');
    const p = createLinkedProject(
      db,
      {name: 'New project', description: '', assignments: []},
      folder,
    );
    assert.equal(
      JSON.parse(readFileSync(join(folder, '.personal-brain.json'), 'utf8')).projectId,
      p.id,
    );
    assert.equal(
      (
        db.db.prepare('SELECT value FROM meta WHERE key=?').get('repository:' + p.id) as {
          value: string;
        }
      ).value,
      realpathSync(folder),
    );
    assert.throws(
      () => createLinkedProject(db, {name: 'Duplicate', description: '', assignments: []}, folder),
      /already belongs/,
    );
    assert.equal(db.projects().length, 1);
  } finally {
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
});

test('linked folder: inspection names the project; replacing relinks and failures restore the old link', () => {
  const root = mkdtempSync(join(tmpdir(), 'pb-wizard-relink-')),
    folder = join(root, 'repo'),
    nested = join(folder, 'packages', 'app');
  mkdirSync(nested, {recursive: true});
  const db = new BrainDB(join(root, 'test.sqlite'));
  const linkFile = join(folder, '.personal-brain.json');
  const linkedId = () => JSON.parse(readFileSync(linkFile, 'utf8')).projectId;
  try {
    assert.equal(inspectOnboardingFolder(db, folder).existing, null);
    const first = createLinkedProject(
      db,
      {name: 'First', description: '', assignments: []},
      folder,
    );
    const inspected = inspectOnboardingFolder(db, folder).existing!;
    assert.equal(inspected.projectId, first.id);
    assert.equal(inspected.projectName, 'First');
    assert.equal(inspected.inFolder, true);
    assert.equal(inspectOnboardingFolder(db, nested).existing!.inFolder, false);

    // Without an explicit choice the link is protected.
    assert.throws(
      () => createLinkedProject(db, {name: 'Second', description: '', assignments: []}, folder),
      /already belongs/,
    );
    db.db.exec(
      "CREATE TRIGGER fail_repository BEFORE INSERT ON meta WHEN NEW.key LIKE 'repository:%' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
    );
    assert.throws(
      () =>
        createLinkedProject(db, {name: 'Second', description: '', assignments: []}, folder, true),
      /fixture failure/,
    );
    assert.equal(linkedId(), first.id, 'a failed replacement restores the previous link');
    db.db.exec('DROP TRIGGER fail_repository');

    const second = createLinkedProject(
      db,
      {name: 'Second', description: '', assignments: []},
      folder,
      true,
    );
    assert.equal(linkedId(), second.id);
    assert.equal(db.projects().length, 2, 'the replaced project is kept');

    writeFileSync(linkFile, JSON.stringify({projectId: 'from-another-computer'}));
    const unknown = inspectOnboardingFolder(db, folder).existing!;
    assert.equal(unknown.projectName, null);
    assert.equal(unknown.projectId, 'from-another-computer');
  } finally {
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
});

test('large libraries are analyzed in stages that each fit the prompt limit', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pb-wizard-staged-')),
    folder = join(root, 'repo'),
    bin = join(root, 'bin'),
    log = join(root, 'calls.log');
  mkdirSync(folder);
  mkdirSync(bin);
  const db = new BrainDB(join(root, 'test.sqlite')),
    path = process.env.PATH;
  const style = (title: string, domain: string, priority: number) =>
    db.create({
      kind: 'preference',
      domain,
      title,
      summary: title,
      useWhen: 'Use when ' + title + ' ' + 'x'.repeat(380),
      content: title + ' rules ' + 'y'.repeat(1000),
      tags: ['tag'],
      priority,
      status: 'active',
      checks: [],
      backend: null,
    });
  try {
    writeFileSync(join(folder, 'README.md'), 'A TypeScript application.');
    // 450 styles: the compact catalog alone exceeds one request, so selection needs several rounds.
    for (let i = 0; i < 447; i++) {
      style('Filler ' + i, 'general', 50);
    }
    const picks = [
      style('Pick coding', 'coding', 90),
      style('Pick design', 'design', 60),
      // Lowest priority, beyond the first 300 records: must still be considered.
      style('Pick writing', 'writing', 1),
    ];
    // The fake agent answers by stage, logs each call and fails if a prompt is over the limit.
    const agentSource = (failDraft: boolean) =>
      `const fs=require('fs');let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{` +
      `if(input.length>200000)process.exit(3);fs.appendFileSync(${JSON.stringify(log)},input.slice(0,6)+'\\n');` +
      `const data=JSON.parse(input.slice(input.indexOf('DATA:\\n')+6));` +
      `if(input.startsWith('Select')){console.log(JSON.stringify({recommendations:data.styles.filter(s=>s.title.startsWith('Pick')).map(s=>({id:s.id,reason:'README.md'}))}));}` +
      `else if(input.startsWith('Draft')){${failDraft ? 'process.exit(5);' : ''}console.log(JSON.stringify({guidelines:data.styles.map(s=>({id:s.id,customizationNote:'Fits',projectGuidelines:'Guideline for '+s.title}))}));}` +
      `else process.exit(4);});`;
    writeFileSync(join(bin, 'agent.cjs'), agentSource(false));
    if (process.platform === 'win32') {
      writeFileSync(join(bin, 'claude.cmd'), '@echo off\r\nnode "%dp0%\\agent.cjs" %*\r\n');
    } else {
      writeFileSync(
        join(bin, 'claude'),
        '#!/bin/sh\nexec ' +
          JSON.stringify(process.execPath) +
          ' ' +
          JSON.stringify(join(bin, 'agent.cjs')) +
          ' "$@"\n',
        {mode: 0o755},
      );
    }
    process.env.PATH = bin;
    const result = await recommendProjectStyles(db, folder, 'claude');
    assert.deepEqual(result.recommendations.map((r) => r.id).sort(), picks.map((p) => p.id).sort());
    for (const r of result.recommendations) {
      assert.match(r.projectGuidelines!, /^Guideline for Pick/);
    }
    const calls = readFileSync(log, 'utf8').trim().split('\n');
    assert.ok(
      calls.filter((c) => c.startsWith('Select')).length >= 3,
      'partial rounds plus a final round',
    );
    assert.equal(
      calls.filter((c) => c.startsWith('Draft')).length,
      1,
      'one call drafts guidelines',
    );
    assert.ok(result.issues.some((issue) => issue.type === 'staged-analysis'));

    // A failed guidelines call keeps the selection and explains what is missing.
    writeFileSync(join(bin, 'agent.cjs'), agentSource(true));
    const degraded = await recommendProjectStyles(db, folder, 'claude');
    assert.equal(degraded.recommendations.length, 3);
    assert.ok(degraded.recommendations.every((r) => r.projectGuidelines === undefined));
    assert.ok(degraded.issues.some((issue) => issue.type === 'guidelines-failed'));
  } finally {
    process.env.PATH = path;
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
});
test('AI recommendations reject invented, private, duplicate or conflicting styles', () => {
  const style = {
    id: 's',
    domain: 'coding',
    kind: 'preference',
    status: 'active',
  } as import('../src/core/models.ts').BrainRecord;
  assert.deepEqual(
    validateRecommendations(
      {recommendations: [{id: 's', reason: 'package.json defines TypeScript'}]},
      [style],
    ),
    [{id: 's', reason: 'package.json defines TypeScript'}],
  );
  assert.throws(
    () => validateRecommendations({recommendations: [{id: 'missing', reason: 'x'}]}, [style]),
    /unavailable/,
  );
  assert.throws(
    () =>
      validateRecommendations({recommendations: [{id: 's', reason: 'x'}]}, [
        {...style, projectId: 'private'},
      ]),
    /unavailable/,
  );
  assert.throws(
    () =>
      validateRecommendations(
        {
          recommendations: [
            {id: 's', reason: 'x'},
            {id: 's2', reason: 'y'},
          ],
        },
        [style, {...style, id: 's2'}],
      ),
    /conflicting/,
  );
  assert.throws(() => validateRecommendations({recommendations: [null]}, [style]), /unavailable/);
  assert.throws(
    () => validateRecommendations({recommendations: [{id: 's', reason: ''}]}, [style]),
    /reason/,
  );
  assert.deepEqual(validateRecommendations({recommendations: []}, [style]), []);
  const note =
    'Keep the shared baseline; use the repository test command from README.md here only.';
  assert.equal(
    validateRecommendations(
      {recommendations: [{id: 's', reason: 'README.md', customizationNote: note}]},
      [style],
    )[0].customizationNote,
    note,
  );
  for (const customizationNote of [null, 42, '', 'x'.repeat(2001)]) {
    assert.throws(
      () =>
        validateRecommendations(
          {recommendations: [{id: 's', reason: 'README.md', customizationNote}]},
          [style],
        ),
      /customization note/,
    );
  }
});

test('wizard HTTP routes validate folders and create scoped projects without sockets', async () => {
  const {createBrainHttpServer} = await import('../src/server/http.ts');
  const root = mkdtempSync(join(tmpdir(), 'pb-wizard-http-')),
    folder = join(root, 'repo');
  mkdirSync(folder);
  const db = new BrainDB(join(root, 'test.sqlite')),
    server = createBrainHttpServer(db);
  const request = <T = unknown>(url: string, payload: unknown) =>
    new Promise<{status: number; data: T}>((resolve) => {
      let status = 0;
      const res = Object.assign(new EventEmitter(), {
        setHeader() {},
        writeHead(code: number) {
          status = code;
        },
        end(text: string) {
          resolve({status, data: JSON.parse(text)});
        },
      });
      server.emit(
        'request',
        {
          url,
          method: 'POST',
          headers: {},
          async *[Symbol.asyncIterator]() {
            yield JSON.stringify(payload);
          },
        },
        res,
      );
    });
  try {
    assert.equal((await request('/api/onboarding/folder', {folder})).status, 200);
    assert.equal(
      (await request('/api/onboarding/analyze', {folder, agent: 'invalid'})).status,
      400,
    );
    const result = await request<{id: string}>('/api/onboarding/create', {
      folder,
      project: {name: 'HTTP wizard', description: '', assignments: []},
    });
    assert.equal(result.status, 201);
    assert.equal(db.project(result.data.id).name, 'HTTP wizard');
    const linked = await request<{existing: {projectId: string; projectName: string}}>(
      '/api/onboarding/folder',
      {folder},
    );
    assert.equal(linked.status, 200);
    assert.equal(linked.data.existing.projectName, 'HTTP wizard');
    const duplicate = await request('/api/onboarding/create', {
      folder,
      project: {name: 'Second', description: '', assignments: []},
    });
    assert.equal(duplicate.status, 409);
    const replaced = await request<{id: string}>('/api/onboarding/create', {
      folder,
      replaceLink: true,
      project: {name: 'Second', description: '', assignments: []},
    });
    assert.equal(replaced.status, 201);
  } finally {
    server.close();
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
});

test('AI discovery uses bounded evidence without creating projects or changing styles', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pb-wizard-ai-')),
    folder = join(root, 'repo'),
    bin = join(root, 'bin');
  mkdirSync(folder);
  mkdirSync(bin);
  const db = new BrainDB(join(root, 'test.sqlite')),
    path = process.env.PATH;
  try {
    await assert.rejects(recommendProjectStyles(db, folder, 'unsupported'), /Choose Codex/);
    await assert.rejects(recommendProjectStyles(db, folder, 'claude'), /No readable/);
    const style = db.create({
      kind: 'preference',
      domain: 'coding',
      title: 'TypeScript',
      summary: 'Typed code',
      content: 'Use typed code',
      tags: [],
      priority: 90,
      status: 'active',
      checks: [],
      backend: null,
    });
    writeFileSync(join(folder, 'README.md'), 'A TypeScript application.');
    const reply = JSON.stringify({
      recommendations: [{id: style.id, reason: 'README.md says TypeScript.'}],
    });
    // A local CLI fixture exercises process I/O without contacting a provider.
    writeFileSync(
      join(bin, 'agent.cjs'),
      `let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{if(!input.includes('A TypeScript application.'))process.exit(2);console.log(${JSON.stringify(reply)});});`,
    );
    if (process.platform === 'win32') {
      writeFileSync(join(bin, 'claude.cmd'), '@echo off\r\nnode "%dp0%\\agent.cjs" %*\r\n');
    } else {
      writeFileSync(
        join(bin, 'claude'),
        '#!/bin/sh\nexec ' +
          JSON.stringify(process.execPath) +
          ' ' +
          JSON.stringify(join(bin, 'agent.cjs')) +
          ' "$@"\n',
        {mode: 0o755},
      );
    }
    process.env.PATH = bin;
    const result = await recommendProjectStyles(db, folder, 'claude');
    assert.equal(result.recommendations[0].id, style.id);
    assert.deepEqual(result.files, ['README.md']);
    assert.equal(db.projects().length, 0);
    assert.equal(db.get(style.id)!.version, 1);
    assert.equal(existsSync(join(folder, '.personal-brain.json')), false);
    writeFileSync(join(bin, 'agent.cjs'), 'process.stdin.resume();setTimeout(()=>{},30000);');
    const controller = new AbortController(),
      pending = recommendProjectStyles(db, folder, 'claude', controller.signal);
    await assert.rejects(recommendProjectStyles(db, folder, 'claude'), /Another project analysis/);
    setTimeout(() => controller.abort(), 50);
    await assert.rejects(pending, /cancelled/);
    process.env.PATH = join(root, 'missing');
    await assert.rejects(
      recommendProjectStyles(db, folder, 'claude'),
      /Cannot start|Cannot launch/,
    );
  } finally {
    process.env.PATH = path;
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
});

test('personalization validates project guidelines and private scope', () => {
  const style = {
    id: 's',
    domain: 'coding',
    kind: 'preference',
    status: 'active',
    projectId: 'p',
  } as import('../src/core/models.ts').BrainRecord;
  const recommendations = [
    {id: 's', reason: 'README.md', projectGuidelines: 'Use the existing test command (README.md).'},
  ];
  assert.equal(
    validateRecommendations({recommendations}, [style], 'p')[0].projectGuidelines,
    recommendations[0].projectGuidelines,
  );
  assert.throws(() => validateRecommendations({recommendations}, [style], 'other'), /unavailable/);
  for (const projectGuidelines of [null, 42, 'x'.repeat(12001)]) {
    assert.throws(
      () =>
        validateRecommendations(
          {recommendations: [{...recommendations[0], projectGuidelines}]},
          [style],
          'p',
        ),
      /project guidelines/,
    );
  }
});

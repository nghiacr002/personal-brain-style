import {resolveInstructions} from './resolve.ts';
import {checkInstructionSet} from './instruction-set.ts';
import {readFileSync, realpathSync, statSync} from 'node:fs';
import {isAbsolute, relative, resolve, extname, sep} from 'node:path';
import {BrainDB} from '../core/database.ts';
import {BrainError} from '../core/models.ts';
import {projectFolder} from '../projects/skill-discovery.ts';

export function reviewArtifacts(db: BrainDB, projectId: string, args: Record<string, unknown>) {
  db.project(projectId);
  if (args.instructionSetId !== undefined) {
    args = checkInstructionSet(db, projectId, args);
  }
  if (typeof args.task !== 'string' || !args.task.trim() || args.task.length > 1000) {
    throw new BrainError('Artifact review requires a task description (1-1000 characters)');
  }
  if (
    !Array.isArray(args.recordIds) ||
    !args.recordIds.length ||
    args.recordIds.length > 20 ||
    !args.recordIds.every((id) => typeof id === 'string')
  ) {
    throw new BrainError('Select 1-20 applicable recordIds from this project');
  }
  const resolved = resolveInstructions(db, projectId, args);
  const records = resolved.records,
    checklist = resolved.requirementChecklist;
  if (checklist.length > 300) {
    throw new BrainError('Review scope exceeds 300 requirements; review fewer root styles');
  }
  const evidence = args.evidence ?? [];
  if (!Array.isArray(evidence) || evidence.length > 300) {
    throw new BrainError('Evidence must be an array of at most 300 entries');
  }
  type Proof = {
    kind: 'command' | 'file' | 'sample';
    command?: string;
    exitCode?: number;
    path?: string;
    contains?: string;
    excerpt?: string;
  };
  const byKey = new Map<string, {status: string; note: string; proof?: Proof}>();
  for (const e of evidence) {
    if (
      !e ||
      typeof e !== 'object' ||
      typeof e.recordId !== 'string' ||
      typeof e.requirementId !== 'string' ||
      !Number.isInteger(e.recordVersion) ||
      !['pass', 'fail', 'not_verified'].includes(e.status) ||
      typeof e.note !== 'string' ||
      !e.note.trim() ||
      e.note.length > 1000
    ) {
      throw new BrainError(
        'Invalid evidence: recordId, recordVersion, requirementId, status and note are required',
      );
    }
    if (e.proof !== undefined && !validProof(e.proof)) {
      throw new BrainError(
        'Invalid proof: kind command needs command and exitCode; file needs a repository-relative path (contains optional, up to 200 characters); sample needs an excerpt up to 2000 characters',
      );
    }
    const requirement = checklist.find(
      (r) => r.recordId === e.recordId && r.id === e.requirementId,
    );
    const key = e.recordId + ':' + e.requirementId;
    const entry = `Evidence ${JSON.stringify(key)}`;
    if (byKey.has(key)) {
      throw new BrainError(`${entry} is duplicated`);
    }
    if (requirement && requirement.recordVersion !== e.recordVersion) {
      throw new BrainError(
        `${entry} is stale: recordVersion ${e.recordVersion}, current ${requirement.recordVersion}`,
      );
    }
    if (!requirement) {
      const skipped = resolved.guidance.find(
        (g) => g.recordId === e.recordId && g.status !== 'applicable',
      );
      throw new BrainError(
        skipped
          ? `${entry} is outside the review scope: record applicability is ${skipped.status} for this context. Pass the instructionSetId from brain_prepare, or the same context (activity, languages, frameworks, targets).`
          : `${entry} is outside the review scope: no such requirement in the selected records or their required links.`,
      );
    }
    byKey.set(key, e);
  }
  const paths = args.artifacts ?? [];
  if (!Array.isArray(paths) || paths.length > 30 || !paths.every(safePath)) {
    throw new BrainError(
      'Artifacts must be at most 30 repository-relative paths without traversal',
    );
  }
  let root: string | undefined;
  const needsRoot = paths.length || [...byKey.values()].some((c) => c.proof?.kind === 'file');
  if (needsRoot) {
    root = realpathSync(projectFolder(db, projectId));
  }
  // A file proof is checked here: the file exists inside the repository and contains the text.
  const fileProof = (proof: Proof): {ok: boolean; why: string} => {
    if (!safePath(proof.path!)) {
      return {ok: false, why: 'file proof path must be repository-relative'};
    }
    try {
      const target = realpathSync(resolve(root!, proof.path!));
      const rel = relative(root!, target);
      if (
        rel === '..' ||
        rel.startsWith('..' + sep) ||
        isAbsolute(rel) ||
        !statSync(target).isFile()
      ) {
        return {ok: false, why: `${proof.path} is not a file in the repository`};
      }
      if (
        proof.contains &&
        !readFileSync(target, 'utf8').slice(0, 2_000_000).includes(proof.contains)
      ) {
        return {ok: false, why: `${proof.path} does not contain the given text`};
      }
      return {
        ok: true,
        why: proof.contains ? `${proof.path} contains the given text` : `${proof.path} exists`,
      };
    } catch {
      return {ok: false, why: `${proof.path} was not found`};
    }
  };
  const artifacts = paths.map((path) => {
    try {
      const target = realpathSync(resolve(root!, path));
      const rel = relative(root!, target);
      if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
        throw new BrainError('Artifact escapes linked repository');
      }
      const stat = statSync(target);
      return {
        path,
        extension: extname(path).toLowerCase(),
        exists: stat.isFile() && stat.size > 0,
        bytes: stat.isFile() ? stat.size : 0,
      };
    } catch (e) {
      if (e instanceof BrainError) {
        throw e;
      }
      return {path, extension: extname(path).toLowerCase(), exists: false, bytes: 0};
    }
  });
  const results = checklist.map((r) => {
    const claim = byKey.get(r.recordId + ':' + r.id);
    const accepted =
      r.type === 'artifact'
        ? (r.extensions || [r.extension]).filter((extension): extension is string => !!extension)
        : [];
    const requested = accepted.filter((extension) =>
      resolved.context.formats?.includes(extension.slice(1)),
    );
    const matching = artifacts.filter((artifact) =>
      (requested.length ? requested : accepted).includes(artifact.extension),
    );
    const present = requested.length
      ? requested.every((extension) =>
          matching.some((artifact) => artifact.exists && artifact.extension === extension),
        )
      : matching.some((artifact) => artifact.exists);
    // File metadata proves presence only; editability, meaning and visual quality stay manual.
    let status: 'not_applicable' | 'optional' | 'advisory' | 'fail' | 'pass' | 'not_verified';
    let verification = 'agent-report-only',
      proofNote = '';
    const proof = claim?.proof;
    if (r.applicability === 'not_applicable') {
      status = 'not_applicable';
    } else if (r.optional) {
      status = 'optional';
    } else if (claim?.status === 'fail') {
      status = 'fail';
    } else if (r.type === 'artifact') {
      status = present ? 'pass' : 'fail';
      verification = 'file-presence-only';
    } else if (claim?.status === 'pass' && proof) {
      const verify = (r as {verify?: string}).verify;
      if (verify && verify !== proof.kind) {
        status = 'not_verified';
        proofNote = `requirement expects ${verify} proof, got ${proof.kind}`;
      } else if (proof.kind === 'file') {
        const checked = fileProof(proof);
        status = checked.ok ? 'pass' : 'fail';
        verification = 'file-checked';
        proofNote = checked.why;
      } else if (proof.kind === 'command') {
        status = proof.exitCode === 0 ? 'pass' : 'fail';
        verification = 'agent-command';
        proofNote = `${proof.command} exited ${proof.exitCode}`;
      } else {
        status = 'pass';
        verification = 'agent-sample';
      }
    } else if ((r as {advisory?: boolean}).advisory && !claim) {
      // Review criteria guide the reviewer; unclaimed ones do not make the report unverified.
      status = 'advisory';
    } else {
      status = 'not_verified';
    }
    return {
      ...r,
      status,
      verification,
      ...(proof ? {proof, proofNote} : {}),
      agentReported: claim?.status ?? null,
      note: claim?.note ?? '',
      artifacts: matching.map((a) => a.path),
    };
  });
  const textReviews =
    typeof args.content === 'string'
      ? [...new Set(records.map((r) => r.domain))].map((domain) =>
          db.evaluate(args.content as string, domain, projectId),
        )
      : [];
  const recordIds = new Set(records.map((r) => r.id));
  const pendingTextChecks =
    typeof args.content === 'string' ? 0 : records.reduce((n, r) => n + (r.checks?.length || 0), 0);
  const textFindings = [
    ...new Map(
      textReviews
        .flatMap((r) => r.findings)
        .filter((f) => recordIds.has(f.ruleId))
        .map((f) => [JSON.stringify(f), f]),
    ).values(),
  ];
  let status: 'fail' | 'not_verified' | 'pass' = 'pass';
  if (results.some((r) => r.status === 'fail') || textFindings.some((f) => !f.passed)) {
    status = 'fail';
  } else if (
    resolved.unresolved.length ||
    // Nothing passed and no text checks ran: advisory rows alone verify nothing.
    (!results.some((r) => r.status === 'pass') && !textFindings.length) ||
    pendingTextChecks > 0 ||
    results.some((r) => r.status === 'not_verified')
  ) {
    status = 'not_verified';
  }
  const report = {
    instructionSetId: args.instructionSetId ?? null,
    task: args.task,
    status,
    unresolved: resolved.unresolved,
    scope:
      'Agent-selected applicable styles and required dependencies; completeness of task selection is not verified.',
    results,
    artifacts,
    textFindings,
    pendingTextChecks,
    note: 'A manual pass needs proof: file proofs were checked by Personal Brain; command and sample proofs are recorded as the agent reported them. A pass without proof stays Not verified. Unclaimed review criteria are advisory. File presence does not prove format validity or editability. This report does not certify full compliance.',
  };
  const serialized = JSON.stringify(report);
  if (serialized.length > 100000) {
    throw new BrainError('Review report too large; reduce scope or evidence');
  }
  const event = db.trace({
    // trace() keeps only known agent names, so a made-up host is stored as unknown.
    agent: typeof args.host === 'string' ? args.host : 'unknown',
    ...(typeof args.threadId === 'string' && typeof args.host === 'string'
      ? {runId: `${args.host}:${args.threadId}`}
      : {}),
    channel: 'review',
    eventType: 'compliance.review',
    outcome: status,
    recordIds: records.map((r) => r.id),
    recordVersions: Object.fromEntries(records.map((r) => [r.id, r.version])),
    metadata: {projectId, complianceReport: serialized, sessionLinked: false},
  });
  return {reviewId: event.id, ...report};
}

function safePath(p: unknown): p is string {
  return (
    typeof p === 'string' &&
    p.length > 0 &&
    p.length < 500 &&
    !isAbsolute(p) &&
    !p.split(/[\\/]/).includes('..') &&
    !p.includes('\0')
  );
}

function validProof(p: unknown): boolean {
  if (!p || typeof p !== 'object') {
    return false;
  }
  const proof = p as Record<string, unknown>;
  const text = (v: unknown, max: number) => typeof v === 'string' && !!v.trim() && v.length <= max;
  if (proof.kind === 'command') {
    return text(proof.command, 500) && Number.isInteger(proof.exitCode);
  }
  if (proof.kind === 'file') {
    return safePath(proof.path) && (proof.contains === undefined || text(proof.contains, 200));
  }
  return proof.kind === 'sample' && text(proof.excerpt, 2000);
}

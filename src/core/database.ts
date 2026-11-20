import {
  applicability,
  validateTaskContext,
  linkedIds,
  validatePreferenceContract,
} from './preference-contract.ts';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID, randomBytes, createHmac} from 'node:crypto';
import {mkdirSync, chmodSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {homedir} from 'node:os';
import {validateRequirements} from './requirements.ts';
import {discoveryMetadata} from './discovery-metadata.ts';
import {
  DEFAULT_RETENTION_DAYS,
  LEARNING_MODES,
  type LearningMode,
  looksLikeCredential,
  lostObligations,
  suppressionFingerprint,
  checkFixtures,
  fixtureFailures,
  keyReceipt,
  type Fixtures,
} from './learning.ts';
import {
  BrainError,
  DOMAINS,
  type Project,
  type ProjectAssignment,
  type BrainRecord,
  type Domain,
  type Feedback,
  type Kind,
  type RecordInput,
  type Revision,
  type TestRule,
  type TaskContext,
  validDomain,
  validKind,
  slug,
} from './models.ts';

export const defaultHome = () => process.env.PB_HOME || join(homedir(), '.personal-brain-style');
export const dbPath = () => join(defaultHome(), 'brain.sqlite');

export function checkInput(raw: unknown): RecordInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BrainError('Expected record object');
  }
  const x = raw as Record<string, unknown>;
  if (x.projectId !== undefined && (typeof x.projectId !== 'string' || !x.projectId)) {
    throw new BrainError('Invalid project scope');
  }
  if (
    x.keyId !== undefined &&
    (typeof x.keyId !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x.keyId) ||
      x.keyId.length > 150)
  ) {
    throw new BrainError('Style key must be a lowercase slug of at most 150 characters');
  }
  if (!validKind(x.kind)) {
    throw new BrainError('Invalid record kind');
  }
  if (!validDomain(x.domain)) {
    throw new BrainError('Invalid style domain');
  }
  for (const field of ['title', 'summary', 'content'] as const) {
    if (typeof x[field] !== 'string') {
      throw new BrainError(`Invalid ${field}`);
    }
  }
  if (!(x.title as string).trim() || (x.title as string).length > 150) {
    throw new BrainError('Title must have 1-150 characters');
  }
  if ((x.summary as string).length > 1200 || (x.content as string).length > 100000) {
    throw new BrainError('Record text too long');
  }
  if (
    !Array.isArray(x.tags) ||
    x.tags.length > 24 ||
    !x.tags.every((t) => typeof t === 'string' && t.length < 80)
  ) {
    throw new BrainError('Invalid tags');
  }
  if (x.useWhen !== undefined && (typeof x.useWhen !== 'string' || x.useWhen.length > 600)) {
    throw new BrainError('Use when must be text of at most 600 characters');
  }
  if (
    typeof x.priority !== 'number' ||
    !Number.isInteger(x.priority) ||
    x.priority < 0 ||
    x.priority > 100
  ) {
    throw new BrainError('Priority must be 0-100');
  }
  if (!['active', 'draft', 'archived'].includes(String(x.status))) {
    throw new BrainError('Invalid status');
  }
  if (!Array.isArray(x.checks) || x.checks.length > 30) {
    throw new BrainError('Invalid review checks');
  }
  if (
    x.requiredIds !== undefined &&
    (!Array.isArray(x.requiredIds) ||
      x.requiredIds.length > 12 ||
      !x.requiredIds.every((id) => typeof id === 'string'))
  ) {
    throw new BrainError('Required links must contain at most 12 record IDs');
  }
  for (const field of ['principles', 'externalSkills', 'reviewCriteria', 'examples']) {
    if (
      x[field] !== undefined &&
      (!Array.isArray(x[field]) ||
        (x[field] as unknown[]).length > 30 ||
        !(x[field] as unknown[]).every(
          (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 2000,
        ))
    ) {
      throw new BrainError('Invalid ' + field);
    }
  }
  const checks: TestRule[] = [];
  for (const c of x.checks) {
    if (
      !c ||
      typeof c !== 'object' ||
      !['contains', 'not_contains', 'max_length', 'min_length'].includes(c.type) ||
      !(typeof c.value === 'string' || typeof c.value === 'number')
    ) {
      throw new BrainError('Invalid review check');
    }
    checks.push({
      type: c.type,
      value: c.value,
      label: typeof c.label === 'string' ? c.label.slice(0, 200) : undefined,
    });
  }
  let backend = null;
  if (x.kind === 'tool' && x.backend !== null && x.backend !== undefined) {
    const b = x.backend as Record<string, unknown>;
    if (
      typeof b.command !== 'string' ||
      !b.command.trim() ||
      !Array.isArray(b.args) ||
      !b.args.every((v) => typeof v === 'string') ||
      typeof b.toolName !== 'string' ||
      typeof b.enabled !== 'boolean'
    ) {
      throw new BrainError('Invalid MCP backend configuration');
    }
    if (b.args.length > 30 || b.args.some((v: string) => v.length > 500)) {
      throw new BrainError('Tool arguments too long');
    }
    backend = {
      command: b.command,
      args: b.args,
      toolName: b.toolName,
      enabled: b.enabled,
      timeoutMs: Math.min(120000, Math.max(1000, Number(b.timeoutMs) || 30000)),
    };
  }
  return {
    ...validatePreferenceContract(x),
    keyId: (x.keyId as string | undefined) || slug(String(x.title)) || 'style',
    sourceStyleId: x.sourceStyleId as string | undefined,
    projectId: x.projectId as string | undefined,
    kind: x.kind,
    domain: x.domain,
    title: String(x.title).trim(),
    summary: String(x.summary),
    content: String(x.content),
    tags: x.tags as string[],
    useWhen:
      typeof x.useWhen === 'string'
        ? x.useWhen.trim()
        : discoveryMetadata(x as unknown as RecordInput).useWhen,
    requirements: validateRequirements(x.requirements),
    examples: (x.examples || []) as string[],
    principles: (x.principles || []) as string[],
    externalSkills: (x.externalSkills || []) as string[],
    reviewCriteria: (x.reviewCriteria || []) as string[],
    priority: x.priority as number,
    status: x.status as RecordInput['status'],
    requiredIds: [...new Set((x.requiredIds || []) as string[])],
    checks,
    backend,
  };
}
const stopWords = new Set(
  'the a an and or to of for in on with is it this that my me please let should have use when how can do we you all as at by from be are new using what which who where why there here plus'.split(
    ' ',
  ),
);
function tokenize(s: string): string[] {
  return [
    ...new Set(
      s
        .toLowerCase()
        .normalize('NFKD')
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length > 1 && !stopWords.has(t)),
    ),
  ];
}
export function recordMatch(record: BrainRecord, query: string) {
  const terms = tokenize(query),
    labels = ['title', 'tags', 'useWhen', 'summary', 'guidance'];
  const fields = [
    record.title,
    record.tags.join(' '),
    record.useWhen || '',
    record.summary,
    [
      record.content,
      ...(record.externalSkills || []),
      ...(record.skillBindings || []).map((s) => s.name),
      ...(record.examples || []),
      ...(record.reviewCriteria || []),
    ].join(' '),
  ].map((value) => new Set(tokenize(value)));
  const matches = fields.flatMap((words, i) => {
    const matched = terms.filter((t) => words.has(t));
    return matched.length ? [{field: labels[i], terms: matched}] : [];
  });
  const score = terms.reduce(
    (sum, t) =>
      sum + fields.reduce((n, words, i) => n + (words.has(t) ? [8, 6, 5, 3, 1][i] : 0), 0),
    0,
  );
  const keyTerms = tokenize(record.keyId || '');
  const named = keyTerms.length > 0 && keyTerms.every((t) => terms.includes(t));
  if (named) {
    matches.push({field: 'key', terms: keyTerms});
  }
  return {score: query.trim() ? score + (named ? 20 : 0) : record.priority / 20, matches};
}
export function rankRecord(record: BrainRecord, query: string): number {
  return recordMatch(record, query).score;
}

const diagnose = (
  action: Feedback['action'],
  proposal: unknown,
  record: BrainRecord | null,
): Feedback['diagnosis'] => {
  if (action === 'remember') {
    return 'missing';
  }
  if (action === 'forget' || proposal != null) {
    return 'revision';
  }
  return record?.status === 'active' ? 'execution' : 'missing';
};
type FeedbackInput = {
  recordId?: string | null;
  rating: string;
  note: string;
  projectId?: string | null;
  source?: Feedback['source'];
  sourceEventId?: string | null;
  proposedContent?: string | null;
  action?: Feedback['action'];
  proposal?: {title?: unknown; domain?: unknown} | null;
  evidenceIds?: string[];
  /** Project analysis pins the version it saw, so a newer edit shows as stale. */
  baseVersion?: number;
};
export type DecisionOptions = {content?: unknown; scope?: unknown; acknowledgeRemovals?: unknown};
export class BrainDB {
  db: DatabaseSync;
  constructor(filePath: string = dbPath()) {
    mkdirSync(dirname(filePath), {recursive: true, mode: 0o700});
    this.db = new DatabaseSync(filePath);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, snapshot TEXT NOT NULL, kind TEXT NOT NULL, domain TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS records_filter ON records(kind, domain, status);
      CREATE TABLE IF NOT EXISTS revisions (id TEXT PRIMARY KEY, record_id TEXT NOT NULL, version INTEGER NOT NULL, action TEXT NOT NULL, snapshot TEXT NOT NULL, at TEXT NOT NULL, UNIQUE(record_id,version));
      CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, record_id TEXT, rating TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, snapshot TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS domains (id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE, combinable INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, action TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL, detail TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS trace_events (
        id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, run_id TEXT NOT NULL,
        agent TEXT NOT NULL, channel TEXT NOT NULL, event_type TEXT NOT NULL,
        outcome TEXT NOT NULL, record_ids TEXT NOT NULL, record_versions TEXT NOT NULL DEFAULT '{}', metadata TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS trace_by_time ON trace_events(occurred_at DESC);
      CREATE INDEX IF NOT EXISTS trace_by_run ON trace_events(run_id, occurred_at);
    `);
    if (
      !(
        this.db.prepare("SELECT name FROM pragma_table_info('domains')").all() as {name: string}[]
      ).some((c) => c.name === 'combinable')
    ) {
      this.db.exec('ALTER TABLE domains ADD COLUMN combinable INTEGER NOT NULL DEFAULT 0');
    }
    const feedbackColumns = new Set(
      (
        this.db.prepare("SELECT name FROM pragma_table_info('feedback')").all() as {name: string}[]
      ).map((c) => c.name),
    );
    for (const [name, type] of [
      ['project_id', 'TEXT'],
      ['source', "TEXT NOT NULL DEFAULT 'user'"],
      ['source_event_id', 'TEXT'],
      ['proposed_content', 'TEXT'],
      ['base_version', 'INTEGER'],
      ['diagnosis', "TEXT NOT NULL DEFAULT 'missing'"],
      ['status', "TEXT NOT NULL DEFAULT 'pending'"],
      ['decided_at', 'TEXT'],
      ['applied_version', 'INTEGER'],
      ['action', "TEXT NOT NULL DEFAULT 'revise'"],
      ['proposal', 'TEXT'],
      ['evidence_ids', 'TEXT'],
    ]) {
      if (!feedbackColumns.has(name)) {
        this.db.exec(`ALTER TABLE feedback ADD COLUMN ${name} ${type}`);
      }
    }
    this.db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS feedback_event ON feedback(source_event_id) WHERE source_event_id IS NOT NULL',
    );
    // Carry runs and items saved by earlier versions into the learning loop. Runs are recognized by
    // their stored shape (proposals + decisions), items by a source value this version no longer writes.
    this.db.exec(`UPDATE OR IGNORE meta SET key='learning-run:'||json_extract(value,'$.id')
        WHERE json_valid(value) AND json_type(value,'$.proposals')='array' AND json_type(value,'$.applied')='array'
          AND key<>'learning-run:'||json_extract(value,'$.id');
      UPDATE feedback SET source='projects',
          source_event_id='learning-run:'||substr(source_event_id,instr(source_event_id,':')+1)
        WHERE source NOT IN ('user','agent','projects');`);
    for (const id of DOMAINS) {
      if (!this.db.prepare('SELECT 1 FROM meta WHERE key=?').get('deleted-domain:' + id)) {
        this.db.prepare('INSERT OR IGNORE INTO domains(id,name) VALUES(?,?)').run(id, id);
      }
    }
    if (!this.db.prepare("SELECT value FROM meta WHERE key='capability_names_v1'").get()) {
      this.transaction(() => {
        const names: Record<string, string> = {
          general: 'General',
          thinking: 'Thinking',
          architecture: 'Architecture',
          diagrams: 'Diagrams',
          writing: 'Writing',
          coding: 'Coding',
          technology: 'Technology selection',
          reviews: 'Review',
          communication: 'Communication',
          design: 'UI/UX Design',
          tools: 'MCP tools',
        };
        for (const [id, name] of Object.entries(names)) {
          this.db
            .prepare('UPDATE OR IGNORE domains SET name=? WHERE id=? AND name=?')
            .run(name, id, id);
        }
        for (const [id, name] of [
          ['drawio', 'Draw.io'],
          ['mermaid', 'Mermaid'],
        ]) {
          this.db.prepare('INSERT OR IGNORE INTO domains(id,name) VALUES(?,?)').run(id, name);
        }
        this.db.prepare("INSERT INTO meta(key,value) VALUES('capability_names_v1','1')").run();
      });
    }
    if (!this.db.prepare("SELECT 1 FROM meta WHERE key='style_keys_v1'").get()) {
      this.transaction(() => {
        const used = new Set<string>();
        const rows = this.db
          .prepare(
            "SELECT snapshot FROM records ORDER BY json_extract(snapshot,'$.projectId') IS NOT NULL, rowid",
          )
          .all() as {snapshot: string}[];
        for (const row of rows) {
          const record = this.parse(row.snapshot),
            base = record.keyId || slug(record.title) || 'style';
          // Preserve conflicting legacy content with a distinct, stable key rather than merging it silently.
          let key = base;
          while (
            used.has((record.projectId || 'global') + ':' + key) ||
            used.has('global:' + key)
          ) {
            key = base.slice(0, 100) + '-' + record.id;
          }
          used.add((record.projectId || 'global') + ':' + key);
          this.db
            .prepare('UPDATE records SET snapshot=? WHERE id=?')
            .run(JSON.stringify({...record, keyId: key}), record.id);
        }
        this.db.prepare("INSERT INTO meta(key,value) VALUES('style_keys_v1','1')").run();
      });
    }
    try {
      chmodSync(filePath, 0o600);
    } catch {
      /* permission may be managed by filesystem */
    }
    if (!this.db.prepare("SELECT 1 FROM meta WHERE key='discovery_metadata_v1'").get()) {
      this.transaction(() => {
        for (const row of this.db.prepare('SELECT snapshot FROM records').all() as {
          snapshot: string;
        }[]) {
          const record = this.parse(row.snapshot);
          const metadata = discoveryMetadata(record);
          this.write(
            {
              ...record,
              ...metadata,
              version: record.version + 1,
              updatedAt: new Date().toISOString(),
            },
            'update',
          );
        }
        this.db.prepare("INSERT INTO meta(key,value) VALUES('discovery_metadata_v1','1')").run();
      });
    }
  }
  domains(): Array<{id: string; name: string; combinable: boolean}> {
    return (
      this.db
        .prepare('SELECT id,name,combinable FROM domains ORDER BY name COLLATE NOCASE')
        .all() as Array<{id: string; name: string; combinable: number}>
    ).map((d) => ({id: d.id, name: d.name, combinable: !!d.combinable}));
  }
  // Projects pick one style per kind and capability, except in combinable capabilities where styles stack.
  selectionSlot(record: Pick<BrainRecord, 'id' | 'kind' | 'domain'>): string {
    const row = this.db.prepare('SELECT combinable FROM domains WHERE id=?').get(record.domain) as
      {combinable: number} | undefined;
    return record.kind + ':' + record.domain + (row?.combinable ? ':' + record.id : '');
  }
  hasDomain(id: unknown): boolean {
    return validDomain(id) && !!this.db.prepare('SELECT 1 FROM domains WHERE id=?').get(id);
  }
  saveDomain(name: unknown, id?: string, expectedName?: unknown, combinable?: unknown) {
    if (combinable !== undefined && typeof combinable !== 'boolean') {
      throw new BrainError('Combinable must be true or false');
    }
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) {
      throw new BrainError('Domain name must have 1-60 characters');
    }
    const label = name.trim();
    const key = id || slug(label);
    if (!validDomain(key) || key === 'all') {
      throw new BrainError('Use a domain name starting with a letter');
    }
    return this.transaction(() => {
      const existing = this.domains().find((d) => d.id === key);
      if (id && !existing) {
        throw new BrainError('Domain not found', 'NOT_FOUND', 404);
      }
      if (id && existing?.name !== expectedName) {
        throw new BrainError('Domain changed. Refresh and try again.', 'CONFLICT', 409);
      }
      if (
        (!id && existing) ||
        this.domains().some((d) => d.id !== id && d.name.toLowerCase() === label.toLowerCase())
      ) {
        throw new BrainError('Domain already exists', 'CONFLICT', 409);
      }
      this.db
        .prepare(
          'INSERT INTO domains(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name',
        )
        .run(key, label);
      if (combinable !== undefined) {
        this.db.prepare('UPDATE domains SET combinable=? WHERE id=?').run(combinable ? 1 : 0, key);
        // Turning combining off must not leave a project with two styles in one capability.
        if (!combinable) {
          for (const p of this.projects()) {
            this.scopedRecords(p.id);
          }
        }
      }
      this.audit(id ? 'rename-domain' : 'create-domain', key, label);
      return this.domains().find((d) => d.id === key)!;
    });
  }
  isClosed = false;
  close() {
    this.isClosed = true;
    this.db.close();
  }
  private parse(snapshot: string) {
    return JSON.parse(snapshot) as BrainRecord;
  }
  get(id: string): BrainRecord | null {
    const row = this.db.prepare('SELECT snapshot FROM records WHERE id = ?').get(id) as
      {snapshot: string} | undefined;
    return row ? this.parse(row.snapshot) : null;
  }
  privatizeLegacyProjectStyles(projectId: string) {
    return this.transaction(() => {
      this.project(projectId);
      const all = (
        this.db
          .prepare(
            "SELECT snapshot FROM records WHERE json_extract(snapshot,'$.projectId') IS NULL",
          )
          .all() as {snapshot: string}[]
      ).map((r) => this.parse(r.snapshot));
      const tags = new Set([
        'personal-brain-project-design',
        'personal-brain-project-coding',
        'personal-brain-project-technology',
      ]);
      const candidates = new Map(
        all.filter((r) => r.tags.some((tag) => tags.has(tag))).map((r) => [r.id, r]),
      );
      // Preserve genuine shared consumers; only move records owned exclusively by this project.
      const otherIds = new Set(
        this.projects()
          .filter((p) => p.id !== projectId)
          .flatMap((p) => this.scopedRecords(p.id).map((r) => r.id)),
      );
      let changed = true;
      while (changed) {
        changed = false;
        for (const id of candidates.keys()) {
          if (
            otherIds.has(id) ||
            all.some((r) => !candidates.has(r.id) && linkedIds(r).includes(id))
          ) {
            candidates.delete(id);
            changed = true;
          }
        }
      }
      for (const record of candidates.values()) {
        this.write(
          {...record, projectId, version: record.version + 1, updatedAt: new Date().toISOString()},
          'update',
        );
      }
      for (const record of candidates.values()) {
        this.validateRequired(this.get(record.id)!);
      }
      const selected = new Set(this.scopedRecords(projectId).map((r) => r.id));
      const locals = this.list({projectId, limit: 300}).filter((r) => r.projectId === projectId);
      for (const record of locals) {
        if (selected.has(record.id) || !record.tags.some((tag) => tags.has(tag))) {
          continue;
        }
        const active = locals.find(
          (r) =>
            selected.has(r.id) &&
            r.title === record.title &&
            r.domain === record.domain &&
            r.kind === record.kind,
        );
        const first = this.db
          .prepare('SELECT snapshot FROM revisions WHERE record_id=? AND version=1')
          .get(record.id) as {snapshot: string} | undefined;
        if (active && first && !this.parse(first.snapshot).projectId) {
          this.update(
            record.id,
            {title: record.title.slice(0, 135) + ' (legacy copy)'},
            record.version,
          );
        }
      }
      return candidates.size;
    });
  }
  list(
    filter: {
      projectId?: string;
      kind?: Kind;
      domain?: Domain;
      status?: string;
      query?: string;
      limit?: number;
    } = {},
  ): BrainRecord[] {
    let sql = 'SELECT snapshot FROM records WHERE 1=1';
    const args: string[] = [];
    if (filter.projectId) {
      this.project(filter.projectId);
    }
    sql +=
      " AND (json_extract(snapshot,'$.projectId') IS NULL" +
      (filter.projectId ? " OR json_extract(snapshot,'$.projectId')=?" : '') +
      ')';
    if (filter.projectId) {
      args.push(filter.projectId);
    }
    if (filter.kind) {
      sql += ' AND kind=?';
      args.push(filter.kind);
    }
    if (filter.domain) {
      sql += ' AND domain=?';
      args.push(filter.domain);
    }
    if (filter.status) {
      sql += ' AND status=?';
      args.push(filter.status);
    }
    const rows = this.db.prepare(sql).all(...args) as {snapshot: string}[];
    const query = String(filter.query || '');
    const list = rows
      .map((r) => this.parse(r.snapshot))
      .map((r) => ({r, score: rankRecord(r, query)}));
    list.sort(
      (a, b) =>
        (query ? b.score - a.score : b.r.priority - a.r.priority) ||
        b.r.priority - a.r.priority ||
        b.r.updatedAt.localeCompare(a.r.updatedAt),
    );
    return list
      .filter((v) => !query || v.score > 0)
      .slice(0, Math.min(300, Math.max(1, filter.limit ?? 100)))
      .map((v) => v.r);
  }
  capabilityStats() {
    const records = (
      this.db
        .prepare(
          "SELECT snapshot FROM records WHERE status!='archived' AND json_extract(snapshot,'$.projectId') IS NULL",
        )
        .all() as {snapshot: string}[]
    ).map((r) => this.parse(r.snapshot));
    const usage = new Map<string, Set<string>>();
    for (const p of this.projects()) {
      const seen = new Set<string>();
      const visit = (id: string) => {
        if (seen.has(id)) {
          return;
        }
        seen.add(id);
        const r = this.get(id);
        if (!r || r.status !== 'active' || (r.projectId && r.projectId !== p.id)) {
          return;
        }
        if (!r.projectId) {
          if (!usage.has(r.domain)) {
            usage.set(r.domain, new Set());
          }
          usage.get(r.domain)!.add(p.id);
        }
        for (const child of linkedIds(r)) {
          visit(child);
        }
      };
      p.assignments.forEach((a) => visit(a.recordId));
    }
    return this.domains().map((d) => {
      const rows = records.filter((r) => r.domain === d.id);
      return {
        ...d,
        styles: rows.filter((r) => r.kind === 'preference').length,
        skills:
          rows.filter((r) => r.kind === 'skill').length +
          rows.reduce(
            (n, r) => n + (r.externalSkills?.length || 0) + (r.skillBindings?.length || 0),
            0,
          ),
        examples:
          rows.filter((r) => r.kind === 'example').length +
          rows.reduce((n, r) => n + (r.examples?.length || 0), 0),
        rules:
          rows.filter((r) => r.kind === 'review').length +
          rows.reduce((n, r) => n + (r.reviewCriteria?.length || 0) + r.checks.length, 0),
        projects: usage.get(d.id)?.size || 0,
      };
    });
  }
  projectDefaultStyleIds(): string[] {
    const row = this.db
      .prepare("SELECT value FROM meta WHERE key='new_project_style_defaults_v1'")
      .get() as {value: string} | undefined;
    const ids: string[] = row ? JSON.parse(row.value) : [];
    const architecture = this.db
      .prepare(
        "SELECT id FROM records WHERE json_extract(snapshot,'$.keyId')='solution-architecture' AND json_extract(snapshot,'$.projectId') IS NULL AND json_extract(snapshot,'$.status')='active'",
      )
      .get() as {id: string} | undefined;
    if (architecture && !ids.includes(architecture.id)) {
      ids.push(architecture.id);
    }
    const slots = new Set<string>();
    return ids.filter((id) => {
      const r = this.get(id);
      if (!r || r.projectId || r.status !== 'active') {
        return false;
      }
      const slot = this.selectionSlot(r);
      if (slots.has(slot)) {
        return false;
      }
      slots.add(slot);
      return true;
    });
  }
  summary() {
    const all = this.list({limit: 300});
    const counts = Object.fromEntries(
      ['preference', 'skill', 'example', 'review', 'tool'].map((k) => [
        k,
        all.filter((r) => r.kind === k && r.status === 'active').length,
      ]),
    );
    return {
      counts,
      projectDefaultStyleIds: this.projectDefaultStyleIds(),
      domains: this.domains().map((d) => d.id),
      domainRegistry: this.capabilityStats(),
      total: all.length,
      revisions: (this.db.prepare('SELECT count(*) AS n FROM revisions').get() as {n: number}).n,
      feedback: (this.db.prepare('SELECT count(*) AS n FROM feedback').get() as {n: number}).n,
    };
  }
  transaction<T>(cb: () => T): T {
    this.db.exec('SAVEPOINT brain_write');
    try {
      const result = cb();
      this.db.exec('RELEASE brain_write');
      return result;
    } catch (e) {
      this.db.exec('ROLLBACK TO brain_write; RELEASE brain_write');
      throw e;
    }
  }
  deletionPreview(kind: string, id: string) {
    if (!['record', 'domain', 'project', 'reset'].includes(kind)) {
      throw new BrainError('Invalid removal type');
    }
    const all = (this.db.prepare('SELECT snapshot FROM records').all() as {snapshot: string}[]).map(
      (r) => this.parse(r.snapshot),
    );
    let title = id;
    if (kind === 'record') {
      const r = this.get(id);
      if (!r) {
        throw new BrainError('Record not found', 'NOT_FOUND', 404);
      }
      title = r.title;
    }
    if (kind === 'domain') {
      const d = this.domains().find((d) => d.id === id);
      if (!d) {
        throw new BrainError('Capability not found', 'NOT_FOUND', 404);
      }
      title = d.name;
    }
    if (kind === 'project' || kind === 'reset') {
      title = this.project(id).name;
    }
    const records = all.filter((r) => {
      if (kind === 'record') {
        return r.id === id;
      }
      if (kind === 'domain') {
        return r.domain === id;
      }
      return r.projectId === id;
    });
    const ids = new Set(records.map((r) => r.id));
    const links = all.filter(
      (r) =>
        !ids.has(r.id) &&
        (linkedIds(r).some((x) => ids.has(x)) || (!!r.sourceStyleId && ids.has(r.sourceStyleId))),
    );
    const projects = this.projects().filter(
      (p) =>
        (p.id === id && (kind === 'project' || kind === 'reset')) ||
        p.assignments.some((a) => ids.has(a.recordId)),
    );
    let restored: Array<{recordId: string; override: null}> = [];
    if (kind === 'reset') {
      const baseline = this.db
        .prepare('SELECT value FROM meta WHERE key=?')
        .get('project-style-baseline:' + id) as {value: string} | undefined;
      restored = (baseline ? JSON.parse(baseline.value) : this.project(id).assignments)
        .filter((a: {recordId: string}) => {
          const r = this.get(a.recordId);
          return r && !r.projectId && r.status === 'active';
        })
        .map((a: {recordId: string}) => ({recordId: a.recordId, override: null}));
    }
    const fingerprint = createHmac('sha256', 'deletion-preview')
      .update(
        JSON.stringify({
          kind,
          id,
          all: all.map((r) => [r.id, r.version]),
          projects: this.projects(),
          domains: this.domains(),
          restored,
        }),
      )
      .digest('hex');
    return {
      kind,
      id,
      title,
      records: records.map((r) => ({id: r.id, title: r.title})),
      linkedRecords: links.map((r) => ({id: r.id, title: r.title})),
      projects: projects.map((p) => ({id: p.id, name: p.name})),
      restored: restored.map((a) => ({...a, title: this.get(a.recordId)!.title})),
      fingerprint,
    };
  }
  deleteWithPreview(kind: string, id: string, fingerprint: string) {
    return this.transaction(() => {
      const preview = this.deletionPreview(kind, id);
      if (fingerprint !== preview.fingerprint) {
        throw new BrainError('Data changed. Review a fresh deletion preview.', 'CONFLICT', 409);
      }
      const ids = new Set(preview.records.map((r) => r.id));
      for (const linked of preview.linkedRecords) {
        const r = this.get(linked.id)!;
        this.write(
          {
            ...r,
            requiredIds: (r.requiredIds || []).filter((x) => !ids.has(x)),
            supportingLinks: r.supportingLinks?.filter((x) => !ids.has(x.recordId)),
            version: r.version + 1,
            updatedAt: new Date().toISOString(),
          },
          'update',
        );
      }
      for (const p of this.projects()) {
        if (kind === 'project' && p.id === id) {
          this.db.prepare('DELETE FROM projects WHERE id=?').run(id);
          continue;
        }
        const assignments =
          kind === 'reset' && p.id === id
            ? preview.restored.map(({recordId}) => ({recordId, override: null}))
            : p.assignments.filter((a) => !ids.has(a.recordId));
        if (JSON.stringify(assignments) !== JSON.stringify(p.assignments)) {
          this.db.prepare('UPDATE projects SET snapshot=? WHERE id=?').run(
            JSON.stringify({
              ...p,
              assignments,
              version: p.version + 1,
              updatedAt: new Date().toISOString(),
            }),
            p.id,
          );
        }
      }
      for (const recordId of ids) {
        const removed = this.get(recordId);
        // Deletion receipt: a hash of the key only, so a later import cannot silently restore it.
        if (removed?.keyId && !removed.projectId) {
          this.db
            .prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)')
            .run('deleted-key:' + keyReceipt(removed.keyId), new Date().toISOString());
        }
        this.db.prepare('DELETE FROM meta WHERE key=?').run('learning-fixtures:' + recordId);
        if (
          removed?.projectId &&
          removed.tags.includes('auto-project-discovery') &&
          kind !== 'project'
        ) {
          this.db
            .prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)')
            .run('discovery-paused:' + removed.projectId, '1');
        }
        for (const table of ['revisions', 'feedback']) {
          this.db.prepare(`DELETE FROM ${table} WHERE record_id=?`).run(recordId);
        }
        this.db.prepare('DELETE FROM records WHERE id=?').run(recordId);
        this.db.prepare('DELETE FROM audit WHERE target=?').run(recordId);
        this.db
          .prepare(
            'DELETE FROM trace_events WHERE EXISTS (SELECT 1 FROM json_each(trace_events.record_ids) WHERE value=?)',
          )
          .run(recordId);
      }
      for (const row of this.db
        .prepare(
          "SELECT snapshot FROM records WHERE json_extract(snapshot,'$.sourceStyleId') IS NOT NULL",
        )
        .all() as {snapshot: string}[]) {
        const record = this.parse(row.snapshot);
        if (ids.has(record.sourceStyleId!)) {
          this.write(
            {
              ...record,
              sourceStyleId: undefined,
              sourceVersion: undefined,
              version: record.version + 1,
              updatedAt: new Date().toISOString(),
            },
            'update',
          );
        }
      }
      const defaults = this.db
        .prepare("SELECT value FROM meta WHERE key='new_project_style_defaults_v1'")
        .get() as {value: string} | undefined;
      for (const row of this.db
        .prepare(
          "SELECT key,value FROM meta WHERE key LIKE 'learning-run:%' OR key LIKE 'instruction-set:%'",
        )
        .all() as {key: string; value: string}[]) {
        const snapshot: {
          projectId?: string;
          projectIds?: string[];
          resolvedIds?: string[];
          recordIds?: string[];
          sources?: {
            contextProjectId?: string;
            projectId?: string;
            recordId?: string;
            id?: string;
          }[];
          targets?: {id?: string}[];
        } = JSON.parse(row.value);
        const projectAffected =
          (kind === 'project' || kind === 'reset') &&
          (snapshot.projectId === id ||
            snapshot.projectIds?.includes(id) ||
            snapshot.sources?.some((r) => r.contextProjectId === id || r.projectId === id));
        const recordAffected = [
          ...(snapshot.resolvedIds || snapshot.recordIds || []),
          ...(snapshot.sources || []).map((r) => r.recordId || r.id),
          ...(snapshot.targets || []).map((r) => r.id),
        ].some((recordId) => recordId !== undefined && ids.has(recordId));
        if (projectAffected || recordAffected) {
          this.db.prepare('DELETE FROM meta WHERE key=?').run(row.key);
        }
      }
      if (defaults) {
        this.db
          .prepare("UPDATE meta SET value=? WHERE key='new_project_style_defaults_v1'")
          .run(JSON.stringify(JSON.parse(defaults.value).filter((x: string) => !ids.has(x))));
      }
      for (const row of this.db
        .prepare("SELECT key,value FROM meta WHERE key LIKE 'project-style-baseline:%'")
        .all() as {key: string; value: string}[]) {
        this.db
          .prepare('UPDATE meta SET value=? WHERE key=?')
          .run(
            JSON.stringify(
              JSON.parse(row.value).filter((a: {recordId: string}) => !ids.has(a.recordId)),
            ),
            row.key,
          );
      }
      if (kind === 'domain') {
        this.db.prepare('DELETE FROM domains WHERE id=?').run(id);
        this.db
          .prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)')
          .run('deleted-domain:' + id, '1');
      }
      if (kind === 'project') {
        for (const prefix of [
          'repository:',
          'project-style-baseline:',
          'discovery-paused:',
          'learning-paused:',
        ]) {
          this.db.prepare('DELETE FROM meta WHERE key=?').run(prefix + id);
        }
        this.db
          .prepare("DELETE FROM trace_events WHERE json_extract(metadata,'$.projectId')=?")
          .run(id);
        this.db.prepare('DELETE FROM feedback WHERE project_id=?').run(id);
      }
      if (kind === 'reset') {
        this.db
          .prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)')
          .run('discovery-paused:' + id, '1');
        this.scopedRecords(id);
      }
      return preview;
    });
  }
  projectRecordByTag(projectId: string, tag: string): BrainRecord | undefined {
    const row = this.db
      .prepare(
        "SELECT snapshot FROM records WHERE json_extract(snapshot,'$.projectId')=? AND EXISTS (SELECT 1 FROM json_each(records.snapshot,'$.tags') WHERE value=?) LIMIT 1",
      )
      .get(projectId, tag) as {snapshot: string} | undefined;
    return row ? this.parse(row.snapshot) : undefined;
  }
  create(raw: unknown, uniqueProjectTag?: string): BrainRecord {
    const input = checkInput(raw);
    if (input.projectId) {
      this.project(input.projectId);
    }
    if (!this.hasDomain(input.domain)) {
      throw new BrainError('Register this domain before using it');
    }
    const now = new Date().toISOString();
    const rec: BrainRecord = {
      ...input,
      id: randomUUID(),
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    return this.transaction(() => {
      if (uniqueProjectTag) {
        if (!input.projectId || !input.tags.includes(uniqueProjectTag)) {
          throw new BrainError('Unique discovery tags require a project-private record');
        }
        const existing = this.projectRecordByTag(input.projectId, uniqueProjectTag);
        if (existing) {
          return existing;
        }
      }
      if (input.sourceStyleId) {
        throw new BrainError('Use project personalization to link a global style');
      }
      if (input.projectId) {
        const existing = this.styleByKey(input.keyId!, input.projectId);
        if (existing) {
          if (existing.kind !== input.kind || existing.domain !== input.domain) {
            throw new BrainError(
              'Style key belongs to a different capability or type',
              'CONFLICT',
              409,
            );
          }
          const localRow = this.db
            .prepare(
              "SELECT snapshot FROM records WHERE json_extract(snapshot,'$.keyId')=? AND json_extract(snapshot,'$.projectId')=?",
            )
            .get(input.keyId!, input.projectId) as {snapshot: string} | undefined;
          const local = localRow ? this.parse(localRow.snapshot) : undefined;
          if (local) {
            return this.update(
              local.id,
              {...input, sourceStyleId: local.sourceStyleId},
              local.version,
            );
          }
          const project = this.project(input.projectId);
          if (!this.scopedRecords(project.id).some((r) => r.id === existing.id)) {
            this.saveProject(
              {
                ...project,
                assignments: [...project.assignments, {recordId: existing.id, override: null}],
              },
              project.id,
              project.version,
            );
          }
          return this.personalizeRecord(
            project.id,
            existing.id,
            input,
            existing.version,
            this.project(project.id).version,
          );
        }
      }
      this.validateRequired(rec);
      this.write(rec, 'create');
      return rec;
    });
  }
  update(id: string, raw: unknown, expectedVersion: number): BrainRecord {
    return this.transaction(() => {
      const prev = this.get(id);
      if (!prev) {
        throw new BrainError('Record not found', 'NOT_FOUND', 404);
      }
      if (prev.version !== expectedVersion) {
        throw new BrainError('Version conflict. Refresh and try again.', 'CONFLICT', 409);
      }
      const input = checkInput({...prev, ...(raw as object)});
      if (
        input.keyId !== prev.keyId ||
        input.sourceStyleId !== prev.sourceStyleId ||
        input.sourceVersion !== prev.sourceVersion
      ) {
        throw new BrainError('Style identity cannot be changed');
      }
      if (input.projectId !== prev.projectId) {
        throw new BrainError('Record scope cannot be changed');
      }
      if (!this.hasDomain(input.domain)) {
        throw new BrainError('Register this domain before using it');
      }
      const rec: BrainRecord = {
        ...prev,
        ...input,
        version: prev.version + 1,
        updatedAt: new Date().toISOString(),
      };
      this.validateRequired(rec);
      this.write(rec, 'update');
      return rec;
    });
  }
  restore(id: string, targetVersion: number, expectedVersion: number): BrainRecord {
    return this.transaction(() => {
      const prev = this.get(id);
      if (!prev) {
        throw new BrainError('Record not found', 'NOT_FOUND', 404);
      }
      if (prev.version !== expectedVersion) {
        throw new BrainError('Version conflict', 'CONFLICT', 409);
      }
      const row = this.db
        .prepare('SELECT snapshot FROM revisions WHERE record_id=? AND version=?')
        .get(id, targetVersion) as {snapshot: string} | undefined;
      if (!row) {
        throw new BrainError('Revision not found', 'NOT_FOUND', 404);
      }
      const historical = this.parse(row.snapshot);
      const rec: BrainRecord = {
        ...prev,
        ...checkInput(historical),
        keyId: prev.keyId,
        sourceStyleId: prev.sourceStyleId,
        projectId: prev.projectId,
        version: prev.version + 1,
        updatedAt: new Date().toISOString(),
      };
      this.validateRequired(rec);
      this.write(rec, 'restore');
      return rec;
    });
  }
  /** Validate the final graph so an atomic dependency reversal has no transient cycle. */
  updateBatch(
    changes: Array<{id: string; expectedVersion: number; input: Partial<RecordInput>}>,
  ): BrainRecord[] {
    return this.transaction(() => {
      const seen = new Set<string>();
      const records = changes.map((change) => {
        const previous = this.get(change.id);
        if (!previous || previous.version !== change.expectedVersion || seen.has(change.id)) {
          throw new BrainError('Batch changed or contains duplicate records', 'CONFLICT', 409);
        }
        seen.add(change.id);
        const input = checkInput({...previous, ...change.input});
        for (const key of ['keyId', 'projectId', 'sourceStyleId', 'sourceVersion'] as const) {
          if (input[key] !== previous[key]) {
            throw new BrainError('Batch cannot change record identity or scope');
          }
        }
        if (!this.hasDomain(input.domain)) {
          throw new BrainError('Register this domain before using it');
        }
        return {
          ...previous,
          ...input,
          version: previous.version + 1,
          updatedAt: new Date().toISOString(),
        };
      });
      for (const record of records) {
        this.write(record, 'update');
      }
      for (const record of this.list({limit: 300})) {
        this.validateRequired(record);
      }
      for (const project of this.projects()) {
        this.scopedRecords(project.id);
      }
      return records;
    });
  }
  styleByKey(keyId: string, projectId?: string): BrainRecord | undefined {
    const rows = this.db
      .prepare(
        "SELECT snapshot FROM records WHERE json_extract(snapshot,'$.keyId')=? AND (json_extract(snapshot,'$.projectId') IS NULL OR json_extract(snapshot,'$.projectId')=?) ORDER BY json_extract(snapshot,'$.projectId') IS NOT NULL",
      )
      .all(keyId, projectId || '') as {snapshot: string}[];
    return rows.map((row) => this.parse(row.snapshot))[0];
  }
  private write(rec: BrainRecord, action: Revision['action']) {
    rec.keyId ||= slug(rec.title) || 'style';
    const matches = (
      this.db
        .prepare("SELECT snapshot FROM records WHERE json_extract(snapshot,'$.keyId')=? AND id!=?")
        .all(rec.keyId, rec.id) as {snapshot: string}[]
    ).map((row) => this.parse(row.snapshot));
    if (
      matches.some(
        (r) =>
          r.projectId === rec.projectId ||
          (!r.projectId && rec.sourceStyleId !== r.id) ||
          (!rec.projectId && r.sourceStyleId !== rec.id),
      )
    ) {
      throw new BrainError(
        'Style key already exists. Reuse the global style or update the project style.',
        'CONFLICT',
        409,
      );
    }
    if (rec.sourceStyleId) {
      const source = this.get(rec.sourceStyleId);
      if (!rec.projectId || !source || source.projectId || source.keyId !== rec.keyId) {
        throw new BrainError('Invalid global style personalization link');
      }
    }
    const snapshot = JSON.stringify(rec);
    this.db
      .prepare(
        `INSERT INTO records(id,snapshot,kind,domain,status,version,updated_at) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET snapshot=excluded.snapshot,kind=excluded.kind,domain=excluded.domain,status=excluded.status,version=excluded.version,updated_at=excluded.updated_at`,
      )
      .run(rec.id, snapshot, rec.kind, rec.domain, rec.status, rec.version, rec.updatedAt);
    this.db
      .prepare('INSERT INTO revisions(id,record_id,version,action,snapshot,at) VALUES(?,?,?,?,?,?)')
      .run(randomUUID(), rec.id, rec.version, action, snapshot, rec.updatedAt);
    this.audit(action, rec.id, `v${rec.version}`);
  }
  history(id: string): Revision[] {
    return (
      this.db
        .prepare(
          'SELECT id,record_id,version,action,snapshot,at FROM revisions WHERE record_id=? ORDER BY version DESC',
        )
        .all(id) as Array<{
        id: string;
        record_id: string;
        version: number;
        action: Revision['action'];
        snapshot: string;
        at: string;
      }>
    ).map((r) => ({
      id: r.id,
      recordId: r.record_id,
      version: r.version,
      action: r.action,
      snapshot: this.parse(r.snapshot),
      at: r.at,
    }));
  }
  addFeedback(input: FeedbackInput): Feedback {
    if (!['accepted', 'rejected', 'correction'].includes(input.rating)) {
      throw new BrainError('Invalid rating');
    }
    if (!input.note || input.note.length > 10000) {
      throw new BrainError('Feedback note required, max 10000 characters');
    }
    if (input.sourceEventId && input.sourceEventId.length > 200) {
      throw new BrainError('Source event ID max 200 characters');
    }
    const action = input.action || 'revise';
    if (!['revise', 'remember', 'forget'].includes(action)) {
      throw new BrainError('Invalid learning action');
    }
    const proposed = input.proposedContent ?? null;
    if (proposed !== null && (!proposed.trim() || proposed.length > 100000)) {
      throw new BrainError('Proposed content required, max 100000 characters');
    }
    let proposal: Feedback['proposal'] = null;
    if (action === 'remember') {
      const title = String(input.proposal?.title || '').trim();
      if (input.recordId || proposed === null || !title || title.length > 200) {
        throw new BrainError('Remember needs content and a title (max 200), and no target record');
      }
      if (!this.hasDomain(input.proposal?.domain)) {
        throw new BrainError(
          'Unknown domain. Use one of: ' +
            this.domains()
              .map((d) => d.id)
              .join(', '),
        );
      }
      proposal = {title, domain: String(input.proposal!.domain)};
    } else if (!input.recordId && (proposed !== null || action === 'forget')) {
      throw new BrainError('A proposed change must target a record');
    } else if (action === 'forget' && proposed !== null) {
      throw new BrainError('Forget does not take proposed content');
    }
    if ([input.note, proposed || '', proposal?.title || ''].some(looksLikeCredential)) {
      throw new BrainError('This looks like a credential. Remove secrets before saving feedback.');
    }
    if (input.projectId) {
      this.project(input.projectId);
    }
    const record = input.recordId ? this.get(input.recordId) : null;
    // Project-private records are invisible outside their project, so treat them as missing.
    if (input.recordId && (!record || (record.projectId && record.projectId !== input.projectId))) {
      throw new BrainError('Referenced record not found', 'NOT_FOUND', 404);
    }
    return this.transaction(() => {
      if (input.sourceEventId) {
        const existing = this.feedbackRows('WHERE source_event_id=?', input.sourceEventId)[0];
        if (existing) {
          return existing;
        }
      }
      const f: Feedback = {
        id: randomUUID(),
        recordId: record?.id || null,
        rating: input.rating as Feedback['rating'],
        note: input.note,
        createdAt: new Date().toISOString(),
        projectId: input.projectId || null,
        source: input.source || 'user',
        sourceEventId: input.sourceEventId || null,
        proposedContent: proposed,
        baseVersion: input.baseVersion ?? record?.version ?? null,
        diagnosis: diagnose(action, proposed, record),
        status: 'pending',
        decidedAt: null,
        appliedVersion: null,
        action,
        proposal,
        evidenceIds: input.evidenceIds || [],
      };
      this.db
        .prepare(
          'INSERT INTO feedback(id,record_id,rating,note,created_at,project_id,source,source_event_id,proposed_content,base_version,diagnosis,status,action,proposal,evidence_ids) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .run(
          f.id,
          f.recordId,
          f.rating,
          f.note,
          f.createdAt,
          f.projectId,
          f.source,
          f.sourceEventId,
          f.proposedContent,
          f.baseVersion,
          f.diagnosis,
          f.status,
          f.action,
          f.proposal ? JSON.stringify(f.proposal) : null,
          JSON.stringify(f.evidenceIds),
        );
      this.audit(
        'feedback',
        f.recordId || 'general',
        `${f.action} ${f.diagnosis} from ${f.source}`,
      );
      return f;
    });
  }
  learningSettings() {
    const value = (key: string) =>
      (
        this.db.prepare('SELECT value FROM meta WHERE key=?').get(key) as
          {value: string} | undefined
      )?.value;
    const retention = value('learning-retention-days');
    return {
      mode: (value('learning-mode') as LearningMode | undefined) || 'suggest',
      retentionDays: retention === undefined ? DEFAULT_RETENTION_DAYS : Number(retention),
      pausedProjects: (
        this.db
          .prepare("SELECT substr(key,17) AS id FROM meta WHERE key LIKE 'learning-paused:%'")
          .all() as {id: string}[]
      ).map((r) => r.id),
      suppressions: (
        this.db
          .prepare("SELECT count(*) AS n FROM meta WHERE key LIKE 'learning-suppressed:%'")
          .get() as {n: number}
      ).n,
      // Merging identical local proposals costs nothing, so it is on by default.
      autoConsolidate: value('learning-auto-consolidate') !== '0',
      // Comparing projects calls the user's agent CLI, so it stays off until the user answers once.
      autoProjects: value('learning-auto-projects') === '1',
      autoProjectsAsked: value('learning-auto-projects') !== undefined,
      agent: (value('learning-agent') || '') as '' | 'codex' | 'claude',
    };
  }
  saveLearningSettings(raw: unknown) {
    const x = (raw || {}) as {
      mode?: unknown;
      retentionDays?: unknown;
      pausedProjects?: unknown;
      autoConsolidate?: unknown;
      autoProjects?: unknown;
      agent?: unknown;
    };
    for (const key of ['autoConsolidate', 'autoProjects'] as const) {
      if (x[key] !== undefined && typeof x[key] !== 'boolean') {
        throw new BrainError(key + ' must be true or false');
      }
    }
    if (x.agent !== undefined && !['', 'codex', 'claude'].includes(x.agent as string)) {
      throw new BrainError('Agent must be codex, claude or empty for automatic');
    }
    if (!LEARNING_MODES.includes(x.mode as LearningMode)) {
      throw new BrainError('Mode must be off, suggest or explicit');
    }
    const days = Number(x.retentionDays);
    if (!Number.isInteger(days) || days < 0 || days > 3650) {
      throw new BrainError('Retention must be 0-3650 days (0 keeps decided evidence)');
    }
    if (!Array.isArray(x.pausedProjects) || x.pausedProjects.some((id) => typeof id !== 'string')) {
      throw new BrainError('Paused projects must be a list of project IDs');
    }
    return this.transaction(() => {
      for (const id of x.pausedProjects as string[]) {
        this.project(id);
      }
      const set = this.db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)');
      set.run('learning-mode', String(x.mode));
      set.run('learning-retention-days', String(days));
      if (x.autoConsolidate !== undefined) {
        set.run('learning-auto-consolidate', x.autoConsolidate ? '1' : '0');
      }
      if (x.autoProjects !== undefined) {
        set.run('learning-auto-projects', x.autoProjects ? '1' : '0');
      }
      if (x.agent !== undefined) {
        set.run('learning-agent', String(x.agent));
      }
      this.db.prepare("DELETE FROM meta WHERE key LIKE 'learning-paused:%'").run();
      for (const id of x.pausedProjects as string[]) {
        set.run('learning-paused:' + id, '1');
      }
      this.audit('learning-settings', 'learning', `${x.mode}, ${days} days`);
      return this.learningSettings();
    });
  }
  /** Agent entry point: honors capture mode, project pause and dismissed-idea suppression. */
  capture(input: FeedbackInput): {recorded: boolean; reason?: string; feedback?: Feedback} {
    const settings = this.learningSettings();
    if (settings.mode === 'off') {
      return {recorded: false, reason: 'Learning capture is off'};
    }
    if (input.projectId && settings.pausedProjects.includes(input.projectId)) {
      return {recorded: false, reason: 'Learning capture is paused for this project'};
    }
    if (this.isSuppressed(input)) {
      return {recorded: false, reason: 'You dismissed a matching suggestion before'};
    }
    let feedback = this.addFeedback({...input, source: 'agent'});
    if (settings.autoConsolidate) {
      feedback = this.autoConsolidate(feedback);
    }
    const record = feedback.recordId ? this.get(feedback.recordId) : null;
    // Explicit mode commits remember/forget only inside the caller's own scope; anything wider waits for review.
    const sameScope =
      feedback.action === 'remember' ||
      (feedback.action === 'forget' && (record?.projectId || null) === feedback.projectId);
    if (settings.mode === 'explicit' && feedback.status === 'pending' && sameScope) {
      try {
        return {recorded: true, feedback: this.decideFeedback(feedback.id, 'accept')};
      } catch (e) {
        // Keep the request in the inbox so the user can resolve the conflict.
        return {recorded: true, reason: 'Saved for review: ' + (e as Error).message, feedback};
      }
    }
    return {recorded: true, feedback};
  }
  private fingerprintOf(
    f: Pick<FeedbackInput, 'action' | 'recordId' | 'proposedContent' | 'note'>,
  ) {
    const action = f.action || 'revise';
    return suppressionFingerprint(
      action,
      f.recordId || null,
      action === 'forget' ? '' : (f.proposedContent ?? f.note),
    );
  }
  private isSuppressed(f: FeedbackInput) {
    return !!this.db
      .prepare('SELECT 1 FROM meta WHERE key=?')
      .get('learning-suppressed:' + this.fingerprintOf(f));
  }
  clearSuppressions() {
    const n = Number(
      this.db.prepare("DELETE FROM meta WHERE key LIKE 'learning-suppressed:%'").run().changes,
    );
    this.audit('learning-suppressions-cleared', 'learning', String(n));
    return {cleared: n};
  }
  /** User decision on an inbox item. Accepting writes a new record revision against the item's base version. */
  decideFeedback(id: string, decision: unknown, options: DecisionOptions = {}): Feedback {
    if (decision !== 'accept' && decision !== 'dismiss' && decision !== 'split') {
      throw new BrainError('Decision must be accept, dismiss or split');
    }
    if (options.content !== undefined && typeof options.content !== 'string') {
      throw new BrainError('Edited content must be text');
    }
    if (options.scope !== undefined && options.scope !== 'project') {
      throw new BrainError('Scope may only be narrowed to project');
    }
    return this.transaction(() => {
      const f = this.feedbackRows('WHERE id=?', id)[0];
      if (!f) {
        throw new BrainError('Feedback not found', 'NOT_FOUND', 404);
      }
      if (f.status !== 'pending') {
        throw new BrainError('Feedback was already decided', 'CONFLICT', 409);
      }
      if (f.source === 'projects') {
        // Project-analysis proposals carry source evidence only decideLearningItem can re-check.
        throw new BrainError('Project-analysis proposals are decided through decideLearningItem');
      }
      const decidedAt = new Date().toISOString();
      if (decision === 'split') {
        if (!f.evidenceIds.length) {
          throw new BrainError('Only a consolidated proposal can be split');
        }
        this.db
          .prepare("UPDATE feedback SET status='dismissed',decided_at=? WHERE id=?")
          .run(decidedAt, id);
        for (const sourceId of f.evidenceIds) {
          this.db
            .prepare(
              "UPDATE feedback SET status='pending',decided_at=NULL WHERE id=? AND status='superseded'",
            )
            .run(sourceId);
        }
        this.audit('feedback-split', f.recordId || 'general', String(f.evidenceIds.length));
        return {...f, status: 'dismissed', decidedAt};
      }
      let appliedVersion: number | null = null;
      let recordId: string | null = null;
      if (decision === 'accept') {
        ({appliedVersion, recordId} = this.applyFeedback(f, options));
      } else {
        // Dismissal suppresses recurrence of the same idea; only a hash is kept.
        this.db
          .prepare('INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)')
          .run('learning-suppressed:' + this.fingerprintOf(f), decidedAt);
      }
      return this.closeFeedback(
        f,
        decision === 'accept' ? 'accepted' : 'dismissed',
        appliedVersion,
        recordId,
      );
    });
  }
  feedbackItem(id: string): Feedback | undefined {
    return this.feedbackRows('WHERE id=?', id)[0];
  }
  /** Records a decision on a pending item and on the items it consolidated. */
  closeFeedback(
    f: Feedback,
    status: 'accepted' | 'dismissed',
    appliedVersion: number | null,
    recordId: string | null = null,
  ): Feedback {
    const decidedAt = new Date().toISOString();
    this.db
      .prepare(
        'UPDATE feedback SET status=?,decided_at=?,applied_version=?,record_id=COALESCE(?,record_id) WHERE id=?',
      )
      .run(status, decidedAt, appliedVersion, recordId, f.id);
    for (const sourceId of f.evidenceIds) {
      this.db
        .prepare("UPDATE feedback SET status=?,decided_at=? WHERE id=? AND status='superseded'")
        .run(status, decidedAt, sourceId);
    }
    this.audit(
      'feedback-' + status,
      recordId || f.recordId || 'general',
      appliedVersion ? `v${appliedVersion}` : f.action,
    );
    return {...f, status, decidedAt, appliedVersion, recordId: recordId || f.recordId};
  }
  /** Blocks a revision that drops obligations (unless acknowledged) or fails regression fixtures. */
  checkRevision(recordId: string, content: string, acknowledgeRemovals: unknown) {
    const current = this.get(recordId);
    const lost = current ? lostObligations(current.content, content) : [];
    if (lost.length && acknowledgeRemovals !== true) {
      throw new BrainError(
        'Proposal drops mandatory statements: ' + lost.join(' | '),
        'OBLIGATIONS_REMOVED',
        409,
      );
    }
    const failed = fixtureFailures(this.fixtures(recordId), content);
    if (failed.length) {
      // Regression fixtures have no override: edit the proposal or the fixtures first.
      throw new BrainError(
        'Regression fixtures failed: ' + failed.join(' | '),
        'FIXTURES_FAILED',
        409,
      );
    }
    return current;
  }
  private applyFeedback(
    f: Feedback,
    options: DecisionOptions,
  ): {appliedVersion: number | null; recordId: string | null} {
    if (f.action === 'remember') {
      const style = {
        title: f.proposal!.title,
        domain: f.proposal!.domain,
        summary: f.note.slice(0, 1200),
        content: (options.content as string | undefined) ?? f.proposedContent!,
        tags: ['remembered'],
      };
      const record = f.projectId
        ? this.createProjectStyle(f.projectId, style, this.project(f.projectId).version).record
        : this.create({
            ...style,
            kind: 'preference',
            priority: 50,
            status: 'active',
            checks: [],
            backend: null,
          });
      return {appliedVersion: record.version, recordId: record.id};
    }
    if (!f.recordId || f.baseVersion == null) {
      if (options.content !== undefined) {
        throw new BrainError('Edited content requires a target record');
      }
      return {appliedVersion: null, recordId: null};
    }
    if (f.action === 'forget') {
      // Archive is reversible from History; permanent purge stays in the removal preview flow.
      return {
        appliedVersion: this.update(f.recordId, {status: 'archived'}, f.baseVersion).version,
        recordId: null,
      };
    }
    const content = (options.content as string | undefined) ?? f.proposedContent;
    if (content == null) {
      return {appliedVersion: null, recordId: null};
    }
    const current = this.checkRevision(f.recordId, content, options.acknowledgeRemovals);
    if (options.scope === 'project') {
      if (!f.projectId || current?.projectId) {
        throw new BrainError('Project-only applies to project feedback on a shared style');
      }
      // personalizeRecord checks the base version, so a newer shared edit still conflicts.
      const copy = this.personalizeRecord(
        f.projectId,
        f.recordId,
        {content},
        f.baseVersion,
        this.project(f.projectId).version,
      ) as BrainRecord;
      return {appliedVersion: copy.version, recordId: copy.id};
    }
    // A newer edit since the proposal was made raises CONFLICT instead of being overwritten.
    return {
      appliedVersion: this.update(f.recordId, {content}, f.baseVersion).version,
      recordId: null,
    };
  }
  /** Bulk decisions run independently so one failure is reported without hiding the others. */
  decideMany(
    ids: unknown,
    decision: unknown,
    options: DecisionOptions = {},
    decide: (id: string, decision: unknown, options: DecisionOptions) => Feedback = (i, d, o) =>
      this.decideFeedback(i, d, o),
  ) {
    if (!Array.isArray(ids) || !ids.length || ids.length > 100) {
      throw new BrainError('Select 1-100 items');
    }
    return ids.map((id) => {
      try {
        return {id, ok: true, feedback: decide(String(id), decision, options)};
      } catch (e) {
        return {id, ok: false, error: e instanceof Error ? e.message : String(e)};
      }
    });
  }
  /** Fold related pending corrections on one record into a single candidate, keeping every source. */
  consolidateFeedback(ids: unknown, content?: unknown): Feedback {
    if (
      !Array.isArray(ids) ||
      ids.length < 2 ||
      ids.length > 50 ||
      new Set(ids).size !== ids.length
    ) {
      throw new BrainError('Select 2-50 distinct items to consolidate');
    }
    if (content !== undefined && typeof content !== 'string') {
      throw new BrainError('Consolidated content must be text');
    }
    return this.transaction(() => {
      const rows = ids.map((id) => this.feedbackRows('WHERE id=?', String(id))[0]);
      const first = rows[0];
      if (
        rows.some(
          (r) =>
            !r ||
            r.status !== 'pending' ||
            r.source === 'projects' ||
            r.action !== 'revise' ||
            !r.recordId ||
            r.recordId !== first.recordId ||
            r.projectId !== first.projectId,
        )
      ) {
        throw new BrainError(
          'Only pending revisions of the same style and scope can be consolidated',
          'CONFLICT',
          409,
        );
      }
      const latest = [...rows]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .find((r) => r.proposedContent !== null);
      const merged = this.addFeedback({
        rating: 'correction',
        note: rows
          .map((r) => r.note)
          .join('\n---\n')
          .slice(0, 10000),
        recordId: first.recordId,
        projectId: first.projectId,
        proposedContent: (content as string | undefined) ?? latest?.proposedContent ?? null,
        evidenceIds: rows.map((r) => r.id),
      });
      for (const r of rows) {
        this.db.prepare("UPDATE feedback SET status='superseded' WHERE id=?").run(r.id);
      }
      return merged;
    });
  }
  /** Permanently delete evidence rows. The audit receipt keeps only a count. */
  purgeFeedback(ids: unknown) {
    if (!Array.isArray(ids) || !ids.length || ids.length > 200) {
      throw new BrainError('Select 1-200 items to purge');
    }
    const del = this.db.prepare('DELETE FROM feedback WHERE id=?');
    const n = this.transaction(() =>
      ids.reduce((sum: number, id) => sum + Number(del.run(String(id)).changes), 0),
    );
    this.audit('feedback-purged', 'learning', String(n));
    return {purged: n};
  }
  /** Retention: decided evidence older than the policy is deleted; pending items are never expired. */
  expireEvidence(now = Date.now()) {
    const {retentionDays} = this.learningSettings();
    if (!retentionDays) {
      return 0;
    }
    const cutoff = new Date(now - retentionDays * 86400000).toISOString();
    const n = Number(
      this.db
        .prepare(
          "DELETE FROM feedback WHERE status!='pending' AND decided_at IS NOT NULL AND decided_at<?",
        )
        .run(cutoff).changes,
    );
    if (n) {
      this.audit('feedback-expired', 'learning', String(n));
    }
    return n;
  }
  /** Inbox listing enriched with target content, evidence counts and conflict signals. */
  inbox(
    filter: {
      projectId?: string;
      status?: string;
      diagnosis?: string;
      recordId?: string;
      source?: string;
    } = {},
  ) {
    this.expireEvidence();
    const all = this.feedbackRows('ORDER BY created_at DESC');
    const shown = all
      .filter(
        (f) =>
          (!filter.projectId || f.projectId === filter.projectId) &&
          (!filter.status || f.status === filter.status) &&
          (!filter.diagnosis || f.diagnosis === filter.diagnosis) &&
          (!filter.recordId || f.recordId === filter.recordId) &&
          (!filter.source || f.source === filter.source),
      )
      .slice(0, 200);
    const reviews = this.reviewEvidence();
    return shown.map((f) => {
      const record = f.recordId ? this.get(f.recordId) : null;
      const related = all.filter((o) => f.recordId && o.recordId === f.recordId);
      const independent = new Set(
        related
          .filter(
            (o) => o.rating === 'correction' && o.status !== 'dismissed' && !o.evidenceIds.length,
          )
          .map((o) => o.sourceEventId || o.id),
      ).size;
      return {
        ...f,
        target: record
          ? {
              title: record.title,
              content: record.content,
              version: record.version,
              status: record.status,
              shared: !record.projectId,
            }
          : null,
        stale: !!record && f.baseVersion !== null && record.version !== f.baseVersion,
        lostObligations:
          record && f.action === 'revise' && f.proposedContent !== null
            ? lostObligations(record.content, f.proposedContent)
            : [],
        fixtureFailures:
          record && f.action === 'revise' && f.proposedContent !== null
            ? fixtureFailures(this.fixtures(record.id), f.proposedContent)
            : [],
        evidence: {
          independent,
          counter: related.filter((o) => o.rating === 'accepted').length,
          reviews: (record && reviews.get(`${record.id}@${record.version}`)) || {
            passed: 0,
            failed: 0,
          },
          competing: related.filter(
            (o) =>
              o.id !== f.id &&
              o.status === 'pending' &&
              o.action === 'revise' &&
              o.proposedContent !== null,
          ).length,
        },
      };
    });
  }
  /**
   * Bounded automation: fold an identical pending proposal (same style, scope and text) into one candidate.
   * Behavior-preserving only; the user can split it back.
   */
  private autoConsolidate(f: Feedback): Feedback {
    if (f.status !== 'pending' || f.action !== 'revise' || f.proposedContent === null) {
      return f;
    }
    const twins = this.feedbackRows(
      "WHERE status='pending' AND action='revise' AND record_id=? AND proposed_content=? AND id!=?",
      f.recordId!,
      f.proposedContent,
      f.id,
    ).filter((o) => o.projectId === f.projectId && o.source !== 'projects');
    if (!twins.length) {
      return f;
    }
    const ids = [...twins.flatMap((t) => (t.evidenceIds.length ? t.evidenceIds : [t.id])), f.id];
    const merged = this.transaction(() => {
      for (const t of twins.filter((t) => t.evidenceIds.length)) {
        this.db
          .prepare("UPDATE feedback SET status='dismissed',decided_at=? WHERE id=?")
          .run(new Date().toISOString(), t.id);
        for (const sourceId of t.evidenceIds) {
          this.db
            .prepare("UPDATE feedback SET status='pending' WHERE id=? AND status='superseded'")
            .run(sourceId);
        }
      }
      return this.consolidateFeedback(ids, f.proposedContent);
    });
    this.audit(
      'learning-auto',
      merged.recordId || 'general',
      `consolidated ${ids.length} identical proposals`,
    );
    return merged;
  }
  hasDeletionReceipt(keyId: string) {
    return !!this.db
      .prepare('SELECT 1 FROM meta WHERE key=?')
      .get('deleted-key:' + keyReceipt(keyId));
  }
  fixtures(recordId: string): Fixtures {
    const row = this.db
      .prepare('SELECT value FROM meta WHERE key=?')
      .get('learning-fixtures:' + recordId) as {value: string} | undefined;
    return row ? JSON.parse(row.value) : {keep: [], avoid: []};
  }
  saveFixtures(recordId: string, raw: unknown): Fixtures {
    const record = this.get(recordId);
    if (!record) {
      throw new BrainError('Record not found', 'NOT_FOUND', 404);
    }
    let fixtures: Fixtures;
    try {
      fixtures = checkFixtures(raw);
    } catch (e) {
      throw new BrainError((e as Error).message);
    }
    const current = fixtureFailures(fixtures, record.content);
    if (current.length) {
      throw new BrainError('Fixtures must pass on the current version: ' + current.join(' | '));
    }
    this.db
      .prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)')
      .run('learning-fixtures:' + recordId, JSON.stringify(fixtures));
    this.audit(
      'learning-fixtures',
      recordId,
      `${fixtures.keep.length} keep, ${fixtures.avoid.length} avoid`,
    );
    return fixtures;
  }
  /** Why a style is or is not applied in a scope, for "why did you do this / why was this missing". */
  explainRecord(recordId: string, projectId?: string) {
    const record = this.get(recordId);
    if (!record || (record.projectId && record.projectId !== projectId)) {
      throw new BrainError('Record not found', 'NOT_FOUND', 404);
    }
    const effective = this.scopedRecords(projectId).find((r) => r.id === recordId);
    let reason = 'Applied: ' + (effective?.source || '');
    if (record.status !== 'active') {
      reason = `Not applied: the style is ${record.status}`;
    } else if (!effective) {
      reason = projectId
        ? 'Not applied: the style is not selected in this project and no selected style requires it'
        : 'Not applied: project-only style';
    }
    const delivered = this.db
      .prepare(
        'SELECT occurred_at AS at, agent, event_type AS eventType, record_versions AS versions FROM trace_events WHERE demo=0 AND EXISTS (SELECT 1 FROM json_each(trace_events.record_ids) WHERE value=?) ORDER BY occurred_at DESC LIMIT 1',
      )
      .get(recordId) as
      {at: string; agent: string; eventType: string; versions: string} | undefined;
    return {
      id: record.id,
      title: record.title,
      version: record.version,
      status: record.status,
      scope: record.projectId ? 'project' : 'global',
      applied: !!effective,
      reason,
      appliesWhen: record.appliesWhen || null,
      lastDelivered: delivered
        ? {
            at: delivered.at,
            agent: delivered.agent,
            eventType: delivered.eventType,
            version: JSON.parse(delivered.versions || '{}')[recordId] ?? null,
          }
        : null,
      pendingInbox: this.feedbackRows("WHERE record_id=? AND status='pending'", recordId).length,
      fixtures: this.fixtures(recordId),
    };
  }
  /**
   * Requirement results from agents' compliance reviews, per style version. Mostly agent-reported:
   * the server verifies automated checks only, so this is a signal, not proof.
   */
  reviewEvidence(): Map<string, {passed: number; failed: number}> {
    const rows = this.db
      .prepare(
        `SELECT json_extract(r.value,'$.recordId') AS id, json_extract(r.value,'$.recordVersion') AS version,
          sum(json_extract(r.value,'$.status')='pass' OR (json_extract(r.value,'$.status')!='fail' AND json_extract(r.value,'$.agentReported')='pass')) AS passed,
          sum(json_extract(r.value,'$.status')='fail' OR (json_extract(r.value,'$.status')!='pass' AND json_extract(r.value,'$.agentReported')='fail')) AS failed
        FROM trace_events t, json_each(json_extract(t.metadata,'$.complianceReport'),'$.results') r
        WHERE t.demo=0 AND t.event_type='compliance.review' AND json_valid(json_extract(t.metadata,'$.complianceReport'))
        GROUP BY 1,2`,
      )
      .all() as Array<{id: string; version: number; passed: number; failed: number}>;
    return new Map(
      rows.map((r) => [
        `${r.id}@${r.version}`,
        {passed: Number(r.passed) || 0, failed: Number(r.failed) || 0},
      ]),
    );
  }
  /** Active styles whose current version has review results, failing ones first. */
  private styleChecks() {
    const out: Array<{id: string; title: string; version: number; passed: number; failed: number}> =
      [];
    for (const [key, result] of this.reviewEvidence()) {
      const [id, version] = key.split('@');
      const r = this.get(id);
      if (r && r.status === 'active' && String(r.version) === version) {
        out.push({id, title: r.title, version: r.version, ...result});
      }
    }
    return out
      .filter((r) => r.passed + r.failed)
      .sort((a, b) => b.failed - a.failed || a.passed - b.passed)
      .slice(0, 8);
  }
  /** Capture activity per agent integration, from trace events of the learning tools. */
  private integrationStatus() {
    return this.db
      .prepare(
        "SELECT agent, count(*) AS events, max(occurred_at) AS lastAt, sum(outcome!='success') AS failures FROM trace_events WHERE demo=0 AND event_type IN ('mcp.brain_feedback','mcp.brain_remember','mcp.brain_forget') GROUP BY agent ORDER BY lastAt DESC",
      )
      .all() as Array<{agent: string; events: number; lastAt: string; failures: number}>;
  }
  /** Observable learning measures with their denominators. No composite score. */
  learningHealth() {
    const rows = this.feedbackRows('');
    const count = (status: Feedback['status']) => rows.filter((r) => r.status === status).length;
    const decided = rows.filter((r) => r.decidedAt && r.status !== 'superseded');
    const applied = rows.filter((r) => r.status === 'accepted' && r.appliedVersion && r.recordId);
    const reverted = applied.filter((r) =>
      this.db
        .prepare("SELECT 1 FROM revisions WHERE record_id=? AND action='restore' AND version>?")
        .get(r.recordId, r.appliedVersion),
    ).length;
    const pending = rows.filter((r) => r.status === 'pending');
    const hours = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 3600000;
    return {
      ...this.learningSettings(),
      integrations: this.integrationStatus(),
      styleChecks: this.styleChecks(),
      recentAutomatic: this.db
        .prepare(
          "SELECT created_at AS at, detail FROM audit WHERE action='learning-auto' ORDER BY created_at DESC LIMIT 10",
        )
        .all() as Array<{at: string; detail: string}>,
      pending: pending.length,
      accepted: count('accepted'),
      dismissed: count('dismissed'),
      reviewed: decided.length,
      applied: applied.length,
      reverted,
      averageReviewHours: decided.length
        ? Math.round(
            (decided.reduce((s, r) => s + hours(r.createdAt, r.decidedAt!), 0) / decided.length) *
              10,
          ) / 10
        : null,
      oldestPendingDays: pending.length
        ? Math.floor(hours(pending.at(-1)!.createdAt, new Date().toISOString()) / 24)
        : null,
    };
  }
  listFeedback(projectId?: string): Feedback[] {
    return projectId
      ? this.feedbackRows('WHERE project_id=? ORDER BY created_at DESC LIMIT 200', projectId)
      : this.feedbackRows('ORDER BY created_at DESC LIMIT 200');
  }
  private feedbackRows(where: string, ...params: string[]): Feedback[] {
    return (
      this.db
        .prepare(
          `SELECT id,record_id AS recordId,rating,note,created_at AS createdAt,project_id AS projectId,source,source_event_id AS sourceEventId,proposed_content AS proposedContent,base_version AS baseVersion,diagnosis,status,decided_at AS decidedAt,applied_version AS appliedVersion,action,proposal,evidence_ids AS evidenceIds FROM feedback ${where}`,
        )
        .all(...params) as Array<Feedback & {proposal: string | null; evidenceIds: string | null}>
    ).map((r) => ({
      ...r,
      proposal: r.proposal ? JSON.parse(r.proposal) : null,
      evidenceIds: r.evidenceIds ? JSON.parse(r.evidenceIds) : [],
    }));
  }
  private audit(action: string, target: string, detail: string) {
    this.db
      .prepare('INSERT INTO audit(id,action,target,created_at,detail) VALUES(?,?,?,?,?)')
      .run(randomUUID(), action, target, new Date().toISOString(), detail);
  }
  auditLog() {
    return this.db
      .prepare(
        'SELECT action,target,created_at AS createdAt,detail FROM audit ORDER BY created_at DESC LIMIT 100',
      )
      .all();
  }
  /** Stable private digest for correlating repeated prompts without storing their text. */
  fingerprint(value: string) {
    let row = this.db.prepare("SELECT value FROM meta WHERE key='trace_hmac_secret'").get() as
      {value: string} | undefined;
    if (!row) {
      this.db
        .prepare("INSERT OR IGNORE INTO meta(key,value) VALUES ('trace_hmac_secret',?)")
        .run(randomBytes(32).toString('hex'));
      row = this.db.prepare("SELECT value FROM meta WHERE key='trace_hmac_secret'").get() as {
        value: string;
      };
    }
    return createHmac('sha256', Buffer.from(row.value, 'hex'))
      .update(value)
      .digest('hex')
      .slice(0, 16);
  }
  /** Telemetry stores metadata only; never store full prompts, generated content or tool parameters. */
  trace(event: {
    agent: string;
    channel: string;
    eventType: string;
    outcome?: string;
    runId?: string | null;
    recordIds?: string[];
    recordVersions?: Record<string, number>;
    metadata?: Record<string, unknown>;
    demo?: boolean;
  }) {
    const safe = (value: unknown, limit = 160) => String(value ?? '').slice(0, limit);
    const allowed = ['claude', 'codex', 'opencode', 'chatgpt', 'unknown', 'web', 'test'];
    const agent = allowed.includes(event.agent) ? event.agent : 'unknown';
    const runId = safe(event.runId || `${agent}:${event.channel}:unlinked`, 180);
    // Whitelist telemetry keys; explicit compliance submissions also contain bounded review evidence.
    const safeMetadata: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(event.metadata || {})) {
      if (
        !/^(client|domain|count|recordCount|contextChars|promptChars|promptHash|matchedDomains|resultCount|checkCount|passed|step|note|tool|version|sessionLinked|projectId|origin|tested|complianceReport)$/i.test(
          key,
        )
      ) {
        continue;
      }
      if (['string', 'number', 'boolean'].includes(typeof value) || value === null) {
        safeMetadata[key] =
          typeof value === 'string'
            ? safe(value, key === 'complianceReport' ? 100000 : 160)
            : (value as number | boolean | null);
      }
    }
    const item = {
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      runId,
      agent,
      channel: safe(event.channel, 50),
      eventType: safe(event.eventType, 80),
      outcome: safe(event.outcome || 'observed', 24),
      recordIds: (event.recordIds || []).filter((x) => /^[a-f0-9-]{36}$/i.test(x)).slice(0, 40),
      recordVersions: Object.fromEntries(
        Object.entries(event.recordVersions || {})
          .filter(([id, v]) => /^[a-f0-9-]{36}$/i.test(id) && Number.isInteger(v) && v > 0)
          .slice(0, 40),
      ),
      metadata: safeMetadata,
      demo: !!event.demo,
    };
    this.db
      .prepare(
        `INSERT INTO trace_events(id,occurred_at,run_id,agent,channel,event_type,outcome,record_ids,record_versions,metadata,demo) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        item.id,
        item.occurredAt,
        item.runId,
        item.agent,
        item.channel,
        item.eventType,
        item.outcome,
        JSON.stringify(item.recordIds),
        JSON.stringify(item.recordVersions),
        JSON.stringify(item.metadata),
        item.demo ? 1 : 0,
      );
    return item;
  }
  listTrace(
    filter: {
      projectId?: string;
      agent?: string;
      channel?: string;
      runId?: string;
      recordId?: string;
      includeDemo?: boolean;
      limit?: number;
    } = {},
  ) {
    const filters: string[] = [];
    const args: (string | number)[] = [];
    if (!filter.includeDemo) {
      filters.push('demo = 0');
    }
    if (filter.projectId && filter.projectId !== 'all') {
      if (filter.projectId === 'unscoped') {
        filters.push("json_extract(metadata,'$.projectId') IS NULL");
      } else {
        this.project(filter.projectId);
        filters.push("json_extract(metadata,'$.projectId')=?");
        args.push(filter.projectId);
      }
    }
    if (filter.agent && filter.agent !== 'all') {
      filters.push('agent=?');
      args.push(filter.agent);
    }
    if (filter.channel && filter.channel !== 'all') {
      filters.push('channel=?');
      args.push(filter.channel);
    }
    if (filter.runId) {
      filters.push('run_id=?');
      args.push(filter.runId);
    }
    if (filter.recordId) {
      filters.push('instr(record_ids,?) > 0');
      args.push(JSON.stringify(filter.recordId).slice(1, -1));
    }
    args.push(Math.min(500, Math.max(1, Number(filter.limit) || 150)));
    const where = filters.length ? ' WHERE ' + filters.join(' AND ') : '';
    const rows = this.db
      .prepare(
        `SELECT id,occurred_at AS occurredAt,run_id AS runId,agent,channel,event_type AS eventType,outcome,record_ids AS recordIds,record_versions AS recordVersions,metadata,demo FROM trace_events${where} ORDER BY occurred_at DESC,rowid DESC LIMIT ?`,
      )
      .all(...args) as Array<{
      id: string;
      occurredAt: string;
      runId: string;
      agent: string;
      channel: string;
      eventType: string;
      outcome: string;
      recordIds: string;
      recordVersions: string;
      metadata: string;
      demo: number;
    }>;
    return rows.map((r) => ({
      ...r,
      recordIds: JSON.parse(r.recordIds) as string[],
      recordVersions: JSON.parse(r.recordVersions) as Record<string, number>,
      metadata: JSON.parse(r.metadata) as Record<string, unknown>,
      demo: !!r.demo,
    }));
  }
  projectActivity(projectId: string) {
    this.project(projectId);
    const rows = this.db
      .prepare(
        `SELECT agent,run_id AS threadId,MAX(occurred_at) AS lastSeen,COUNT(*) AS calls,COALESCE(SUM(CASE WHEN channel='hook' THEN CAST(json_extract(metadata,'$.contextChars') AS INTEGER) ELSE 0 END),0) AS contextChars
      FROM trace_events WHERE demo=0 AND outcome IN ('success','emitted')
      AND json_extract(metadata,'$.projectId')=? AND json_extract(metadata,'$.sessionLinked')=1
      GROUP BY agent,run_id ORDER BY lastSeen DESC`,
      )
      .all(projectId) as Array<{
      agent: string;
      threadId: string;
      lastSeen: string;
      calls: number;
      contextChars: number;
    }>;
    const cutoff = Date.now() - 15 * 60 * 1000;
    const sessions = rows.map((r) => ({
      ...r,
      estimatedContextTokens: Math.ceil(r.contextChars / 4),
      active: Date.parse(r.lastSeen) >= cutoff,
    }));
    const unlinked = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS n FROM trace_events WHERE demo=0 AND outcome IN ('success','emitted')
      AND json_extract(metadata,'$.projectId')=? AND COALESCE(json_extract(metadata,'$.sessionLinked'),0)!=1`,
        )
        .get(projectId) as {n: number}
    ).n;
    const reviews = this.db
      .prepare(
        "SELECT occurred_at AS at, metadata FROM trace_events WHERE demo=0 AND event_type='compliance.review' AND json_extract(metadata,'$.projectId')=? ORDER BY occurred_at DESC,rowid DESC LIMIT 20",
      )
      .all(projectId) as Array<{at: string; metadata: string}>;
    return {
      complianceReviews: reviews.map((r) => ({
        at: r.at,
        ...JSON.parse(JSON.parse(r.metadata).complianceReport),
      })),
      linked: sessions.length,
      active: sessions.filter((r) => r.active).length,
      unlinkedCalls: unlinked,
      sessions: sessions.slice(0, 100),
      activityWindowMinutes: 15,
    };
  }
  deliveryHealth() {
    const rows = this.db
      .prepare(
        `SELECT agent,event_type AS eventType,MAX(occurred_at) AS lastSeen,COUNT(*) AS count
      FROM trace_events WHERE demo=0 AND outcome IN ('success','emitted')
      AND event_type IN ('mcp.initialize','mcp.brain_get','hook.session.context','hook.prompt.context')
      GROUP BY agent,event_type`,
      )
      .all() as Array<{agent: string; eventType: string; lastSeen: string; count: number}>;
    const stages = {
      handshake: 'mcp.initialize',
      retrieval: 'mcp.brain_get',
      sessionHook: 'hook.session.context',
      promptHook: 'hook.prompt.context',
    };
    return {
      note: 'Historical observations, not a live connection check or proof of instruction compliance. Unknown means no successful event was recorded.',
      agents: ['claude', 'codex', 'opencode', 'chatgpt', 'unknown'].map((agent) => ({
        agent,
        stages: Object.fromEntries(
          Object.entries(stages).map(([name, event]) => {
            const row = rows.find((r) => r.agent === agent && r.eventType === event);
            return [
              name,
              {
                status: row ? 'observed' : 'unknown',
                count: row?.count || 0,
                lastSeen: row?.lastSeen || null,
              },
            ];
          }),
        ),
      })),
    };
  }
  traceStats(projectId?: string) {
    let scope = '';
    const args: string[] = [];
    if (projectId && projectId !== 'all') {
      if (projectId === 'unscoped') {
        scope = " AND json_extract(metadata,'$.projectId') IS NULL";
      } else {
        this.project(projectId);
        scope = " AND json_extract(metadata,'$.projectId')=?";
        args.push(projectId);
      }
    }
    const rows = this.db
      .prepare(
        `SELECT event_type AS name,COUNT(*) AS count FROM trace_events WHERE demo=0${scope} GROUP BY event_type ORDER BY count DESC`,
      )
      .all(...args) as {name: string; count: number}[];
    const get = (name: string) => rows.find((r) => r.name === name)?.count || 0;
    const context = this.db
      .prepare(
        `SELECT COALESCE(SUM(CAST(json_extract(metadata,'$.contextChars') AS INTEGER)),0) AS chars FROM trace_events WHERE demo=0 AND channel='hook' AND outcome='emitted'${scope}`,
      )
      .get(...args) as {chars: number};
    return {
      estimatedContextTokens: Math.ceil(context.chars / 4),
      tokenUsageNote:
        'Rough estimate: emitted hook characters / 4. Not model input/output usage, cached tokens or billing. Model usage is unavailable without host reports.',
      events: rows.reduce((n, r) => n + r.count, 0),
      byEvent: rows,
      startup: get('hook.session.context'),
      promptMatches: get('hook.prompt.context'),
      discovery: get('mcp.brain_discover'),
      retrieval: get('mcp.brain_get'),
      reviews: get('mcp.brain_review'),
      feedback: get('mcp.brain_feedback'),
      note: 'Observed calls and delivered instructions are not proof the agent followed them. Artifact quality must be evaluated separately.',
    };
  }
  seedTraceDemo() {
    if (
      (this.db.prepare('SELECT COUNT(*) AS n FROM trace_events WHERE demo=1').get() as {n: number})
        .n
    ) {
      return 0;
    }
    const diagram = this.list({kind: 'skill', status: 'active'}).find(
      (r) => r.domain === 'diagrams',
    );
    const style = this.list({kind: 'preference', status: 'active'}).find(
      (r) => r.domain === 'diagrams',
    );
    const writing = this.list({kind: 'skill', status: 'active'}).find(
      (r) => r.domain === 'writing',
    );
    const runs = [
      {
        agent: 'claude',
        runId: 'demo-claude-drawing',
        stages: [
          ['hook', 'hook.session.context', 'delivered', [], 'Global working style loaded'],
          [
            'hook',
            'hook.prompt.context',
            'delivered',
            [diagram?.id, style?.id],
            'Drawing instructions matched',
          ],
          [
            'mcp',
            'mcp.brain_discover',
            'success',
            [diagram?.id, style?.id],
            'Skill catalog searched',
          ],
          ['mcp', 'mcp.brain_get', 'success', [diagram?.id], 'Full drawing skill retrieved'],
          ['mcp', 'mcp.brain_review', 'success', [diagram?.id], 'Example review submitted'],
        ],
      },
      {
        agent: 'codex',
        runId: 'demo-codex-writing',
        stages: [
          ['hook', 'hook.session.context', 'delivered', [], 'Global working style loaded'],
          ['hook', 'hook.prompt.context', 'delivered', [writing?.id], 'Writing procedure matched'],
          ['mcp', 'mcp.brain_discover', 'success', [writing?.id], 'Document skills searched'],
          ['mcp', 'mcp.brain_get', 'success', [writing?.id], 'Writing procedure retrieved'],
        ],
      },
    ] as const;
    let count = 0;
    for (const run of runs) {
      for (const [channel, eventType, outcome, ids, note] of run.stages) {
        const stageIds: readonly (string | undefined)[] = ids;
        const recordIds = stageIds.filter((x): x is string => !!x);
        this.trace({
          agent: run.agent,
          runId: run.runId,
          channel,
          eventType,
          outcome,
          recordIds,
          recordVersions: Object.fromEntries(
            recordIds.map((id) => [id, this.get(id)?.version || 1]),
          ),
          metadata: {note, origin: 'demonstration'},
          demo: true,
        });
        count++;
      }
    }
    return count;
  }
  clearTraceDemo() {
    return this.db.prepare('DELETE FROM trace_events WHERE demo=1').run().changes;
  }
  private validateRequired(record: BrainRecord) {
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (r: BrainRecord) => {
      if (done.has(r.id)) {
        return;
      }
      if (visiting.has(r.id)) {
        throw new BrainError('Required links cannot contain a cycle');
      }
      visiting.add(r.id);
      for (const id of linkedIds(r)) {
        const linked = id === record.id ? record : this.get(id);
        if (!linked || linked.status !== 'active') {
          throw new BrainError('Required linked record must exist and be active: ' + id);
        }
        if (linked.projectId && linked.projectId !== record.projectId) {
          throw new BrainError('Dependency belongs to another project');
        }
        visit(linked);
      }
      visiting.delete(r.id);
      done.add(r.id);
    };
    visit(record);
  }
  requiredRecords(roots: BrainRecord[], projectId?: string): BrainRecord[] {
    const effective = new Map(this.scopedRecords(projectId).map((r) => [r.id, r]));
    const result: BrainRecord[] = [];
    const done = new Set<string>();
    const visiting = new Set<string>();
    const visit = (record: BrainRecord) => {
      if (visiting.has(record.id)) {
        throw new BrainError('Required-link cycle');
      }
      if (done.has(record.id)) {
        return;
      }
      visiting.add(record.id);
      for (const id of record.requiredIds || []) {
        const linked = effective.get(id);
        if (!linked) {
          throw new BrainError(
            'Required linked style is inactive or replaced by project scope: ' + id,
          );
        }
        visit(linked);
      }
      visiting.delete(record.id);
      done.add(record.id);
      result.push(record);
    };
    roots.forEach(visit);
    return result;
  }
  projects(): Project[] {
    return (
      this.db.prepare('SELECT snapshot FROM projects ORDER BY rowid DESC').all() as {
        snapshot: string;
      }[]
    ).map((r) => JSON.parse(r.snapshot));
  }
  project(id: string): Project {
    const row = this.db.prepare('SELECT snapshot FROM projects WHERE id=?').get(id) as
      {snapshot: string} | undefined;
    if (!row) {
      throw new BrainError('Project not found', 'NOT_FOUND', 404);
    }
    return JSON.parse(row.snapshot);
  }
  saveProject(raw: unknown, id?: string, expectedVersion?: number): Project {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BrainError('Invalid project');
    }
    const x = raw as Record<string, unknown>;
    if (typeof x.name !== 'string' || !x.name.trim() || x.name.length > 150) {
      throw new BrainError('Project name must have 1–150 characters');
    }
    if (typeof x.description !== 'string' || x.description.length > 1200) {
      throw new BrainError('Description must have at most 1200 characters');
    }
    if (!Array.isArray(x.assignments) || x.assignments.length > 300) {
      throw new BrainError('Invalid assignments');
    }
    return this.transaction(() => {
      const previous = id ? this.project(id) : null;
      if (previous && previous.version !== expectedVersion) {
        throw new BrainError('Project changed. Reload before saving.', 'CONFLICT', 409);
      }
      const slots = new Set<string>();
      const assignments: ProjectAssignment[] = (x.assignments as unknown[]).map(
        (value: unknown) => {
          if (!value || typeof value !== 'object') {
            throw new BrainError('Invalid assignment');
          }
          const a = value as Record<string, unknown>;
          if (typeof a.recordId !== 'string') {
            throw new BrainError('Invalid record ID');
          }
          const record = this.get(a.recordId);
          if (!record || record.status !== 'active' || record.kind === 'tool') {
            throw new BrainError('Select an active library record');
          }
          if (record.projectId && record.projectId !== id) {
            throw new BrainError('Style belongs to another project');
          }
          const slot = this.selectionSlot(record);
          if (slots.has(slot)) {
            throw new BrainError(
              'Conflicting selections: choose one ' + record.kind + ' for ' + record.domain,
            );
          }
          slots.add(slot);
          if (
            a.override !== null &&
            (typeof a.override !== 'string' || !a.override.trim() || a.override.length > 100000)
          ) {
            throw new BrainError('Override must be non-empty text or null');
          }
          return {recordId: record.id, override: a.override as string | null};
        },
      );
      const project: Project = {
        id: previous?.id || randomUUID(),
        name: (x.name as string).trim(),
        description: x.description as string,
        assignments,
        version: (previous?.version || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      this.db
        .prepare(
          'INSERT INTO projects(id,snapshot) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET snapshot=excluded.snapshot',
        )
        .run(project.id, JSON.stringify(project));
      return project;
    });
  }
  /**
   * Copies a project's setup: selections and overrides, private styles (re-linked to each other),
   * their fixtures and per-project settings. The repository link, feedback and activity stay with
   * the original, since they describe that repository's history.
   */
  cloneProject(id: string, name: unknown): Project {
    return this.transaction(() => {
      const source = this.project(id);
      const owned = (
        this.db
          .prepare("SELECT snapshot FROM records WHERE json_extract(snapshot,'$.projectId')=?")
          .all(id) as {snapshot: string}[]
      ).map((row) => this.parse(row.snapshot));
      const ids = new Map(owned.map((r) => [r.id, randomUUID()]));
      const remap = (recordId: string) => ids.get(recordId) ?? recordId;
      const clone = this.saveProject({
        name: name === undefined ? 'Copy of ' + source.name : name,
        description: source.description,
        assignments: source.assignments.filter((a) => !ids.has(a.recordId)),
      });
      const now = new Date().toISOString();
      const copies = owned.map((r) => ({
        ...r,
        id: remap(r.id),
        projectId: clone.id,
        requiredIds: r.requiredIds?.map(remap),
        supportingLinks: r.supportingLinks?.map((l) => ({...l, recordId: remap(l.recordId)})),
        version: 1,
        createdAt: now,
        updatedAt: now,
      }));
      for (const r of copies) {
        this.write(r, 'create');
      }
      for (const r of copies.filter((c) => c.status === 'active')) {
        this.validateRequired(r);
      }
      const copyMeta = this.db.prepare(
        'INSERT INTO meta(key,value) SELECT ?, value FROM meta WHERE key=?',
      );
      for (const [from, to] of ids) {
        copyMeta.run('learning-fixtures:' + to, 'learning-fixtures:' + from);
      }
      for (const prefix of ['project-style-baseline:', 'learning-paused:', 'discovery-paused:']) {
        copyMeta.run(prefix + clone.id, prefix + id);
      }
      this.audit('project-clone', clone.id, source.id);
      return this.saveProject(
        {
          ...clone,
          assignments: source.assignments.map((a) => ({...a, recordId: remap(a.recordId)})),
        },
        clone.id,
        clone.version,
      );
    });
  }
  installRequiredLinks(updates: Map<string, string[]>, marker: string) {
    this.transaction(() => {
      for (const [id, requiredIds] of updates) {
        const record = this.get(id);
        if (!record) {
          throw new BrainError('Record not found');
        }
        if (JSON.stringify(record.requiredIds || []) === JSON.stringify(requiredIds)) {
          continue;
        }
        const next = {
          ...record,
          ...checkInput({...record, requiredIds}),
          version: record.version + 1,
          updatedAt: new Date().toISOString(),
        };
        this.validateRequired(next);
        this.write(next, 'update');
      }
      // Roll back the entire audit if any project's selected slots would conflict.
      for (const project of this.projects()) {
        this.scopedRecords(project.id);
      }
      this.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run(marker, 'done');
    });
  }
  publishProjectRecord(projectId: string, recordId: string, expectedVersion: number) {
    return this.transaction(() => {
      this.project(projectId);
      const source = this.get(recordId);
      if (!source || source.projectId !== projectId) {
        throw new BrainError('Private project record not found', 'NOT_FOUND', 404);
      }
      if (source.version !== expectedVersion) {
        throw new BrainError('Version conflict. Reload before publishing.', 'CONFLICT', 409);
      }
      const copies = new Map<string, BrainRecord>(),
        visiting = new Set<string>();
      const publish = (record: BrainRecord): BrainRecord => {
        if (!record.projectId) {
          return record;
        }
        if (record.projectId !== projectId) {
          throw new BrainError('Dependency belongs to another project');
        }
        const existing = this.styleByKey(record.keyId!);
        if (existing) {
          return existing;
        }
        if (copies.has(record.id)) {
          return copies.get(record.id)!;
        }
        if (visiting.has(record.id)) {
          throw new BrainError('Required links cannot contain a cycle');
        }
        visiting.add(record.id);
        const requiredIds = (record.requiredIds || []).map((id) => {
          const linked = this.get(id);
          if (!linked || linked.status !== 'active') {
            throw new BrainError('Required dependency is unavailable');
          }
          return publish(linked).id;
        });
        const supportingLinks = record.supportingLinks?.map((link) => {
          const child = this.get(link.recordId);
          if (!child) {
            throw new BrainError('Supporting record unavailable');
          }
          return {...link, recordId: publish(child).id};
        });
        const now = new Date().toISOString();
        const shared: BrainRecord = {
          ...checkInput({
            ...record,
            projectId: undefined,
            sourceStyleId: undefined,
            sourceVersion: undefined,
            requiredIds,
            supportingLinks,
          }),
          id: randomUUID(),
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
        const locals = this.db
          .prepare("SELECT snapshot FROM records WHERE json_extract(snapshot,'$.keyId')=?")
          .all(record.keyId!) as {snapshot: string}[];
        for (const row of locals) {
          const local = this.parse(row.snapshot);
          if (local.kind !== shared.kind || local.domain !== shared.domain) {
            throw new BrainError(
              'Private styles with this key have different capabilities or types. Resolve the key conflict before publishing.',
              'CONFLICT',
              409,
            );
          }
          this.db.prepare('UPDATE records SET snapshot=? WHERE id=?').run(
            JSON.stringify({
              ...local,
              sourceStyleId: shared.id,
              sourceVersion: local.id === record.id ? shared.version : undefined,
            }),
            local.id,
          );
        }
        this.validateRequired(shared);
        this.write(shared, 'create');
        for (const row of locals) {
          const local = this.parse(row.snapshot);
          this.write(
            {...local, sourceStyleId: shared.id, version: local.version + 1, updatedAt: now},
            'update',
          );
        }
        copies.set(record.id, shared);
        visiting.delete(record.id);
        return shared;
      };
      const record = publish(source);
      return {record, published: [...copies.values()]};
    });
  }
  createProjectStyle(
    projectId: string,
    raw: unknown,
    expectedProjectVersion: number,
    select = true,
  ) {
    return this.transaction(() => {
      const project = this.project(projectId);
      if (project.version !== expectedProjectVersion) {
        throw new BrainError('Project changed. Reload before saving.', 'CONFLICT', 409);
      }
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new BrainError('Style object required');
      }
      const input = raw as Record<string, unknown>;
      if (
        input.projectId !== undefined ||
        input.kind !== undefined ||
        input.backend !== undefined ||
        input.status !== undefined
      ) {
        throw new BrainError('Scope, type and status are managed by project style creation');
      }
      const key = typeof input.keyId === 'string' ? input.keyId : slug(String(input.title || ''));
      const existing = this.styleByKey(key, projectId);
      const localRow = this.db
        .prepare(
          "SELECT snapshot FROM records WHERE json_extract(snapshot,'$.keyId')=? AND json_extract(snapshot,'$.projectId')=?",
        )
        .get(key, projectId) as {snapshot: string} | undefined;
      const baseline = localRow ? this.parse(localRow.snapshot) : existing;
      const record = this.create({
        tags: [],
        priority: 90,
        requiredIds: [],
        checks: [],
        ...baseline,
        ...input,
        sourceStyleId: undefined,
        projectId,
        kind: 'preference',
        status: 'active',
        backend: null,
      });
      const current = this.project(projectId);
      if (select && !current.assignments.some((a) => a.recordId === record.id)) {
        this.saveProject(
          {
            ...current,
            assignments: [...current.assignments, {recordId: record.id, override: null}],
          },
          projectId,
          current.version,
        );
      }
      return {
        record,
        projectVersion: this.project(projectId).version,
        selected: this.project(projectId).assignments.some((a) => a.recordId === record.id),
        scope: 'project',
      };
    });
  }
  personalizeRecord(
    projectId: string,
    recordId: string,
    raw: unknown,
    expectedVersion: number,
    expectedProjectVersion: number,
  ) {
    return this.transaction(() => {
      const project = this.project(projectId);
      if (project.version !== expectedProjectVersion) {
        throw new BrainError('Project changed. Reload before saving.', 'CONFLICT', 409);
      }
      const effective = this.scopedRecords(projectId);
      const source = effective.find((r) => r.id === recordId);
      if (!source) {
        throw new BrainError('Record is not selected in this project', 'NOT_FOUND', 404);
      }
      if (source.version !== expectedVersion) {
        throw new BrainError('Version conflict. Reload before saving.', 'CONFLICT', 409);
      }
      const input = checkInput({
        ...source,
        ...(raw as object),
        projectId,
        keyId: source.keyId,
        sourceStyleId: source.projectId ? source.sourceStyleId : source.id,
      });
      if (
        input.kind !== source.kind ||
        input.domain !== source.domain ||
        input.status !== 'active'
      ) {
        throw new BrainError(
          'Project edits must keep the capability, type and active status. Manage selections in Configure project.',
        );
      }
      if (JSON.stringify(input) === JSON.stringify(checkInput({...source, projectId}))) {
        return source;
      }
      this.db
        .prepare('INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)')
        .run(
          'project-style-baseline:' + projectId,
          JSON.stringify(
            project.assignments
              .filter((a) => !this.get(a.recordId)?.projectId)
              .map((a) => ({...a, override: null})),
          ),
        );
      const replacements = new Map<string, BrainRecord>();
      const now = new Date().toISOString();
      const copy = (record: BrainRecord, changes: object) => {
        const row = this.db
          .prepare(
            "SELECT snapshot FROM records WHERE json_extract(snapshot,'$.keyId')=? AND json_extract(snapshot,'$.projectId')=?",
          )
          .get(record.keyId!, projectId) as {snapshot: string} | undefined;
        const previous = row ? this.parse(row.snapshot) : record;
        const local = previous.projectId === projectId;
        const next: BrainRecord = {
          ...record,
          ...changes,
          projectId,
          sourceStyleId: local ? previous.sourceStyleId : record.id,
          sourceVersion: local ? previous.sourceVersion : record.version,
          id: local ? previous.id : randomUUID(),
          version: local ? previous.version + 1 : 1,
          createdAt: local ? previous.createdAt : now,
          updatedAt: now,
        };
        this.validateRequired(next);
        this.write(next, local ? 'update' : 'create');
        replacements.set(record.id, next);
        return next;
      };
      const edited = copy(source, input);
      // Copy only ancestors whose exact required IDs must follow the private version.
      const visited = new Set<string>();
      const rewire = (record: BrainRecord): BrainRecord => {
        if (replacements.has(record.id)) {
          return replacements.get(record.id)!;
        }
        if (visited.has(record.id)) {
          return record;
        }
        visited.add(record.id);
        const requiredIds = (record.requiredIds || []).map((id) => {
          const child = effective.find((r) => r.id === id);
          return child ? rewire(child).id : id;
        });
        const supportingLinks = record.supportingLinks?.map((link) => {
          const child = effective.find((r) => r.id === link.recordId);
          return {...link, recordId: child ? rewire(child).id : link.recordId};
        });
        return requiredIds.some((id, i) => id !== record.requiredIds?.[i]) ||
          JSON.stringify(supportingLinks) !== JSON.stringify(record.supportingLinks)
          ? copy(record, {requiredIds, supportingLinks})
          : record;
      };
      effective.forEach(rewire);
      const assignments = project.assignments.map((a) =>
        replacements.has(a.recordId)
          ? {recordId: replacements.get(a.recordId)!.id, override: null}
          : a,
      );
      const updated = {...project, assignments, version: project.version + 1, updatedAt: now};
      this.db
        .prepare('UPDATE projects SET snapshot=? WHERE id=?')
        .run(JSON.stringify(updated), projectId);
      this.scopedRecords(projectId);
      return edited;
    });
  }
  scopedRecords(
    projectId: string | undefined = process.env.PB_PROJECT_ID,
  ): Array<BrainRecord & {source: string}> {
    const all = (
      this.db.prepare("SELECT snapshot FROM records WHERE status='active'").all() as {
        snapshot: string;
      }[]
    )
      .map((r) => this.parse(r.snapshot))
      .sort((a, b) => b.priority - a.priority);
    if (!projectId) {
      return all.filter((r) => !r.projectId).map((r) => ({...r, source: 'Global default'}));
    }
    const project = this.project(projectId);
    const selected = project.assignments.map((a) => {
      const record = this.get(a.recordId);
      if (
        !record ||
        record.status !== 'active' ||
        (record.projectId && record.projectId !== projectId)
      ) {
        throw new BrainError(
          'Project selection is unavailable: ' + a.recordId + '. Update the project configuration.',
        );
      }
      return {
        ...record,
        content: a.override ?? record.content,
        source: a.override !== null ? 'Project override' : 'Project selection',
      };
    });
    const slots = new Set<string>();
    for (const record of selected) {
      const slot = this.selectionSlot(record);
      if (slots.has(slot)) {
        throw new BrainError(
          'Project selections now conflict in ' + slot + '. Update the project configuration.',
        );
      }
      slots.add(slot);
    }
    const effective = new Map(selected.map((r) => [r.id, r]));
    const visiting = new Set<string>(),
      done = new Set<string>();
    const include = (record: BrainRecord, conditional = false) => {
      if (visiting.has(record.id)) {
        throw new BrainError('Required-link cycle');
      }
      if (done.has(record.id)) {
        return;
      }
      visiting.add(record.id);
      for (const id of conditional ? linkedIds(record) : record.requiredIds || []) {
        let linked = effective.get(id);
        if (!linked) {
          const shared = all.find(
            (r) => r.id === id && (!r.projectId || r.projectId === projectId),
          );
          if (!shared) {
            throw new BrainError('Required linked style is inactive or unavailable: ' + id);
          }
          const slot = this.selectionSlot(shared);
          if (!conditional && slots.has(slot)) {
            throw new BrainError('Required linked style conflicts with project selection: ' + id);
          }
          linked = {...shared, source: conditional ? 'Supporting guidance' : 'Required dependency'};
          effective.set(id, linked);
          if (!conditional) {
            slots.add(slot);
          }
        }
        include(linked, conditional);
      }
      visiting.delete(record.id);
      done.add(record.id);
    };
    selected.forEach((record) => include(record));
    done.clear();
    selected.forEach((record) => include(record, true));
    return [...effective.values()];
  }
  // Every active preference visible to a project, without list()'s 300-record cap.
  activePreferences(projectId?: string): BrainRecord[] {
    return (
      this.db.prepare("SELECT snapshot FROM records WHERE status='active'").all() as {
        snapshot: string;
      }[]
    )
      .map((r) => this.parse(r.snapshot))
      .filter((r) => r.kind === 'preference' && (!r.projectId || r.projectId === projectId));
  }
  bootstrapWithRecords(maxChars = 3500, projectId?: string) {
    const items = this.scopedRecords(projectId)
      .filter((r) => r.kind === 'preference' && !r.compatibility)
      .slice(0, 35);
    const included: BrainRecord[] = [];
    let out =
      'PERSONAL BRAIN STYLE BASELINE\nIndex only; full instructions are not loaded. For substantive tasks use brain_discover, then brain_get for matching records and required links. Read their referenced external skills before applying them. Reuse an already loaded record only when its ID, version and project scope match.\n';
    for (const item of items) {
      const line = `\n[${item.domain}] ${item.title} | id ${item.id} | version ${item.version}\n${(item.useWhen || item.summary).slice(0, 140)} | keywords: ${item.tags.slice(0, 8).join(', ')}\n`;
      if (out.length + line.length > maxChars) {
        break;
      }
      out += line;
      included.push(item);
    }
    if (included.length < items.length) {
      out += `\nMore styles available through brain_discover.\n`;
    }
    return {text: out, records: included};
  }
  bootstrap(maxChars = 3500, projectId?: string) {
    return this.bootstrapWithRecords(maxChars, projectId).text;
  }
  projectSelectionReason(id: string, projectId?: string) {
    if (!projectId) {
      return 'global';
    }
    return this.project(projectId).assignments.some((a) => a.recordId === id)
      ? 'selected'
      : 'dependency';
  }
  discover(
    task: string,
    kinds: Kind[] = ['skill', 'preference', 'tool', 'review', 'example'],
    limit = 12,
    projectId?: string,
    context: TaskContext = {},
  ) {
    context = validateTaskContext(context);
    return this.scopedRecords(projectId)
      .filter(
        (r) =>
          !r.compatibility &&
          applicability(r.appliesWhen, context) !== 'not_applicable' &&
          (!r.standardLanguage ||
            !context.languages ||
            context.languages.includes(r.standardLanguage)),
      )
      .map((r) => ({r, ...recordMatch(r, task)}))
      .filter(({r, score}) => score > 0 && kinds.includes(r.kind))
      .sort((a, b) => b.score - a.score || b.r.priority - a.r.priority)
      .slice(0, Math.max(1, Math.min(30, limit)))
      .map(({r, score, matches}) => ({
        id: r.id,
        keyId: r.keyId,
        kind: r.kind,
        domain: r.domain,
        title: r.title,
        summary: r.summary,
        useWhen: r.useWhen || '',
        tags: r.tags,
        requiredIds: r.requiredIds || [],
        version: r.version,
        priority: r.priority,
        matches,
        matchReason: matches.map((m) => m.field + ': ' + m.terms.join(', ')).join('; '),
        score,
        selection: this.projectSelectionReason(r.id, projectId),
        invokable: r.kind === 'tool' && !!r.backend?.enabled,
      }));
  }
  evaluate(content: string, domain: Domain = 'general', projectId?: string) {
    const rules = this.scopedRecords(projectId)
      .filter((r) => r.kind === 'review' || r.kind === 'preference')
      .filter((r) => r.domain === 'general' || r.domain === domain);
    const findings: {ruleId: string; check: string; passed: boolean; detail: string}[] = [];
    let manual = 0;
    const manualReviews: Array<{
      recordId: string;
      title: string;
      criteria: string[];
      status: string;
    }> = [];
    for (const rule of rules) {
      let criteria: string[] = [];
      if (rule.reviewCriteria?.length) {
        criteria = rule.reviewCriteria;
      } else if (rule.kind === 'review') {
        criteria = [rule.content];
      }
      if (criteria.length) {
        manual++;
        manualReviews.push({recordId: rule.id, title: rule.title, criteria, status: 'pending'});
      }
      if (!rule.checks.length) {
        continue;
      }
      for (const check of rule.checks) {
        const v = String(check.value);
        let passed = false;
        if (check.type === 'contains') {
          passed = content.toLowerCase().includes(v.toLowerCase());
        }
        if (check.type === 'not_contains') {
          passed = !content.toLowerCase().includes(v.toLowerCase());
        }
        if (check.type === 'min_length') {
          passed = content.length >= Number(v);
        }
        if (check.type === 'max_length') {
          passed = content.length <= Number(v);
        }
        findings.push({
          ruleId: rule.id,
          check: check.label || `${check.type} ${v}`,
          passed,
          detail: passed ? 'Check passed' : 'Check failed',
        });
      }
    }
    let compliance: 'manual-review-required' | 'automated-checks-only' | 'not-evaluated' =
      'not-evaluated';
    if (manual) {
      compliance = 'manual-review-required';
    } else if (findings.length) {
      compliance = 'automated-checks-only';
    }
    return {
      passed: findings.every((x) => x.passed),
      automated: findings.length,
      manualReviewRules: manual,
      manualReviews,
      findings,
      compliance,
      note: 'Text checks are deterministic. Visual layout and architectural correctness still require separate validation.',
    };
  }
}

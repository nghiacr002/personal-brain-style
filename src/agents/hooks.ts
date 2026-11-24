import {complianceReminder} from '../instructions/compliance.ts';
import {dirname} from 'node:path';
import {resolveProjectScope} from '../projects/project-scope.ts';
import {readFileSync} from 'node:fs';
import {BrainDB, recordMatch} from '../core/database.ts';
import type {BrainRecord, Domain} from '../core/models.ts';

/** Personal Brain supplies context; it never starts a second LLM turn. */
export type AgentKind = 'claude' | 'codex' | 'opencode';
export type HookPhase = 'session' | 'prompt' | 'tool' | 'gate';
/**
 * Tool-use signal for "did this working session use the styles": an edit marks real work, a
 * brain_get/brain_prepare marks a style load. Names differ by host: Claude Edit/Write, Codex
 * apply_patch, OpenCode edit/write/patch; MCP tools end in their own name on every host.
 */
export function toolSignal(name: unknown): 'work' | 'load' | null {
  if (typeof name !== 'string') {
    return null;
  }
  if (/brain_(get|prepare)$/.test(name)) {
    return 'load';
  }
  return /^(edit|write|multiedit|notebookedit|apply_patch|patch)$/i.test(name) ? 'work' : null;
}

// Tags both catalog capability ids and the legacy ids older libraries still use.
function classify(task: string): Domain[] {
  const t = task.toLowerCase();
  const result: Domain[] = [];
  if (
    /diagram|draw\b|drawing|drawio|draw\.io|mermaid|excalidraw|flowchart|visualiz|topology|sequence diagram|architecture diagram|sơ đồ|bản vẽ|thiết kế sơ đồ/.test(
      t,
    )
  ) {
    result.push('diagrams');
  }
  if (
    /architect|system design|solution design|microservice|integration|infrastructure|kiến trúc/.test(
      t,
    )
  ) {
    result.push('architecture');
  }
  if (
    /requirement|user story|acceptance|backlog|stakeholder|brd|srs|product owner|yêu cầu/.test(t)
  ) {
    result.push('product-analysis', 'writing');
  }
  if (
    /document|report|proposal|memo|specification|spec\b|write|writing|prd|brd|hld|lld|roadmap|adr\b|runbook|test plan|test case|openapi|api spec|database design|viết|tài liệu/.test(
      t,
    )
  ) {
    result.push('writing-documents', 'writing');
  }
  if (/research|think|plan|compare|decid|tradeoff|trade-off|strategy|phân tích/.test(t)) {
    result.push('foundations', 'thinking');
  }
  if (
    /review|audit|verify|validate|check|critic|quality|test plan|qa\b|qc\b|kiểm tra|đánh giá/.test(
      t,
    )
  ) {
    result.push('quality-review', 'reviews');
  }
  if (
    /code|coding|implement|debug|refactor|typescript|python|java|kotlin|swift|dart|\.net|c#|frontend|backend|mobile|api\b|logging|tracing|project structure/.test(
      t,
    )
  ) {
    result.push('engineering-standards', 'coding');
  }
  if (/ux|ui|prototype|wireframe|design system|mockup|palette|screen/.test(t)) {
    result.push('design');
  }
  if (
    /technology|tech selection|azure|aws|gcp|cloud|security|threat|network|data model|integration/.test(
      t,
    )
  ) {
    result.push('architecture', 'technology');
  }
  if (
    /devops|sre|deploy|pipeline|ci\/cd|incident|on-call|release|lifecycle|tech lead|ai delivery/.test(
      t,
    )
  ) {
    result.push('delivery-operations');
  }
  return [...new Set(result)];
}

// ponytail: keyword cue, not intent detection; the agent judges and the user consents on the Learning page.
// "instead of" and Vietnamese "luôn" ("right away") and "thay vì" were mostly one-off task wording.
const STANDING =
  /\b(from now on|going forward|by default|default|always|never|whenever|every time|each time|next time|in future|in the future|i prefer|i'd prefer|i want .{0,40}\b(to be|to use|as)|let'?s? (always )?use|should (always )?use|don'?t (ever )?use|stop using|remember (that|to|this))\b|luôn luôn|hãy luôn|phải luôn|mặc định|từ nay|từ giờ|lần sau|đừng bao giờ|không bao giờ|ghi nhớ|hãy nhớ/i;
// ponytail: length cap; long prompts are pasted documents or tool-generated runs, not a person
// stating a preference. Detect generated runs directly if hosts start reporting them.
const MAX_CUE_PROMPT = 1500;

export const learnNudge =
  'PERSONAL BRAIN LEARN: this message may state a lasting working preference or decision (a default, an always/never rule, a correction to reuse). ' +
  'If it is meant to last beyond this task, call brain_remember once (brain_feedback with rating "correction" if brain_remember is unavailable) with the projectId, a short title, the preference as content, its domain, and the user\'s own words as reason; pass no projectId only if the user said it applies everywhere. ' +
  "Do not ask first: it waits on the Learning page for the user's consent. Skip one-off task details. Then continue the task.";

/**
 * Claude Code hides MCP tools behind tool search, so an index of record ids alone rarely gets
 * followed (about 3 loads per 100 prompts versus Codex's majority). Name the exact load step.
 */
export function toolHint(agent: AgentKind) {
  return agent === 'claude'
    ? '\n\nPERSONAL BRAIN TOOLS: if brain_* tools are not loaded yet, load them first with ToolSearch query "select:mcp__personal-brain__brain_get,mcp__personal-brain__brain_prepare,mcp__personal-brain__brain_discover,mcp__personal-brain__brain_review,mcp__personal-brain__brain_remember". Skipping the load is not a reason to skip the styles.'
    : '';
}

/**
 * Claude rarely calls brain_get from an index alone, so for Claude the strongly matched
 * preferences are sent as a digest (summary, principles, requirements) once per session and
 * version. Other agents load reliably and keep the index only.
 */
const INLINE_BUDGET = 2000;
// ponytail: 2+ distinct prompt words in title, keywords or "Use when"; one shared word was
// usually a false match ("style", "text"). Use the ranking score if this proves too strict.
const STRONG_FIELDS = new Set(['title', 'tags', 'useWhen', 'key']);
export function strongMatch(record: BrainRecord, prompt: string) {
  const words = new Set(
    recordMatch(record, prompt)
      .matches.filter((m) => STRONG_FIELDS.has(m.field))
      .flatMap((m) => m.terms),
  );
  return words.size >= 2;
}
/** The parts of a style that must not be lost, never its text cut mid-sentence. */
export function styleDigest(r: BrainRecord) {
  const list = (head: string, items: string[] = []) =>
    items.length ? `\n${head}\n${items.map((x) => '- ' + x).join('\n')}` : '';
  const extra = r.reviewCriteria?.length
    ? `\n(${r.reviewCriteria.length} review criteria: load with brain_get before finishing.)`
    : '';
  return (
    `## ${r.title} (v${r.version}, id ${r.id})\n${r.summary}` +
    list('Principles:', r.principles) +
    list(
      'Requirements:',
      (r.requirements || []).map((q) => q.label),
    ) +
    extra
  );
}
export function inlineStyles(
  db: BrainDB,
  agent: AgentKind,
  sessionId: string | null,
  matches: BrainRecord[],
  prompt: string,
): string {
  if (agent !== 'claude' || !sessionId) {
    return '';
  }
  const key = 'hook-inlined:' + db.fingerprint(JSON.stringify([agent, sessionId]));
  const row = db.db.prepare('SELECT value FROM meta WHERE key=?').get(key) as
    {value: string} | undefined;
  const seen = new Set<string>(row ? JSON.parse(row.value) : []);
  let left = INLINE_BUDGET;
  const parts: string[] = [];
  for (const r of matches.filter((m) => m.kind === 'preference' && strongMatch(m, prompt))) {
    const tag = `${r.id}@${r.version}`;
    const digest = styleDigest(r);
    // A digest that does not fit is skipped whole; the index still lists it.
    if (seen.has(tag) || digest.length > left) {
      continue;
    }
    left -= digest.length;
    seen.add(tag);
    parts.push(digest);
  }
  if (!parts.length) {
    return '';
  }
  db.db
    .prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)')
    .run(key, JSON.stringify([...seen]));
  return (
    'PERSONAL BRAIN STYLE DIGEST — apply these now. Each is a summary: brain_get on the id has the full instructions, required links and review criteria.\n\n' +
    parts.join('\n\n')
  );
}

export function alwaysApplyRecords(db: BrainDB, projectId?: string) {
  return db.scopedRecords(projectId).filter((r) => r.alwaysApply && r.status === 'active');
}

/**
 * "Always apply" styles govern every task (who does the work, how it is delivered), so they
 * cannot wait for a prompt-word match. Session start sends all of them (also after context
 * compaction); later prompts resend only new or changed versions.
 */
export function alwaysStyles(
  db: BrainDB,
  agent: AgentKind,
  sessionId: string | null,
  projectId: string | undefined,
  fresh: boolean,
): string {
  const records = alwaysApplyRecords(db, projectId);
  const key = 'hook-always:' + db.fingerprint(JSON.stringify([agent, sessionId]));
  const row =
    !fresh && sessionId
      ? (db.db.prepare('SELECT value FROM meta WHERE key=?').get(key) as
          {value: string} | undefined)
      : undefined;
  const seen = new Set<string>(row ? JSON.parse(row.value) : []);
  const due = records.filter((r) => !seen.has(`${r.id}@${r.version}`));
  if (sessionId) {
    db.db
      .prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)')
      .run(key, JSON.stringify(records.map((r) => `${r.id}@${r.version}`)));
  }
  if (!due.length) {
    return '';
  }
  return (
    'PERSONAL BRAIN ALWAYS APPLY — selected for every task in this scope, whatever the prompt says. Apply them from the start, before deciding how or by whom the work is done. Load each with brain_get (or include it in brain_prepare) before editing files; edits are blocked until you do.\n\n' +
    due.map(styleDigest).join('\n\n')
  );
}

// Requires every always-apply style and every style (preference) the current prompt matched,
// loaded at any point in the session. Skills, templates and review rules stay optional.
// Two denials per turn, then edits pass so a broken Personal Brain never locks the agent out.
const GATE_DENIALS = 2;
/** Reason to block an edit, or null to allow it. Claude PreToolUse only. */
export function gateReason(db: BrainDB, runId: string, projectId: string | undefined) {
  const events = db.db
    .prepare(
      `SELECT occurred_at AS at, event_type AS type, record_ids AS ids FROM trace_events
       WHERE run_id=? AND event_type IN ('hook.prompt.context','hook.prompt.no_match','hook.tool.load','hook.gate.denied')
       ORDER BY occurred_at`,
    )
    .all(runId) as Array<{at: string; type: string; ids: string}>;
  const prompt = events.filter((e) => e.type.startsWith('hook.prompt.')).at(-1);
  const since = prompt?.at ?? '';
  const ids = (e: {ids: string}) => {
    try {
      return JSON.parse(e.ids || '[]') as string[];
    } catch {
      return [];
    }
  };
  const loaded = loadedIds(db, runId);
  const scoped = db.scopedRecords(projectId);
  const matched = new Set(prompt ? ids(prompt) : []);
  const missing = scoped.filter(
    (r) =>
      r.status === 'active' &&
      !loaded.has(r.id) &&
      (r.alwaysApply || (r.kind === 'preference' && matched.has(r.id))),
  );
  if (!missing.length) {
    return null;
  }
  if (events.filter((e) => e.type === 'hook.gate.denied' && e.at > since).length >= GATE_DENIALS) {
    return null;
  }
  const list = missing
    .map((r) => `- ${r.title} | id ${r.id}${r.alwaysApply ? ' | always apply' : ''}`)
    .join('\n');
  return (
    `Personal Brain: load this task's styles before editing files${projectId ? ` (projectId ${projectId})` : ''}. ` +
    `Call brain_prepare with the applicable recordIds and context, or brain_get for each, then retry the edit. ` +
    `Load every style listed; if one turns out not to apply after reading it, say so in your report.\n${list}\n` +
    `If the brain_* tools are not loaded, run ToolSearch "select:mcp__personal-brain__brain_get,mcp__personal-brain__brain_prepare". ` +
    `If styles conflict with each other or with the request, stop and ask the user before continuing.`
  );
}

/** Styles already loaded in this session (brain_get, brain_prepare and its required links). */
function loadedIds(db: BrainDB, runId: string) {
  const rows = db.db
    .prepare(
      `SELECT record_ids AS ids FROM trace_events WHERE run_id=? AND event_type='hook.tool.load'`,
    )
    .all(runId) as Array<{ids: string}>;
  return new Set(
    rows.flatMap((row) => {
      try {
        return JSON.parse(row.ids || '[]') as string[];
      } catch {
        return [];
      }
    }),
  );
}

/**
 * Names up front what the edit gate will demand, so Claude loads it in one call before work
 * starts instead of being blocked mid-task.
 */
export function requiredNotice(
  db: BrainDB,
  runId: string,
  matches: BrainRecord[],
  projectId: string | undefined,
) {
  const loaded = loadedIds(db, runId);
  const matched = new Set(matches.filter((r) => r.kind === 'preference').map((r) => r.id));
  const due = db
    .scopedRecords(projectId)
    .filter(
      (r) => r.status === 'active' && !loaded.has(r.id) && (r.alwaysApply || matched.has(r.id)),
    );
  if (!due.length) {
    return '';
  }
  return (
    `PERSONAL BRAIN REQUIRED BEFORE EDITING: load all of these now, in one brain_prepare call (recordIds ${JSON.stringify(due.map((r) => r.id))}) or brain_get for each. ` +
    'File edits are blocked until every one is loaded. If one does not apply after reading it, say so in your report.\n' +
    due.map((r) => `- ${r.title} | id ${r.id}`).join('\n')
  );
}

export function hasPreferenceCue(prompt: string): boolean {
  return prompt.length <= MAX_CUE_PROMPT && STANDING.test(prompt);
}

export function startupContext(db: BrainDB, projectId?: string): string {
  // Deliberately small, so full specialty skills can load on demand.
  const baseline = db.bootstrap(1600, projectId);
  const scopeInstruction = projectId
    ? `Project scope: ${projectId}. Pass projectId "${projectId}" on every Personal Brain MCP call. `
    : '';
  return (
    `${baseline}\n\nPERSONAL BRAIN AUTO ACTIVATION\n${scopeInstruction}` +
    `Personal Brain is the user's global working style; it does not contain project memory. ` +
    `For each substantive diagram, architecture, writing, design or review task, apply the matching skill and style automatically. ` +
    `The UserPromptSubmit hook supplies matching record references, not full instructions. ` +
    `For substantive work, call brain_discover and brain_get for matching styles and required links; reuse only the same ID/version/scope already read in this conversation; ` +
    `Read available external skills on demand with brain_get_installed_skill; flag missing or ambiguous references. ` +
    `For development, load the common standard and the applicable language substyle; supply known languages, frameworks and targets to preparation, using empty arrays when none apply. Do not infer every framework mentioned by a style is in use. ` +
    `Do not ask the user to request skill discovery. If a direct user instruction conflicts with a selected style, ask before overriding the style. ` +
    `Never claim a tool or visual validator was run unless it actually ran.\n\n${complianceReminder}`
  );
}

export function taskContext(
  db: BrainDB,
  prompt: string,
  onMatch?: (matches: BrainRecord[], domains: Domain[]) => void,
  projectId?: string,
): string | null {
  const task = prompt.trim().slice(0, 4000);
  if (!task || task.length < 4) {
    return null;
  }
  const domains = classify(task);
  const scoped = db.scopedRecords(projectId);
  // Offer only strong matches: at least 30% of the best score (and 6), matched on the title,
  // tags, useWhen, summary or key, not only on words in the body. Body-only matches made hooks
  // offer styles agents never loaded (Mermaid: offered 163 times, loaded 0).
  const found = db.discover(task, undefined, 30, projectId);
  const floor = Math.max(6, (found[0]?.score || 0) * 0.3);
  const candidates = found
    .filter((m) => m.score >= floor && m.matches.some((x) => x.field !== 'guidance'))
    .map((match) => ({record: scoped.find((r) => r.id === match.id)!}));
  const selected: BrainRecord[] = [];
  // Share ranking with MCP; bound only the delivered index size.
  const limits: Record<string, number> = {skill: 2, preference: 4, review: 2, example: 2, tool: 1};
  const counts: Record<string, number> = {};
  let used = 0;
  for (const {record: r} of candidates) {
    if ((counts[r.kind] || 0) >= (limits[r.kind] || 0)) {
      continue;
    }
    const size = r.title.length + r.id.length + r.domain.length + 80;
    if (used + size > 1200) {
      continue;
    }
    selected.push(r);
    counts[r.kind] = (counts[r.kind] || 0) + 1;
    used += size;
  }
  const nudge = hasPreferenceCue(task) ? `\n\n${learnNudge}` : '';
  if (!selected.length) {
    return nudge.trim() || null;
  }
  onMatch?.(selected, domains);
  const sections = selected
    .map((r) => `[${r.kind} | ${r.domain}] ${r.title} | version ${r.version} | id ${r.id}`)
    .join('\n');
  return (
    `PERSONAL BRAIN TASK MATCH — INDEX ONLY\n${projectId ? `Project scope: ${projectId}. Pass this projectId on every call.\n` : ''}` +
    `${sections}\n\nLoad relevant records with brain_get, including requiredLinked instructions, skills and review criteria. ` +
    `Reuse instructions only if this conversation already contains the same record ID, version and scope. ` +
    `Read required external skills on demand; never claim unavailable skills were used. ` +
    `Use brain_discover if these matches are insufficient. If the request conflicts with a style, ask the user which applies before acting. Full instructions have not been injected.\n\n${complianceReminder}${nudge}`
  );
}

export function formatHookOutput(
  event: 'SessionStart' | 'UserPromptSubmit',
  context: string | null,
): string {
  if (!context) {
    return '';
  }
  return JSON.stringify({hookSpecificOutput: {hookEventName: event, additionalContext: context}});
}

export function instructionRefreshContext(
  db: BrainDB,
  agent: AgentKind,
  phase: HookPhase,
  sessionId: string | null,
  projectId: string | undefined = process.env.PB_PROJECT_ID,
): string | null {
  const digest = db.fingerprint(
    JSON.stringify([
      projectId ?? null,
      db.scopedRecords(projectId).sort((a, b) => a.id.localeCompare(b.id)),
    ]),
  );
  if (sessionId) {
    const key = 'hook-instructions:' + db.fingerprint(JSON.stringify([agent, sessionId]));
    const previous = db.db.prepare('SELECT value FROM meta WHERE key=?').get(key) as
      {value: string} | undefined;
    if (previous?.value === digest) {
      return null;
    }
    db.db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(key, digest);
  }
  if (phase === 'session') {
    return null;
  }
  return (
    'PERSONAL BRAIN INSTRUCTION REFRESH\n' +
    `Current scope: ${projectId ? `project ${projectId}` : 'global'}. ` +
    'Instructions or scope changed, or this session has no previous instruction snapshot. ' +
    'Before continuing the ongoing task, call brain_discover using the full task intent, not just this short reply. ' +
    'Reload applicable instructions and required links with brain_get or brain_prepare in the current scope. ' +
    'Do not reuse cached instructions or prepared sets until revalidated; stop applying removed or deselected instructions. ' +
    'Preserve the user’s task and explicit choices. This notice is not the full instruction content.'
  );
}

export function simulateHook(
  db: BrainDB,
  agent: AgentKind,
  phase: HookPhase,
  input: unknown,
): string {
  const obj =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const sessionId =
    [obj.session_id, obj.thread_id].find((id): id is string => typeof id === 'string') ?? null;
  const refresh = instructionRefreshContext(db, agent, phase, sessionId);
  if (phase === 'session') {
    return formatHookOutput('SessionStart', startupContext(db) + toolHint(agent));
  }
  return formatHookOutput(
    'UserPromptSubmit',
    [refresh, taskContext(db, typeof obj.prompt === 'string' ? obj.prompt : '')]
      .filter(Boolean)
      .join('\n\n'),
  );
}

export function executeHook(db: BrainDB, agent: AgentKind, phase: HookPhase) {
  let input: unknown = {};
  try {
    const raw = readFileSync(0, 'utf8').slice(0, 1048576);
    input = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    /* Fail open when host supplies malformed input. */
  }
  try {
    const obj =
      input && typeof input === 'object' && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};
    const scope = resolveProjectScope(
      undefined,
      typeof obj.cwd === 'string' ? obj.cwd : process.cwd(),
    );
    const projectId = scope.projectId;
    if (projectId) {
      db.project(projectId);
    }
    const sessionId =
      [obj.session_id, obj.thread_id].find((id): id is string => typeof id === 'string') ?? null;
    const runId = sessionId ? `${agent}:${sessionId.slice(0, 100)}` : `${agent}:hook:unlinked`;
    if (phase === 'gate') {
      if (!sessionId || toolSignal(obj.tool_name) !== 'work') {
        return;
      }
      const reason = gateReason(db, runId, projectId);
      if (reason) {
        db.trace({
          agent,
          channel: 'hook',
          eventType: 'hook.gate.denied',
          outcome: 'blocked',
          runId,
          metadata: {projectId: projectId || null, tool: String(obj.tool_name).slice(0, 80)},
        });
        process.stdout.write(
          JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'deny',
              permissionDecisionReason: reason,
            },
          }) + '\n',
        );
      }
      return;
    }
    if (phase === 'tool') {
      const signal = toolSignal(obj.tool_name);
      if (signal && sessionId) {
        const args = (obj.tool_input || {}) as {id?: unknown; recordIds?: unknown};
        const loaded = new Set(
          signal === 'load'
            ? [args.id, ...(Array.isArray(args.recordIds) ? args.recordIds : [])].filter(
                (id): id is string => typeof id === 'string',
              )
            : [],
        );
        // brain_prepare also returns required links, so they count as loaded.
        if (/brain_prepare$/.test(String(obj.tool_name))) {
          const scoped = db.scopedRecords(projectId);
          for (const id of loaded) {
            scoped.find((r) => r.id === id)?.requiredIds?.forEach((dep) => loaded.add(dep));
          }
        }
        db.trace({
          agent,
          channel: 'hook',
          eventType: 'hook.tool.' + signal,
          outcome: 'observed',
          runId,
          recordIds: [...loaded],
          metadata: {projectId: projectId || null, tool: String(obj.tool_name).slice(0, 80)},
        });
      }
      return;
    }
    const refresh = instructionRefreshContext(db, agent, phase, sessionId, projectId);
    if (phase === 'session') {
      let discoveryNote = '';
      if (
        projectId &&
        !db.db.prepare('SELECT 1 FROM meta WHERE key=?').get('discovery-paused:' + projectId)
      ) {
        try {
          if (scope.file) {
            db.db
              .prepare('INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)')
              .run('repository:' + projectId, dirname(scope.file));
          }
          discoveryNote =
            '\nProject discovery: before substantive repository work, call brain_discover_project. Read source evidence and ADR amendments, compare current selected styles, and apply justified project-only amendments through brain_update_project_style using sourceFiles digests and current versions. Preserve personal edits; flag unresolved conflicts rather than choosing silently. Skip unchanged styles. Do not create a generic conventions draft or a capability. Full source analysis is performed by you, not the startup hook.';
        } catch (e) {
          discoveryNote =
            '\nProject discovery needs attention: ' +
            (e instanceof Error ? e.message : String(e)).slice(0, 220);
        }
      }
      const always = alwaysStyles(db, agent, sessionId, projectId, true);
      const context =
        startupContext(db, projectId) +
        discoveryNote +
        toolHint(agent) +
        // MCP calls cannot see the host's session; with this id they join the hook's trace.
        (sessionId
          ? `\nSession link: pass threadId "${sessionId.slice(0, 100)}" on every Personal Brain MCP call, so the calls are traced to this session.`
          : '') +
        (always ? '\n\n' + always : '');
      const baseline = db.bootstrapWithRecords(1600, projectId).records;
      db.trace({
        agent,
        channel: 'hook',
        eventType: 'hook.session.context',
        outcome: 'emitted',
        runId,
        recordIds: baseline.map((r) => r.id),
        recordVersions: Object.fromEntries(baseline.map((r) => [r.id, r.version])),
        metadata: {
          note: 'Index only; full instructions load through brain_get',
          contextChars: context.length,
          sessionLinked: !!sessionId,
          projectId: projectId || null,
        },
      });
      process.stdout.write(formatHookOutput('SessionStart', context) + '\n');
    } else {
      const prompt = typeof obj.prompt === 'string' ? obj.prompt : '';
      const matches: BrainRecord[] = [];
      const domains: Domain[] = [];
      const matchedContext = taskContext(
        db,
        prompt,
        (found, matched) => {
          matches.push(...found);
          domains.push(...matched);
        },
        projectId,
      );
      const inlined = inlineStyles(db, agent, sessionId, matches, prompt);
      const always = alwaysStyles(db, agent, sessionId, projectId, false);
      const required =
        agent === 'claude' && sessionId ? requiredNotice(db, runId, matches, projectId) : '';
      const context = [refresh, matchedContext, inlined, always, required]
        .filter(Boolean)
        .join('\n\n');
      db.trace({
        agent,
        channel: 'hook',
        eventType: context ? 'hook.prompt.context' : 'hook.prompt.no_match',
        outcome: context ? 'emitted' : 'skipped',
        runId,
        recordIds: matches.map((r) => r.id),
        recordVersions: Object.fromEntries(matches.map((r) => [r.id, r.version])),
        metadata: {
          note: 'Index only; full instructions load through brain_get',
          projectId: projectId || null,
          promptChars: prompt.length,
          promptHash: db.fingerprint(prompt),
          matchedDomains: domains.join(','),
          contextChars: context?.length || 0,
          preferenceCue: hasPreferenceCue(prompt),
          sessionLinked: !!sessionId,
          instructionsRefreshed: !!refresh,
        },
      });
      if (context) {
        process.stdout.write(formatHookOutput('UserPromptSubmit', context) + '\n');
      }
    }
  } catch (e) {
    console.error(`Personal Brain hook skipped: ${e instanceof Error ? e.message : String(e)}`);
    if (phase === 'prompt') {
      process.stdout.write(
        formatHookOutput(
          'UserPromptSubmit',
          'PERSONAL BRAIN REFRESH UNAVAILABLE\nCurrent instructions could not be verified. Do not assume cached Brain instructions are current. Resolve the current project scope and reload with brain_discover and brain_get before continuing; report any unavailable preferences.',
        ) + '\n',
      );
    }
  }
}

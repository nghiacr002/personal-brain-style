import {spawn} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {executable} from '../agents/executable.ts';
import type {BrainDB} from '../core/database.ts';
import {BrainError} from '../core/models.ts';
import {preferencesText} from '../projects/handoff.ts';
import {agentArgv} from './project-learning.ts';

/**
 * Controlled comparison: the same task runs with and without a project's approved preferences,
 * and both outputs are scored by the same checks. The only difference between the two prompts is
 * the preferences, so the pass-rate gap is what the styles change.
 */
export type Check = {kind: 'contains' | 'absent' | 'regex'; value: string};
export type BenchTask = {
  id: string;
  title: string;
  projectId: string;
  prompt: string;
  checks: Check[];
  updatedAt: string;
};
type Agent = 'codex' | 'claude';
type Condition = 'with' | 'without';
export type BenchResult = {
  taskId: string;
  agent: Agent;
  condition: Condition;
  run: number;
  passed: number;
  total: number;
  failed: string[];
  error?: string;
  seconds: number;
};
export type BenchRun = {
  id: string;
  status: 'running' | 'ready' | 'failed' | 'cancelled';
  createdAt: string;
  agents: Agent[];
  runs: number;
  taskIds: string[];
  planned: number;
  results: BenchResult[];
  error?: string;
};
const MAX_PLANNED = 60;
const TIMEOUT_MS = 300000;
const cancels = new Map<string, () => void>();

const put = (db: BrainDB, key: string, value: unknown) =>
  db.db
    .prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)')
    .run(key, JSON.stringify(value));
const all = <T>(db: BrainDB, prefix: string) =>
  (
    db.db.prepare('SELECT value FROM meta WHERE key LIKE ?').all(prefix + '%') as {
      value: string;
    }[]
  ).map((r) => JSON.parse(r.value) as T);

/** Parses one check per line: `contains: text`, `absent: text` or `regex: pattern`. */
export function parseChecks(text: unknown): Check[] {
  if (typeof text !== 'string') {
    throw new BrainError('Checks must be text, one per line');
  }
  const checks = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(contains|absent|not|regex)\s*:\s*(.+)$/i);
      if (!m || m[2].length > 500) {
        throw new BrainError(
          `Check "${line.slice(0, 60)}" must start with contains:, absent: or regex:`,
        );
      }
      const kind = (m[1].toLowerCase() === 'not' ? 'absent' : m[1].toLowerCase()) as Check['kind'];
      if (kind === 'regex') {
        try {
          new RegExp(m[2], 'i');
        } catch {
          throw new BrainError('Invalid regex: ' + m[2]);
        }
      }
      return {kind, value: m[2]};
    });
  if (!checks.length || checks.length > 20) {
    throw new BrainError('Give 1–20 checks');
  }
  return checks;
}
export const checkLabel = (c: Check) => `${c.kind}: ${c.value}`;
export function score(output: string, checks: Check[]) {
  const text = output.toLowerCase();
  const failed = checks.filter((c) => {
    if (c.kind === 'regex') {
      return !new RegExp(c.value, 'i').test(output);
    }
    const found = text.includes(c.value.toLowerCase());
    return c.kind === 'contains' ? !found : found;
  });
  return {
    passed: checks.length - failed.length,
    total: checks.length,
    failed: failed.map(checkLabel),
  };
}

export const benchTasks = (db: BrainDB) =>
  all<BenchTask>(db, 'bench-task:').sort((a, b) => a.title.localeCompare(b.title));
export function saveBenchTask(db: BrainDB, raw: unknown, id?: string): BenchTask {
  const x = (raw || {}) as Record<string, unknown>;
  if (typeof x.title !== 'string' || !x.title.trim() || x.title.length > 150) {
    throw new BrainError('Task title must have 1–150 characters');
  }
  if (typeof x.prompt !== 'string' || !x.prompt.trim() || x.prompt.length > 20000) {
    throw new BrainError('Task prompt must have 1–20000 characters');
  }
  if (typeof x.projectId !== 'string') {
    throw new BrainError('Choose the project whose styles this task tests');
  }
  db.project(x.projectId);
  if (id && !db.db.prepare('SELECT 1 FROM meta WHERE key=?').get('bench-task:' + id)) {
    throw new BrainError('Task not found', 'NOT_FOUND', 404);
  }
  const task: BenchTask = {
    id: id || randomUUID(),
    title: x.title.trim(),
    projectId: x.projectId,
    prompt: x.prompt,
    checks: parseChecks(x.checks),
    updatedAt: new Date().toISOString(),
  };
  put(db, 'bench-task:' + task.id, task);
  return task;
}
export function deleteBenchTask(db: BrainDB, id: string) {
  db.db.prepare('DELETE FROM meta WHERE key=?').run('bench-task:' + id);
}
export const benchRuns = (db: BrainDB) =>
  all<BenchRun>(db, 'bench-run:')
    .map((r) =>
      r.status === 'running' && !cancels.has(r.id)
        ? {...r, status: 'failed' as const, error: 'Interrupted by a restart'}
        : r,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);

/** Same wrapper for both conditions, so the preferences are the only difference. */
export function benchPrompt(db: BrainDB, task: BenchTask, condition: Condition) {
  const styles =
    condition === 'with'
      ? `Follow these working preferences.\n\n${preferencesText(db, task.projectId).body}\n\n---\n\n`
      : '';
  return `${styles}Task:\n${task.prompt}\n\nReply with the complete deliverable as text in this message.`;
}

/** One headless agent call; resolves with its final answer. */
type Runner = (
  agent: Agent,
  prompt: string,
  onCancel: (kill: () => void) => void,
) => Promise<string>;
export const runAgent: Runner = (agent, prompt, onCancel) =>
  new Promise((resolve, reject) => {
    const folder = mkdtempSync(join(tmpdir(), 'brain-bench-')),
      output = join(folder, 'result.txt');
    let stdout = '';
    const cleanup = () =>
      rmSync(folder, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});
    let launch;
    try {
      launch = executable(agent, agentArgv(agent, output));
    } catch (e) {
      cleanup();
      reject(e);
      return;
    }
    const child = spawn(launch.command, launch.args, {
      cwd: folder,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    onCancel(() => child.kill('SIGKILL'));
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > 1000000) {
        child.kill('SIGKILL');
      }
    });
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.on('error', (e) => {
      clearTimeout(timer);
      cleanup();
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        if (code !== 0) {
          throw new Error(`Agent failed (exit ${code}); check its login in your terminal`);
        }
        resolve(agent === 'codex' ? readFileSync(output, 'utf8') : stdout);
      } catch (e) {
        reject(e);
      } finally {
        cleanup();
      }
    });
    child.stdin.end(prompt);
  });

export function startBenchRun(db: BrainDB, raw: unknown, runner: Runner = runAgent) {
  const x = (raw || {}) as Record<string, unknown>;
  const agents = Array.isArray(x.agents) ? [...new Set(x.agents)] : [];
  if (!agents.length || !agents.every((a) => a === 'codex' || a === 'claude')) {
    throw new BrainError('Choose Codex, Claude or both');
  }
  const runs = Number(x.runs);
  if (!Number.isInteger(runs) || runs < 1 || runs > 5) {
    throw new BrainError('Runs per task must be 1–5');
  }
  const known = new Map(benchTasks(db).map((t) => [t.id, t]));
  const taskIds = Array.isArray(x.taskIds)
    ? ((x.taskIds as unknown[]).filter((id) => known.has(id as string)) as string[])
    : [];
  if (!taskIds.length) {
    throw new BrainError('Choose at least one task');
  }
  const planned = taskIds.length * agents.length * runs * 2;
  if (planned > MAX_PLANNED) {
    throw new BrainError(`That is ${planned} agent calls; keep it to ${MAX_PLANNED} or fewer`);
  }
  if (cancels.size) {
    throw new BrainError('A comparison is already running', 'CONFLICT', 409);
  }
  const job: BenchRun = {
    id: randomUUID(),
    status: 'running',
    createdAt: new Date().toISOString(),
    agents: agents as Agent[],
    runs,
    taskIds,
    planned,
    results: [],
  };
  const save = () => !db.isClosed && put(db, 'bench-run:' + job.id, job);
  let cancelled = false,
    kill = () => {};
  cancels.set(job.id, () => {
    cancelled = true;
    kill();
  });
  save();
  void (async () => {
    // Conditions alternate inside each run so model or network drift hits both equally.
    for (let run = 1; run <= runs && !cancelled; run++) {
      for (const taskId of taskIds) {
        for (const agent of job.agents) {
          for (const condition of ['with', 'without'] as const) {
            if (cancelled) {
              break;
            }
            const task = known.get(taskId)!,
              started = Date.now();
            const base = {taskId, agent, condition, run};
            try {
              const output = await runner(
                agent,
                benchPrompt(db, task, condition),
                (k) => (kill = k),
              );
              job.results.push({
                ...base,
                ...score(output, task.checks),
                seconds: Math.round((Date.now() - started) / 1000),
              });
            } catch (e) {
              job.results.push({
                ...base,
                passed: 0,
                total: task.checks.length,
                failed: [],
                error: e instanceof Error ? e.message.slice(0, 300) : String(e),
                seconds: Math.round((Date.now() - started) / 1000),
              });
            }
            save();
          }
        }
      }
    }
    cancels.delete(job.id);
    job.status = job.results.every((r) => r.error) ? 'failed' : 'ready';
    if (job.status === 'failed') {
      job.error = job.results[0]?.error;
    }
    if (cancelled) {
      job.status = 'cancelled';
    }
    save();
  })();
  return job;
}
export function cancelBenchRun(id: string) {
  cancels.get(id)?.();
  return {cancelled: cancels.has(id)};
}

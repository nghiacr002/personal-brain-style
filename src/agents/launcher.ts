import {spawnSync} from 'node:child_process';
import {readFileSync, statSync} from 'node:fs';
import {delimiter, dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {manageHookConfig, type Agent, type InstallOptions} from './hook-install.ts';
import {executable} from './executable.ts';

const here = dirname(fileURLToPath(import.meta.url));
export function packageVersion(from = here): string | null {
  for (let dir = from, i = 0; i < 6; i++, dir = dirname(dir)) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      if (pkg.name === 'personal-brain-style') {
        return pkg.version;
      }
    } catch {
      /* keep looking upward */
    }
  }
  return null;
}
export type InstallMode = 'source' | 'npx' | 'global';

export function onPath(name: string) {
  const names = process.platform === 'win32' ? [name + '.cmd', name + '.exe', name] : [name];
  return (process.env.PATH || '').split(delimiter).some((dir) =>
    names.some((n) => {
      try {
        return statSync(join(dir, n)).isFile();
      } catch {
        return false;
      }
    }),
  );
}

// How agents start Personal Brain. npx caches can be cleared, so an npx copy launches through npx;
// global and source copies keep absolute paths, which stay valid until the copy is removed.
export function launcher(from = here): {mode: InstallMode; argv: string[]} {
  // Accept either separator so POSIX-style and Windows paths are recognised alike.
  const parts = from.split(/[\\/]/);
  // Pin the running version: the package publishes under the beta tag, so a bare name could resolve elsewhere.
  if (parts.includes('_npx')) {
    const v = packageVersion(from);
    return {
      mode: 'npx',
      argv: ['npx', '--yes', v ? `personal-brain-style@${v}` : 'personal-brain-style'],
    };
  }
  return {
    mode: parts.includes('node_modules') ? 'global' : 'source',
    argv: [process.execPath, resolve(from, '../../scripts/run.mjs'), resolve(from, '../cli.ts')],
  };
}

const quote = (value: string) =>
  /^[\w@%+=:,./-]+$/.test(value) ? value : "'" + value.replaceAll("'", "'\\''") + "'";
export const shellJoin = (argv: string[]) => argv.map(quote).join(' ');

// What a person types is always the installed command; when it is missing, the UI offers
// installing it, running it through npx (pinned to this version), or this copy's full command.
export function commandLine(from = here, binOnPath = onPath('personal-brain')) {
  const {mode, argv} = launcher(from);
  const version = packageVersion(from);
  return {
    mode,
    cli: 'personal-brain',
    onPath: binOnPath,
    npx: shellJoin([
      'npx',
      '--yes',
      version ? `personal-brain-style@${version}` : 'personal-brain-style',
    ]),
    raw: shellJoin(argv),
  };
}

export function mcpAddArgs(agent: 'claude' | 'codex', from = here) {
  const server = [...launcher(from).argv, 'mcp', agent];
  return agent === 'claude'
    ? ['mcp', 'add', '--transport', 'stdio', '--scope', 'user', 'personal-brain', '--', ...server]
    : ['mcp', 'add', 'personal-brain', '--', ...server];
}

type Step = {step: string; ok: boolean; detail: string};
// One command per agent: hooks (or the OpenCode plugin) plus MCP registration through the agent's own CLI.
// Windows npm shims (.cmd) cannot be spawned without a shell; executable() resolves them to node + script.
const spawnAgent = (cmd: string, args: string[], o: object) => {
  try {
    const l = executable(cmd, args);
    return spawnSync(l.command, l.args, o);
  } catch (error) {
    return {status: 1, error};
  }
};
export function connectAgent(
  action: 'connect' | 'disconnect',
  agent: Agent,
  run: (
    cmd: string,
    args: string[],
    o: object,
  ) => {status: number | null; stderr?: unknown; error?: unknown} = spawnAgent,
  opts: InstallOptions = {},
  agentOnPath = onPath,
): Step[] {
  const steps: Step[] = [];
  try {
    const hook = manageHookConfig(action === 'connect' ? 'install' : 'remove', agent, opts);
    steps.push({
      step: agent === 'opencode' ? 'plugin' : 'hooks',
      ok: true,
      detail: `${action === 'connect' ? 'installed' : 'removed'} ${hook.file}${hook.changed ? '' : ' (no change)'}`,
    });
  } catch (e) {
    steps.push({step: 'hooks', ok: false, detail: e instanceof Error ? e.message : String(e)});
  }
  if (agent === 'opencode') {
    steps.push({
      step: 'mcp',
      ok: true,
      detail: 'the plugin registers the MCP server when OpenCode starts',
    });
    return steps;
  }
  const add = mcpAddArgs(agent);
  if (!agentOnPath(agent)) {
    steps.push({
      step: 'mcp',
      ok: false,
      detail: `${agent} CLI not found on PATH. ${action === 'connect' ? 'Run: ' + shellJoin([agent, ...add]) : 'Remove the personal-brain MCP server in ' + agent} `,
    });
    return steps;
  }
  // Re-registering replaces an older entry that may point at a moved or cleared copy.
  const remove =
    agent === 'claude'
      ? ['mcp', 'remove', '--scope', 'user', 'personal-brain']
      : ['mcp', 'remove', 'personal-brain'];
  run(agent, remove, {stdio: 'ignore'});
  if (action === 'disconnect') {
    steps.push({step: 'mcp', ok: true, detail: `removed personal-brain from ${agent}`});
    return steps;
  }
  const result = run(agent, add, {encoding: 'utf8'});
  steps.push({
    step: 'mcp',
    ok: result.status === 0,
    detail:
      result.status === 0
        ? `registered personal-brain in ${agent}`
        : String(result.stderr || result.error || 'registration failed')
            .trim()
            .slice(0, 300),
  });
  return steps;
}

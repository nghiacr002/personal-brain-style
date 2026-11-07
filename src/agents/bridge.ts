import {executable} from './executable.ts';
import {spawn} from 'node:child_process';
import {BrainError, type ToolBackend} from '../core/models.ts';

/**
 * A single-use stdio MCP client. This does not interpret or execute shell scripts.
 * Tools are invoked only after the local administrator enables a registered backend
 * AND starts Personal Brain with PB_ENABLE_TOOL_PROXY=1.
 */
export function invokeBackend(
  backend: ToolBackend,
  args: Record<string, unknown>,
): Promise<unknown> {
  return talkToBackend(backend, 'tools/call', {name: backend.toolName, arguments: args});
}
export function inspectBackend(backend: ToolBackend): Promise<unknown> {
  return talkToBackend(backend, 'tools/list', {});
}
function talkToBackend(
  backend: ToolBackend,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  if (!backend.enabled || process.env.PB_ENABLE_TOOL_PROXY !== '1') {
    throw new BrainError(
      'Tool proxy disabled. Enable the tool and set PB_ENABLE_TOOL_PROXY=1',
      'DISABLED',
      403,
    );
  }
  if (!backend.toolName.trim()) {
    throw new BrainError('Backend tool name required');
  }
  return new Promise((resolve, reject) => {
    const launch = executable(backend.command, backend.args);
    let settled = false,
      ready = false,
      buffer = '';
    const timeout = setTimeout(
      () => done(new Error('Backend MCP timed out')),
      backend.timeoutMs || 30000,
    );
    const child = spawn(launch.command, launch.args, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + String(chunk)).slice(-1500);
    });
    const send = (obj: unknown) => child.stdin.write(JSON.stringify(obj) + '\n');
    function done(error?: Error, result?: unknown) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      child.kill('SIGTERM');
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    }
    child.on('error', (err) => done(err));
    child.on('exit', (code) => {
      if (!settled) {
        done(new Error(`Backend exited ${code}: ${stderr}`));
      }
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffer += String(chunk);
      if (buffer.length > 4_000_000) {
        return done(new Error('Backend response too large'));
      }
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) {
          continue;
        }
        try {
          const msg = JSON.parse(line);
          if (msg.id === 1) {
            if (msg.error) {
              return done(new Error(`Backend initialize failed: ${JSON.stringify(msg.error)}`));
            }
            if (!ready) {
              ready = true;
              send({jsonrpc: '2.0', method: 'notifications/initialized'});
              send({jsonrpc: '2.0', id: 2, method, params});
            }
          }
          if (msg.id === 2) {
            if (msg.error) {
              return done(new Error(`Backend tool error: ${JSON.stringify(msg.error)}`));
            }
            return done(undefined, msg.result);
          }
        } catch {
          /* ignore stderr-like lines in stdout */
        }
      }
    });
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: {name: 'personal-brain-style', version: '1.0.0'},
      },
    });
  });
}

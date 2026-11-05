# Windows and macOS verification

Audit date: 2026-11-04. This is a verification record, not certification of every client/version combination.

## Runtime and setup

Use native Node.js 22.13+ (Node 24 recommended). `npm start` starts the browser UI and development watchers. `npm run cli -- desktop repair` configures Claude Desktop without Bash. The activation shell script requires Bash: use Git Bash plus native Windows Node on Windows. WSL uses Linux paths and configuration, not Windows Desktop settings.

| Area | Implementation / checks | Remaining validation |
| --- | --- | --- |
| CLI, MCP and package | Stable CLI path, compiled nested modules, isolated packed-install smoke test | Native Windows matrix execution |
| Desktop | macOS/Windows/XDG paths; config override; backup; preserve unrelated entries | Live Desktop launch on both OSs; alternate MSIX locations may need `--config` |
| Project detection | Native path traversal to nearest `.personal-brain.json`; explicit project and environment precedence | Native Windows drive/UNC repository fixtures |
| Source evidence | Native relative-path containment; reject symlink redirection and traversal | Windows filesystem case/junction behavior in CI |
| Skill discovery | Home/project/agent/plugin roots; deduplication; missing/ambiguous references; bounded reads | Native Windows installed-client inventories |
| Claude hooks | Direct executable plus argument array, avoiding shell quoting | Requires a Claude Code release supporting exec-form hooks; live host test |
| Codex hooks | Windows PowerShell encoded invocation; POSIX quoting elsewhere | Live Codex Windows invocation and stdin flow |
| Connect / MCP registration | `connect`/`disconnect` install hooks or plugin and run `claude mcp add --transport stdio --scope user …` or `codex mcp add …` with an argument array (no shell; Windows npm `.cmd` shims resolve to node + script, as for Fusion); existing entry removed first; prints the command when the agent CLI is not on PATH | Live registration on Windows |
| npx-pinned launcher | An npx copy registers hooks, plugin and MCP through `npx --yes personal-brain-style@<version>`, so clearing the npx cache does not break them; global and source copies use absolute paths | Windows `npx.cmd` resolution in agent hosts; per-call startup time |
| OpenCode plugin | One managed file in `~/.config/opencode/plugins/` registers the MCP server through the plugin `config` hook and injects session/prompt context through `chat.message` and `experimental.chat.system.transform`; refuses to overwrite unmanaged files | Live OpenCode host test; the system-transform hook is marked experimental by OpenCode |
| Fusion / tool bridge | Windows native executables or recognized npm Node shims, no shell interpolation | Authenticated provider calls; unusual custom shims require explicit node.exe + script configuration |
| Fusion cancellation | Cleanup waits for process close; fixture lifecycle checks | Provider-specific spawned descendants are not independently supervised |
| ChatGPT tunnel | Bash helper and validation fixtures | Windows Git Bash/tunnel-client interoperability; no native PowerShell tunnel helper |

## Automated verification

`.github/workflows/platform-checks.yml` runs the build, tests and packaged installation on Windows and macOS with Node 22 and 24. It has been added locally; no GitHub run is claimed. POSIX shell-fixture tests for CLI registration and the tunnel helper are explicitly skipped on Windows and run in the macOS job. Fusion has a Windows npm-shim fixture as well as its POSIX fixture.

Local macOS sandbox testing cannot bind HTTP listening sockets. Tests that require a listener must run outside this sandbox or in CI; they are not disabled to hide that restriction.

## Sources

- [Node child processes](https://nodejs.org/api/child_process.html): Windows batch shims are not standalone executables.
- [Claude Code command hook fields](https://code.claude.com/docs/en/hooks#command-hook-fields): executable/args form avoids platform shell parsing.

Repair hooks after upgrading to regenerate their command format. The audit does not change personal configuration or remove installed skills.

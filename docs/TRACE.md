# Trace Explorer — Operational guide

Trace Explorer tracks **how Personal Brain was invoked**. It is not a model internals debugger. Open it from the sidebar under **Diagnostics**.

The timeline updates live every 5 seconds. Use the **Live updates** switch to turn this off. Updates pause while an event is expanded, a filter has focus, you are not on page 1, or the browser tab is hidden.

## Event sources

| Source | Event | What it proves |
|---|---|---|
| Claude/Codex hook or OpenCode plugin | `hook.session.context` | A startup hook produced global style JSON |
| Claude/Codex hook or OpenCode plugin | `hook.prompt.context` | A prompt hook produced matching skill/style JSON |
| Claude/Codex hook or OpenCode plugin | `hook.prompt.no_match` | A prompt hook ran without matching a domain |
| MCP connection | `mcp.initialize` | A compatible MCP client initialized a server process |
| MCP tool registry | `mcp.tools.list` | The client requested the tool list |
| MCP tool | `mcp.brain_discover` | The client searched the style/skill catalog |
| MCP tool | `mcp.brain_get` | The client requested full contents of a specific record |
| MCP tool | `mcp.brain_review` | The client submitted text for automated review checks |
| MCP tool | `mcp.brain_feedback` | The client recorded feedback |
| MCP tool | `mcp.brain_call_tool` | The client attempted a configured external tool invocation |

All MCP calls are recorded with success/error, time, agent hint, and available record IDs and versions. The command-line arguments used to register MCP (`mcp claude`, `mcp codex`, `mcp opencode`, `mcp chatgpt`) identify the agent; otherwise the MCP client name is used, and unrecognized clients appear as `unknown`. The OpenCode plugin runs the same session and prompt hooks, recorded under agent `opencode`. The registration hint identifies the originating connection, **not a security boundary**.

## How to reverse trace a drawing instruction

1. Open **Trace Explorer**.
2. In **Reverse by rule**, select `Editable draw.io architecture style`.
3. Filter by agent: `claude`, `codex`, `opencode` or `chatgpt`.
4. Inspect `hook.prompt.context` to see whether the matching rule ID and version were emitted.
5. Inspect `mcp.brain_discover` and `mcp.brain_get` to see whether the agent actively searched and retrieved a skill.
6. Inspect `mcp.brain_review` to see whether a deterministic text validation was requested.
7. Judge actual output quality separately from an artifact and acceptance criteria.

**Important:** CLI session-start hooks and MCP server calls often run in different processes. The hook may provide a session ID, but MCP stdio clients do not necessarily provide the same ID. `runId` values are therefore not guaranteed to correlate. Use agent, timestamps and record IDs for investigation; do not claim exact end-to-end tracing when IDs are missing.

## Evidence interpretation

- Hook **emitted**: Our process wrote context as a hook response. The host may still reject or ignore it. Do not interpret as confirmed model compliance.
- MCP **retrieved**: The client requested the full record and the server responded. This does not prove the model obeyed it.
- Review **called**: The server executed supported text checks; manual/visual checks remain unverified.
- Real **effectiveness**: Requires comparing the generated artifact to measurable criteria, or collecting independent human acceptance evidence.

Live counters exclude demonstration events. The UI no longer creates or shows sample traces; for development, the CLI (`trace demo`, `trace clear-demo`) and the API below still create and remove them.

## Privacy and storage

Trace records live in the same local SQLite file as the style catalog (`~/.personal-brain-style/brain.sqlite` by default). Each trace row stores:

- Timestamp, channel, event name, result, agent hint, run ID.
- Matched style/skill record IDs and their version at invocation time.
- Small whitelisted metadata counters and a **keyed HMAC fingerprint** of hook prompts.

Ordinary hook/MCP telemetry does **not** store original prompts, tool-call arguments, agent output or external tool responses. Explicit `compliance.review` submissions additionally store task summaries, artifact paths, requirement snapshots and agent evidence notes. These appear in project activity and trace exports; never include secrets in review evidence. Artifact file contents are not collected by presence checks. A session identifier supplied by a CLI can still reveal a stable ID, so handle database exports with care. Back up or delete the SQLite file with normal filesystem controls.

## CLI

`trace demo` and `clear-demo` are for development only.

```bash
npm run cli -- trace stats
npm run cli -- trace demo
npm run cli -- trace export
npm run cli -- trace export --demo
npm run cli -- trace clear-demo
```

## API

The demo endpoints are for development only. The API is local and does not require a Bearer token. Browser requests must pass the exact local origin check:

- `GET /api/trace/stats`
- `GET /api/trace?agent=claude&channel=hook&recordId=<uuid>&demo=1`
- `POST /api/trace/demo`
- `DELETE /api/trace/demo`

## Limits

- This is a local developer tool, not a network-exposed observability service.
- No durable trace retention policy, encryption-at-rest, or enterprise authentication is included.
- No actual diagram renderer or image-diff engine is built into v1.2.
- Trace data alone is insufficient to calculate instruction effectiveness; use controlled artifact comparisons and review feedback.

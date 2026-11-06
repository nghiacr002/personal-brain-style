# OpenCode V2 compatibility — 2026-11-05

The V1-only generated plugin caused the reported default-definition error in OpenCode 2.2.5. The generator now emits a default object with `id`, V2 `setup`, and a V1 `server` entry point. V2 registers MCP using a transform and adapts prompt/context events to the existing instruction delivery logic. Existing MCP configuration is preserved.

Contract sources: [official migration guide](https://opencode.ai/v2/docs/build/plugins/migrate-v1/) and [server API / V1 compatibility](https://opencode.ai/v2/docs/build/plugins/server/), accessed 2026-11-05. The object-based V1 entry point requires V1 1.18.29 or newer; older V1 versions are not supported by this generated form.

## Acceptance and execution

| Case | Method | Result |
|---|---|---|
| Generated module loads and registers V2 handlers | Dynamic import and mock V2 context in `tests/hooks.test.ts` | Passed |
| Prompt context is typed, session-isolated and does not alter user text | Execute generated handlers with a fixture subprocess | Passed |
| Existing MCP config is preserved | Existing disabled entry remains unchanged after setup | Passed |
| Actual V2 plugin loader accepts default definition | OpenCode 2.2.5 isolated server; `plugin list --server` lists `personal-brain` | Passed |
| Actual MCP handshake succeeds | Same isolated server; `mcp list --server` reports connected | Passed |
| Regression | `npm test`, Node 22.23.4: 161 passed, 0 failed/skipped | Passed |
| Build | `npm run build:package` | Passed |
| Live model turn / V1 host | No model prompt sent; no V1 binary tested | Not verified |

The first standalone listing returned before asynchronous plugin loading completed. A persistent isolated localhost server and subsequent listing established successful loading and connection. Tests used temporary configuration, database and runtime directories. The managed user plugin was then repaired; previous contents were saved to `/tmp/pb-opencode-before-v2.js`. Restart the user's OpenCode session to load the new file.

Self-review scope: generator, generated export, plugin installer callers, existing refusal to overwrite foreign files, hook adapters, and documentation. Existing activation-script changes were preserved. Codebase-memory coverage predates reorganised paths; source inspection and tests supplied the evidence. No claim of independently reviewed or persisted Personal Brain compliance is made.

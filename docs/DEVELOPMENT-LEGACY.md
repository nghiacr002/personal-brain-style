# Personal Brain v1.2 — Style Studio + Trace Explorer

**A local, reusable personal working-style brain for Claude Code and Codex.** It is **not** a codebase memory system, project memory, or agent harness.

Personal Brain supplies global thinking, architecture, diagram, writing, design, and review standards using automatic hooks and a discoverable MCP server. It also records *what the CLIs requested* without claiming to know how the model reasoned internally.

## What's new in v1.2

- **65 pre-filled example records** across preferences, skills, approved examples, review criteria, and tool descriptions.
- An **ⓘ explanation** for each feature and on the editor's fields, with What / How / Why / Example / Limits.
- **Trace Explorer** with event timelines, agent and channel filters, reverse lookup by style/skill, delivered version metadata, and JSON export.
- **Real vs demo** trace separation with marked example timelines.
- **Privacy-first hook telemetry**: prompt HMAC fingerprints; explicit compliance reviews additionally persist task summaries, paths and evidence notes.
- Existing SQLite records and revisions are preserved when upgrading.

## Requirements

- macOS (Apple Silicon or Intel) with Node.js **24 LTS recommended**, or **22.13+**.
- Claude Code and/or Codex CLI installed and authenticated if you want live integration.
- No additional runtime npm dependencies. TypeScript is a dev dependency for rebuilding `public/app.js`.
- Local browser and terminal.

## Install and start

```bash
unzip personal-brain-style-ts-v1.2-complete.zip
cd personal-brain-style
node --version
bash scripts/setup-macos.sh
npm start
```

Open **http://127.0.0.1:4177**. The local app opens directly without login. Startup fills missing sample records across all five library sections and adds clearly marked demo traces.

Setup seeds all 65 sample records in a non-destructive way, runs 23 automated tests, and does not change your Claude/Codex settings. Existing entries with the same title are preserved.

## Connect MCP and automatic startup hooks

```bash
# Inspect changes without applying them
bash scripts/activate-personal-brain.sh

# Install MCP entries and both hook configurations
bash scripts/activate-personal-brain.sh --apply

# Verify
bash scripts/activate-personal-brain.sh --status
claude mcp list
codex mcp list
```

Restart both agents. Codex may require a one-time approval of hooks via `/hooks`.

Hooks automatically emit a concise personal style at `SessionStart` and relevant task instructions at `UserPromptSubmit`. MCP can provide additional skills and tool metadata when the agent calls `brain_discover` or `brain_get`.

**A hook running does not prove the model followed the instruction.** Check the Trace Explorer and inspect the resulting artifact independently.

### If you upgraded from v1.1.1

Do **not** delete the existing SQLite database; it is normally located at `~/.personal-brain-style/brain.sqlite`. If moving the source directory, refresh the absolute paths used by your CLI hooks and MCP registrations.

```bash
# Optional: make a consistent backup before upgrade
npm run cli -- backup "$HOME/Desktop/personal-brain-before-upgrade.sqlite"

# Reapply hook settings so their paths point to this version
bash scripts/activate-personal-brain.sh --apply

# Inspect currently registered MCP commands
claude mcp get personal-brain
codex mcp get personal-brain
```

If an existing registration targets your previous installation or does not end with `mcp claude` / `mcp codex`, review the change and recreate **only** the `personal-brain` entry. The standard CLI commands are:

```bash
claude mcp remove personal-brain --scope user
codex mcp remove personal-brain
bash scripts/connect-macos.sh --apply
```

Review your CLI configuration before removing entries. Do not delete other MCP services. On some CLI versions, the removal command or scope flags may differ; use the CLI's `mcp --help` if necessary.

The new MCP argument (`claude` or `codex`) improves agent attribution in traces; previous registrations may still function but appear as `unknown`.

## Core features

| UI | What it does | Why it matters |
|---|---|---|
| Overview | Summary of all active style data | Single view of your working standards |
| My Styles | Versioned global style rules | Same design conventions across agents |
| Skills | Procedures agents can discover or receive through hooks | Portable working methods |
| Examples | Reusable format and quality references | Demonstrate desired results |
| Review Standards | Deterministic text checks and manual rubrics | More consistent reviews |
| MCP Tool Catalog | Discoverable approved tool descriptions | Find drawing and document tools |
| Discovery Lab | Simulate search, startup baseline and text review | Debug matching without spending tokens |
| Auto Activation | Inspect installed hooks | Detect configuration, then verify invocation |
| Feedback | Capture accepted results and corrections | Improve styles by approved revision |
| Activity | History and rollback | Recover previous instruction versions |
| **Trace Explorer** | Hook/MCP event timeline and reverse trace | Measure service adoption and troubleshoot instruction retrieval |

Every major screen has an **ⓘ info button**, and every editor field has help. Tool catalog entries are **discovery-only** until a trusted backend is configured and explicitly enabled.

## Trace examples

Open **Trace Explorer → Generate sample traces** to create marked synthetic Claude-drawing and Codex-writing flows. Choose **Include demo traces** to see them; demo events never enter live metrics. To investigate a real preference, select it under **Reverse by rule** and view which agent emitted or retrieved which version.

Read [the complete trace guide](docs/TRACE.md) for exact events, privacy rules and interpretation. Trace does not capture model reasoning, prove instruction adherence, or correlate every hook event with an MCP process.

## Command line

```bash
npm run seed                        # Fill missing sample styles, without replacing edits
npm run cli -- doctor             # Environment diagnostics
npm run cli -- preview claude session
npm run cli -- preview codex prompt "Create editable architecture diagram"
npm run cli -- trace stats
npm run cli -- trace demo
npm run cli -- trace export
npm run cli -- trace clear-demo
npm run cli -- export             # Export style records and feedback
npm run cli -- backup /absolute/path/brain-backup.sqlite
npm test                           # Automated integration tests
```

**Example catalog:** [`examples/style-catalog.json`](examples/style-catalog.json) contains 65 readable sample style records. The source of truth for seeding is [`src/seed.ts`](src/seed.ts). Sample data is global and contains no project knowledge.

## Runtime, storage and security

- Node.js + TypeScript local CLI and web server.
- SQLite WAL with revision history and optimistic concurrency.
- MCP stdio server (minimal protocol implementation), two startup adapters, optional approved tool bridge.
- Web UI bound to **127.0.0.1**, using browser-origin checks.
- SQLite is stored at `~/.personal-brain-style/brain.sqlite`, or under `$PB_HOME` if set.
- The Trace Explorer stores metadata and explicit compliance submissions; see [docs/TRACE.md](docs/TRACE.md).
- No cloud sync, project data, codebase indexing, autonomous retraining, or additional agent harness.

**Important:** Local application checks do not create an OS sandbox. Approved external MCP tools execute with the permissions of the configured local process. Do not expose this server to the internet.

## Development and quality checks

```bash
npm install
npm run build:ui
npm test
```

The UI is authored in `web/app.ts` and distributed as compiled `public/app.js`. The TypeScript server starts directly using the version-aware launcher in `scripts/run.mjs`.

Tests include: SQLite persistence, revisions, idempotent sample import, automatic hook selection, real CLI hook invocations, MCP handshake and tool calls, versioned reverse tracing, privacy checks, local trace API, demo-vs-real metrics, and UI help definitions.

No live Anthropic/OpenAI CLI task was executed during package development; your local installation must verify actual CLI interaction.

## Architecture

```text
Claude Code / Codex CLI
    |                  \\
Startup / Prompt Hooks   MCP stdio
    |                      |
    +-------- Personal Brain Core -------+
             | Skills / Style            | Trace events
             | Version history           | Feedback
             +---------------------------+
                     SQLite WAL
                        |
                     Web UI
                 Trace Explorer
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the original design notes and [docs/TRACE.md](docs/TRACE.md) for the new telemetry model.

## License

MIT. See LICENSE.

## Sky blue style studio

My Styles includes eleven draft recipes for drawing, writing, thinking, architecture, technology selection, UI design, coding and review. Restart the updated server to import samples automatically, open **My Styles**, expand a worked example, then edit and activate a recipe. Existing rules and revisions are preserved. See [all eleven worked examples](docs/MY-STYLE.md) and the [architecture walkthrough](docs/ARCHITECTURE.md#complete-example-edit-discover-and-verify-a-style).

## Starting with your own records

Libraries use paginated tables. Automatic sample imports are disabled. On the first start of this update, untouched bundled records are archived and demo traces are removed. Personal records and edited samples remain. Revision history is retained.

## Project-scoped working styles

The app opens on Projects. Create reusable records in Library, select records per project, and optionally override their instructions. The effective configuration shows project selections, overrides and required dependencies. Agents select scope with projectId or PB_PROJECT_ID; browser navigation never changes agent sessions. See [the project guide](docs/PROJECTS.md) for configuration, precedence, conflicts and limitations.

### Automatic refresh during development

`npm start` builds the UI, watches `web/` TypeScript, and runs the backend with Node's native watch mode. Backend source changes restart the HTTP server; changes to compiled JavaScript, CSS or HTML reload open browser pages within about a second. The URL preserves the current view. If you have typed on the page, a reload button appears instead of discarding edits automatically. Failed UI builds remain visible in Terminal.

Stop with Ctrl+C. Use `npm run start:stable` for the previous non-watching server. After updating the start script, stop the existing server and run `npm start` once. This watches the web server, not separately running agent MCP sessions. Node.js 22.13+ and installed development dependencies are required.

If setup previously registered Node 18, run `bash scripts/activate-personal-brain.sh --repair`. The installer now selects a supported runtime before changing settings (PATH Node, installed nvm versions, then common system paths). `PB_NODE=/absolute/path/to/node` explicitly selects a runtime and is validated. Repair replaces only personal-brain MCP entries whose output identifies this installation's runner, then installs hooks with that same Node path. Other entries remain unchanged. Restart agent sessions afterward.

See [compliance review](docs/COMPLIANCE.md) and the [workspace audit](docs/WORKSPACE-AUDIT.md) for evidence limits and design decisions.

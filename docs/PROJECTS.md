# Projects and the shared library

Projects hold working preferences, not repository contents or business data.

## Workflow

1. Open Library. Choose Style, Skill, Template or Review, and create a record in the appropriate capability. Templates are reusable document outlines, code scaffolds or prompt starters; their stored kind remains `example`.
2. Save the record as Active when ready for agents.
3. Open Projects → New Project. Enter its name and description.
4. Select active library records. In a combinable capability (all nine release-catalog capabilities) you may select several records of the same type. In a Pick one capability choose at most one record per type; conflicts return an error and retain the form.
5. Optionally enter project-only instructions beside an assigned record. Leave blank to inherit the shared instructions. Review checks stay in the shared record.
6. Save. The project page displays the effective instructions and their source: Project override, Project selection or Required dependency.

A project uses only explicit selections and their transitive required dependencies. An empty project has no applicable records. Global defaults apply only when no project ID is supplied. Required dependencies use their shared content unless explicitly overridden in the project; conflicting records in the same type slot of a Pick one capability produce an error. Arbitrary natural-language contradictions are not automatically detected. A project-only override replaces the selected record's content, without changing the library.

Projects reference the latest active record version. If a selected record is archived, or edits introduce a slot conflict in a Pick one capability, scoped retrieval fails with an actionable error. Configure the project to repair it. Project updates use expectedVersion to reject stale saves.

## Agent scope

The browser's selected project never changes agent scope.

Use brain_projects to find the project UUID. Pass projectId on every scoped brain_bootstrap, brain_discover, brain_get, brain_style and brain_review call. Tool execution remains subject to existing backend authorization.

For hooks and an MCP process dedicated to a project, set PB_PROJECT_ID to that UUID in the process environment. For example:

    PB_PROJECT_ID=<project-uuid> codex
    PB_PROJECT_ID=<project-uuid> claude

The variable must reach the hook/MCP child process. A separate already-running MCP process may need its own environment configuration or restart. Without a project ID, retrieval uses global defaults. An invalid project ID returns an error rather than switching silently to global instructions.

## Storage and boundaries

SQLite stores projects separately from shared records. Project snapshots include assignments, optional content overrides and an optimistic concurrency version. Existing record revision history is unchanged. JSON export includes projects; SQLite backup includes the full database.

Repository mappings use the nearest .personal-brain.json in the working folder or its parents. Project versions protect updates but do not provide a project-history restore UI. Trace record IDs and versions describe library records; a library version alone does not identify an overridden project's exact content.

## Linked agent conversations

Click a project row or its title to open details. Project lists show linked conversation totals and recently active counts. The details panel lists agent, thread ID and last-seen time, with a refresh action. “Recently active” means a successful/emitted event within 15 minutes; it is not a live connection or running-process guarantee.

Hooks attach PB_PROJECT_ID and the host session/thread ID to telemetry. Scoped MCP calls accept optional `threadId`; pass the actual host conversation ID when available. Matching agent/thread IDs deduplicate hook and MCP events. Calls without that ID are listed separately, never counted as conversations. Demo events, failed calls and events belonging to other projects are excluded. The panel shows the latest 100 conversations; totals cover all retained events. Historical events without project attribution cannot be assigned retrospectively.

Restart the HTTP server and existing MCP processes after this update. Hook executions load the updated code on their next invocation. This adds metadata only; conversation text is not stored.

## Automatic repository scope

Use Link repository on the project detail page, with an existing absolute folder path. This creates `.personal-brain.json` containing `projectId`; it never replaces a different existing link. This repository is linked to the Personal Brain project.

Resolution order: explicit MCP projectId, PB_PROJECT_ID, nearest repository configuration walking upward, then global defaults. Malformed/unreadable configuration and unknown project IDs fail explicitly. Hooks use the host payload cwd; MCP uses its process working directory or an explicit cwd argument. Hook startup context tells the agent to pass the detected project ID on later MCP calls, covering clients whose MCP process starts elsewhere. Start a new agent session after installing the updated integration.

Test connection resolves the folder's configuration and active project records locally. It does not establish a live agent connection; use observed project activity for that evidence. The initial MCP/hook setup is still required once.

# Project discovery and installed skills

## Lazy record discovery

In any style, skill, template, review or tool editor, expand **Discovery**. Use **Search tags / keywords** for task vocabulary and **Use when** for a short description of applicable work. These fields are saved with the record's version and can also be changed through project-scoped MCP updates. Project updates preserve the shared original.

Startup supplies a bounded index with usage guidance and keywords, not instruction bodies. Task hooks can match custom capabilities through record metadata; they are not limited to built-in topic names. `brain_discover` ranks title, keywords, usage conditions and summary above full-text matches. Referenced skill names and embedded examples/review criteria are also searchable through their owning record. Matching is lexical, not a guarantee of semantic relevance; add the terms you actually use in requests.

Use `brain_get` to load matched records and their transitive required links even when those dependencies have no matching keyword. External skill bodies remain on-demand through `brain_get_installed_skill`. Reuse loaded instructions only for the same record ID, version and project scope. Scoped discovery includes selected records and required links; private records cannot appear globally or in another project.

Existing records receive capability-based keyword suggestions and usage guidance once, preserving content, scope, status and revision history. Later edits are not overwritten. Installed external SKILL.md files are not modified; their references remain attached to the owning records. New records without supplied usage guidance receive a capability-based default; the editor can override it.

## Repository and skill inventory

Open a project and choose **Discover styles & skills** to inspect selected styles, the repository source index, installed skills and findings. The dialog provides an agent instruction for personalizing those existing styles. It does not create a generic draft or require a new capability.

On SessionStart, installed Claude/Codex hooks and the OpenCode plugin direct the agent to inspect repository evidence and amend applicable selected styles before substantive work. The hook does not interpret source or write styles itself. Restart the agent/MCP connection after updating server code. Existing generic drafts are preserved but no longer automatically created.

The agent workflow is:

1. Call `brain_discover_project` with explicit `projectId`. Read the returned workflow, current project version and selected-style IDs/versions.
2. Page the source index with `fileOffset`; request up to eight representative source, test, configuration or ADR files with `files`. Default evidence includes root instructions, README and common package/build manifests. Each evidence item contains its path, content and SHA-256 digest.
3. Load applicable selected styles with `brain_get`. Extract established conventions with source evidence. Respect explicit ADR amendments over superseded decisions; preserve personal edits and flag unresolved conflicts rather than silently replacing them.
4. Call `brain_update_project_style` with current versions, amendments in `changes`, `sourceFiles: [{file, digest}]` and `conflicts: []` only after resolving conflicts. The server rejects changed evidence and reported conflicts and records source citations. Shared records become project-private copies; private records update in place. Dependency ancestors are rewired within the project. Unchanged updates create no copy or revision.
5. Refresh discovery after each update because IDs and project version may change. Report amendments, evidence and unresolved findings. Amended styles remain active and selected; no separate draft activation is required.

`createDraft` is a deprecated compatibility argument: it returns a finding but never creates a draft. Discovery itself is read-only. Semantic analysis is performed by the calling agent, not a background model in Personal Brain; the server cannot prove an agent's claimed conflict resolution.

Repository traversal is capped at 10,000 entries and depth 12, with 200 indexed paths per page, 64 KiB per evidence file and 100,000 characters per response. Symlinks, generated/dependency directories and secret-like paths are excluded. This is not a complete secret detector: ordinary source files can contain sensitive text. No repository commands run. Scan issues and truncation are explicit.

Installed skill metadata is read from project `.agents/skills`, `.codex/skills`, `.claude/skills`, global `~/.agents/skills`, agent `~/.codex/skills`, `~/.claude/skills` and agent plugin caches. Skill paths are deduplicated and scanning is bounded. No skill commands or installers run.

Skill bodies are not injected at startup. `brain_get` includes availability and skill IDs for its external references and required dependencies. Use `brain_get_installed_skill` with explicit `projectId` and an inventory ID to read applicable full instructions on demand. This loads SKILL.md only; supporting resources remain relative to its reported location. A skill being installed does not prove that it was used or that its tools are operational.

Missing references and ambiguous differing installations are highlighted. Project installations take precedence; identical copies are not conflicts. Discovery reports invalid selections (for example, two styles selected in a Pick one capability) and skill-reference findings. Combinable capabilities allow several selected styles. It cannot prove that arbitrary natural-language instructions are compatible: review semantic contradictions before applying amendments. Scan failures and limits appear in findings; inventory is not a guarantee of complete host configuration coverage.

## Deleting and resetting

Capabilities, library records and projects have a Delete action with an affected-data preview. Confirmation permanently removes owned records, their revisions, feedback and related traces, and removes their links and project assignments. Shared dependencies referenced by a deleted record are preserved. If data changes after preview, open a fresh preview before confirming.

In a project's **More** menu, **Reset styles** removes all private styles and instruction overrides. It restores shared selections saved before the first customization; older projects without that snapshot retain their current shared selections. The preview lists the selections to restore. Reset pauses automatic repository-personalization reminders; explicit agent discovery remains available. Project deletion leaves repository files untouched: remove its `.personal-brain.json` marker from linked repositories separately.

## Graph and context estimates

Dependency maps start with style relationships in 2D. Select a node to highlight its links and inspect its skills, review criteria and examples. **Show all content nodes** expands these into the graph. Use 3D, zoom, fit and dragging as needed; rearranging nodes does not change saved dependencies.

Trace Explorer and project conversation activity estimate emitted hook context tokens using characters divided by four. These figures measure recorded context only, not actual model input, output, cache usage or billing. Exact task token totals require usage reports from the agent host, which these integrations do not currently supply.

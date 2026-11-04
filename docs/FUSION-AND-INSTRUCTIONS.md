# Fusion and task instructions

Research and implementation review: 4 November 2026.

## Product boundary

Personal Brain manages reusable working instructions. Fusion learns proposed changes from the effective styles selected by projects; it does not infer successful practices from code changes, agent traces, or test outcomes. Repository personalization is a separate workflow that supplies source evidence for private styles.

Fusion is a proposal workflow. A person reviews and publishes each change. The service cannot establish that an agent's generalization is correct merely because its JSON is valid.

## Research decisions

| Primary reference | Relevant pattern | Decision for Personal Brain |
| --- | --- | --- |
| [Agent Skills specification](https://agentskills.io/specification) | Discovery metadata and progressive loading of instructions/resources | Keep compact discovery, then load the applicable full instructions and external skills on demand. |
| [Microsoft APM lockfile specification](https://microsoft.github.io/apm/reference/lockfile-spec/) | Explicit resolved dependency identity and versions | Bind task review to effective instruction content and project versions; reject stale evidence rather than silently reviewing new rules. This is a local fingerprint, not an APM lockfile implementation. |
| [Spec Kit quickstart](https://github.github.com/spec-kit/quickstart) | Constitution, analysis and staged quality checks | Reconcile requirements before implementation and record evidence before completion. Keep automated checks distinct from subjective review. |
| [Rulesync](https://github.com/dyoshikawa/rulesync) | Shared instruction configuration across coding agents | Preserve one scoped instruction model for Codex and Claude, without adding another configuration framework to this app. |

These sources describe useful patterns, not proof that Personal Brain implements all of those products' capabilities. The changes below address observed defects in this repository.

## Fusion workflow

1. Select projects and Codex or Claude on the Fusion page. The CLI must already be installed and authenticated.
2. Analyze effective, active project instructions and their selected/required skill, review and example records. Unselected private records are excluded. Each source retains its project context, effective override, record ID and version. Reusing one shared record in several projects is not independent evidence.
3. Review the rationale, cited sources, current/proposed content, supporting fields and conflicts. The page refreshes running status automatically. Cancel an analysis or reject individual proposals when appropriate.
4. Publish accepted proposals one at a time. Publication checks source project versions, source instructions and the shared target version again. A changed source or target requires a new analysis.
5. A published proposal creates a new shared-style revision. Projects consuming that shared style receive the revision; private copies remain unchanged. Publication and the decision record commit together or roll back together.

Fusion preserves structured requirements, deterministic checks and required record links. It also preserves existing required external-skill references and review criteria. New skill references must already appear in the target or cited sources; this does not prove that a skill is installed or appropriate. Removing existing mandatory guidance requires a separate deliberate style edit.

Unresolved conflicts block publication. Old analyses without project-context provenance cannot be published; rerun them. Deleting/resetting a project, or deleting referenced records, removes associated Fusion snapshots and prepared task sets. A finishing analysis cannot recreate deleted history.

Limits are explicit: at most 30 projects, 300 active shared targets, 500,000 input characters, 20 proposals, 1 MB agent output and five minutes per analysis. Oversized inputs fail rather than being silently truncated. Fusion currently updates existing shared styles; creating a new style remains a Library action. It does not auto-install skills or automatically publish changes.

## Agent instruction workflow

Restart existing MCP clients after upgrading so they discover `brain_prepare`.

1. Resolve the project and call `brain_discover` for the actual task. Select applicable record IDs from that project.
2. Call `brain_prepare` with `projectId`, a concise `task`, and 1–20 applicable `recordIds`.
3. Read the returned full records, transitive required dependencies and requirement checklist. Read the relevant external skills separately. Resolve conflicting instructions and missing skills before proceeding.
4. Implement and verify the deliverables.
5. Call `brain_review` with the same `projectId`, returned `instructionSetId`, repository-relative `artifacts`, and version-bound checklist `evidence`.

Example tool arguments:

```json
{"projectId":"your-project-id","task":"Implement and verify the requested API change","recordIds":["selected-style-id"]}
```

```json
{"projectId":"your-project-id","instructionSetId":"returned-set-id","artifacts":["src/example.ts"],"evidence":[]}
```

The second example has no manual evidence, so it must not be treated as complete compliance. Supply actual evidence using the tool's schema. The review rejects another project's set, a different task/scope, changed project selections, changed overrides, or changed dependency content/version. Prepare a fresh set and re-review after changes.

Legacy `brain_review` calls with task/recordIds still work; they do not provide this preparation-time freshness guarantee. The read-only ChatGPT connector does not expose the write-capable preparation/review flow. Its existing discovery/get workflow remains available.

## Data and honest guarantees

Prepared sets store a task summary, project and record IDs, project version, timestamp and content digest locally. They do not store artifact contents. Fusion stores instruction snapshots and proposals locally and sends selected effective instructions plus shared targets to the chosen CLI provider. Do not place secrets in styles or task summaries. CLI stderr is not persisted in Fusion errors.

The service can verify input scope, versions, dependency resolution, structured constraints and the deterministic checks it actually runs. It cannot force a host agent to call a tool, prove that the agent read a skill, choose every relevant style for a task, or independently verify semantic/visual correctness. Agent-reported passes remain distinct from verified results. Human review is still necessary before publishing generalized instructions.

## Verification for this change

The repository suite completed with 115 passing tests and two environment-blocked HTTP listener tests (`listen EPERM: 127.0.0.1`). Coverage includes project overrides, linked evidence, stale publication, protected skills/criteria, transaction rollback, cancellation, deletion cleanup and prepared instruction freshness/isolation. CLI lifecycle tests use local fixture executables rather than paid provider requests.

A subsequent focused UI run passed all 30 tests, including polling that preserves the running form and stops after navigation. The UI TypeScript build and packed installation/CLI/MCP initialization/clean-workspace smoke test passed. The live Firefox Fusion page was inspected for navigation, comparison panels and disabled published/conflicting actions. Authenticated Codex/Claude analysis, narrow-screen and complete keyboard testing were not performed in this change. These results are dated evidence, not a promise about later revisions.

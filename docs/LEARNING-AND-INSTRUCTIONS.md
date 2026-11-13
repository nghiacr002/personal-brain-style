# Learning and task instructions

Research and implementation review: 4 November 2026.

## Product boundary

Personal Brain manages reusable working instructions. Learning from projects proposes changes from the effective styles selected by projects; it does not infer successful practices from code changes, agent traces, or test outcomes. Repository personalization is a separate workflow that supplies source evidence for private styles.

Every learning source is a proposal workflow. A person consents to each change. The service cannot establish that an agent's generalization is correct merely because its JSON is valid.

## Research decisions

| Primary reference | Relevant pattern | Decision for Personal Brain |
| --- | --- | --- |
| [Agent Skills specification](https://agentskills.io/specification) | Discovery metadata and progressive loading of instructions/resources | Keep compact discovery, then load the applicable full instructions and external skills on demand. |
| [Microsoft APM lockfile specification](https://microsoft.github.io/apm/reference/lockfile-spec/) | Explicit resolved dependency identity and versions | Bind task review to effective instruction content and project versions; reject stale evidence rather than silently reviewing new rules. This is a local fingerprint, not an APM lockfile implementation. |
| [Spec Kit quickstart](https://github.github.com/spec-kit/quickstart) | Constitution, analysis and staged quality checks | Reconcile requirements before implementation and record evidence before completion. Keep automated checks distinct from subjective review. |
| [Rulesync](https://github.com/dyoshikawa/rulesync) | Shared instruction configuration across coding agents | Preserve one scoped instruction model for Codex and Claude, without adding another configuration framework to this app. |

These sources describe useful patterns, not proof that Personal Brain implements all of those products' capabilities. The changes below address observed defects in this repository.

## The learning loop

Personal Brain improves your styles through one loop on the **Learning** page: **Learn → Feedback → Consent → Reuse**.

- **Learn.** Agents relay corrections and your explicit remember/forget requests while they work (`brain_feedback`, `brain_remember`, `brain_forget`); you can type a correction yourself; and Personal Brain automatically compares projects whose styles were customized.
- **Feedback.** Each proposed change becomes one item with its source (_From agent_, _From you_, _From your projects_), evidence, word diff and warnings.
- **Consent.** Nothing changes until you apply an item. You can dismiss it (it is not suggested again), apply it to one project only where allowed, or apply it to the shared style. Every apply creates a new style version that History can restore.
- **Reuse.** Agents receive the approved version on their next task; their corrections start the loop again.

### Learning from projects

1. Comparison is automatic. It is off until you turn it on: the first time you open **Learning**, the page asks once and stores your answer (change it later under Settings). When on, while the app is running, it checks every two minutes whether any project's customized styles (private copies or overrides) changed since the last comparison. If so, it asks Codex (or Claude, or the agent chosen in Settings) to compare them; if nothing changed, or projects use shared styles unchanged, no agent is called. Turn this off, pick the agent, or exclude projects under Settings; **Compare now** forces a comparison. The Codex or Claude CLI must be installed and signed in.
2. Analyze effective, active project instructions and their selected/required skill, review and example records. Unselected private records are excluded. Each source retains its project context, effective override, record ID and version. Reusing one shared record in several projects is not independent evidence.
3. When the analysis finishes, each proposal is added once, marked _From your projects_ (filter by source to see only these). The page's status card shows a running comparison and can stop it. Each item shows the rationale, a word diff of the content, cited sources, the other fields it rewrites, and conflicts.
4. Apply or dismiss proposals one at a time or in bulk. Applying runs the same checks as every item (dropped obligations, regression fixtures), then re-checks source project versions, source instructions and the shared target version. A changed source or target requires a new analysis. These items cannot be applied project-only, edited or consolidated.
5. An applied proposal creates a new shared-style revision. Projects consuming that shared style receive the revision; private copies remain unchanged. The style update and both decision records commit together or roll back together.

Project analysis preserves structured requirements, deterministic checks and required record links. It also preserves existing required external-skill references and review criteria. New skill references must already appear in the target or cited sources; this does not prove that a skill is installed or appropriate. Removing existing mandatory guidance requires a separate deliberate style edit.

Unresolved conflicts block Apply. Old analyses without project-context provenance cannot be published; rerun them. Deleting/resetting a project, or deleting referenced records, removes associated project-analysis snapshots and prepared task sets. A finishing analysis cannot recreate deleted history.

Limits are explicit: at most 30 projects, 300 active shared targets, 500,000 input characters, 20 proposals, 1 MB agent output and five minutes per analysis. Oversized inputs fail rather than being silently truncated. Project analysis currently updates existing shared styles; creating a new style remains a Library action. It does not auto-install skills or automatically publish changes.

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

Prepared sets store a task summary, project and record IDs, project version, timestamp and content digest locally. They do not store artifact contents. Learning from projects stores instruction snapshots and proposals locally and sends selected effective instructions plus shared targets to the chosen CLI provider. Do not place secrets in styles or task summaries. CLI stderr is not persisted in learning from projects errors.

The service can verify input scope, versions, dependency resolution, structured constraints and the deterministic checks it actually runs. It cannot force a host agent to call a tool, prove that the agent read a skill, choose every relevant style for a task, or independently verify semantic/visual correctness. Agent-reported passes remain distinct from verified results. Human review is still necessary before publishing generalized instructions.

## Verification for this change

The repository suite completed with 115 passing tests and two environment-blocked HTTP listener tests (`listen EPERM: 127.0.0.1`). Coverage includes project overrides, linked evidence, stale publication, protected skills/criteria, transaction rollback, cancellation, deletion cleanup and prepared instruction freshness/isolation. CLI lifecycle tests use local fixture executables rather than paid provider requests.

A subsequent focused UI run passed all 30 tests, including polling that preserves the running form and stops after navigation. The UI TypeScript build and packed installation/CLI/MCP initialization/clean-workspace smoke test passed. The live Firefox project-analysis page was inspected for navigation, comparison panels and disabled published/conflicting actions. Authenticated Codex/Claude analysis, narrow-screen and complete keyboard testing were not performed in this change. These results are dated evidence, not a promise about later revisions.

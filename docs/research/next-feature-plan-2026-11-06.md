# Next feature: preview preferences for a task

Recommendation: build a task preference preview before adding synchronization or more integrations. It should answer: **“For this task, which of my preferences apply, why, and what still needs a decision?”** This directly supports “your working preferences, applied consistently across AI tools.” This document is a proposal; no feature implementation is authorized by the research request.

## Evidence and confidence

Research date: 2026-11-06. Sources are current official documentation plus this repository. This is a product judgment based on implementation readiness and the recent user workflow, not a market survey or measured customer demand.

| Observation | Evidence | Implication |
|---|---|---|
| Persistent instructions already exist in host tools. Cursor offers global, project, automatic, file-specific and manual rules. | [Cursor rules](https://cursor.com/help/customization/rules) | Another generic rule editor offers limited differentiation. Make applicability understandable across the existing integrations. |
| Claude documents instruction-size costs, conflicting instructions, inspection and prompt audits; instruction loading does not guarantee adherence. | [Claude memory and instructions](https://code.claude.com/docs/en/memory) | Show effective scope and unresolved choices. Avoid a misleading “AI will comply” badge. |
| OpenCode documents local/global rule lookup and precedence, including AGENTS.md versus CLAUDE.md behavior. | [OpenCode rules](https://opencode.ai/docs/rules/) | Host behavior differs; distinguish Personal Brain resolution from everything a host may independently load. |
| Personal Brain already resolves conditional guidance, structured choices, checklist items and provenance. HTTP and MCP expose it. | `src/instructions/resolve.ts`, `src/server/http.ts`, `src/agents/mcp.ts` | Reuse the shared resolver. No second rules engine is needed. |
| The current discovery UI renders a raw JSON result and does not call the preference-resolution endpoint. | `web/app.ts`: `discover()` and discovery action; source search for `/api/preferences/resolve` | The valuable backend behavior has no approachable task workflow. |
| Retrieval remains imperfect. | Current run of `tests/instruction-quality.test.ts`: 23/30 expected styles in top three, seven misses | Candidates must be editable. Never imply that the first suggestions are the complete requirement set. |
| Feedback, Fusion, library transfer and private/global comparisons already exist in some form. | Current UI/source and README; implemented earlier in this conversation | Extend those foundations later instead of introducing duplicate concepts now. |

Confidence: high that the UI gap exists and the resolver can support the core workflow; medium that this is the highest-value next feature. No usability interviews, competitor hands-on trials, retention metrics or model-output comparison were performed.

The retrieval benchmark uses 30 authored synthetic prompts and is not a general quality score. This run passed its existing 22/30 regression floor; it does not prove improved user outcomes. The quality guide still describes the older 22/30 baseline, and parts of README describe earlier catalog counts/relationships. Correct those specific stale descriptions when shipping the preview.

## Ranked options

These priorities are judgments, not measured scores. Effort assumes one developer familiar with the code and includes focused tests, not release certification.

| Rank | Feature | User benefit | Effort | Decision |
|---|---|---|---|---|
| 1 | Task preference preview | Understand and correct what applies before work starts | Medium: roughly 3–5 development days | Build next |
| 2 | Review a correction as a preference change | Turn repeated feedback into an explicit, versioned proposal with accept/reject | Medium–large | Follow preview; reuse existing Feedback/Fusion, do not silently learn from every conversation |
| 3 | Save reusable selection presets | Reuse a small bundle of preferences across projects | Small–medium | Later; first determine whether current project selection/defaults already solve the need |
| 4 | Native instruction-file export | Use selected preferences in another tool without a live MCP connection | Medium | Later; require explicit scope, owned files and drift handling so exports do not become competing sources of truth |
| 5 | Cross-machine library synchronization | Keep multiple installations aligned | Large | Defer; selective transfer now covers the basic need, while synchronization adds conflict/deletion/identity policy |
| Alternative | Pause feature work and improve retrieval only | Reduce missed and unrelated suggestions | Small–medium initially | Keep a measured maintenance track; do not replace the preview with opaque ranking changes |

## MVP user flow

1. Open a project and choose **Preview task preferences**. Reuse the existing Style discovery page, upgraded to this workflow; preserve old diagnostic links.
2. Enter the task, choose its activity and intended output formats. Missing values stay visibly unspecified; an empty formats list deliberately means no format-specific artifact is requested.
3. Search for candidate preferences within the project. Each candidate shows a short matching reason. Select or remove candidates explicitly; allow browsing all active project preferences when search misses one. Separate selected roots from included dependencies. Start with no implicit final selection.
4. Choose **Preview**. Call the existing resolver with selected root IDs and context. Display:
   - Effective preferences, their versions and source (global or project-private).
   - Why linked guidance applies, is excluded or needs more context.
   - Resolved structured values and the source of each decision.
   - Conflicting values and explicit task choices to resolve them.
   - Required outcomes/checks separately from optional procedure references.
5. Adjust a task choice and preview again. These are temporary choices for this task; the preview does not edit the library or project assignments.
6. Copy the resulting checklist, including scope, versions and unresolved warnings. Link to the relevant library item if the user chooses to change a persistent default.

Example: a project includes Draw.io and Mermaid defaults. The preview reports the conflict. Choosing Mermaid as the task's `diagram.format` resolves it, displays the overridden Draw.io criteria as excluded, and leaves unrelated mandatory checks intact. Merely typing “Mermaid” in the task is not treated as an authoritative structured choice.

## Boundaries

- The UI previews **Personal Brain’s** effective instructions, not the host's entire context or system prompt.
- No agent/model execution, new external calls, task-history database, cloud account or automatic library mutation in the MVP.
- No arbitrary prose conflict solver. Show structured conflicts and explain the limit.
- No promise that a host follows a previewed instruction. Avoid “compliance passed” wording.
- Show bindings and fallback text without claiming installation or execution. A later host comparison may reuse actual installed-skill discovery and existing read-only capability profiles.
- No new dependency or major frontend framework. Reuse current fields, cards, checkbox selectors, inline errors and responsive layout.
- Keep backend resolution and existing MCP behavior authoritative. A preview must not bypass project scope or waive unconditional requirements.

## Implementation sequence

### 1. Freeze the preview contract and scenarios

Reuse `resolveInstructions`, its HTTP endpoint, project-scoped discovery and the existing context validator. Define a TypeScript response type shared where practical. Return stable machine-readable reason codes only if the UI cannot reliably present existing fields; do not derive authority by parsing prose.

Resolve a presentation edge case first: `guidance` is a traversal/event list and may contain both an earlier applicable event and a later format exclusion for the same record. The final result must display one unambiguous effective status, retaining provenance without contradictory badges.

Add read-only endpoint assertions and fixtures for ordinary work, planning, conditional documents, format conflicts, private precedence and missing context. Do not change ranking in this slice.

### 2. Build the project task preview

Reach: `web/app.ts`, `public/index.html`/`public/style.css` if necessary, generated `public/app.js`, and existing project/discovery navigation.

Add the project entry point, task/context inputs, candidate checkboxes, dependency explanations, results and copy action. Use plain-language activity/format labels mapped to the existing contract. Support explicit key/value overrides through a small advanced control instead of a raw JSON textarea.

Preserve inputs on validation errors. Switching projects clears incompatible selections and results. Abort or ignore old requests so a slow response cannot replace a newer preview. Changing task/context/selection marks the displayed result out of date until rerun. Do not persist raw task text or put it in URLs.

### 3. Verify and document

Reach: `tests/preference-boundary.test.ts`, `tests/style-ui.test.mjs`, HTTP/MCP tests where shared behavior changes, README and `docs/INSTRUCTION-QUALITY.md`.

Run focused tests, the full regression suite, UI build and package build. Inspect desktop and narrow layouts, keyboard operation, labels, errors and long preference titles. Confirm the same explicit task/context/roots give the same effective records through HTTP and MCP. Update documentation with the current benchmark, retaining its historical baseline.

## Acceptance criteria

| ID | Observable result |
|---|---|
| TP-01 | Preview calls create no records, revisions, assignments or prepared instruction sets. |
| TP-02 | Candidates and resolution cannot retrieve another project's private records or unselected records. |
| TP-03 | Missing required context stays unresolved; a known mismatch is visibly not applicable. |
| TP-04 | Conflicting same-level values remain conflicts until an explicit task choice resolves them; ranking cannot decide precedence. |
| TP-05 | Project-private structured preferences override global defaults, and each decision displays its source/version. |
| TP-06 | Optional procedures never appear as required checks; unconditional requirements cannot be removed by unchecking a dependency. |
| TP-07 | Final status is coherent for records encountered through several links or excluded by a format choice. |
| TP-08 | HTTP and MCP resolution agree for the same inputs; unsupported host actions are never presented as available. |
| TP-09 | Project switches and out-of-order requests cannot display stale results as current. |
| TP-10 | Copy output includes task scope, record versions and unresolved conditions; it does not claim successful execution. |
| TP-11 | Empty results, invalid input, long titles and keyboard-only interaction remain usable at desktop and 360px width. |
| TP-12 | Existing discovery links and the retrieval benchmark remain functional; no incidental ranking regression. |

## Success measurement and follow-up

First evaluate a small, predefined set of real workflows locally: routine bug fix, planning only, a diagram format override, document-specific guidance and an unavailable optional skill. The user should be able to explain why a preference was included or excluded and find an unresolved choice without reading JSON. Record completion and confusion points manually; no telemetry is needed.

After the preview is useful, add a correction workflow: select a record/version, describe the desired behavior, inspect a proposed diff and approve a versioned update. Decide separately whether that workflow needs an optional model call. Do not fold it into this MVP.

Revisit synchronization only when repeated manual transfers across machines are an observed problem. Revisit native export when a specific unsupported host is requested. Revisit ranking with held-out tasks and explicit irrelevant-task labels, not by tuning only to the existing 30 examples.

## Verification of this plan

Source inspection confirmed the resolver, endpoints, current discovery UI and capability limitations. Graph coverage was checked; stale/missing and excluded paths were read directly, including the partial UI parse range. The current retrieval benchmark was rerun successfully: 23/30 hit@3. Official source pages above were opened on the research date. This was self-review, not an independent product study. Only this planning document was added; existing uncommitted implementation work was preserved.

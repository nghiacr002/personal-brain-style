# Personal Brain: preferences boundary audit and implementation plan

Personal Brain should retain its storage, project isolation and delivery foundations, while separating personal expectations from procedural guidance. The first implementation should establish task applicability and a small preference-focused catalog pilot, rather than rewrite the product or migrate every record at once.

Date: 2026-11-06. Baseline: `f86c2fd`, package `1.3.0-beta.3`. Audience: product owner and implementer. Status: proposal for discussion; application changes have not been implemented. Product premise agreed with the user: **Your working preferences, applied consistently across AI tools.**

## Decision criteria and scope

Judge the design on preference portability, relevance to the actual task, explicit precedence, preservation of user edits, understandable delivery evidence, and maintenance cost. Consistent delivery is testable; identical model behavior is not guaranteed.

This audit covers record modeling, catalog content, project customization, discovery, dependency expansion, preparation, skill resolution, MCP delivery, hooks, review and Fusion. UI findings are from source, not rendered inspection. It is a bounded product-boundary review, not a complete security or architecture audit.

Evidence is current repository source and a focused test run. The graph generation is dated 2026-11-03 and still references pre-reorganization paths. Coverage reported current paths as untracked or changed; relevant source was read directly. No exhaustive caller claim relies on that graph. The earlier [product research](product-improvements-2026-11-05.md) is context, not current validation of its external claims.

## Intended boundary

| Information | Home | Example |
|---|---|---|
| Desired outcome or working preference | Personal Brain | Lead with the decision; keep diagrams editable; prefer small complete changes |
| Explicit tool preference | Personal Brain, separately from execution steps | Prefer Draw.io for architecture diagrams unless the task requests another format |
| Tool operation and technical procedure | External skill | Construct valid mxGraph XML; invoke the renderer; run structural lint |
| Reusable document shape | Template reference or template record | Sections of an ADR, activated when an ADR is requested |
| Repository facts | Repository evidence | Framework version, deployed services, schema |
| Repository convention | Project-scoped preference with evidence | This project uses its configured formatter |
| Current deliverable and exception | Task scope | For this task, provide Mermaid rather than Draw.io |
| Proof of a check | Review/activity record | Parser succeeded; visual inspection not performed |

A preference may legitimately describe process: “read callers before changing a shared function” expresses a working expectation. The boundary is not “ban every method section.” Move renderer syntax, command recipes and lengthy generic tutorials out; retain the user's meaningful constraints and quality criteria.

## Existing foundations to preserve

- [Record storage and scoping](../../src/core/database.ts): project-private copies, explicit assignments, transitive required links, cycle checks, transactional edits and optimistic version checks.
- [Preparation](../../src/instructions/instruction-set.ts): task/project binding, effective-record digest and stale-set rejection. Extend this rather than adding a second instruction engine.
- [Hooks](../../src/agents/hooks.ts): compact indexes rather than unconditional full bodies.
- [Skill discovery](../../src/projects/skill-discovery.ts): external references, bounded reads, digest-based ambiguity reporting and project-installation precedence.
- [Artifact review](../../src/instructions/artifact-review.ts): agent claims remain unverified; file presence does not prove semantic correctness or editability.
- [Fusion](../../src/instructions/fusion.ts): source evidence, conflict rejection, explicit publishing and version checks.

## Findings, ordered by product impact

These are gaps against the proposed product boundary, not all regressions against the existing contract. No security blocker or data loss was established by this audit.

| ID / priority | Observed evidence | Consequence and proposed response |
|---|---|---|
| F1 / Major | The [catalog](../../src/styles/global-style-catalog.ts) stores extensive procedures in preferences. Draw.io includes cell IDs, mxGeometry and routing recipes; development and QC include full workflows. | Content competes with installed skills and creates two maintenance locations. Pilot concise outcomes, constraints and criteria with external procedure references. |
| F2 / Major | [requiredRecords](../../src/core/database.ts) expands all required IDs. [requirementChecklist](../../src/core/requirements.ts) adds every criterion and external skill reference. Conditions exist inside prose. Development transitively reaches QA and its test-document template. | Loading a useful preference also loads work that may not apply. Distinguish always-required invariants from conditional supporting guidance; resolve applicability before producing mandatory checks. |
| F3 / Major | [prepareInstructions](../../src/instructions/instruction-set.ts) explicitly asks the agent to resolve contradictions. Model fields provide free text, priorities and IDs, but no general structured preference decision. Project text overrides replace content while other fields persist. | Structural conflicts are checked, semantic contradictions are not. Provide provenance and explicit decisions for known conflicting preferences; do not pretend arbitrary prose conflicts can be solved deterministically. |
| F4 / Major | [rankRecord](../../src/core/database.ts) scores lexical matches across metadata and long content. Hooks additionally apply domain bonuses and per-kind quotas. [Quality test](../../tests/instruction-quality.test.ts) achieved 22/30 hit@3 in this run. Live discovery for this audit returned a test-plan template first. | Selection can over-trigger and differs by entry point. Share candidate selection logic, expose reasons and measure false positives as well as expected hits. Live observation is illustrative; catalog benchmark is reproducible. |
| F5 / Major | [MCP](../../src/agents/mcp.ts) exposes only bootstrap/discover/get/style in ChatGPT mode, while returning common compliance instructions. It intentionally does not expose local skills, prepare or review. | Some instructions request unavailable operations. Preserve read-only boundaries and provide a capability-aware workflow with an explicit manual fallback. |
| F6 / Moderate | [Skill references](../../src/core/models.ts) are strings. [matchSkill](../../src/projects/skill-discovery.ts) strips a trailing condition and matches names/digests, without a requesting-host parameter. Scanner roots cover shared, Codex and Claude locations. | Installation does not establish usability in the current host. Keep exact selection and ambiguity warnings; introduce structured conditions and host-aware resolution only where needed. Verify OpenCode-specific paths before extending the scanner. |
| F7 / Moderate | [Fusion](../../src/instructions/fusion.ts) learns “repeatable methods” from skill/review/example records into global preferences; it preserves every current criterion and skill reference. | Growth is easier than simplification. Restrict suggestions to reusable preferences and distinguish new preference evidence from repeated global text. Simplification must remain a separately reviewed operation. |
| F8 / Moderate | [personalizeRecord](../../src/core/database.ts) copies full records and rewires ancestors; `sourceStyleId` records identity but does not itself capture the exact global base revision used. [UI](../../web/app.ts) also supports text-only assignment overrides. | Two customization paths can drift and make rebasing hard to explain. First expose source/current/private differences; preserve both legacy paths until a tested migration exists. |
| F9 / Moderate | [UI](../../web/app.ts) labels references “Required external skills,” lists procedural skill records alongside styles, and represents templates in multiple forms. | Users cannot easily tell their preference from its implementation aid. Clarify authoring and inspection labels without initially deleting supported record kinds. |

## Alternatives

| Approach | Benefit | Cost / risk | Decision |
|---|---|---|---|
| Keep implementation; change positioning only | Cheapest | Leaves relevance, duplication and host mismatch intact | Insufficient |
| Rewrite everything into a new preference schema | Strong theoretical separation | Large migration, private-content loss risk, delayed feedback | Reject for now |
| Incremental contract and catalog pilot | Reuses proven boundaries; reversible; measurable | Temporary legacy support | Recommended, high confidence for technical fit |
| Export everything as skills | Familiar portable artifact | Conflates preferences and capability again | Optional later export, not core model |

Confidence in improved user outcomes remains unverified until task evaluations and user feedback exist.

## Proposed behavior and precedence

Within Personal Brain's own preference layer: current explicit user direction wins; an explicit project preference overrides the corresponding global default; a global preference overrides a skill's incidental default. Platform/system constraints remain outside and above this resolver. Repository evidence informs a proposal; it does not silently become a personal preference. Technical feasibility failures must be reported, not solved by pretending a requested output was produced.

For two same-scope preferences that disagree, do not use ranking priority as authority. A known structured conflict should be returned with choices; an unresolved prose contradiction should be visible for agent/user judgment. This is a bounded resolver, not a natural-language policy solver.

Example: global preference requests editable Draw.io; project defaults to Mermaid; task explicitly asks for Draw.io. Preparation identifies the task choice, retains applicable readability criteria, excludes Mermaid-only checks, and resolves a usable Draw.io skill if available. If no renderer is available, XML source may still be delivered with rendering marked unverified. The preferred outcome survives the host change.

## Ordered implementation slices

### 1. Establish the contract and baseline

Deliver an ADR defining the boundary and compatibility rules, plus a classification inventory for all 52 bundled records: retain as preference, shorten and reference a skill, template, review criteria, or legacy procedure. Classify each proposed move explicitly; do not automatically strip all METHOD sections.

Extend retrieval fixtures to include negative prompts, planning-only tasks, explicit format overrides, multiple styles in one capability, missing skills and equivalent requests across supported hosts. Record selected IDs, expanded IDs, checklist size and serialized payload bytes. Current 22/30 hit@3 is a regression floor, not product success.

Reach: catalog, documentation, quality fixtures and hook/MCP tests. No user-data migration. Exit: reviewed classification and failing examples for F1–F5, with current expected behavior captured before changes.

### 2. Resolve task applicability in the existing preparation flow

Keep `requiredIds` as unconditional dependencies for legacy callers. Add optional conditional supporting links rather than changing their meaning. Use explicit task context such as activity and requested artifact formats; ambiguous applicability stays unresolved, never silently excluded.

Return included and excluded guidance with reasons, effective versions, provenance and unresolved decisions. Checklist items need an applicability state separate from verification status. A supported “not applicable” decision requires a reason; it must not become a loophole for bypassing unconditional requirements. Bind applicable scope and decisions into the instruction-set digest.

Reach: models and validation, required-link resolution, instruction-set, requirements, artifact-review, MCP schemas, HTTP contracts, editor types, import/export and tests. Preserve existing API calls and old records; introduce additive fields with conservative defaults. Exit: planning-only work does not acquire implementation-only outputs; required security/data-preservation constraints cannot be dropped; changing task scope invalidates prepared review.

### 3. Pilot preference-focused content and explicit skill references

Start with development, document writing, drawing, Draw.io and their directly required review/QC/QA guidance. Keep the user's actual choices: concise output, editable sources, no invented evidence, small complete changes. Remove duplicate technical recipes only where an available procedure or a documented fallback exists.

Introduce structured skill references only to represent necessary semantics: name, applicability, whether required for the task, and acceptable fallback. Continue reading legacy strings. Do not pin absolute local paths into portable preferences; resolve installation IDs/digests at use time. Do not build a skill installer or copy third-party skill bodies into Brain.

Reach: release catalog and its generator, models, scanner/matcher, editor, MCP responses, seed and import/export compatibility, style-contract/dependency tests. Exit: swapping an eligible rendering skill does not change outcome criteria; missing optional tools do not block unrelated tasks; explicit required formats remain required.

Measure payload reduction on the same fixtures; accept reductions only if outcome constraints and useful discovery recall survive. Set a byte-budget target from those measurements rather than inventing a universal token limit.

### 4. Align discovery and delivery across hosts

Use one shared candidate-ranking path for hooks and MCP. Retain lexical retrieval first; improve metadata and narrowly justified scoring using the labeled fixtures before considering semantic infrastructure. Expose match reasons, direct versus dependency selection, and exclusions without injecting full bodies into hooks.

Create one host-aware instruction renderer using existing adapters. It must advertise only available operations: local preparation/review where supported, read-only effective preference retrieval and manual verification otherwise. Do not expose mutation tools to ChatGPT to achieve superficial parity. Prefer a read-only resolution operation shared with preparation if parity requires it.

Reach: database ranking, hooks, MCP, hook-install/OpenCode output, desktop/ChatGPT contracts, compliance text, diagnostic UI and documentation. Exit: the same explicit task scope yields the same effective preferences across adapters, with differences limited to available tools and verification evidence. Validate provider-specific prompts in fixtures and then run live smoke checks; fixture success is not live compliance.

### 5. Make customization and Fusion understandable

Show global origin, private revision, effective value and why it applies. Capture the source revision for future private edits; existing unknown ancestry stays explicitly unknown. Offer comparison before any rebase. Avoid silently absorbing repository facts into reusable global preferences.

Change Fusion's proposal objective from accumulating methods to identifying reusable user preferences. Keep manual publish, source attribution, stale-version checks and conflict rejection. Any removal of a requirement or skill needs a dedicated reviewed diff and rationale; do not simply relax current guards.

Reach: database personalization, onboarding prompts, Fusion validation/UI, record history, project editor, private-style and Fusion tests. Exit: rejecting proposals leaves private/global records untouched; edited private content survives catalog upgrades; global updates can be understood without automatic propagation.

### 6. Broaden the catalog only after the pilot passes

Apply the reviewed classification to the remaining catalog. Update README positioning and in-product explanations. Regenerate catalog docs and packaged browser output through existing scripts. Publish compatibility notes and a clear distinction between delivered, retrieved, checked and independently verified.

Exit: migration rehearsed against synthetic old libraries, all contract tests pass, representative user tasks show relevant preferences without unrelated mandatory workflows. Actual model adherence remains measured evidence, not a promised guarantee.

## Migration and rollback

1. Add fields and backward-compatible readers before changing writers or seed content. Round-trip unknown legacy content and preserve key IDs, histories, private links and project assignments.
2. Fresh installations receive the revised catalog only after pilot review. Existing installations receive a previewable upgrade proposal; never overwrite edited records or reset a deleted record on restart.
3. Use known baseline version/digest checks for any automated catalog update. Unknown provenance requires explicit comparison. Test failed updates roll back atomically.
4. Keep a database backup before migration; verify restoration in a separate data directory. Do not downgrade executable code against a migrated database unless compatibility is proven.
5. Retain old skill/example/tool record support during this work. Do not turn the boundary cleanup into a destructive kind migration.

## Acceptance and test plan for implementation

These cases are proposed, not executed new tests. Existing suites are the starting point, not a reason to duplicate coverage.

| Case | Expected result | Primary test area |
|---|---|---|
| PB-01: ask only for implementation planning | No code-change or formal release-test outputs become mandatory | instruction-set / instruction-quality |
| PB-02: explicit format differs from default | Chosen task format and its criteria apply; decision provenance is visible | instruction-set / style-contracts |
| PB-03: same-scope incompatible preferences | Unresolved conflict is visible; score does not silently select authority | design-composition / projects |
| PB-04: required vs optional missing skill | Required capability gap reported; optional guidance does not block unrelated work | skill-discovery / mcp |
| PB-05: two different installed skill copies | Host-relevant selection or explicit ambiguity; digest recorded | skill-discovery |
| PB-06: equivalent task across hosts | Same preference outcomes; capability-specific operations only | hooks / mcp / chatgpt-connect |
| PB-07: dependency or decision changes after prepare | Review refuses stale set | instruction-set |
| PB-08: legacy string references and text overrides | Existing behavior survives load/save/export/import | database / style-import / private-styles |
| PB-09: migration with private edits/deleted defaults | Edits and deletions preserved; failed write atomic | global-style-seed / private-styles |
| PB-10: Fusion sees one project's tooling | No automatic global technology preference; evidence and review required | fusion-trace |
| PB-11: irrelevant or small task | No unrelated mandatory template; false positives measured | instruction-quality |
| PB-12: check asserted but not run | Remains not verified; non-applicability has distinct reason | artifact-review |

Each implementation slice should run its focused suites, then the full suite and package build before release. UI changes additionally require keyboard, narrow/wide layout, error-state and draft-preservation checks. Live host checks require actual host sessions; maintainers own release sign-off. No schedule or staffing assumptions are made here.

## Verification of this planning deliverable

Self-review, 2026-11-06:

| Criterion | Status | Evidence / limit |
|---|---|---|
| Findings tied to implementation | Pass | Current source links above; stale graph replaced by direct reading |
| Scope, alternatives and prioritized plan | Pass | Boundary table, F1–F9, six dependent slices |
| Compatibility and user-data protection addressed | Pass | Additive contracts, private-edit preservation and rollback plan |
| Existing focused regression baseline | Pass | 22 tests passed, zero failures under Node 22.23.4 |
| Retrieval quality meets a strong product target | Not verified | Existing hit@3 = 22/30; no accepted stronger target yet |
| New behavior, migrations and live host parity | Not verified | Proposed only; no application implementation |
| Rendered UI and full security/performance audit | Out of scope | Source-level product-boundary review |

Executed command: `/Users/nghiadh/.nvm/versions/node/v22.23.4/bin/node scripts/run.mjs --test tests/instruction-quality.test.ts tests/instruction-set.test.ts tests/required-links.test.ts tests/private-styles.test.ts tests/skill-discovery.test.ts tests/hooks.test.ts` (invoked through `rtk proxy`). Initial attempt with default Node 18.20.3 was rejected by the runtime guard; retry used installed supported Node without changing user configuration.

Verdict: **Changes recommended against the new product boundary; implementation not started.** The audit and plan are ready for discussion, not a claim of finished product compliance.

## Decisions to carry into implementation

Recommended defaults: retain legitimate process preferences; make procedure references optional unless the outcome needs them; keep templates task-triggered; keep host mutation permissions unchanged; migrate existing content only through reviewable updates. The first concrete delivery is slices 1–3 for the small pilot, with delivery corrections from slice 4 where the pilot needs them.

Defer cloud sync, a marketplace, automatic learning from every conversation, a general natural-language conflict solver, a new agent runtime and vector search. None is needed to validate the agreed distinction.

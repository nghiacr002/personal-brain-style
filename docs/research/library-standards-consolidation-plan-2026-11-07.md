# Library conflict audit and development-standard consolidation plan

Date: 2026-11-07. Status: approved for implementation, including Python and Java. See [implementation and reconciliation report](development-standards-implementation-2026-11-07.md) for outcomes and verification limits. The original audit below records the pre-migration state.

The target is one Global Development Standard for every language, with one substyle per language. Framework and runtime rules are conditional sections of those language profiles. Architecture, design, research and formal document styles remain optional specialists, not competing common development standards.

## Evidence and limits

Reviewed the live library inventory, dependency graph, scopes, deliverables and requirement fields across all 55 records; inspected detailed engineering, architecture, diagram and document rules for interactions. Compared relevant rules with the source seed catalog. This is a semantic self-review, not a proof that all possible natural-language contradictions have been detected.

Live snapshot: 55 active global records (54 preferences, 1 review); no private records in this snapshot. Coding style is v3; all others are v1. Required-link traversal found zero cycles and zero dangling IDs. All 55 live content bodies differ from current seed bodies; this signals different catalog generations and must not be interpreted as 55 defects. Live records contain zero supporting links and zero structured preference decisions.

Required closures including the selected root: Development 7; TypeScript frontend 21; TypeScript backend 18; .NET backend 18. The frontend closure includes BRD, ADR, LLD and test-plan records. Backend closures include API, ADR, LLD and test-plan records. These are availability/inheritance measurements, not proof every associated document was actually generated.

Sources: live global records keyed in the inventory below; [seed catalog](../../src/styles/global-style-catalog.ts), [seed behavior](../../src/styles/global-style-seed.ts), [catalog upgrade](../../src/styles/catalog-upgrade.ts), [applicability contract](../../src/core/preference-contract.ts), [resolver](../../src/instructions/resolve.ts). Source reads supplement the older code graph; changed files were read directly. No web research was needed to compare user-supplied preferences; this audit does not certify current external framework recommendations.

## Findings and proposed resolutions

Severity here describes reliability of instruction selection, not production security vulnerability severity. Direct contradiction means competing instructions for the same task. Scope overload means individually reasonable rules become mandatory for unrelated work. Conditional differences are not automatically conflicts.

| ID | Class / priority | Evidence and trigger | Resolution |
|---|---|---|---|
| C01 | Direct naming conflict / high | coding-style specifies kebab-case TS files; structure-frontend-typescript says other modules camelCase.ts; backend examples use placeOrder.ts. | One language naming authority: kebab-case ordinary modules/utilities, PascalCase components, use-prefixed hooks and framework-required filenames as explicit exceptions; align examples. |
| C02 | Competing diagram defaults / high | network-architecture requires Draw.io unless user explicitly asks otherwise, while solution/drawing styles delegate format to the selected project style. doc-database explicitly requires Mermaid erDiagram. | Diagram format selected per output; network Draw.io and database Mermaid become overridable defaults. Preserve editable source and semantic requirements. |
| C03 | Artifact contract mismatch / high | doc-word prose permits .docx or .dotx; its requirement accepts only .docx. | Represent alternatives with a validated format choice or accepted-extension contract; test both and reject unrelated formats. |
| C04 | Multiple formats loaded / high | Markdown, HTML and Word have active artifact requirements and no live conditional or structured preference fields. Loading several roots can require unrelated outputs. | Format rules apply to requested outputs only; multiple requested outputs are valid and must not cancel each other. Missing format context remains explicit, not silently skipped. |
| C05 | Scope overload / high | Development -> QA -> doc-test; frontend -> UI/UX -> BA -> BRD; coding-patterns -> software-design -> LLD/ADR. | Required links only for universal prerequisites; specialist/document links conditional or explicitly selected. Test small edits with no formal document requirements. |
| C06 | Scope overload / high | A .NET library inherits backend health/API/migration expectations; React Native is told to select TypeScript web rules for compiler rules only, despite web build requirements in that record. | Base language profiles independent of runtime; web, mobile, API, SDK, CLI, worker branches gated separately. |
| C07 | Precedence ambiguity / high | coding-style accepts explicit project configuration; stack styles say existing choices win; review describes selected roots before required styles; resolver uses task > private project > global and ignores ranking priority for conflicts. | Publish one precedence policy, separate explicit overrides from observed old code, and make language settings specific rather than competing unqualified global values. |
| C08 | Over-prescription / medium | Live .NET defaults include xUnit, specific ASP.NET/Entra choices; user standard allows established frameworks and conditional tools. Common principle says avoid unnecessary packages. | Preserve project choices; native/platform features first; proposed defaults only for unspecified choices. No automatic dependency install. |
| C09 | Internal scope tension / medium | Thinking allows 3-5-line notes for small choices but verification always asks three options/trade-off tables; solution architecture asks 2-3 options. | Scale decision evidence to significance; no padded alternatives or mandatory ADR on trivial decisions. |
| C10 | Duplicated responsibility / medium | QC, QA, review, development and coding style repeat evidence/testing/completion rules. | Common has short baseline; QC owns evidence semantics, QA owns formal strategy, review owns findings/verdict. References must not require full specialist deliverables. |
| C11 | Seed/live parity gap / high | All live bodies differ; seed .NET acceptance refers to a removed commands pattern; reduced seed bodies omit some detailed language preferences. | Rule-by-rule reconciliation, preserving useful preferences while moving procedures out. Seed and live must share canonical outcomes, applicability and review criteria after approved migration. |
| C12 | Migration incompleteness / high | applyCatalogUpgrade currently updates content, skill fields, preference decisions and links, but not principles, reviewCriteria, requirements or examples. | Upgrade a complete reviewed semantic record with optimistic versions and fingerprints; preserve user-specific fields and private copies. Do not apply partial rule updates. |
| C13 | Specificity gap / medium | Requested TS 2-space/100-column/single-quote rules and C# 4-space/120-column/newline-brace defaults are not explicit across current profiles; SOLID exists separately, KISS/DRY/YAGNI mostly implied. | Add exact user defaults to language substyles; common names principles pragmatically without pattern mandates. |
| C14 | Procedure/style boundary / medium | Many records contain step sequences, tool installation/workflow instructions and mandatory documents, not just working preferences. | Keep outcomes, constraints, applicability, examples and acceptance in styles; detailed execution belongs in existing skills or repository procedures. No new skill required merely for formatting. |
| C15 | Applicability capability gap / high | Current structured context supports activity and formats only; it cannot express TypeScript vs C#, React vs Node CLI, or API vs SDK. | Add only necessary language/framework/target conditions and carry them through discovery/preparation/review. Unknown context is unresolved, never assumed applicable or irrelevant. |
| C16 | Excessive baseline obligations / medium | Backend default health endpoints, frontend performance/token budgets, mobile offline/release steps and SRE pipeline requirements can apply outside their intended task. | Retain them as scoped preferences. Separate product requirements from optional default examples; no infrastructure addition solely to satisfy a style. |

Not conflicts by themselves: a 100-column TypeScript target and 120-column C# target; UI token palette versus diagram palette; provider-neutral cloud rules plus explicitly selected Azure defaults; 24 CSS-pixel web minimums versus stricter 44 CSS-pixel targets or native pt/dp targets. Preserve scope/units and apply the relevant stricter requirement, not one universal numeric setting.

## Target hierarchy and ownership

```text
Global Development Standard (existing development ID/key)
  TypeScript
    conditional: React / other web frameworks / Node API / worker / CLI / SDK / React Native
  C# / .NET
    conditional: library / ASP.NET Core / EF Core / worker
  Python
    conditional: Django / FastAPI / Flask
  Java
    conditional: Spring
  Swift
    conditional: SwiftUI / iOS
  Kotlin
    conditional: Compose / Android
  Dart
    conditional: Flutter
```

Swift, Kotlin and Dart preserve existing language preferences. Python and Java were explicitly added by the user to this implementation; other languages remain outside scope.

Every language substyle has one required parent: the common standard. Common must never require its children. Mixed-language work loads common once plus applicable children. Optional specialist styles may depend on common when appropriate, but common must not depend back on those specialists. Framework sections add rules only in their actual scope.

Common owns: pragmatic Clean Code/SOLID/DRY/KISS/YAGNI; readable layout; clear naming intent; small focused units; no premature reuse or abstraction; separation of concerns proportional to complexity; library/platform reuse; configurable operational values with validation; explicit failures and safe logging; secure defaults; risk-based tests; preserve architecture/behavior/data; targeted changes; truthful quality gates. Existing coding-style v3 readability and configuration principles must survive verbatim or with reviewed equivalent meaning.

TypeScript owns: user-supplied sections 2-4 (format/naming/types), TS-specific function/async details, conditional React/Node sections, and exact formatter/lint/typecheck/test expectations. C# owns its format/naming/nullable/domain-type/async/disposal rules, with conditional ASP.NET/EF guidance and .NET checks. Shared architecture/security/testing principles are inherited, not repeated wholesale.

TS defaults: 2 spaces, 100-column target, semicolons, single quotes, braces, no multi-statement lines, no nested ternaries, Prettier. C# defaults: 4 spaces, 120-column target, newline braces, .editorconfig/dotnet format, required control-flow braces. These are targets/configuration preferences, not promises that a formatter enforces every rule: lint/analyzers enforce braces and other semantic layout restrictions. Explicit compatible project configuration takes precedence over personal defaults; legacy compressed code does not count as configuration.

Precedence: explicit task instruction > explicit project rule/override > applicable language/framework setting > common default > incidental skill default. Non-negotiable security/data-integrity checks are not silently removed by a stylistic override. Same-specificity disagreements are surfaced. Ranking scores never establish authority. Scoped structured keys should be language-qualified (for example typescript.indent and csharp.indent) rather than a global indent that conflicts in mixed projects.

## Full Library disposition (55 current records)

The key is stable identity, not a request to rename every record. A compatibility record is retained for old IDs and selections until consumers have migrated; it contains no duplicate baseline rules. No physical deletion is part of this plan.

| Current key | Action | Scope / correction |
|---|---|---|
| `quality-control` | Keep; narrow applicability | Evidence vocabulary and truthfulness; proportional reports, no automatic formal document. |
| `research` | Keep; conditional | Research only uncertain, external or version-dependent claims; no research memo for ordinary edits. |
| `writing` | Keep | Own writing quality and preserve explicit/existing formats; no blanket requirement to create documents. |
| `doc-adr` | Template; explicit task | Only significant recorded decisions; never inherited by every coding task. |
| `thinking` | Keep; scale to task | Short decisions remain short; options/ADR requirements depend on decision significance. |
| `review-checklist` | Keep; conditional checks | Apply only relevant artifact checks; missing evidence is not a pass. |
| `review-standard` | Keep; align precedence | One shared precedence and verdict vocabulary; no new technology/format defaults. |
| `ai-delivery` | Keep; conditional | Separate delivery planning and AI-product evaluation; no redundant permission gates for authorized work. |
| `drawing` | Keep; conditional | Only actual diagram deliverables; separate content/view rules from format selection. |
| `doc-brd` | Template; explicit task | Only requested/formal business specifications. |
| `business-analysis` | Keep; conditional | Own requirement quality; formal BRD/process diagrams only where requested. |
| `doc-prd` | Template; explicit task | Only feature specification work, not every implementation patch. |
| `doc-roadmap` | Template; explicit task | Only roadmap creation or maintenance. |
| `product-ownership` | Keep; conditional | Own outcomes and prioritization; roadmap/PRD/release record only when their task applies. |
| `technology-research` | Keep; conditional | Technology evaluation; do not require a spike or adoption radar for ordinary API lookup. |
| `drawio` | Keep; conditional | Own Draw.io output rules; coexists with other formats only for explicitly separate outputs. |
| `mermaid` | Keep; conditional | Own Mermaid output rules; do not infer all diagrams in Markdown must use Mermaid. |
| `design-system` | Keep; conditional | Own UI tokens; existing brand wins; no full theme migration on a small UI fix. |
| `ui-ux` | Keep; conditional | Own interaction quality; sever automatic BRD dependency; preserve native target-size units. |
| `doc-lld` | Template; explicit task | Only requested/significant module-design documents; no document for trivial refactoring. |
| `software-design` | Keep as specialist | Common gets simple separation principles; deep module/refactor advice only when relevant. |
| `software-architecture` | Keep as specialist | Domain/aggregate patterns are conditional, not mandatory distributed architecture. |
| `security-architecture` | Keep as specialist | Common includes secure defaults; full threat models only where needed. |
| `doc-database` | Template; reconcile format | Preserve schema traceability; remove mandatory Mermaid when another diagram format is selected. |
| `data-architecture` | Keep as specialist | Data ownership/lifecycle; formal database document only when in scope. |
| `doc-integration` | Template; explicit task | Formal integration agreements; examples do not mandate Mermaid or all failure diagrams on every change. |
| `doc-api` | Template; conditional | Only published API/event contracts; honor protocol and existing contract conventions. |
| `integration-architecture` | Keep as specialist | Contracts, consistency and delivery semantics; protocol-specific rules conditional. |
| `network-architecture` | Keep; reconcile format | Draw.io is a default, not a veto over selected or explicitly requested formats. |
| `cloud-architecture` | Keep as specialist | Provider neutral; no cloud/IaC artifacts for local-only development. |
| `doc-hld` | Template; explicit task | Only solution/major-release design work. |
| `solution-architecture` | Keep as specialist | Compose only relevant specialists; significant solution work gets HLD, not every code task. |
| `cloud-azure` | Keep; conditional | Azure-first only when chosen; preserve existing non-Azure/local architecture. |
| `doc-test` | Template; explicit task | Formal test plans/reports only; focused coding tests need no approval document. |
| `quality-assurance` | Keep as specialist | Risk-based test planning; common owns everyday testing expectations. |
| `coding-style` | Merge into common; compatibility record | Move v3 rules to development, then retain old ID as a forwarding dependency without duplicated obligations. |
| `development` | Canonical common standard | Rename Global Development Standard; retain ID/key and consolidate all language-independent baseline rules. |
| `coding-patterns` | Keep as specialist | Common gets pragmatic reuse/error basics; patterns only when needed, no cleanup unrelated to task. |
| `logging-tracing` | Keep as specialist | Common owns safe useful logging baseline; detailed instrumentation only when telemetry changes. |
| `eng-frontend` | Merge baseline; compatibility record | Move general UI-development expectations to common conditional section; deep UX remains specialist. |
| `eng-backend` | Merge baseline; compatibility record | Move service expectations to common conditional section; no API/health requirements for every SDK/CLI. |
| `technical-leadership` | Keep; conditional | Planning/release leadership only; stop requiring both frontend and backend profiles. |
| `doc-runbook` | Template; conditional | Operational changes and service runbooks, not library/CLI development by default. |
| `sre-devops` | Keep; conditional | Production operations when in scope; staging/SBOM/on-call requirements proportional to deployment. |
| `structure-frontend-typescript` | Keep optional structure reference | Align names with TypeScript profile; no automatic folder rewrite or structure document. |
| `eng-frontend-typescript` | Merge into TypeScript; compatibility record | Preserve React/Next/Vue/Angular/Svelte branches under explicit framework conditions. |
| `structure-frontend-mobile` | Keep optional structure reference | Conditional native/Flutter/React Native layouts, no blanket offline/release work. |
| `eng-frontend-mobile` | Split language rules; compatibility record | Move Swift/Kotlin/Dart and React Native guidance into relevant language profiles; do not force web tooling. |
| `structure-backend-typescript` | Keep optional structure reference | Align filenames; feature-layer templates remain choices based on complexity. |
| `eng-backend-typescript` | Merge into TypeScript; compatibility record | Preserve Node and API/worker branches; do not impose server tests on SDKs/CLIs. |
| `structure-backend-dotnet` | Keep optional structure reference | Retain simple and layered choices without forcing a split project per layer. |
| `eng-backend-dotnet` | Merge into C#/.NET; compatibility record | Separate base C# from conditional ASP.NET, EF Core and Entra/Azure rules. |
| `doc-markdown` | Format preference; conditional | Activate for Markdown outputs; explicit existing HTML/Word stays in that format. |
| `doc-html` | Format preference; conditional | HTML documents only; application UI rules do not automatically apply. |
| `doc-word` | Format preference; fix contract | Support requested docx or dotx consistently in prose and artifact checks. |

## Implementation sequence and exit criteria

### Phase 1 — Freeze evidence and define canonical content

1. Capture versioned record snapshots, project assignments/overrides, dependency edges, private-copy provenance, domains and original catalog fingerprints. Keep private contents in the user's local backup, not a repository fixture.
2. Create a rule mapping for every section and bullet in the two user-provided standards: source section/bullet, destination record, applicability, review criterion, preserved/clarified/merged status. Include existing Swift/Kotlin/Dart rules and coding-style v3 additions. No omitted requirement without a recorded rationale.
3. Draft common and seven language records. Existing frontend/backend/structure rules must be mapped before retirement; retain React, Vue, Angular, Svelte, React Native, native mobile and Flutter scopes already supported.
4. Resolve C01-C16 explicitly; review common rules for contradictions and framework defaults for unnecessary obligations.

Exit: every supplied requirement and every retired live rule has an owner; common contains no language-specific formatter values; no duplicate independent common standards remain in the proposed effective graph.

### Phase 2 — Applicability and dependency contract

Use existing requiredIds for inheritance. Add optional languages, frameworks and targets to task context and corresponding applicability conditions only where needed. Suggested target vocabulary: web, api, worker, cli, sdk, mobile. Preserve backward compatibility: absent new fields do not invalidate old records; a condition requiring missing information is unresolved.

Carry context through model validation, MCP schemas/descriptions, HTTP routes, preparation fingerprints, review replay, exports/imports, and any UI preview that supplies context. Repository/framework detection supplies evidence and suggestions; explicit task context wins. Never infer that every framework named in a language record is active.

Conditional prose sections remain readable source guidance; structured requirement conditions govern the checklist. Do not claim the resolver semantically filters arbitrary prose. If deterministic per-section rendering becomes necessary, design that separately rather than promising it from record-level links.

Normalize specific preference keys and conflict handling. Do not use the existing `.format` suffix to discard an entire language record when just a quote/indent preference is overridden. Verify multiple artifacts separately so an explicit request for both HTML and Markdown, or Draw.io and Mermaid, keeps both deliverables.

Exit: common is deduplicated; TS/C# settings coexist; React-only checks do not appear for a Node CLI; missing framework context is reported when relevant; prose and structured decisions agree.

### Phase 3 — Catalog and compatibility migration

1. Reuse `development` and its ID as the canonical Global Development Standard. Preserve the key for integrations; title may change.
2. Create language records with stable keys such as `coding-typescript`, `coding-csharp`, `coding-swift`, `coding-kotlin`, `coding-dart`. All require `development`.
3. First remove development -> coding-style and other obsolete universal edges. Then turn coding-style into a compatibility record requiring development. Perform both in one transaction to avoid a cycle.
4. Convert old frontend/backend stack records to compatibility records only after their rules and scope are preserved in the new language/common profiles. Retain IDs, history and references; no silent deletion or loss of available framework guidance.
5. Generic frontend/backend/mobile compatibility records route to common without requiring every language. Agent recovery/discovery should request the applicable language when not known; do not attach TS/C#/Swift/Kotlin/Dart all at once.
6. Project assignments may retain compatibility IDs initially. An explicit, previewed remap can simplify them later. Text overrides and customized records require manual comparison: do not redirect them blindly. Private copies remain unchanged and show available upstream changes.
7. Fresh seeds contain canonical standards and specialists, not obsolete duplicated baseline content. Existing-library compatibility records remain available for old references, excluded from normal recommendations only through an explicitly implemented and tested compatibility mechanism. Do not claim such a mechanism already exists.
8. Preserve legitimate record kind changes: formal document templates should be represented as templates where the current model uses examples for that role; verify UI/import/discovery mapping before changing kind. Document format preferences remain preferences. No legacy Procedure records are introduced.

Exit: zero cycles/dangling links, no lost source content, old IDs remain recoverable, private/user-edited styles and assignments preserved, and repeated migration is a no-op.

### Phase 4 — Safe application and seed parity

Build a dry-run migration preview showing every content/metadata/link/assignment change, old/new versions, compatibility replacements and conflicts. Pin the preview to expected record/project versions and content fingerprints. Apply the reviewed set transactionally with a new migration marker only after success. Concurrency or validation failure rolls back the entire selected batch.

Use the normal revision-producing update path. Extend catalog upgrade beyond its current partial field set to include the reviewed principles, requirements, reviewCriteria and examples as well as content and links. Never use a blanket seed overwrite on an existing library. Unknown or edited records are comparisons, not automatically eligible upgrades. Capture a rollback manifest; rollback restores the prior active records and links through new revisions, not by deleting history. Recheck versions before rollback to avoid overwriting subsequent edits.

Run the same semantic assertions against a fresh seed and a migrated baseline fixture. Compare canonical fields by stable keys, allowing different generated IDs and version/history metadata. Include a fixture representing the already updated coding-style v3, not just the original release.

Exit: a fresh install and an approved migration expose equivalent canonical rules; modified libraries are preserved; history and rollback are demonstrated.

### Phase 5 — Discovery, UI and agent integration

Library presentation shows Global Development Standard with its language children, using required-parent metadata or an explicitly defined relationship. Explain which common rules are inherited; count them once. Existing optional specialist groups remain separate. Compatibility records must not look like competing current standards.

Discovery should rank the correct language/target for the current task and avoid recommending legacy duplicates. Loading a language automatically includes common. Generic development loads common and may suggest a language rather than impose one. Validate Codex, Claude and OpenCode flows for discover -> get/prepare -> review with the same project scope. Preserve the bounded recovery guidance introduced earlier; an invalid record does not justify global-scope bypass or endless retries.

Global catalog availability is distinct from project selection. A newly created language record must not silently change every project's selections. Show the suggested selection update and apply only the authorized migration scope. This user's global updates do not authorize replacing unrelated private project preferences.

Exit: users see one common parent, applicable language children and understandable inherited rules; older references remain usable; agents receive correct scoped records and honest verification requirements.

### Phase 6 — Validation and release

Run targeted catalog, resolver, instruction-set, import/export, project selection and migration tests; then the full suite and package/UI builds because the context/schema/UI changes cross those boundaries. Run configured formatter/linter and report missing tooling honestly. Inspect the Library hierarchy and preview screens with keyboard and narrow/wide layouts. Replay representative host sessions; a simulated MCP test is not proof of actual agent behavior.

Publish only after the migration preview and evidence are reviewable. Repository formatter installation, mass code reformatting and automatic source refactoring are outside this library-consolidation change.

## Acceptance matrix (define before implementation)

| Test ID | Scenario | Expected result / method |
|---|---|---|
| STD-01 | Generic language-unspecified bug fix | Common only; no guessed language, formal design/test plan or unrelated framework deliverables. Resolver fixture. |
| STD-02 | React TypeScript component | Common once + TS; React and UI checks apply; no Node backend or ASP.NET checks. |
| STD-03 | Node TypeScript CLI | Common once + TS; CLI errors/config/cancellation as relevant; no browser/health/API checks. |
| STD-04 | TypeScript SDK | Language type/API checks; no mandatory server deployment, database or container. |
| STD-05 | C# class library | Common once + C#; no EF migration or ASP.NET endpoint requirements. |
| STD-06 | ASP.NET + EF Core feature | Relevant C# sections and API/database tests apply; no Azure/Entra mandate absent that choice. |
| STD-07 | TS frontend and C# backend | Both children share one common; 2/4 spaces and 100/120 targets coexist without false conflict. |
| STD-08 | React Native, Swift, Kotlin, Flutter | Correct language and mobile branch; no web build obligations; retain platform-specific units and tools. |
| STD-09 | Missing or conflicting context | Explicit unresolved decision; no silent skipping, endless retry or invented framework. |
| STD-10 | Explicit project formatter overrides defaults | Override shown with provenance; common security/testing requirements survive. |
| STD-11 | Small UI fix vs formal architecture task | Small fix has focused verification; requested HLD/BRD/test-plan work loads its actual templates. |
| STD-12 | Network/database diagram, explicit Mermaid/Draw.io | Selected output wins consistently; no hidden second mandatory format. |
| STD-13 | HTML+Markdown or Draw.io+Mermaid both requested | Both output requirements retained; conflicting default only where same output has incompatible choices. |
| STD-14 | Word document vs Word template | docx and dotx each accepted only when appropriate; unrelated file cannot pass. |
| STD-15 | Fresh seed | All canonical records/dependencies/criteria present, no duplicate common baseline; deterministic semantic fixture. |
| STD-16 | Migration of original catalog and coding-style v3 | New hierarchy, exact supplied rule coverage, no loss of readability/configuration principles. |
| STD-17 | Personal edit/private copy/override | Preserved and reported for comparison; no blanket overwrite or stale source promotion. |
| STD-18 | Concurrent edit, failed migration, rerun, rollback | Version conflict/atomic rollback/idempotence; revision and assignment integrity. |
| STD-19 | Existing IDs/imported bundles/prepared sets | Compatibility lookup works; stale prepared sets fail clearly; import remaps dependencies correctly. |
| STD-20 | Circular/dangling required/supporting link | Reject before write, including common/legacy forwarding-cycle risk. |
| STD-21 | Codex/Claude/OpenCode integration | Same scoped inheritance and retry guidance; report live behavior separately from schema tests. |
| STD-22 | Library hierarchy/accessibility | One visible common standard, language children, understandable inherited guidance; keyboard/focus/responsive checks. |
| STD-23 | Other library roles | Research, design, diagrams, documents, cloud and operations retain their specialized guidance only when applicable. |
| STD-24 | Seed/live metadata completeness | Content, principles, examples, requirements, review criteria and links semantically match after approved migration. |

## Implementation touchpoints

- Catalog and migrations: `src/styles/global-style-catalog.ts`, `global-style-seed.ts`, `catalog-upgrade.ts`, baseline fixtures, existing initializer behavior and project-default selection logic.
- Context/resolution: `src/core/models.ts`, `preference-contract.ts`, `requirements.ts`, `src/instructions/resolve.ts`, `instruction-set.ts`, artifact review, import/export validation.
- Interfaces: MCP schemas and descriptions, hooks/agent context, HTTP routes and UI context forms. Generated `public/app.js` rebuilt from `web/app.ts`; do not edit generated output by hand.
- UI: Library grouping/disclosure, migration preview, inherited-rule explanation, compatibility treatment.
- Tests: seed and catalog preservation; preference boundary and instruction-set behavior; library-transfer and scoped project records; UI and host integration; package smoke checks.

Exact file list is to be confirmed by a current caller/coverage trace before implementation; this is a scoped implementation map, not a claim every consumer has already been modified.

## Review verdict and decision record

Original planning verdict: ready for user review. Implementation was subsequently authorized; see the linked report. Recommended order: content mapping -> applicability and resolver support -> canonical catalog and safe migration -> Library/agent integration -> full verification. Do not migrate live records before the new contracts and migration tests are ready.

Self-review corrections incorporated: no single universal indentation rule; no deletion of old IDs; no automatic all-language activation; no seed overwrite of personal edits; no claim that a prose conflict scanner can prove consistency; preserve multiple explicitly requested artifacts; no automatic frontend/backend duties for SDKs/CLIs; include coding-style v3 in migration fixtures; distinguish source update from deployment/host adoption.

Plan verification (2026-11-07): inventory covers 55/55 live keys once; required graph has no cycles or dangling IDs; linked source files exist; document has phases, a disposition per record, conflict register, rollback and 24 acceptance scenarios. Implementation tests and live agent replay are Not run because this turn is planning only. Runtime/framework recommendations and external documentation were not revalidated; retain target-framework compatibility and research them when implementing affected technical guidance.

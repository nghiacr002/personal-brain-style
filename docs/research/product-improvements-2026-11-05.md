# Personal Brain Style: product improvement research

Date: 2026-11-05. Baseline: commit `b402c8d`, package `1.3.0-beta.3`. Status: proposal; no implementation or release authorised by this document.

## Decision and scope

**Research question:** Which improvements would most increase the reliability and usefulness of Personal Brain Style for people applying personal working instructions across projects and coding agents?

**Recommendation:** Prioritise reliable delivery, explainable selection and portable instructions, then measure output quality. Retain the local-first architecture. The strongest potential distinction is a versioned personal instruction library that users can inspect and trust across agents.

Assumed primary user: an individual developer or technical author using multiple projects or agents. This assumption needs customer validation. The intended outcome is less setup troubleshooting and fewer corrections caused by missing, stale or conflicting instructions. Building an agent runtime, project-memory service or team SaaS platform is outside this proposal.

Ranked decision criteria:

1. Correct project scope and instruction selection.
2. Successful setup with clear failure diagnosis.
3. Demonstrable improvement in the resulting work.
4. User ownership, portability and safe recovery.
5. Low maintenance cost and reversible changes.

## Method and confidence

Evidence combines current repository source, the earlier HLD/LLD work and official public documentation. External sources were accessed on 2026-11-05. Repository observations below are source-inspected behaviour, not newly executed integration tests. The codebase graph reports an index dated 2026-11-03 and does not track several reorganised paths; current source was read directly for the cited findings.

Labels distinguish **Observed** repository facts, **External** documented capabilities, **Inference** interpretations and **Proposed** work. Confidence is high for the narrow implementation findings, medium for prioritisation, and unverified for adoption, willingness to pay and measurable quality gains. No customer interviews, market sizing or competitor hands-on trials were conducted.

## What the existing product already provides

**Observed:** Project selection and required dependencies define an effective instruction set. Discovery ranks metadata and content lexically. Hooks emit compact indexes; full instructions are retrieved separately. Prepared instruction sets record versions and a digest, and reviews reject changed instruction sets. These are useful foundations to extend rather than replace. See [database](../../src/core/database.ts), [hooks](../../src/agents/hooks.ts) and [prepared instructions](../../src/instructions/instruction-set.ts).

**Observed:** Artifact review distinguishes file presence from semantic verification; agent-reported passes remain `not_verified`. Preserve this distinction when adding quality reporting. See [artifact review](../../src/instructions/artifact-review.ts).

## External findings and implications

| Finding | Product implication |
|---|---|
| **External:** Claude Code documents persistent instruction files, scoped rules and auto memory. It explicitly describes instructions as context rather than enforced configuration. [Official documentation](https://code.claude.com/docs/en/memory) | **Inference:** Storing prompts alone is a weak distinction. Show what was delivered and what was verified, without promising obedience. |
| **External:** Cursor supports version-controlled project rules, scoped application and AGENTS.md. [Official rules documentation](https://cursor.com/docs/rules) | **Inference:** Git-owned instruction export is a practical interoperability path. Native hosts remain useful alternatives for single-agent users. |
| **External:** Agent Skills specifies YAML frontmatter, descriptions up to 1,024 characters and optional compatibility/metadata fields. [Specification](https://agentskills.io/specification) | **Inference:** Correct metadata handling is more valuable immediately than adding another proprietary packaging format. |
| **External:** MCP 2025-11-25 requires agreement on a supported protocol version during initialization. [Lifecycle specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle) | **Inference:** Echoing an arbitrary requested version is insufficient negotiation. |
| **External:** The official 2026-07-28 specification uses per-request version metadata and describes interoperability with earlier handshake-based versions. [Versioning specification source](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/versioning.mdx) | **Inference:** Maintain an explicit supported-version matrix. A date-string change cannot implement the newer lifecycle. Actual installed client support must be tested. |

These sources establish available mechanisms, not proof that every host version supports them or that customers prefer this product.

## Prioritised opportunities

Effort bands are relative: small means a bounded correction; medium means a workflow spanning existing components; large means a new subsystem. They are not delivery estimates. P0 means next release candidate; P1 means validate and sequence after P0.

### 1. P0 — Make connection health actionable

**Observed:** MCP initialization reports server version `1.2.0` although the package is `1.3.0-beta.3`; it echoes the requested protocol version without checking support. The CLI doctor prints configuration information and registration commands, but that does not establish a successful live retrieval. Sources: [MCP server](../../src/agents/mcp.ts), [CLI](../../src/cli.ts), [package metadata](../../package.json).

**Proposed:** Read the server version from the existing package-version mechanism; declare supported protocol revisions and implement their actual negotiation rules. Extend existing diagnostics to distinguish installed, registered, handshake observed, project resolved and first retrieval observed. Treat unobserved states as unknown, not failure. Reuse existing trace events; do not create a second monitoring system.

**Acceptance:** An unsupported legacy version receives a supported version according to the legacy contract; package and handshake versions agree; a fresh install can demonstrate one scoped retrieval; unavailable hosts produce actionable messages. Contract tests cover supported and unsupported versions, malformed requests and project pinning. Test installed host versions before claiming compatibility with the newer lifecycle.

**Effort:** small for the version fixes; medium for end-to-end diagnostics. **Confidence:** high for fixes, medium for onboarding benefit.

### 2. P0 — Explain why a style applies or is missing

**Observed:** Project discovery searches selected styles and required dependencies, not every global style. Ranking is weighted lexical matching. In the earlier HLD workflow, a catalog template was not returned by scoped discovery. This is evidence of discoverability friction; it does not by itself prove a ranking defect. Source: [scope and discovery](../../src/core/database.ts).

**Proposed:** Add a task preview showing the project, selected roots, dependencies, record versions, matched fields and omissions caused by limits. Separate “available in library” from “active in this project.” Offer a deliberate selection action when a relevant template is available but inactive; never silently broaden project scope.

**Acceptance:** A user can explain why an HLD template is absent without reading code. Introduce a human-labelled set of 30–50 prompts covering BRD, HLD, LLD, coding, research, synonyms and negative cases. Measure required-style coverage among the first three results and irrelevant-style inclusion. Require zero cross-project private-record exposure in the fixtures. Establish a baseline before setting relevance targets.

**Effort:** medium. **Confidence:** high in the scope distinction; medium in usability impact.

### 3. P0 — Preserve skill metadata correctly

**Observed:** Skill discovery uses a line-based regular expression for YAML fields. A description written using `|` or `>` becomes empty, and displayed descriptions are truncated to 400 characters. The scanner currently checks shared, Codex and Claude locations. Source: [skill discovery](../../src/projects/skill-discovery.ts).

**Proposed:** Parse the supported YAML frontmatter accurately, retaining the full description for matching while shortening only presentation. Preserve compatibility information when exposing or exporting metadata. Keep malformed-file diagnostics and scan limits. Add further host locations only when supporting and testing that host is an explicit product commitment.

**Acceptance:** Fixtures cover quoted strings, comments, multiline descriptions, CRLF, malformed metadata, duplicate names with differing content and scan limits. Existing precedence and ambiguity behaviour remains intact. Evaluate a maintained YAML parser against the project's dependency budget rather than extending regex into a partial YAML implementation.

**Effort:** small to medium. **Confidence:** high.

### 4. P1 — Preview instruction changes and their impact

**Observed:** Prepared sets already pin effective records and project versions. Skill inventory exposes content digests, but prepared-set digests cover Brain records rather than external skill contents. Sources: [prepared sets](../../src/instructions/instruction-set.ts), [skill inventory](../../src/projects/skill-discovery.ts).

**Proposed:** Reuse this model for a before/after preview: changed instructions, affected projects, required dependencies, missing skills and estimated context size. Optionally record the external skill digests actually used in a run. Flag potential semantic contradictions for human review rather than presenting automated conflict detection as certain.

**Acceptance:** A shared-style edit identifies affected projects; a changed external skill can be distinguished from an unchanged Brain record. Context reporting includes the final emitted response, not only the metadata-selection budget. Label character counts and token estimates accurately.

**Effort:** medium. **Confidence:** medium.

### 5. P1 — Export portable, reviewable instruction bundles

**Proposed:** Offer one-way export of an explicitly selected project instruction set into Git-owned Markdown and standards-compatible skill folders. Start with one supported target and a dry-run diff. Include source IDs, versions and the required dependency closure in a manifest. Preserve manually maintained files; flag unsupported semantics rather than silently dropping them.

Use [Agent Skills](https://agentskills.io/specification) for skill packaging and a tested host-specific instruction entry point, informed by [Cursor's native rule model](https://cursor.com/docs/rules). A static export cannot guarantee dynamic discovery, review recording or host permission equivalence; disclose those limitations.

**Acceptance:** Repeated export is deterministic, user edits are protected, referenced files exist and an integration fixture loads the result in the chosen host. Do not build bidirectional sync initially.

**Effort:** medium. **Confidence:** medium; validate demand with multi-agent users first.

### 6. P1 — Measure whether styles improve work

**Observed:** Hook traces record emission, and artifact review can establish file presence. Neither establishes that an agent followed every instruction or improved the final output. Sources: [hooks](../../src/agents/hooks.ts), [review](../../src/instructions/artifact-review.ts).

**Proposed:** Begin with a small opt-in evaluation fixture, not an evaluation platform. Compare native project instructions alone, current Brain styles and a candidate style revision on the same tasks. Keep model/host versions and task inputs fixed; run repeated trials where feasible. Combine deterministic artifact checks with blind human review against a predefined rubric.

**Measures:** Correct instruction selection, first-pass artifact acceptance, user corrections, completion time and measured token usage when available. Separate selection failures from generation failures. Keep held-out tasks so style revisions do not merely optimise the examples. Capture task content only with explicit opt-in.

**Acceptance:** Publish baseline and candidate results, sample size and uncertainty. A proposed style improvement needs evidence beyond the agent's own pass claim. No percentage improvement is claimed by this research.

**Effort:** medium. **Confidence:** high that measurement is needed; benefit remains unverified.

### 7. P1 — Make recovery and export limitations clear

**Observed:** CLI JSON export uses `db.list({limit:300})` alongside projects and feedback; SQLite backup uses `VACUUM INTO`. They are different operations. The JSON export should not be presented as a complete database backup. Source: [CLI](../../src/cli.ts).

**Proposed:** Clearly label export scope and truncation, and provide a documented, verified recovery procedure using the existing SQLite backup. Test with more than 300 records and project-private dependencies before promising portable full-library export. Define optional retention and deletion controls for trace/review content only after inventorying what must survive for recovery.

**Acceptance:** A temporary backup can be reopened and checked for records, project assignments and history. Recovery instructions protect the current database and account for active processes. No production database is overwritten in the test.

**Effort:** small for clearer labels and recovery documentation; medium for complete portable export. **Confidence:** high for the export limit.

## Alternatives

| Option | Effort / cost | Risk and operation | Security / ownership | Reversibility | Decision |
|---|---|---|---|---|---|
| Keep the current product and add documentation only | Low | Leaves confirmed compatibility and parsing defects | Preserves local ownership | High | Useful immediate documentation, insufficient alone |
| Improve existing diagnostics, selection, portability and evaluation | Small fixes followed by medium workflows | Builds on current scope, trace and version mechanisms | Keeps local storage; explicit export boundaries | High if changes remain additive | Recommended |
| Build a cloud team-policy and memory platform | Large; hosting and support costs unestimated | Adds identity, sync, tenancy and conflict resolution | New data-sharing and access-control responsibilities | Lower | Defer until customer demand justifies it |

The recommended option addresses observed failures with the least architectural change. Native instruction files remain a credible alternative for people who use only one host and do not need central versioned management.

## Delivery sequence and validation

1. **Reliability release:** version/protocol fixes, skill metadata fixtures, diagnostic states and clear export wording. Exit when supported-host contract checks pass and a fresh-install retrieval is demonstrated.
2. **Selection release:** task preview, active-versus-available distinction and a retrieval benchmark. Exit when users can resolve missing-template cases and benchmark regressions are visible.
3. **Value experiment:** a portable export target and controlled output-quality comparison. Expand only when users use the export or results support a measurable benefit.

Suggested owners are roles, not assigned people: maintainer for protocol/parser/recovery; product owner for selection UX and user interviews; quality owner for evaluation fixtures. Record a formal architecture decision only if implementation commits to a new lifecycle strategy, dependency or synchronisation model.

## Risks, open questions and revisit triggers

| Risk or uncertainty | Mitigation / owner | Revisit trigger |
|---|---|---|
| Native hosts solve much of instruction management | Interview users about cross-project and cross-host friction / product owner | Users prefer native files and cannot identify additional value |
| Better diagnostics are mistaken for guaranteed compliance | Distinguish emitted, retrieved and independently verified / quality owner | Any misleading success state in usability testing |
| More instructions increase cost or conflict | Measure final payload size and output quality / maintainer | Candidate styles increase corrections or context use without benefit |
| Lexical matching misses synonyms | Benchmark scope and metadata first / quality owner | Persistent measured misses justify a semantic-search experiment |
| Export duplicates divergent sources of truth | One-way, deterministic export with provenance and diff / maintainer | Repeated demand for edits flowing back into Brain |
| Modern protocol support breaks legacy hosts | Versioned contract tests and explicit support matrix / maintainer | A supported host changes its lifecycle or drops legacy support |

Premortem: six months of adding styles and integrations could still leave users unsure whether anything applied. Avoid that outcome by demonstrating first retrieval and task selection before expanding the catalog.

Interview questions: Which agents are actually used weekly? Which missing or conflicting instructions caused rework? Is setup, selection or document quality the largest pain? Is Git export sufficient for sharing? What evidence would make users trust a quality claim?

Defer vector databases, autonomous style rewriting, a new agent runtime, team cloud sync and a marketplace until these questions or measured failures justify them.

## Verification and source register

**Pass:** Narrow implementation findings were checked in current source; priorities include acceptance evidence; recommendations are labelled proposals; primary sources support external mechanism claims.

**Not verified:** Live compatibility with every host, newer MCP lifecycle implementation, customer demand, quality gains, complete backup restoration and production performance. No application code changed and no new runtime tests were run for this research-only deliverable. A persisted Personal Brain review was not submitted; the earlier automatic approval rejection for transmitting project artifacts remains unresolved.

| Source | Revision / date | Use |
|---|---|---|
| Repository files linked above | `b402c8d`, inspected 2026-11-05 | Current implementation evidence |
| [Claude Code memory](https://code.claude.com/docs/en/memory) | Living documentation; accessed 2026-11-05 | Native instruction facilities and enforcement limits |
| [Cursor rules](https://cursor.com/docs/rules) | Living documentation; accessed 2026-11-05 | Native rules and Git ownership |
| [Agent Skills specification](https://agentskills.io/specification) | Living specification; accessed 2026-11-05 | Metadata and portable directory format |
| [MCP lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle) | 2025-11-25; accessed 2026-11-05 | Legacy negotiation contract |
| [MCP versioning source](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/versioning.mdx) | 2026-07-28 specification on mutable `main`; accessed 2026-11-05 | Modern lifecycle and legacy interoperability |

The newer MCP page was read from the official repository because the corresponding documentation-site URL did not load. Publication dates for living host documentation were not established; installed-host versions remain a separate verification requirement.

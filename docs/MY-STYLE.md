# My Styles — eleven practical recipes

Samples import automatically when the updated server starts. Restart an older running server, then connect to the studio. They appear first in My Styles as drafts. Expand instructions, then Edit and save as Active to use a sample with agents. Existing edits are preserved. Coding is a dedicated domain; technology selection uses Architecture.

## Sky blue architecture drawing

Domain: diagrams

# When to use
Draw editable, layered diagrams with clear boundaries.

# Instructions
For system topology use editable draw.io. Use a white canvas, sky blue groups, dark labels, consistent rounded rectangles and orthogonal connectors. Group by responsibility, label protocols and mark trust boundaries. Include a legend. Validate XML and inspect a rendered preview when tooling is available; disclose missing visual verification.

# Example prompt
Draw the Personal Brain component topology.

# Worked output
Canvas: white. Local user boundary contains Browser → HTTP API → Style Repository → SQLite WAL. Browser to API: authenticated HTTP on loopback. CLI boundary contains Claude and Codex → Hooks / MCP stdio → Style Repository. External boundary contains Optional Tool Proxy → approved MCP process, disabled by default. Sky blue containers identify responsibilities; dark arrows show request direction. Legend: solid arrow = request; container = process or trust boundary.

# Acceptance check
Confirm the output follows the instructions, label assumptions, and report only checks actually performed.

## Transaction sequence drawing

Domain: diagrams

# When to use
Explain interactions in chronological order.

# Instructions
Use Mermaid sequenceDiagram for request flows. Name participants by responsibility. Show authentication, success and a meaningful failure path. Keep topology out of the transaction view. Supply editable source and validate syntax when a parser is available.

# Example prompt
Show how a style edit is saved.

# Worked output
sequenceDiagram
    actor User
    participant UI as Browser
    participant API as Local API
    participant DB as SQLite
    User->>UI: Save edited style
    UI->>API: PUT record with token and expectedVersion
    API->>DB: Validate and update atomically
    alt Current version matches
        DB-->>API: New version and revision
        API-->>UI: 200 saved record
    else Stale version
        API-->>UI: 409 conflict
        UI-->>User: Error; retain unsaved fields
    end

# Acceptance check
Confirm the output follows the instructions, label assumptions, and report only checks actually performed.

## Concise technical writing

Domain: writing

# When to use
Lead with the result and support it with concrete evidence.

# Instructions
State the outcome first. Use simple verbs, short paragraphs and consistent terminology. Explain the user impact, verification and remaining limits. Remove filler, unverified claims and unfinished placeholders.

# Example prompt
Write a release note for versioned styles.

# Worked output
My Style keeps your working rules in one versioned library. Edit a rule and save to create a new revision. Claude and Codex can retrieve the current active instructions on subsequent tasks. Older revisions remain available for restore. Verification: persistence and stale-update tests pass only when actually run. Limit: retrieving a rule does not prove an agent followed it.

# Acceptance check
Confirm the output follows the instructions, label assumptions, and report only checks actually performed.

## Testable requirements writing

Domain: writing

# When to use
Turn an intention into verifiable acceptance criteria.

# Instructions
Define the actor, goal, scope and numbered requirements. For each requirement give observable acceptance criteria and failure behavior. Separate confirmed constraints from assumptions. Do not invent business targets.

# Example prompt
Specify safe editing of a working style.

# Worked output
Actor: local user. Goal: revise a style without losing history. R1: Save creates a new immutable revision snapshot. Acceptance: given v1, saving changed content produces v2 and preserves v1 in history. R2: stale edits fail. Acceptance: given another save already produced v2, submitting expectedVersion=1 returns HTTP 409 and keeps v2 unchanged. R3: preserve unsaved text on failure. Acceptance: the editor remains open with entered content and an error. Out of scope: collaborative cloud editing.

# Acceptance check
Confirm the output follows the instructions, label assumptions, and report only checks actually performed.

## Evidence-led thinking

Domain: thinking

# When to use
Separate what is known from what needs testing.

# Instructions
Write facts, assumptions, options, decision and verification. Challenge the need for new components. Compare at least two credible options. Describe evidence that would change the decision; label estimates.

# Example prompt
Should a local style studio use a remote database?

# Worked output
Facts: the product serves one local user and stores versioned records in SQLite. Assumption: cloud sharing is unnecessary. Options: retain SQLite; add a hosted database. Decision: retain SQLite because the stated use case needs local persistence and revisions, and a hosted service adds credentials, network failures and operations. Verify: restart persistence, atomic updates and backup restore. Revisit when multi-device synchronization becomes an explicit requirement.

# Acceptance check
Confirm the output follows the instructions, label assumptions, and report only checks actually performed.

## Boundaries-first architecture

Domain: architecture

# When to use
Describe ownership, interfaces and failure boundaries before implementation.

# Instructions
Begin with scope and constraints. Define components, data ownership, interfaces and trust boundaries. Explain authentication, failure behavior, observability and recovery. Keep diagram and prose consistent. Avoid adding a service without a concrete need.

# Example prompt
Explain the Personal Brain architecture.

# Worked output
Scope: portable global working methods for local Claude and Codex sessions. Browser owns presentation; loopback HTTP API validates token, origin and input. BrainDB owns records, revision transactions and trace metadata in SQLite WAL. Hooks emit concise task context; MCP supports discovery and retrieval over stdio. The optional external tool proxy executes only configured, enabled backends when its process gate is enabled. Failures: stale saves return 409; invalid credentials reject requests; unsupported tools stay unavailable. Recovery: restore a revision as a new version or restore a consistent database backup. Evidence: traces prove emission or retrieval, not compliance.

# Acceptance check
Confirm the output follows the instructions, label assumptions, and report only checks actually performed.

## Trade-off architecture decisions

Domain: architecture

# When to use
Record a decision together with alternatives and revisit triggers.

# Instructions
Use an ADR with context, constraints, alternatives, decision, consequences and verification. Prefer the smallest solution that meets requirements. Include a trigger for revisiting the decision.

# Example prompt
Record the storage decision for a local style tool.

# Worked output
ADR: local transactional storage. Context: one user needs durable styles, revision history and concurrent process access. Alternatives: JSON files, SQLite, hosted SQL. Decision: use SQLite WAL with atomic record and revision writes. Consequences: no database service is needed; backups must be consistent; writes remain serialized. JSON makes concurrent updates and revision atomicity harder. Hosted SQL adds network and credentials without a requested collaboration feature. Verify: persistence, rollback history and stale version rejection. Revisit: supported multi-user remote writes.

# Acceptance check
Confirm the output follows the instructions, label assumptions, and report only checks actually performed.

## Constraint-led technology selection

Domain: architecture

# When to use
Choose technology using requirements and a small evidence matrix.

# Instructions
State hard constraints before comparing candidates. Check compatibility, license, maintenance, security, deployment effort and total cost from current primary sources before a real selection. Separate verified capabilities from assumptions. Recommend one candidate with rejection reasons and a small proof of concept.

# Example prompt
Compare storage options for a single-user local application.

# Worked output
Illustrative matrix, not a current vendor assessment:
Candidate | Local/offline | Transactions | Operations
JSON files | Yes | Custom locking needed | Simple files
SQLite | Yes | Built-in | Embedded library
Hosted SQL | Network-dependent | Built-in | Remote service
Recommendation: SQLite for this constrained example. Reject JSON when atomic versioned updates are required. Reject hosted SQL while offline operation is mandatory. Proof of concept: two processes attempt updates against one version; one succeeds and one receives a conflict. Before adoption, verify the chosen runtime's SQLite support and license from official sources.

# Acceptance check
Confirm the output follows the instructions, label assumptions, and report only checks actually performed.

## Accessible sky blue interface

Domain: design

# When to use
Build calm interfaces with readable contrast and clear actions.

# Instructions
Use pale sky backgrounds, white surfaces, dark blue text and a deeper blue for primary controls. Keep one main action per section, visible labels, keyboard focus and responsive layouts. Never convey state using color alone. Honor reduced motion. Check contrast and narrow layouts.

# Example prompt
Define a style-library screen.

# Worked output
Screen: My Style. Intro explains that recipes begin as drafts. Primary action: New Style. Secondary action: Load style recipes. Search and domain filter have accessible labels. Cards show domain, title, summary, readable instructions, Edit, History and textual status. Palette: canvas #f0f7fc; surface #ffffff; text #0c2840; primary #0369a1 with white text. Desktop uses two columns; phone uses one. Save errors retain form content. Keyboard users can skip navigation and see focus indicators.

# Acceptance check
Confirm the output follows the instructions, label assumptions, and report only checks actually performed.

## Evidence-based review

Domain: reviews

# When to use
Report actionable defects and distinguish tests from observations.

# Instructions
Review against explicit acceptance criteria. Put correctness, security and data-loss risks first. Each finding includes severity, evidence, impact and correction. Name executed checks and their results. Separate visual observations from automated results. Never claim an unrun test passed.

# Example prompt
Review a stale-save implementation.

# Worked output
Finding: High — update handler overwrites the record without comparing expectedVersion. Evidence: a second client can submit v1 after v2 exists. Impact: lost changes. Correction: reject stale updates with 409 and atomically write the current record and revision. Verification: create v1, save v2, submit stale v1 and assert v2 content and history remain intact. Visual review: confirm the editor stays open and shows the conflict. If the UI was not opened, report that check as unverified.

# Acceptance check
Confirm the output follows the instructions, label assumptions, and report only checks actually performed.

## Minimal verified coding

Domain: coding

# When to use
Implementing a feature or fixing a bug in an existing application.

# Instructions
Read the relevant code and callers first. Reuse existing components and dependencies. Fix the root cause once, preserve error handling and validation, and avoid unrelated refactors. Add a focused behavioral test for nontrivial logic. Run the relevant build and tests and report actual results.

# Example prompt
Fix missing spacing without weakening the application security policy.

# Worked output
Cause: inline margin styles are rejected by style-src self. Change: move the section gap and button margins into named stylesheet classes; apply those classes to the existing markup. Preserve the current security header. Check: assert generated markup has no inline style attributes, verify the named rules exist in the served stylesheet, and inspect desktop and phone layouts if a browser is available. Report any blocked checks.

# Acceptance check
No relaxed security policy, no lost functionality, and no claims about tests or visual checks that were not run.


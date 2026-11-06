# Working preferences across AI tools

Personal Brain owns reusable working preferences, desired outcomes and acceptance criteria. Skills own procedures and tool-specific recipes. Project facts stay in the repository. Existing legacy skill records and string references remain readable; no user records are silently rewritten.

## Resolve before preparing

`brain_resolve` is read-only and available to local and ChatGPT clients. Pass the project ID, task, selected root record IDs and explicit context:

```json
{
  "task": "Explain the architecture using Mermaid",
  "recordIds": ["selected-record-id"],
  "context": {
    "activity": "architecture",
    "formats": ["mermaid"],
    "preferences": [{"key": "diagram.format", "value": "mermaid"}]
  }
}
```

Formats control conditional guidance. Explicit preference key/value pairs resolve competing defaults; free-text task wording is not parsed into authoritative choices. A missing condition is unresolved, while a known mismatch is not applicable. Activities and formats are combined with AND; entries within each list use OR.

Structured choices use task > project-private preference > global preference precedence. Conflicting values at the same level remain conflicts regardless of ranking priority. Legacy prose overrides affect content, but cannot silently change structured fields; personalize the record to change those. Arbitrary prose contradictions require human or agent review.

`requiredIds` are unconditional links. `supportingLinks` have a `recordId` and `when` condition. Explicit format choices supersede incompatible format records and their format-specific requirements; other unconditional requirements cannot be waived with a not-applicable evidence claim. `skillBindings` contain a name, required boolean, fallback and optional condition. Optional procedures never become mandatory just because they are missing.

Local `brain_prepare` uses the same resolver, rejects unresolved required applicability/conflicts, and freezes context with record versions. Review rejects changed context or stale instructions. ChatGPT remains read-only: it can resolve preferences but cannot prepare persisted instruction sets, inspect local skill files or persist artifact reviews. Its instructions describe those limits.

## Procedures and evidence

Skill discovery can filter by the requesting host while retaining project/shared installations. Legacy references remain supported. A listed skill does not prove installation, invocation or successful validation. Optional fallbacks should disclose checks that could not be performed.

Discovery and prompt hooks share ranking. Results expose matched fields, terms, score and selection reason. Scores help shortlist candidates; they never establish precedence or semantic completeness.

## Updating existing libraries

Fresh libraries receive the revised catalog. Existing libraries use **Library → Review catalog updates**. Each proposal shows content, dependency links, bindings and structured choices. Only records matching a known release baseline can be applied automatically. Personal edits and unknown content require manual comparison. Updates require the previewed version and create history; restore creates another version. Missing catalog records are not recreated by this operation.

Private copies retain their source identity and source version. Existing copies whose base is unknown display that fact. Updating a global preference does not rewrite its private copies. History compares the original base snapshot, current private contract and current global contract before a manual rebase.

Fusion proposes reusable preferences from selected project preferences. It preserves mandatory requirements and rejects obvious newly introduced command/XML recipes. This is a bounded guard, not a semantic proof; proposals still require review. No automatic publication or procedure extraction is introduced.

OpenCode root discovery follows its [official skill locations](https://opencode.ai/docs/skills/), including `.config/opencode/skills` and Claude-compatible skill folders. Host permission policies and nested-worktree discovery are not simulated by the inventory.

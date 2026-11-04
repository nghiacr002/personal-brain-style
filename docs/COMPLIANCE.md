# Style compliance review

Personal Brain supplies instructions and records bounded evidence. It cannot force a host agent to obey a prompt or prove that an agent actually read a skill.

Styles can define `requirements` alongside existing review criteria and external skill references:

```json
[
  {"id":"req-source","label":"Native diagram source","type":"artifact","extension":".drawio"},
  {"id":"req-editable","label":"Verify native editable elements","type":"manual"}
]
```

Use stable `req-` IDs. The editor and `brain_update_project_style` accept these requirements. Existing review criteria and required skill references also appear in the checklist returned by `brain_get`; they require no migration.

1. Discover and load the current project styles, required links and relevant skills.
2. Reconcile required outputs before selecting tools. HTML cannot replace a required `.drawio` deliverable.
3. Perform the work and inspect actual artifacts.
4. Call `brain_review` with the current project's applicable style IDs and evidence bound to the IDs/versions from `requirementChecklist`:

```json
{
  "projectId":"<project-id>",
  "task":"Produce architecture diagram",
  "recordIds":["<style-id>"],
  "artifacts":["docs/architecture.drawio"],
  "evidence":[{
    "recordId":"<style-id>",
    "recordVersion":1,
    "requirementId":"req-editable",
    "status":"pass",
    "note":"Opened the file in Draw.io and inspected native elements."
  }]
}
```

Supply `content` separately for deterministic text checks. Omitted text leaves those checks pending. Legacy text-only calls still work.

Artifact checks confirm a nonempty file with the requested extension inside the linked repository. They do not parse its format or prove editability, correct icons, semantics or visual quality. Traversal and symlink escapes are rejected. Manual agent-reported passes remain **Not verified**; reported failures remain **Fail**. Reports cover the agent-selected roots and required dependencies, not an independently verified complete task scope.

Project **Agent activity → Compliance reviews** shows the latest 20 historical reports, with style versions and separate agent evidence. A later style/file edit does not revalidate an old report. Reports persist task summaries, repository-relative paths, check results and evidence notes in local trace storage. Do not put secrets or full prompts in those fields. Artifact file contents are not read or stored by presence checks. Trace exports include these reports.

Restart existing MCP sessions after updating the server so clients receive the new schemas. No host completion blocker or independent manual-review approval is implemented.

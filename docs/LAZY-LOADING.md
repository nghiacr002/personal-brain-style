# On-demand style and skill loading

SessionStart supplies a bounded index of style titles, IDs and versions, plus retrieval guidance. It does not inject instruction bodies, examples, review criteria or external skill files. UserPromptSubmit ranks relevant records and supplies a bounded reference list. Unrelated prompts add no context.

For substantive work, agents discover matching records and call `brain_get` with the project ID. That response contains the complete record and required-linked instructions. Agents then locate and read the referenced external skills relevant to the task. Listing a skill neither installs it nor proves it was used. Reuse is appropriate only when the same record ID, version and project scope are already present in the conversation; this is agent guidance, not a server-side cache guarantee.

Trace hook entries record index delivery, not full instruction retrieval. Look for `mcp.brain_get` to verify retrieval. Older trace entries retain their original evidence. Character counts are measured; token savings vary by model and task and are not inferred as exact counts.

Navigation keeps agent setup and traces visible. Discovery testing, startup preview, text review, external tool registration, feedback and change history remain under Advanced tools. Existing URLs continue to work.

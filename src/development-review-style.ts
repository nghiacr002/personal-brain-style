import {BrainDB} from "./database.ts";

export function requireDevelopmentReview(db:BrainDB){
 const key="development_review_gate_v1";
 if(db.db.prepare("SELECT value FROM meta WHERE key=?").get(key))return 0;
 const tags=["personal-brain-project-coding","personal-brain-project-design","personal-quality-control","personal-quality-control-qc"];
 const records=db.list({kind:"preference",limit:300}).filter(r=>r.tags.some(t=>tags.includes(t)));
 if(!records.length)return 0;
 const content=`MANDATORY DEVELOPMENT AND REVIEW WORKFLOW
Before implementation: retrieve the current project-selected styles and required dependencies. Read the full instructions of the relevant implementation skills and the review skill. Identify the backend/UI scope, affected callers, acceptance criteria and required checks. A skill name or retrieved style is not evidence that its instructions were followed.
During implementation: apply the selected rules and skills continuously. Review meaningful changes as they are made, checking validation, data preservation, project isolation, accessibility, interaction and error handling as applicable. Revisit the plan when scope changes; do not postpone all review until the end.
Before completion: perform an explicit review of the final change using the applicable review skill and the selected styles' review criteria. For code review, use ponytail:ponytail-review when available. For UI, also use ui-ux-pro-max and the selected design-system skill, and inspect actual rendered behavior when tooling is available. Read the skills before applying them; never claim a skill was used solely because it is listed.
Backend review: inspect affected callers and data boundaries, test validation and failure paths, verify persistence, migrations, scope isolation and compatibility where affected. UI review: verify the complete user workflow, immediate local search, contextual actions, keyboard/focus behavior, responsive layout, empty/error states and preservation of drafts. Run the relevant build and focused tests after changes.
Resolve material findings and rerun the affected checks after fixes. Record findings, fixes, commands or inspection evidence, and outstanding risks. If a required skill, test environment or visual validator is unavailable, state that limitation and mark the relevant review pending. Do not silently skip the review or report full verification from passing tests alone. A self-review is acceptable unless an independent reviewer is explicitly required; label it honestly.
Completion report: summarize what changed, which styles and review skills were applied, what was reviewed and tested, and which checks remain pending. Never invent review results, screenshots, approvals or test evidence.`;
 const criteria=[
  "Confirm applicable styles, required dependencies and implementation/review skills were read before work.",
  "Review meaningful changes during development against the selected rules and acceptance criteria.",
  "Perform a final skill-guided review of backend and/or UI changes; report whether it was self-review or independent review.",
  "Resolve material findings, rerun affected checks, and provide concrete review and test evidence.",
  "Reject a fully verified completion claim when required review, skills or visual checks are missing; mark those checks pending."
 ];
 for(const r of records){
  db.update(r.id,{...r,content:r.content+"\n\n"+content,
   principles:[...new Set([...(r.principles||[]),"Review during development and before completion using the applicable styles, rules and skills."])],
   externalSkills:[...new Set([...(r.externalSkills||[]),"ponytail:ponytail-review (for backend or UI code review)"])],
   reviewCriteria:[...new Set([...(r.reviewCriteria||[]),...criteria])],
   examples:[...(r.examples||[]),"After adding an API and its form, review the API validation, persistence and scope isolation, then inspect the form's keyboard flow, errors and responsive layout using the applicable skills. Fix findings and rerun affected tests. If browser access is unavailable, report code-review evidence and passing tests while marking visual review pending."]
  },r.version);
 }
 db.db.prepare("INSERT INTO meta(key,value) VALUES(?,?)").run(key,"1");return records.length;
}

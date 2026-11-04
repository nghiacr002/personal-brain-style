import {BrainDB} from "./database.ts";

// User-requested shared writing style, assigned only to these two existing projects.
export function installWritingStyle(db:BrainDB){
  const key="shared_document_writing_v1";
  if(db.db.prepare("SELECT value FROM meta WHERE key=?").get(key))return 0;
  const ids=["696366e9-d012-4288-8a46-376b49873137","b3937377-32ad-43a8-9adc-c21d06a9b4a4"];
  const projects=db.projects().filter(p=>ids.includes(p.id));
  if(projects.length!==2)return 0;
  const tag="personal-document-writing";
  let style=db.list({kind:"preference",limit:300}).find(r=>r.tags.includes(tag));
  if(!style)style=db.create({
    kind:"preference",domain:"writing",title:"Document writing — clear, structured and evidence-based",
    summary:"Write concise technical documents with explicit decisions, traceable evidence and actionable review criteria.",
    content:"Apply when writing or revising project documentation. Start by identifying the audience, purpose, scope and decision or action the reader needs. Lead with the conclusion or recommendation. Use plain technical English, short connected paragraphs, consistent terminology and active voice. Define acronyms on first use.\n\nUse only sections needed for the document: purpose and scope; requirements and constraints; proposed approach; decisions and alternatives; risks and assumptions; implementation or operating steps; verification and next actions. Use tables for comparisons, numbered steps for procedures, and diagrams when relationships are clearer visually. Apply any project-selected architecture and drawing styles to diagrams. Do not invent project facts, metrics, owners, dates or verification results.\n\nDistinguish facts, assumptions, proposals and open questions. Cite the source and date for externally verified claims when relevant. Make requirements observable and testable. Record decisions with their rationale, alternatives and consequences. End with concrete next actions and unresolved questions when they exist. Preserve supplied facts and the meaning of existing text during edits.\n\nUse Markdown for repository documents unless another format is requested. For editable office documents, use the documents skill and inspect the rendered output when available. Required external skills are not automatically installed: locate and read their instructions before applicable work; disclose missing tools. Review the final document against the criteria below and report unperformed checks honestly.",
    principles:["Write for the reader's decision or task; lead with the main point.","Prefer plain, concise technical English and consistent terminology.","Separate evidence from assumptions and make requirements testable.","Preserve project facts and explicitly report verification limits."],
    externalSkills:["documents:documents (when creating or editing an office document)"],
    reviewCriteria:["Confirm the audience, purpose, scope and main recommendation are clear.","Check terminology, acronyms, heading order and sentence clarity; remove repetition.","Trace factual claims to supplied evidence or cited sources; label assumptions and open questions.","Verify requirements and acceptance criteria describe observable results.","Check decisions explain alternatives, consequences and unresolved risks.","Validate links, tables and code examples; render office documents and inspect pagination/layout when possible.","Confirm diagrams follow the project's selected drawing style and distinguish completed checks from pending reviews."],
    examples:["Decision note — Add capability search. Purpose: help users locate a capability in the local registry. Decision: filter registered names with the existing browser UI and preserve the query in the URL. Rationale: reuse the current local stack without adding a search service. Acceptance: matching names are shown; no matches produces a clear empty state; refreshing preserves the query. Verification: record the actual tests run and leave browser layout inspection pending if it was not performed."],
    tags:[tag,"writing","documentation","technical-english","project-style"],requiredIds:[],priority:90,status:"active",checks:[],backend:null
  });
  for(const project of projects){
    // Preserve a writing selection if the user configured one before this migration ran.
    if(project.assignments.some(a=>{const r=db.get(a.recordId);return r?.kind==="preference"&&r.domain==="writing";}))continue;
    db.saveProject({...project,assignments:[...project.assignments,{recordId:style.id,override:null}]},project.id,project.version);
  }
  db.db.prepare("INSERT INTO meta(key,value) VALUES(?,?)").run(key,"1");
  return 1;
}

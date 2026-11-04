import {BrainDB} from './database.ts';
import type {RecordInput} from './models.ts';

export function installReviewStandard(db:BrainDB){
 const marker='shared_review_standard_v2';
 if(db.db.prepare('SELECT 1 FROM meta WHERE key=?').get(marker))return 0;
 let capability=db.domains().find(d=>d.id==='reviews'||d.name.toLowerCase()==='review');
 if(!capability)capability=db.saveDomain('Reviews');
 if(capability.name!=='Review')capability=db.saveDomain('Review',capability.id,capability.name);
 const base={domain:capability.id,priority:95,status:'active' as const,checks:[],backend:null};
 const ensure=(input:RecordInput)=>{
  const row=db.db.prepare("SELECT snapshot FROM records WHERE json_extract(snapshot,'$.projectId') IS NULL AND EXISTS (SELECT 1 FROM json_each(records.snapshot,'$.tags') WHERE value=?)").get(input.tags[0]) as {snapshot:string}|undefined;
  return row?JSON.parse(row.snapshot):db.create(input);
 };
 const rules=[
  {tag:'review-standard-correctness',title:'Review rule — correctness, security and data preservation',content:'Trace changed behavior through callers and input/storage boundaries. Review normal, boundary and failure paths, authorization, project isolation, concurrency, migrations and recovery where applicable. Give each finding a concrete trigger, expected/actual behavior, evidence, impact and smallest complete correction. Prioritize security and data-loss defects. Retest fixes and relevant regressions; do not report speculative defects without a reproducible case or source evidence.'},
  {tag:'review-standard-artifacts',title:'Review rule — workflows and artifact compliance',content:'Reconcile the user request, project-selected styles, required dependencies and skills before accepting work. Check required formats and deliverables, not merely validator success. For UI, exercise keyboard/focus, dialogs, navigation, narrow/wide layouts and empty/error states in a real rendered interface. For diagrams, inspect editable source, actual rendered labels/connectors/boundaries and semantic accuracy. For documents, review factual evidence, audience, structure and requested format. Record checks unavailable in the environment as Not verified.'},
  {tag:'review-standard-evidence',title:'Review rule — evidence, findings and final verdict',content:'Report Pass, Fail or Not verified for each applicable acceptance criterion. Name the artifact or file, relevant record version, method, command or inspection evidence and actual result. Separate automated tests, rendered inspection, semantic judgment and agent assertions. An installed skill or retrieved style is not evidence of use. State whether the review is self-review or independent. Resolve material findings and rerun affected checks. Never declare complete compliance while mandatory outputs are missing or required checks remain unverified; report those limits explicitly. Use brain_review when available to record evidence, but its result does not independently prove overall correctness.'}
 ].map(rule=>ensure({...base,kind:'review',title:rule.title,summary:rule.title,content:rule.content,tags:[rule.tag,'review','verification','compliance'],requiredIds:[]}));
 const checklist=ensure({...base,kind:'review',title:'Review checklist — correctness, artifacts and evidence',summary:'Combined acceptance checklist for project-scoped review.',content:rules.map(r=>r.title+'\n'+r.content).join('\n\n'),tags:['shared-review-checklist','review','acceptance'],requiredIds:[]});
 const style=ensure({...base,kind:'preference',title:'Review — evidence-based standards and compliance',
  summary:'Continuous and final review against project requirements, selected styles and verifiable evidence.',
  useWhen:'Reviewing implementation, backend or UI changes, architecture, network diagrams, documents, skills or style updates; verifying deliverables before completion.',
  tags:['shared-review-standard','review','code review','design review','verification','compliance','acceptance','quality','audit'],
  content:'Before work, identify acceptance criteria and retrieve applicable project styles, required links and skills. Reconcile mandatory outputs and conflicting instructions; direct user requirements take precedence. Read the applicable implementation and review skills. During development, review meaningful changes against these criteria. Before completion, apply all required review rules, inspect connected code or artifact sources, run relevant checks, resolve material findings and retest. Use the smallest complete fix and preserve project data, scope and existing decisions. Distinguish a self-review from an independent review. Report findings in severity order with evidence, impact and correction, then a clear verdict and unverified checks. This review style supplements implementation and QC styles; it does not change technology or visual defaults.',
  principles:['Review during work and before completion.','Verify outputs against selected styles and user requirements.','Report concrete findings and honest evidence; validator success is not full compliance.'],
  externalSkills:['ponytail:ponytail-review (for code changes)','ui-ux-pro-max (for UI workflow and visual review)','drawio-skill (for native Draw.io diagram review)'],
  examples:['Backend: submit a stale record version after a newer save. Verify rejection preserves current content and revision history; cite the actual test result.','UI: inspect a modal with keyboard navigation, a long title and a narrow viewport. A successful build is not evidence of focus or layout correctness.','Diagram: verify the requested editable .drawio exists, inspect its native connectors and render each requested page. XML validity alone does not prove correct routes, readable labels or architecture compliance.'],
  reviewCriteria:['Confirm the applicable styles, required links, skills and acceptance criteria were read.','Apply the linked correctness, artifact and evidence rules; report concrete findings and corrective actions.','Resolve material findings, rerun affected checks and state remaining Fail or Not verified results.'],
  requiredIds:[checklist.id]
 });
 if(style.requiredIds.length!==1||style.requiredIds[0]!==checklist.id)db.update(style.id,{requiredIds:[checklist.id]},style.version);
 let attached=0;
 for(const project of db.projects()){
  if(project.assignments.some(a=>a.recordId===style.id))continue;
  // Preserve an existing review selection rather than replace a user's custom standard.
  const selection=project.assignments.find(a=>{const r=db.get(a.recordId);return r?.domain===capability.id&&r.kind==='preference';});
  if(selection)continue;
  db.saveProject({...project,assignments:[...project.assignments,{recordId:style.id,override:null}]},project.id,project.version);
  attached++;
 }
 db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run(marker,'1');
 return attached;
}

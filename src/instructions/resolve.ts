import {BrainDB} from '../core/database.ts';
import {BrainError,type BrainRecord} from '../core/models.ts';
import {applicability,validateTaskContext} from '../core/preference-contract.ts';
import {requirementChecklist} from '../core/requirements.ts';

/** Read-only resolution shared by local preparation and remote clients. */
export function resolveInstructions(db:BrainDB,projectId:string,args:Record<string,unknown>){
 const project=db.project(projectId),context=validateTaskContext(args.context);
 if(typeof args.task!=='string'||!args.task.trim()||args.task.length>1000)throw new BrainError('Task must have 1–1000 characters');
 const ids=args.recordIds;
 if(!Array.isArray(ids)||!ids.length||ids.length>20||!ids.every(id=>typeof id==='string')||new Set(ids).size!==ids.length)throw new BrainError('Choose 1–20 unique project record IDs');
 const available=db.scopedRecords(projectId),records:BrainRecord[]=[],seen=new Set<string>();
 const guidance:Array<{recordId:string;from?:string;status:string;reason:string}>=[];
 const visit=(id:string,from?:string)=>{
  if(seen.has(id))return;seen.add(id);
  const r=available.find(r=>r.id===id);if(!r)throw new BrainError('Instruction is not active or not selected in this project');
  for(const child of r.requiredIds||[])visit(child,r.id);
  for(const link of r.supportingLinks||[]){const status=applicability(link.when,context);guidance.push({recordId:link.recordId,from:r.id,status,reason:JSON.stringify(link.when)});if(status==='applicable')visit(link.recordId,r.id);}
  records.push(r);guidance.push({recordId:id,from,status:'applicable',reason:from?'Required or applicable supporting guidance':'Explicit task selection'});
 };
 ids.forEach(id=>visit(id));
 const keys=new Set([...records.flatMap(r=>(r.preferences||[]).map(p=>p.key)),...(context.preferences||[]).map(p=>p.key)]);
 const decisions=[...keys].map(key=>{
  const choices=records.flatMap(r=>(r.preferences||[]).filter(p=>p.key===key).map(p=>({...p,recordId:r.id,scope:r.projectId?'project':'global',version:r.version})));
  const explicit=context.preferences?.find(p=>p.key===key);
  const candidates=choices.some(p=>p.scope==='project')?choices.filter(p=>p.scope==='project'):choices;
  const values=new Set(candidates.map(p=>p.value));
  return {key,value:explicit?.value??(values.size===1?candidates[0].value:null),status:explicit||values.size===1?'resolved':'conflict',source:explicit?'task':candidates[0]?.scope,choices};
 });
 const effectiveRecords=records.filter(r=>{
  const overridden=(r.preferences||[]).find(p=>p.key.endsWith('.format')&&decisions.some(d=>d.key===p.key&&d.status==='resolved'&&d.value!==p.value));
  if(overridden)guidance.push({recordId:r.id,status:'not_applicable',reason:'Format superseded by resolved '+overridden.key});
  return !overridden;
 });
 const checklist=requirementChecklist(effectiveRecords,context);
 if(checklist.length>300)throw new BrainError('Instruction set exceeds 300 requirements; select fewer roots');
 return {projectId,projectVersion:project.version,task:args.task,context,recordIds:ids,records:effectiveRecords,guidance,decisions,requirementChecklist:checklist,
  unresolved:[...guidance.filter(g=>g.status==='unresolved'),...decisions.filter(d=>d.status==='conflict'),...checklist.filter(c=>!c.optional&&c.applicability==='unresolved')],
  provenance:records.map(r=>({recordId:r.id,version:r.version,scope:r.projectId?'project':'global',sourceStyleId:r.sourceStyleId??null,sourceVersion:r.sourceVersion??null,globalVersion:r.sourceStyleId?db.get(r.sourceStyleId)?.version??null:null})),
  scope:'Explicit task selection; semantic completeness and arbitrary prose contradictions require review.',
  precedence:'Explicit task preferences > project preferences > global defaults > incidental skill defaults. Unconditional requirements remain binding. Do not use ranking priority to resolve conflicts.'};
}

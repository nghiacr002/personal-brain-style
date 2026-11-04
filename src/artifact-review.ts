import {checkInstructionSet} from "./instruction-set.ts";
import {realpathSync,statSync} from 'node:fs';
import {isAbsolute,relative,resolve,extname,sep} from 'node:path';
import {BrainDB} from './database.ts';
import {BrainError} from './models.ts';
import {projectFolder} from './skill-discovery.ts';
import {requirementChecklist} from './requirements.ts';

export function reviewArtifacts(db:BrainDB,projectId:string,args:Record<string,unknown>){
  db.project(projectId);
  if(args.instructionSetId!==undefined)args=checkInstructionSet(db,projectId,args);
  if(typeof args.task!=='string'||!args.task.trim()||args.task.length>1000)throw new BrainError('Artifact review requires a task description (1-1000 characters)');
  if(!Array.isArray(args.recordIds)||!args.recordIds.length||args.recordIds.length>20||!args.recordIds.every(id=>typeof id==='string'))throw new BrainError('Select 1-20 applicable recordIds from this project');
  const scoped=db.scopedRecords(projectId);
  const roots=args.recordIds.map(id=>{const r=scoped.find(r=>r.id===id&&r.status==='active');if(!r)throw new BrainError('Review record is not active in this project');return r;});
  const records=db.requiredRecords(roots,projectId);
  const checklist=requirementChecklist(records);
  if(checklist.length>300)throw new BrainError('Review scope exceeds 300 requirements; review fewer root styles');
  const evidence=args.evidence??[];
  if(!Array.isArray(evidence)||evidence.length>300)throw new BrainError('Evidence must be an array of at most 300 entries');
  const byKey=new Map<string,{status:string;note:string}>();
  for(const e of evidence){
    if(!e||typeof e!=='object'||typeof e.recordId!=='string'||typeof e.requirementId!=='string'||!Number.isInteger(e.recordVersion)||!['pass','fail','not_verified'].includes(e.status)||typeof e.note!=='string'||!e.note.trim()||e.note.length>1000)throw new BrainError('Invalid evidence: recordId, recordVersion, requirementId, status and note are required');
    const requirement=checklist.find(r=>r.recordId===e.recordId&&r.id===e.requirementId);
    const key=e.recordId+':'+e.requirementId;
    if(!requirement||requirement.recordVersion!==e.recordVersion||byKey.has(key))throw new BrainError('Evidence is stale, duplicated or outside the review scope');
    byKey.set(key,e);
  }
  const paths=args.artifacts??[];
  if(!Array.isArray(paths)||paths.length>30||!paths.every(p=>typeof p==='string'&&p.length>0&&p.length<500&&!isAbsolute(p)&&!p.split(/[\\/]/).includes('..')&&!p.includes('\0')))throw new BrainError('Artifacts must be at most 30 repository-relative paths without traversal');
  let root:string|undefined;
  if(paths.length)root=realpathSync(projectFolder(db,projectId));
  const artifacts=paths.map(path=>{
    try{
      const target=realpathSync(resolve(root!,path));const rel=relative(root!,target);
      if(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))throw new BrainError('Artifact escapes linked repository');
      const stat=statSync(target);
      return {path,extension:extname(path).toLowerCase(),exists:stat.isFile()&&stat.size>0,bytes:stat.isFile()?stat.size:0};
    }catch(e){if(e instanceof BrainError)throw e;return {path,extension:extname(path).toLowerCase(),exists:false,bytes:0};}
  });
  const results=checklist.map(r=>{
    const claim=byKey.get(r.recordId+':'+r.id);
    const matching=r.type==='artifact'?artifacts.filter(a=>a.extension===r.extension):[];
    // File metadata proves presence only; editability, meaning and visual quality stay manual.
    const status=claim?.status==='fail'?'fail':r.type==='artifact'?(matching.some(a=>a.exists)?'pass':'fail'):'not_verified';
    return {...r,status,verification:r.type==='artifact'&&claim?.status!=='fail'?'file-presence-only':'agent-report-only',agentReported:claim?.status??null,note:claim?.note??'',artifacts:matching.map(a=>a.path)};
  });
  const textReviews=typeof args.content==='string'?[...new Set(records.map(r=>r.domain))].map(domain=>db.evaluate(args.content as string,domain,projectId)):[];
  const recordIds=new Set(records.map(r=>r.id));
  const pendingTextChecks=typeof args.content==='string'?0:records.reduce((n,r)=>n+(r.checks?.length||0),0);
  const textFindings=[...new Map(textReviews.flatMap(r=>r.findings).filter(f=>recordIds.has(f.ruleId)).map(f=>[JSON.stringify(f),f])).values()];
  const status=results.some(r=>r.status==='fail')||textFindings.some(f=>!f.passed)?'fail':(!results.length&&!textFindings.length)||pendingTextChecks>0||results.some(r=>r.status==='not_verified')?'not_verified':'pass';
  const report={instructionSetId:args.instructionSetId??null,task:args.task,status,scope:'Agent-selected applicable styles and required dependencies; completeness of task selection is not verified.',results,artifacts,textFindings,pendingTextChecks,note:'Pass covers the listed automated checks only. File presence does not prove format validity or editability. Agent-reported passes remain Not verified. This report does not certify full compliance.'};
  const serialized=JSON.stringify(report);
  if(serialized.length>100000)throw new BrainError('Review report too large; reduce scope or evidence');
  const event=db.trace({agent:'unknown',channel:'review',eventType:'compliance.review',outcome:status,recordIds:records.map(r=>r.id),recordVersions:Object.fromEntries(records.map(r=>[r.id,r.version])),metadata:{projectId,complianceReport:serialized,sessionLinked:false}});
  return {reviewId:event.id,...report};
}

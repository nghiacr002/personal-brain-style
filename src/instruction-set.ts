import {createHash,randomUUID} from 'node:crypto';
import {BrainDB} from './database.ts';
import {BrainError,type BrainRecord} from './models.ts';
import {requirementChecklist} from './requirements.ts';

const digest=(records:BrainRecord[])=>createHash('sha256').update(JSON.stringify(records)).digest('hex');
function resolveRecords(db:BrainDB,projectId:string,ids:unknown){
 if(!Array.isArray(ids)||!ids.length||ids.length>20||!ids.every(id=>typeof id==='string')||new Set(ids).size!==ids.length)throw new BrainError('Choose 1–20 unique project record IDs');
 const available=db.scopedRecords(projectId);
 const roots=ids.map(id=>{const r=available.find(r=>r.id===id);if(!r)throw new BrainError('Instruction is not selected in this project');return r;});
 return db.requiredRecords(roots,projectId);
}
export function prepareInstructions(db:BrainDB,projectId:string,args:Record<string,unknown>){
 const project=db.project(projectId);
 if(typeof args.task!=='string'||!args.task.trim()||args.task.length>1000)throw new BrainError('Task must have 1–1000 characters');
 const records=resolveRecords(db,projectId,args.recordIds);
 const checklist=requirementChecklist(records);
 if(checklist.length>300)throw new BrainError('Instruction set exceeds 300 requirements; select fewer roots');
 const instructionSet={id:randomUUID(),projectId,projectVersion:project.version,task:args.task,recordIds:args.recordIds,resolvedIds:records.map(r=>r.id),digest:digest(records),createdAt:new Date().toISOString()};
 db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run('instruction-set:'+instructionSet.id,JSON.stringify(instructionSet));
 return {instructionSetId:instructionSet.id,projectId,projectVersion:project.version,task:args.task,records,requirementChecklist:checklist,scope:'Agent-selected applicable instructions and their required dependencies. Task-selection completeness is not verified.',next:'Read applicable external skills. Resolve contradictions before work. Submit brain_review with this instructionSetId after checking artifacts. Changed instructions or project selections require a fresh set.'};
}
export function checkInstructionSet(db:BrainDB,projectId:string,args:Record<string,unknown>){
 if(typeof args.instructionSetId!=='string')throw new BrainError('Invalid instructionSetId');
 const row=db.db.prepare('SELECT value FROM meta WHERE key=?').get('instruction-set:'+args.instructionSetId) as {value:string}|undefined;
 if(!row)throw new BrainError('Instruction set not found');
 const set=JSON.parse(row.value);
 if(set.projectId!==projectId)throw new BrainError('Instruction set belongs to another project');
 if(db.project(projectId).version!==set.projectVersion||digest(resolveRecords(db,projectId,set.recordIds))!==set.digest)throw new BrainError('Instructions or project selections changed; prepare a new instruction set and review again','CONFLICT',409);
 if(args.task!==undefined&&args.task!==set.task)throw new BrainError('Review task differs from the prepared instruction set');
 if(args.recordIds!==undefined&&JSON.stringify(args.recordIds)!==JSON.stringify(set.recordIds))throw new BrainError('Review scope differs from the prepared instruction set');
 return {...args,task:set.task,recordIds:set.recordIds};
}

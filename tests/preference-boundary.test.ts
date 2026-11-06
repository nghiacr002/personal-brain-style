import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {resolveInstructions} from '../src/instructions/resolve.ts';
import {prepareInstructions,checkInstructionSet} from '../src/instructions/instruction-set.ts';
import {seedGlobalStyles} from '../src/styles/global-style-seed.ts';
import {matchSkill} from '../src/projects/skill-discovery.ts';
import {callTool} from '../src/agents/mcp.ts';
import {catalogUpgradePreview,applyCatalogUpgrade} from '../src/styles/catalog-upgrade.ts';

function fixture(){
 const folder=mkdtempSync(join(tmpdir(),'pb-boundary-')),db=new BrainDB(join(folder,'db'));
 const record=(title:string,extra:object={})=>db.create({kind:'preference',domain:'coding',title,summary:title,content:title,tags:[],priority:90,status:'active',checks:[],backend:null,...extra});
 const project=(ids:string[])=>db.saveProject({name:'Test',description:'',assignments:ids.map(recordId=>({recordId,override:null}))});
 return {db,record,project,close(){db.close();rmSync(folder,{recursive:true,force:true});}};
}

test('PB-01/PB-11 planning excludes conditional templates; unknown applicability stays unresolved',()=>{
 const f=fixture();try{
  const template=f.record('Formal test plan',{domain:'writing'}),style=f.record('Develop',{supportingLinks:[{recordId:template.id,when:{activities:['test']}}]});
  const project=f.project([style.id]),args={task:'Plan changes',recordIds:[style.id],context:{activity:'plan',formats:[]}};
  assert.deepEqual(resolveInstructions(f.db,project.id,args).records.map(r=>r.id),[style.id]);
  assert.equal(resolveInstructions(f.db,project.id,{...args,context:{}}).unresolved.length,1);
  assert.throws(()=>prepareInstructions(f.db,project.id,{...args,context:{}}),/applicability/);
  assert.equal(resolveInstructions(f.db,project.id,{...args,context:{activity:'test'}}).records.length,2);
 }finally{f.close();}
});
test('PB-02/PB-03 explicit format resolves conflicting defaults without ranking authority',()=>{
 const f=fixture();try{
  f.db.saveDomain('Coding','coding',f.db.domains().find(d=>d.id==='coding')!.name,true);
  const a=f.record('Draw',{preferences:[{key:'diagram.format',value:'drawio'}],requirements:[{id:'req-source',type:'artifact',extension:'.drawio',label:'Editable source'}]}),b=f.record('Mermaid',{preferences:[{key:'diagram.format',value:'mermaid'}]});
  const project=f.project([a.id,b.id]),args={task:'Draw diagram',recordIds:[a.id,b.id]};
  assert.equal(resolveInstructions(f.db,project.id,args).decisions[0].status,'conflict');
  const resolved=resolveInstructions(f.db,project.id,{...args,context:{formats:['mermaid'],preferences:[{key:'diagram.format',value:'mermaid'}]}});
  assert.equal(resolved.decisions[0].source,'task');assert.deepEqual(resolved.records.map(r=>r.id),[b.id]);assert.equal(resolved.requirementChecklist.length,0);
 }finally{f.close();}
});
test('PB-04/PB-12 optional skills do not block preparation; unconditional requirements cannot be skipped',async()=>{
 const f=fixture();try{
  const r=f.record('Work',{requirements:[{id:'req-proof',label:'Evidence',type:'manual'}],skillBindings:[{name:'renderer',when:{formats:['drawio']},required:false,fallback:'Author source and report rendering not verified'}]}),p=f.project([r.id]);
  const set=prepareInstructions(f.db,p.id,{task:'Work',recordIds:[r.id],context:{formats:[]}});
  assert.equal(set.requirementChecklist.find(r=>r.id==='binding-1')?.applicability,'not_applicable');
  const report=await callTool(f.db,'brain_review',{projectId:p.id,instructionSetId:set.instructionSetId,evidence:[{recordId:r.id,recordVersion:r.version,requirementId:'req-proof',status:'not_applicable',note:'Skip'}]});
  assert.ok('isError' in report);
  const honest=JSON.parse((await callTool(f.db,'brain_review',{projectId:p.id,instructionSetId:set.instructionSetId})).content[0].text);assert.equal(honest.status,'not_verified');
 }finally{f.close();}
});
test('PB-05 requesting host avoids unrelated agent skill copies',()=>{
 const skills=[{id:'a',name:'renderer',description:'',scope:'agent' as const,agent:'codex',file:'/a',digest:'a'},{id:'b',name:'renderer',description:'',scope:'agent' as const,agent:'claude',file:'/b',digest:'b'}];
 assert.equal(matchSkill('renderer',skills).status,'ambiguous');assert.equal(matchSkill('renderer',skills,'codex').skills[0].id,'a');assert.equal(matchSkill('renderer',skills,'chatgpt').status,'missing');
});
test('PB-06/PB-07 read-only resolution matches preparation and rejects changed context',async()=>{
 const f=fixture();try{
  const r=f.record('Work'),p=f.project([r.id]),args={task:'Work',recordIds:[r.id],context:{activity:'implement',formats:[]}};
  const before=f.db.db.prepare('SELECT count(*) n FROM meta').get()!.n;
  const remote=JSON.parse((await callTool(f.db,'brain_resolve',{...args,projectId:p.id})).content[0].text);
  assert.equal(f.db.db.prepare('SELECT count(*) n FROM meta').get()!.n,before);
  const set=prepareInstructions(f.db,p.id,args);assert.deepEqual(remote.records,set.records);
  assert.throws(()=>checkInstructionSet(f.db,p.id,{instructionSetId:set.instructionSetId,context:{activity:'plan'}}),/context/);
 }finally{f.close();}
});
test('PB-08 legacy references persist; contracts reject unknown conditions and cross-project links',()=>{
 const f=fixture();try{
  const legacy=f.record('Legacy',{externalSkills:['old-skill (when needed)']}),p=f.project([legacy.id]);
  const copy=f.db.personalizeRecord(p.id,legacy.id,{content:'Private'},legacy.version,p.version);
  assert.equal(copy.sourceVersion,legacy.version);assert.deepEqual(copy.externalSkills,legacy.externalSkills);
  assert.throws(()=>f.record('Invalid',{supportingLinks:[{recordId:copy.id,when:{activity:['test']}}]}),/Unknown/);
  assert.throws(()=>f.record('Leak',{supportingLinks:[{recordId:copy.id,when:{activities:['test']}}]}),/another project/);
 }finally{f.close();}
});
test('PB-09 catalog upgrades preserve personal edits and private copies',()=>{
 const f=fixture();try{
  seedGlobalStyles(f.db);const r=f.db.list({limit:300}).find(r=>r.keyId==='development')!;
  f.db.update(r.id,{content:'My own workflow'},r.version);
  const proposal=catalogUpgradePreview(f.db).find(p=>p.id===r.id)!;assert.equal(proposal.eligible,false);
  assert.throws(()=>applyCatalogUpgrade(f.db,r.id,proposal.version),/personal edits/);assert.equal(f.db.get(r.id)!.content,'My own workflow');
 }finally{f.close();}
});
test('PB-01 catalog development no longer requires formal test documents during planning',()=>{
 const f=fixture();try{
  seedGlobalStyles(f.db);const r=f.db.list({limit:300}).find(r=>r.keyId==='development')!,p=f.project([r.id]);
  const resolved=resolveInstructions(f.db,p.id,{task:'Plan change',recordIds:[r.id],context:{activity:'plan',formats:[]}});
  assert.ok(!resolved.records.some(r=>r.keyId==='doc-test'||r.keyId==='quality-assurance'));
  assert.ok(!r.content.includes('METHOD\n'));
 }finally{f.close();}
});


test('PB-09 reviewed catalog update is versioned, preserves private copies, and rolls back on conflicts',()=>{
 const f=fixture();try{
  const legacy=JSON.parse(readFileSync(new URL('./fixtures/legacy-coding-preference.json',import.meta.url),'utf8'));
  f.db.saveDomain('Engineering standards');
  const original=f.db.create(legacy),p=f.project([original.id]);
  const privateCopy=f.db.personalizeRecord(p.id,original.id,{content:'Personal project choice'},original.version,p.version);
  const preview=catalogUpgradePreview(f.db).find(p=>p.id===original.id)!;assert.equal(preview.eligible,true);
  const upgraded=applyCatalogUpgrade(f.db,original.id,preview.version);
  assert.equal(upgraded.version,original.version+1);assert.ok(upgraded.skillBindings?.length);
  assert.equal(f.db.get(privateCopy.id)!.content,'Personal project choice');assert.equal(f.db.get(privateCopy.id)!.sourceVersion,original.version);
  assert.throws(()=>applyCatalogUpgrade(f.db,original.id,preview.version),/changed/);
  f.db.restore(original.id,original.version,upgraded.version);assert.equal(f.db.get(original.id)!.content,original.content);
  const blocker=f.record('Additional required rule');const restored=f.db.get(original.id)!;
  f.db.update(restored.id,{requiredIds:[blocker.id]},restored.version);
  assert.equal(catalogUpgradePreview(f.db).find(p=>p.id===original.id)!.eligible,false);
 }finally{f.close();}
});


test('conditional alternatives do not conflict before applicability is evaluated',()=>{
 const f=fixture();try{
  const a=f.record('First format',{domain:'writing'}),b=f.record('Second format',{domain:'writing'});
  const root=f.record('Work',{supportingLinks:[{recordId:a.id,when:{formats:['markdown']}},{recordId:b.id,when:{formats:['html']}}]});
  const p=f.project([root.id]);
  const resolved=resolveInstructions(f.db,p.id,{task:'Write',recordIds:[root.id],context:{formats:['html']}});
  assert.deepEqual(resolved.records.map(r=>r.id),[b.id,root.id]);
 }finally{f.close();}
});

test('project-private structured choices precede global defaults',()=>{
 const f=fixture();try{
  f.db.saveDomain('Coding','coding',f.db.domains().find(d=>d.id==='coding')!.name,true);
  const a=f.record('Global',{preferences:[{key:'verbosity',value:'brief'}]}),b=f.record('Other',{preferences:[{key:'verbosity',value:'detailed'}]});
  const p=f.project([a.id,b.id]);const local=f.db.personalizeRecord(p.id,b.id,{content:'Project preference'},b.version,p.version);
  const resolved=resolveInstructions(f.db,p.id,{task:'Work',recordIds:[a.id,local.id]});
  assert.equal(resolved.decisions[0].value,'detailed');assert.equal(resolved.decisions[0].source,'project');
 }finally{f.close();}
});


test('discovery reports selection evidence and excludes unrelated literal queries',()=>{
 const f=fixture();try{
  seedGlobalStyles(f.db);
  const irrelevant=['hello there','what is 2 plus 2','zzqxv'];
  const falsePositives=irrelevant.flatMap(task=>f.db.discover(task));
  assert.equal(falsePositives.length,0);
  const named=f.db.discover('doc-hld')[0];assert.equal(named.keyId,'doc-hld');assert.ok(named.matches.some(m=>m.field==='key'));assert.ok(named.matchReason);
 }finally{f.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {fusionInput,validateFusion,applyFusion,startFusion,fusionJob,parseFusionOutput,rejectFusion,cancelFusion} from '../src/instructions/fusion.ts';
import {installResearchStyle} from '../src/styles/research-style.ts';

test('Fusion reads one complete JSON response with CLI prose or fences, but rejects ambiguous or broken output',()=>{
 const value={proposals:[{content:'Braces { } and escaped "quotes" and slash \\ remain literal',nested:{items:[1,2]}}]};
 const json=JSON.stringify(value);
 for(const output of [json,json+'\nAnalysis complete.','Here is the result:\n```json\n'+json+'\n```\nReview before publishing.'])assert.deepEqual(parseFusionOutput(output),value);
 assert.throws(()=>parseFusionOutput(json+'\n{"proposals":[]}'),/ambiguous/);
 assert.throws(()=>parseFusionOutput(json.slice(0,-1)),/incomplete/);
 assert.throws(()=>parseFusionOutput('{"proposals":broken}'),/invalid/);
 assert.throws(()=>parseFusionOutput('No result'),/no proposal JSON/);
 assert.throws(()=>validateFusion(parseFusionOutput('{"wrong":[]}\nDone'),[],[]),/proposals/);
});

test('trace project scope isolates events and aggregate counts including no-project events',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pb-trace-scope-')),db=new BrainDB(join(dir,'db'));
 try{
 const a=db.saveProject({name:'A',description:'',assignments:[]}),b=db.saveProject({name:'B',description:'',assignments:[]});
 for(const id of [a.id,b.id,undefined])db.trace({runId:'r',agent:'codex',channel:'hook',eventType:'hook.session.context',outcome:'emitted',metadata:{...(id?{projectId:id}:{}),contextChars:100}});
 assert.equal(db.listTrace({projectId:a.id}).length,1);assert.equal(db.traceStats(a.id).events,1);assert.equal(db.traceStats(a.id).estimatedContextTokens,25);
 assert.equal(db.listTrace({projectId:'unscoped'}).length,1);assert.equal(db.traceStats('unscoped').events,1);assert.equal(db.traceStats().events,3);
 assert.throws(()=>db.listTrace({projectId:'missing'}));
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Fusion rejects fabricated sources/conflicts/stale sources and publishes only a new shared version',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pb-fusion-')),db=new BrainDB(join(dir,'db'));
 try{
 const r=db.create({kind:'preference',domain:'coding',title:'Code',summary:'Original',content:'Original',tags:[],priority:90,status:'active',checks:[],backend:null});
 const p=db.saveProject({name:'A',description:'',assignments:[{recordId:r.id,override:null}]});
 const local=db.personalizeRecord(p.id,r.id,{content:'Private source'},r.version,p.version);
 const input=fusionInput(db,[p.id]);assert.ok(input.sources.some(s=>s.recordId===local.id));assert.ok(input.targets.every(s=>!s.projectId));
 const proposal={targetId:r.id,title:'Code',summary:'Better',content:'Reusable methods',principles:['Simple'],examples:['Example'],externalSkills:[],reviewCriteria:['Check'],rationale:'Evidence',conflicts:[],sourceIds:[p.id+':'+local.id]};
 assert.throws(()=>validateFusion({proposals:[{...proposal,sourceIds:['fake']}]},input.sources,input.targets));
 const proposals=validateFusion({proposals:[proposal]},input.sources,input.targets);
 const job={id:'test',status:'ready',sources:input.sources,targets:input.targets,proposals,applied:[]};
 const save=()=>db.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('fusion:test',?)").run(JSON.stringify(job));
 save();const updated=applyFusion(db,'test',r.id);assert.equal(updated.version,2);assert.equal(db.get(local.id)!.content,'Private source');assert.throws(()=>applyFusion(db,'test',r.id));
 job.targets=[updated];job.applied=[];job.proposals=[{...proposal,conflicts:['Conflict']} as any];save();assert.throws(()=>applyFusion(db,'test',r.id));
 job.proposals=proposals;save();db.update(local.id,{content:'Changed'},local.version);assert.throws(()=>applyFusion(db,'test',r.id),/Source style changed/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Research installs once and is required by architecture without selecting a palette',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pb-research-')),db=new BrainDB(join(dir,'db'));
 try{
 const r=db.create({kind:'preference',domain:'architecture',title:'Architecture',summary:'',content:'Existing',tags:[],priority:90,status:'active',checks:[],backend:null});
 const p=db.saveProject({name:'A',description:'',assignments:[{recordId:r.id,override:null}]});
 installResearchStyle(db);const research=db.list().find(s=>s.domain==='research')!;
 assert.ok(db.get(r.id)!.requiredIds.includes(research.id));assert.ok(db.scopedRecords(p.id).some(s=>s.id===research.id));
 const version=db.project(p.id).version;installResearchStyle(db);assert.equal(db.project(p.id).version,version);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Fusion reports missing CLI as a persisted failure without changing styles',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pb-fusion-cli-')),db=new BrainDB(join(dir,'db')),path=process.env.PATH;
 try{
  const p=db.saveProject({name:'A',description:'',assignments:[]});
  assert.throws(()=>startFusion(db,null as any),/Choose Codex or Claude/);
  process.env.PATH=dir;
  const run=startFusion(db,{agent:'codex',projectIds:[p.id]});
  for(let i=0;i<100&&fusionJob(db,run.id).status==='running';i++)await new Promise(resolve=>setTimeout(resolve,10));
  const job=fusionJob(db,run.id);
  assert.equal(job.status,'failed');assert.match(job.error!,/Cannot start codex/);assert.deepEqual(db.list(),[]);
 }finally{process.env.PATH=path;db.close();rmSync(dir,{recursive:true,force:true});}
});


test('Fusion retains different overrides, excludes unselected styles, rejects drift and rolls back failed publication',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pb-fusion-boundaries-')),db=new BrainDB(join(dir,'db'));
 try{
  const r=db.create({kind:'preference',domain:'coding',title:'Code',summary:'Original',content:'Original',tags:['code'],useWhen:'When coding',priority:90,status:'active',checks:[],backend:null,reviewCriteria:['Keep this check'],requirements:[{id:'req-output',label:'Editable output',type:'artifact',extension:'.txt'}]});
  const a=db.saveProject({name:'A',description:'',assignments:[{recordId:r.id,override:'A convention'}]});
  const b=db.saveProject({name:'B',description:'',assignments:[{recordId:r.id,override:'B convention'}]});
  db.create({kind:'preference',domain:'design',projectId:a.id,title:'Unselected',summary:'',content:'Do not learn this',tags:[],priority:90,status:'active',checks:[],backend:null});
  const input=fusionInput(db,[a.id,b.id,a.id]);
  assert.equal(input.sources.length,2);assert.equal(input.projects.length,2);
  assert.deepEqual(input.sources.map(r=>r.content),['A convention','B convention']);
  assert.notEqual(input.sources[0].id,input.sources[1].id);
  const proposal={targetId:r.id,title:'Code',summary:'Better',content:'Reusable convention',principles:[],examples:[],externalSkills:[],reviewCriteria:['Keep this check'],rationale:'Compare evidence',conflicts:[],sourceIds:[input.sources[0].id]};
  assert.throws(()=>validateFusion({proposals:[{...proposal,externalSkills:['invented']}]},input.sources,input.targets),/invents/);
  assert.throws(()=>validateFusion({proposals:[{...proposal,content:'Run npm install renderer then write mxGeometry'}]},input.sources,input.targets),/technical recipe/);
  assert.throws(()=>validateFusion({proposals:[{...proposal,reviewCriteria:[]}]},input.sources,input.targets),/removes/);
  const proposals=validateFusion({proposals:[proposal]},input.sources,input.targets);
  const job={id:'atomic',status:'ready',sources:input.sources,targets:input.targets,proposals,applied:[]};
  db.db.prepare("INSERT INTO meta(key,value) VALUES('fusion:atomic',?)").run(JSON.stringify(job));
  db.db.exec("CREATE TRIGGER fail_fusion BEFORE UPDATE ON meta WHEN NEW.key='fusion:atomic' BEGIN SELECT RAISE(ABORT,'forced failure'); END;");
  assert.throws(()=>applyFusion(db,'atomic',r.id),/forced failure/);
  assert.equal(db.get(r.id)!.version,1);assert.equal(db.history(r.id).length,1);
  db.db.exec('DROP TRIGGER fail_fusion');
  db.saveProject({...a,assignments:[{recordId:r.id,override:'Changed override'}]},a.id,a.version);
  assert.throws(()=>applyFusion(db,'atomic',r.id),/selection changed/);
  rejectFusion(db,'atomic',r.id);assert.throws(()=>applyFusion(db,'atomic',r.id),/already decided/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});


test('Fusion CLI completes, cancels and does not recreate deleted project history',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pb-fusion-lifecycle-')),db=new BrainDB(join(dir,'db')),path=process.env.PATH;
 const windowsAgent=(delay:number)=>{
  writeFileSync(join(dir,'claude.cmd'),'@ECHO off\r\n"%dp0%/agent.cjs" %*');
  writeFileSync(join(dir,'agent.cjs'),`process.stdin.resume();process.stdin.on('end',()=>setTimeout(()=>console.log('{"proposals":[]}'),${delay}));`);
 };
 const wait=async(id:string)=>{for(let i=0;i<500;i++){await new Promise(resolve=>setTimeout(resolve,10));const row=db.db.prepare('SELECT value FROM meta WHERE key=?').get('fusion:'+id) as any;if(!row||JSON.parse(row.value).status!=='running')return;}};
 try{
  const project=db.saveProject({name:'A',description:'',assignments:[]});
  writeFileSync(join(dir,'claude'),`#!/bin/sh\n/bin/cat >/dev/null\nprintf '{"proposals":[]}\\n'\n`,{mode:0o755});
  if(process.platform==='win32')windowsAgent(0);
  process.env.PATH=dir;
  const ready=startFusion(db,{agent:'claude',projectIds:[project.id]});await wait(ready.id);
  assert.equal(fusionJob(db,ready.id).status,'ready');
  writeFileSync(join(dir,'claude'),'#!/bin/sh\n/bin/cat >/dev/null\nexec /bin/sleep 30\n',{mode:0o755});
  if(process.platform==='win32')windowsAgent(30000);
  const cancelled=startFusion(db,{agent:'claude',projectIds:[project.id]});
  assert.equal(cancelFusion(db,cancelled.id).status,'cancelled');
  writeFileSync(join(dir,'claude'),`#!/bin/sh\n/bin/cat >/dev/null\n/bin/sleep 0.05\nprintf '{"proposals":[]}\\n'\n`,{mode:0o755});
  if(process.platform==='win32')windowsAgent(50);
  const deleted=startFusion(db,{agent:'claude',projectIds:[project.id]});
  const preview=db.deletionPreview('project',project.id);db.deleteWithPreview('project',project.id,preview.fingerprint);
  assert.equal(db.db.prepare("SELECT count(*) n FROM meta WHERE key LIKE 'fusion:%'").get()!.n,0);
  await new Promise(resolve=>setTimeout(resolve,150));
  assert.throws(()=>fusionJob(db,deleted.id),/not found/);
 }finally{process.env.PATH=path;db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Fusion uses preference evidence and preserves required skill references',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pb-fusion-evidence-')),db=new BrainDB(join(dir,'db'));
 try{
  const base={domain:'coding',title:'Code',summary:'Summary',content:'Instructions',tags:[],priority:90,status:'active',checks:[],backend:null};
  const review=db.create({...base,kind:'review',title:'Review evidence'});
  const style=db.create({...base,kind:'preference',externalSkills:['verified-reference'],requiredIds:[review.id]});
  const project=db.saveProject({name:'A',description:'',assignments:[{recordId:style.id,override:null}]});
  const input=fusionInput(db,[project.id]);
  assert.ok(!input.sources.some(r=>r.recordId===review.id&&r.kind==='review'));
  const proposal={targetId:style.id,title:'Code',summary:'Improved',content:'Improved instructions',principles:[],examples:[],externalSkills:[],reviewCriteria:[],rationale:'Evidence',conflicts:[],sourceIds:[project.id+':'+style.id]};
  assert.throws(()=>validateFusion({proposals:[proposal]},input.sources,input.targets),/removes a required skill/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

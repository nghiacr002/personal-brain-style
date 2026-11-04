import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {reviewArtifacts} from '../src/instructions/artifact-review.ts';
import {linkRepository} from '../src/projects/project-scope.ts';
import {callTool} from '../src/agents/mcp.ts';

test('artifact evidence verifies presence, preserves manual uncertainty and rejects unsafe or stale evidence',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pb-evidence-')),outside=mkdtempSync(join(tmpdir(),'pb-outside-'));
 const db=new BrainDB(join(dir,'brain.sqlite'));
 try{
  const r=db.create({kind:'preference',domain:'diagrams',title:'Drawing',summary:'',content:'Editable drawing',tags:[],priority:90,status:'active',checks:[],backend:null,
   requirements:[{id:'req-file',label:'Source file',type:'artifact',extension:'.drawio'},{id:'req-edit',label:'Native elements editable',type:'manual'}]});
  const p=db.saveProject({name:'Drawing project',description:'',assignments:[{recordId:r.id,override:null}]});
  const q=db.saveProject({name:'Other',description:'',assignments:[]});
  linkRepository(dir,p.id);db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run('repository:'+p.id,dir);
  const args={task:'Draw system',recordIds:[r.id],artifacts:['system.drawio'],evidence:[{recordId:r.id,recordVersion:r.version,requirementId:'req-edit',status:'pass',note:'Agent inspected editor'}]};
  assert.equal(reviewArtifacts(db,p.id,args).status,'fail');
  writeFileSync(join(dir,'system.drawio'),'<mxfile/>');
  const result=reviewArtifacts(db,p.id,args);
  assert.equal(result.status,'not_verified');assert.equal(result.results[0].status,'pass');assert.equal(result.results[1].status,'not_verified');assert.equal(result.results[1].agentReported,'pass');
  assert.equal(db.projectActivity(p.id).complianceReviews.length,2);assert.equal(db.projectActivity(q.id).complianceReviews.length,0);
  assert.throws(()=>reviewArtifacts(db,q.id,args),/not active/);
  assert.throws(()=>reviewArtifacts(db,p.id,{...args,artifacts:['../escape.drawio']}),/relative/);
  assert.throws(()=>reviewArtifacts(db,p.id,{...args,evidence:[{...args.evidence[0],recordVersion:99}]}),/stale/);
  assert.throws(()=>reviewArtifacts(db,p.id,{...args,evidence:[...args.evidence,...args.evidence]}),/duplicated/);
  writeFileSync(join(outside,'external.drawio'),'external');symlinkSync(join(outside,'external.drawio'),join(dir,'linked.drawio'));
  assert.throws(()=>reviewArtifacts(db,p.id,{...args,artifacts:['linked.drawio']}),/escapes/);
  const update=await callTool(db,'brain_update_project_style',{projectId:p.id,id:r.id,expectedVersion:r.version,expectedProjectVersion:p.version,changes:{requirements:[{id:'req-new',label:'Check',type:'manual'}]}});
  assert.equal(update.isError,undefined);assert.equal(JSON.parse(update.content[0].text).record.requirements[0].id,'req-new');assert.equal(db.get(r.id)!.requirements![0].id,'req-file');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});

test('text checks are scoped to reviewed styles, and absent text is not marked passed',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pb-checks-')),db=new BrainDB(join(dir,'brain.sqlite'));
 try{
  const base={kind:'preference',domain:'coding',title:'Code',summary:'',content:'Code',tags:[],priority:90,status:'active',backend:null};
  const r=db.create({...base,checks:[{type:'contains',value:'yes'}]});
  const unrelated=db.create({...base,kind:'review',checks:[{type:'contains',value:'other'}]});
  const p=db.saveProject({name:'Checks',description:'',assignments:[{recordId:r.id,override:null},{recordId:unrelated.id,override:null}]});
  const args={task:'Check code',recordIds:[r.id]};
  assert.equal(reviewArtifacts(db,p.id,args).status,'not_verified');
  const pass=reviewArtifacts(db,p.id,{...args,content:'yes'});assert.equal(pass.status,'pass');assert.equal(pass.textFindings.length,1);
  assert.equal(reviewArtifacts(db,p.id,{...args,content:'no'}).status,'fail');
  assert.throws(()=>db.update(r.id,{...r,requirements:[{id:'bad',label:'bad',type:'manual'}]},r.version),/requirement/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

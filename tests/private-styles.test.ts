import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {BrainDB} from "../src/database.ts";
import {callTool} from "../src/mcp.ts";
test("private styles cannot leak into global or another project's selection and dependencies",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-private-"));const db=new BrainDB(join(dir,"brain.sqlite"));
 try{
  const p=db.saveProject({name:"Owner",description:"",assignments:[]}),q=db.saveProject({name:"Other",description:"",assignments:[]});
  const input={kind:"preference",domain:"writing",title:"Private",summary:"Private",content:"Private content",tags:[],priority:90,status:"active",checks:[],backend:null};
  const r=db.create({...input,projectId:p.id});
  assert.equal(db.list().length,0);assert.equal(db.list({projectId:q.id}).length,0);assert.equal(db.list({projectId:p.id}).length,1);
  assert.equal(db.scopedRecords().length,0);
  assert.throws(()=>db.saveProject({...q,assignments:[{recordId:r.id,override:null}]},q.id,q.version),/another project/);
  assert.throws(()=>db.create({...input,requiredIds:[r.id]}),/another project/);
  assert.throws(()=>db.create({...input,projectId:q.id,requiredIds:[r.id]}),/another project/);
  db.saveProject({...p,assignments:[{recordId:r.id,override:null}]},p.id,p.version);
  assert.equal(db.scopedRecords(p.id)[0].id,r.id);
  assert.ok((await callTool(db,"brain_get",{id:r.id,projectId:q.id})).isError);
  assert.ok(!(await callTool(db,"brain_get",{id:r.id,projectId:p.id})).isError);
  assert.throws(()=>db.update(r.id,{...r,projectId:q.id},r.version),/scope/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});


test("project edits clone shared styles and dependent ancestors atomically",()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-personalize-"));const db=new BrainDB(join(dir,"brain.sqlite"));
 try{
  const input={kind:"preference",domain:"writing",title:"Writing",summary:"Summary",content:"Global",tags:[],priority:90,status:"active",checks:[],backend:null,externalSkills:["writer"],reviewCriteria:["Review"],examples:["Example"]};
  const shared=db.create(input),parent=db.create({...input,domain:"coding",title:"Coding",requiredIds:[shared.id]});
  const p=db.saveProject({name:"Owner",description:"",assignments:[{recordId:parent.id,override:null}]}),q=db.saveProject({name:"Other",description:"",assignments:[{recordId:parent.id,override:null}]});
  const local=db.personalizeRecord(p.id,shared.id,{...shared,content:"Local"},shared.version,p.version);
  assert.equal(local.projectId,p.id);assert.notEqual(local.id,shared.id);assert.deepEqual(local.externalSkills,["writer"]);
  const resolved=db.scopedRecords(p.id);assert.equal(resolved.length,2);assert.ok(resolved.every(r=>r.projectId===p.id));assert.ok(resolved[0].requiredIds?.includes(local.id));
  assert.equal(db.get(shared.id)?.content,"Global");assert.equal(db.get(parent.id)?.version,1);assert.equal(db.scopedRecords(q.id)[0].id,parent.id);assert.equal(db.list().length,2);
  const current=db.project(p.id);
  assert.throws(()=>db.personalizeRecord(p.id,local.id,{...local,status:"draft"},local.version,current.version),/active status/);
  assert.equal(db.project(p.id).version,current.version);assert.equal(db.get(local.id)?.version,1);
  assert.throws(()=>db.personalizeRecord(p.id,local.id,local,local.version,p.version),/Project changed/);
  const updated=db.personalizeRecord(p.id,local.id,{...local,content:"Revised"},local.version,current.version);
  assert.equal(updated.id,local.id);assert.equal(updated.version,2);
  assert.throws(()=>db.personalizeRecord(q.id,local.id,local,local.version,q.version),/not selected/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});


test("MCP edits require explicit project scope and publishing copies private dependency closure",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-publish-"));const db=new BrainDB(join(dir,"brain.sqlite"));
 try{
  const input={kind:"preference",domain:"writing",title:"Writing",summary:"Summary",content:"Global",tags:[],priority:90,status:"active",checks:[],backend:null};
  const original=db.create(input);
  const project=db.saveProject({name:"Owner",description:"",assignments:[{recordId:original.id,override:null}]});
  const args={projectId:project.id,id:original.id,expectedVersion:1,expectedProjectVersion:1,changes:{content:"Private instructions",externalSkills:["writer"],examples:["Example"],reviewCriteria:["Review"]}};
  assert.ok((await callTool(db,"brain_update_project_style",{...args,projectId:undefined})).isError);
  assert.ok((await callTool(db,"brain_update_project_style",{...args,changes:{projectId:"other"}})).isError);
  const response=await callTool(db,"brain_update_project_style",args);assert.ok(!response.isError);
  const {record:local,projectVersion}=JSON.parse(response.content[0].text);assert.equal(projectVersion,2);assert.equal(local.projectId,project.id);assert.deepEqual(local.externalSkills,["writer"]);
  assert.equal(db.get(original.id)?.content,"Global");
  assert.ok((await callTool(db,"brain_update_project_style",args)).isError);
  const parent=db.create({...input,projectId:project.id,domain:"coding",title:"Private parent",requiredIds:[local.id]});
  const published=db.publishProjectRecord(project.id,parent.id,parent.version);
  assert.equal(published.published.length,2);assert.ok(published.published.every(r=>!r.projectId));
  const child=published.published.find(r=>r.id!==published.record.id)!;
  assert.deepEqual(published.record.requiredIds,[child.id]);assert.deepEqual(child.externalSkills,["writer"]);assert.deepEqual(child.examples,["Example"]);
  assert.equal(db.project(project.id).version,2);assert.equal(db.project(project.id).assignments[0].recordId,local.id);assert.equal(db.get(parent.id)?.projectId,project.id);
  const other=db.saveProject({name:"Other",description:"",assignments:[]});
  assert.throws(()=>db.publishProjectRecord(other.id,parent.id,parent.version),/not found/);
  assert.throws(()=>db.publishProjectRecord(project.id,parent.id,99),/conflict/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

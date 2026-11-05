import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {BrainDB,rankRecord} from "../src/core/database.ts";
import {taskContext} from "../src/agents/hooks.ts";
import {callTool} from "../src/agents/mcp.ts";

const input={kind:"preference",domain:"general",title:"Conventions",summary:"Team conventions",content:"FULL_INSTRUCTIONS",tags:[],priority:80,status:"active",checks:[],backend:null};

test("keywords and usage conditions discover custom capabilities without eagerly loading bodies",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-keywords-"));const db=new BrainDB(join(dir,"brain.sqlite"));
 try{
  db.saveDomain("Finance operations");
  const required=db.create({...input,title:"Required safeguard",content:"DEPENDENCY_BODY"});
  const style=db.create({...input,domain:"finance-operations",title:"Ledger convention",tags:["reconciliation"],useWhen:"Settling invoices and balancing ledgers",requiredIds:[required.id]});
  const p=db.saveProject({name:"Finance",description:"",assignments:[{recordId:style.id,override:null}]});
  const other=db.saveProject({name:"Other",description:"",assignments:[]});
  const privateStyle=db.create({...input,projectId:other.id,title:"PRIVATE",useWhen:"reconciliation"});
  db.saveProject({...other,assignments:[{recordId:privateStyle.id,override:null}]},other.id,other.version);
  for(const task of ["reconciliation","settling invoices"]){
   const found=db.discover(task,undefined,30,p.id);
   assert.equal(found[0].id,style.id);assert.equal(found[0].useWhen,style.useWhen);
   assert.ok(!JSON.stringify(found).includes("FULL_INSTRUCTIONS"));assert.ok(!found.some(r=>r.id===privateStyle.id));
   assert.match(taskContext(db,task,undefined,p.id)!,/Ledger convention/);
  }
  assert.equal(taskContext(db,"hello",undefined,p.id),null);
  assert.equal(rankRecord(style,"the and please"),0);
  assert.equal(rankRecord(style,"ledgering"),0);
  const result=await callTool(db,"brain_get",{projectId:p.id,id:style.id});
  const loaded=JSON.parse(result.content[0].text);
  assert.equal(loaded.requiredLinked[0].id,required.id);assert.equal(loaded.requiredLinked[0].content,"DEPENDENCY_BODY");
  assert.throws(()=>db.update(style.id,{useWhen:42},style.version),/Use when/);
  assert.throws(()=>db.update(style.id,{useWhen:"x".repeat(601)},style.version),/Use when/);
  const updated=await callTool(db,"brain_update_project_style",{projectId:p.id,id:style.id,expectedVersion:style.version,expectedProjectVersion:p.version,changes:{useWhen:"Closing the monthly books",tags:["month-end"]}});
  assert.ok(!("isError" in updated));
  assert.equal(db.get(style.id)!.useWhen,style.useWhen);
  assert.ok(db.discover("month-end",undefined,30,p.id).some(r=>r.useWhen==="Closing the monthly books"));
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test("metadata backfill covers every kind and private record once while preserving content and revisions",()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-metadata-migration-")),file=join(dir,"brain.sqlite");let db=new BrainDB(file);
 try{
  const project=db.saveProject({name:"Project",description:"",assignments:[]});
  const records=["preference","skill","example","review","tool"].map(kind=>db.create({...input,keyId:"conventions-"+kind,kind,domain:"coding",tags:["keep-my-tag"],projectId:kind==="example"?project.id:undefined,status:kind==="review"?"archived":"active"}));
  // Simulate snapshots written before discovery metadata existed.
  for(const record of records){const {useWhen,...old}=record;db.db.prepare("UPDATE records SET snapshot=? WHERE id=?").run(JSON.stringify(old),record.id);}
  db.db.prepare("DELETE FROM meta WHERE key='discovery_metadata_v1'").run();db.close();db=new BrainDB(file);
  for(const before of records){const after=db.get(before.id)!;assert.ok(after.useWhen);assert.ok(after.tags.includes("debug"));assert.ok(after.tags.includes("keep-my-tag"));assert.equal(after.content,before.content);assert.equal(after.status,before.status);assert.equal(after.projectId,before.projectId);assert.equal(after.version,before.version+1);}
  const first=db.get(records[0].id)!;db.update(first.id,{useWhen:"My edited conditions",tags:["custom-only"]},first.version);
  db.close();db=new BrainDB(file);assert.equal(db.get(first.id)!.useWhen,"My edited conditions");assert.deepEqual(db.get(first.id)!.tags,["custom-only"]);assert.equal(db.get(first.id)!.version,3);
  assert.equal(db.db.prepare("SELECT count(*) AS n FROM revisions WHERE record_id=?").get(first.id)!.n,3);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test("examples and referenced skill names are searchable without embedding their bodies in startup",()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-example-discovery-"));const db=new BrainDB(join(dir,"brain.sqlite"));
 try{
  const sample=db.create({...input,kind:"example",title:"Ledger sample",useWhen:"Reconciling settlements",tags:["settlement"],content:"EXAMPLE_BODY"});
  const skill=db.create({...input,kind:"skill",title:"Ledger procedure",useWhen:"Reconciling settlements",tags:["settlement"],content:"SKILL_BODY"});
  const style=db.create({...input,externalSkills:["special-formatter"],examples:["Traceability worksheet"]});
  assert.deepEqual(new Set(db.discover("settlement").map(r=>r.id)),new Set([sample.id,skill.id]));
  assert.equal(db.discover("special formatter")[0].id,style.id);
  assert.equal(db.discover("traceability")[0].id,style.id);
  const index=db.bootstrap();assert.doesNotMatch(index,/FULL_INSTRUCTIONS|EXAMPLE_BODY|SKILL_BODY/);assert.match(index,/keywords:/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

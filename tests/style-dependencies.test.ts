import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {BrainDB} from "../src/core/database.ts";
import {installStyleDependencies} from "../src/styles/style-dependencies.ts";
import {createBrainHttpServer} from "../src/server/http.ts";

test("audited links are idempotent, preserve alternatives and resolve starter project",()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-links-"));const db=new BrainDB(join(dir,"brain.sqlite"));
 try{
  createBrainHttpServer(db);
  const records=db.list({limit:300});const find=(tag:string)=>records.find(r=>r.tags.includes(tag)||r.keyId===tag)!;
  const dev=find("starter-implementation"),ux=find("starter-ux");
  assert.deepEqual(dev.requiredIds,[]);
  assert.deepEqual(dev.supportingLinks,[]);
  assert.deepEqual(ux.requiredIds,[]);
  const azure=find("cloud-azure"),neutral=find("cloud-architecture");
  assert.ok(!azure.requiredIds?.includes(neutral.id));assert.ok(!neutral.requiredIds?.includes(azure.id));
  const p=db.saveProject({name:"Starter",description:"",assignments:db.projectDefaultStyleIds().map(recordId=>({recordId,override:null}))});
  assert.ok(db.scopedRecords(p.id).some(record=>record.id===dev.id));
  const version=db.get(dev.id)!.version;installStyleDependencies(db);assert.equal(db.get(dev.id)!.version,version);
  db.update(dev.id,{...dev,requiredIds:[]},version);installStyleDependencies(db);assert.deepEqual(db.get(dev.id)!.requiredIds,[]);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test("link audit rolls back revisions and marker on a project conflict",()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-links-conflict-"));const db=new BrainDB(join(dir,"brain.sqlite"));
 try{
  const input={kind:"preference",domain:"writing",title:"A",summary:"A",content:"A",tags:[],priority:70,status:"active",checks:[],backend:null};
  const a=db.create(input),b=db.create({...input,title:"B"}),root=db.create({...input,title:"Root",domain:"coding"});
  db.saveProject({name:"Project",description:"",assignments:[{recordId:root.id,override:null},{recordId:a.id,override:null}]});
  assert.throws(()=>db.installRequiredLinks(new Map([[root.id,[b.id]]]),"test-links"),/conflicts/);
  assert.equal(db.get(root.id)!.version,1);assert.deepEqual(db.get(root.id)!.requiredIds,[]);
  assert.ok(!db.db.prepare("SELECT value FROM meta WHERE key='test-links'").get());
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

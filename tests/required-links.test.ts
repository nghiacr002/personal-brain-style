import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {BrainDB} from "../src/core/database.ts";
import {installArchitectureStyles} from "../src/styles/architecture-styles.ts";
import {callTool} from "../src/agents/mcp.ts";
import {taskContext} from "../src/agents/hooks.ts";

test("three personal architecture styles resolve required links across retrieval, hooks and project overrides",async()=>{
  const dir=mkdtempSync(join(tmpdir(),"pb-required-"));const db=new BrainDB(join(dir,"brain.sqlite"));
  try{
    assert.equal(installArchitectureStyles(db),5);
    const all=db.list();assert.equal(all.length,5);
    const drawing=all.find(r=>r.status==="active"&&r.domain==="architecture")!;
    const thinking=all.find(r=>r.status==="active"&&r.domain==="thinking")!;
    const technology=all.find(r=>r.status==="active"&&r.domain==="technology")!;
    assert.deepEqual(db.requiredRecords([drawing]).map(r=>r.id),[thinking.id,technology.id,drawing.id]);
    const get=JSON.parse((await callTool(db,"brain_get",{id:drawing.id})).content[0].text);
    assert.equal(get.requiredLinked.length,2);
    const style=JSON.parse((await callTool(db,"brain_style",{domain:"architecture"})).content[0].text);
    assert.equal(style.length,3);
    let matched:string[]=[];
    assert.ok(taskContext(db,"Draw an Azure architecture flow diagram",r=>matched=r.map(x=>x.id))?.includes("brain_get"));
    assert.ok(matched.includes(drawing.id)); // Dependencies are loaded by brain_get, not injected by the hook.
    const project=db.saveProject({name:"Workload",description:"",assignments:[{recordId:thinking.id,override:"Project security requirements"},{recordId:drawing.id,override:null}]});
    assert.equal(db.requiredRecords([drawing],project.id)[0].content,"Project security requirements");
    assert.throws(()=>db.update(thinking.id,{...thinking,requiredIds:[drawing.id]},thinking.version),/cycle/);
    assert.throws(()=>db.create({...thinking,requiredIds:["missing"]}),/must exist/);
    const edited=db.update(drawing.id,{...drawing,summary:"My edited summary"},drawing.version);
    assert.equal(installArchitectureStyles(db),0);assert.equal(db.get(drawing.id)?.summary,edited.summary);
    db.update(thinking.id,{...thinking,status:"archived"},thinking.version);
    assert.throws(()=>db.requiredRecords([drawing]),/inactive or replaced/);
    assert.equal((await callTool(db,"brain_get",{id:drawing.id})).isError,true);
    assert.throws(()=>db.restore(drawing.id,1,edited.version),/must exist and be active/);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test("architecture alternatives upgrade an existing library without overwriting personal edits",()=>{
  const dir=mkdtempSync(join(tmpdir(),"pb-alternatives-"));const db=new BrainDB(join(dir,"brain.sqlite"));
  try{
    installArchitectureStyles(db);
    const additions=db.list().filter(r=>r.status==="draft");assert.equal(additions.length,2);
    for(const r of additions)db.db.prepare("DELETE FROM records WHERE id=?").run(r.id);
    db.db.prepare("DELETE FROM meta WHERE key='architecture_styles_v2'").run();
    const azure=db.list().find(r=>r.domain==="technology")!;
    db.update(azure.id,{...azure,content:"My existing Azure instructions"},azure.version);
    assert.equal(installArchitectureStyles(db),2);
    assert.equal(db.get(azure.id)?.content,"My existing Azure instructions");
    const cloud=db.list().find(r=>r.title.endsWith("Cloud Agnostic"))!;
    const patterns=db.list().find(r=>r.title.includes("design patterns"))!;
    assert.equal(cloud.status,"draft");assert.equal(patterns.status,"draft");
    assert.equal(cloud.requiredIds?.length,1);assert.deepEqual(cloud.requiredIds,patterns.requiredIds);
    assert.match(patterns.content,/bounded contexts/);assert.match(patterns.content,/modular monolith/);
    db.update(cloud.id,{...cloud,status:"active"},cloud.version);
    assert.equal(db.requiredRecords([cloud]).length,2);
    assert.equal(installArchitectureStyles(db),0);assert.equal(db.list().length,5);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

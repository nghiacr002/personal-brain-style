import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {BrainDB} from "../src/database.ts";
import {callTool} from "../src/mcp.ts";
import {taskContext} from "../src/hooks.ts";
import {createBrainHttpServer} from "../src/http.ts";
import type {RecordInput} from "../src/models.ts";
const style=(title:string,domain:RecordInput["domain"]="design"):RecordInput=>({kind:"preference",domain,title,summary:title,content:title,tags:["design"],priority:70,status:"active",checks:[],backend:null});
test("project overrides, explicit scope, isolation, persistence and conflicts",()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-project-"));const file=join(dir,"brain.sqlite");let db=new BrainDB(file);
 try{
  const a=db.create(style("Sky blue UI")),b=db.create(style("Minimal UI")),writing=db.create(style("Concise writing","writing"));
  const p=db.saveProject({name:"Portal",description:"",assignments:[{recordId:a.id,override:"Use a navy UI header"}]});
  const q=db.saveProject({name:"Docs",description:"",assignments:[{recordId:b.id,override:null}]});
  const effective=db.scopedRecords(p.id);
  assert.equal(effective.find(r=>r.id===a.id)?.content,"Use a navy UI header");
  assert.ok(!effective.some(r=>r.id===b.id));
  assert.ok(!effective.some(r=>r.id===writing.id));
  assert.ok(db.scopedRecords().some(r=>r.id===writing.id&&r.source==="Global default"));
  const empty=db.saveProject({name:"Empty",description:"",assignments:[]});assert.deepEqual(db.scopedRecords(empty.id),[]);
  assert.equal(db.scopedRecords(q.id).find(r=>r.id===b.id)?.content,"Minimal UI");
  assert.equal(db.get(a.id)?.content,"Sky blue UI");
  assert.throws(()=>db.saveProject({...p,assignments:[{recordId:a.id,override:null},{recordId:b.id,override:null}]},p.id,p.version),/Conflicting/);
  db.saveProject({...p,name:"Updated"},p.id,1);
  assert.throws(()=>db.saveProject(p,p.id,1),/changed/);
  assert.throws(()=>db.saveProject({name:"Bad",description:"",assignments:[{recordId:"missing",override:null}]}),/active/);
  assert.throws(()=>db.scopedRecords("missing"),/not found/);
  db.close();db=new BrainDB(file);assert.equal(db.project(p.id).name,"Updated");
  db.update(a.id,{...a,status:"archived"},a.version);
  assert.throws(()=>db.scopedRecords(p.id),/unavailable/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test("MCP and hooks use explicit project scope, and review checks use selected rules",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-project-agent-"));const db=new BrainDB(join(dir,"brain.sqlite"));const previous=process.env.PB_PROJECT_ID;
 try{
  const a=db.create(style("Sky blue UI")),b=db.create(style("Minimal UI"));
  const rule=db.create({...style("UI review"),kind:"review",checks:[{type:"contains",value:"accessible"}]});
  const p=db.saveProject({name:"Portal",description:"",assignments:[{recordId:a.id,override:"UI design must use navy"},{recordId:rule.id,override:null}]});
  const get=await callTool(db,"brain_get",{id:a.id,projectId:p.id});assert.match(get.content[0].text,/must use navy/);
  const hidden=await callTool(db,"brain_get",{id:b.id,projectId:p.id});assert.equal("isError" in hidden&&hidden.isError,true);
  assert.equal(db.evaluate("accessible","design",p.id).passed,true);
  assert.equal(db.evaluate("missing","design",p.id).passed,false);
  assert.ok(db.discover("navy",undefined,12,p.id).some(r=>r.id===a.id));
  process.env.PB_PROJECT_ID=p.id;
  assert.match(db.bootstrap(),/Sky blue UI/);assert.doesNotMatch(db.bootstrap(),/must use navy/);
  assert.match(taskContext(db,"design a UI")||"",/Sky blue UI/);assert.doesNotMatch(taskContext(db,"design a UI")||"",/must use navy/);
  assert.doesNotMatch(taskContext(db,"design a UI")||"",/Minimal UI/);
 }finally{if(previous===undefined)delete process.env.PB_PROJECT_ID;else process.env.PB_PROJECT_ID=previous;db.close();rmSync(dir,{recursive:true,force:true});}
});
test("project API validates input and updates with optimistic concurrency",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-project-api-"));const db=new BrainDB(join(dir,"brain.sqlite"));const server=createBrainHttpServer(db);
 const request=(url:string,method="GET",payload?:unknown)=>new Promise<{status:number,data:any}>(resolve=>{
  let status=0;
  const req={url,method,headers:{},async *[Symbol.asyncIterator](){if(payload)yield JSON.stringify(payload);}};
  server.emit("request",req,{setHeader(){},writeHead(code:number){status=code;},end(text:string){resolve({status,data:JSON.parse(text)});}});
 });
 try{
  assert.equal((await request("/api/projects","POST",{name:"",description:"",assignments:[]})).status,400);
  const created=await request("/api/projects","POST",{name:"Portal",description:"",assignments:[]});assert.equal(created.status,201);
  assert.equal((await request("/api/projects")).data.length,1);
  assert.equal((await request("/api/projects/"+created.data.id+"/resolved")).status,200);
  assert.equal((await request("/api/projects/"+created.data.id,"PUT",{project:created.data,expectedVersion:0})).status,409);
 }finally{server.close();db.close();rmSync(dir,{recursive:true,force:true});}
});

test("project dependency closure excludes unrelated global records across MCP and hooks",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-project-scope-"));const db=new BrainDB(join(dir,"brain.sqlite"));const previous=process.env.PB_PROJECT_ID;
 try{
  const thinking=db.create(style("Security thinking","thinking"));
  const drawing=db.create({...style("Architecture diagram","architecture"),requiredIds:[thinking.id]});
  const unrelated=db.create(style("Global writing only","writing"));
  const project=db.saveProject({name:"Scoped",description:"",assignments:[{recordId:drawing.id,override:null}]});
  const scoped=db.scopedRecords(project.id);
  assert.deepEqual(scoped.map(r=>r.id),[drawing.id,thinking.id]);
  assert.equal(scoped[1].source,"Required dependency");
  assert.equal((await callTool(db,"brain_get",{id:unrelated.id,projectId:project.id})).isError,true);
  assert.equal(db.discover("Global writing only",undefined,12,project.id).some(r=>r.id===unrelated.id),false);
  const empty=db.saveProject({name:"Empty",description:"",assignments:[]});
  assert.deepEqual(db.scopedRecords(empty.id),[]);
  assert.deepEqual(JSON.parse((await callTool(db,"brain_style",{projectId:empty.id,domain:"writing"})).content[0].text),[]);
  process.env.PB_PROJECT_ID=empty.id;
  assert.equal(taskContext(db,"write a document"),null);
  assert.doesNotMatch(db.bootstrap(),/Global writing only/);
  delete process.env.PB_PROJECT_ID;
  assert.ok(db.scopedRecords().some(r=>r.id===unrelated.id));
 }finally{if(previous===undefined)delete process.env.PB_PROJECT_ID;else process.env.PB_PROJECT_ID=previous;db.close();rmSync(dir,{recursive:true,force:true});}
});

test("project activity counts identified threads, deduplicates channels and separates recent and unlinked calls",()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-project-activity-"));const db=new BrainDB(join(dir,"brain.sqlite"));
 try{
  const p=db.saveProject({name:"Usage",description:"",assignments:[]});
  const event={agent:"codex",channel:"hook",runId:"codex:thread-1",eventType:"hook.session.context",outcome:"emitted",metadata:{projectId:p.id,sessionLinked:true}};
  db.trace(event);db.trace({...event,channel:"mcp",eventType:"mcp.brain_get",outcome:"success"});
  const old=db.trace({...event,agent:"claude",runId:"claude:thread-2"});
  db.db.prepare("UPDATE trace_events SET occurred_at=? WHERE id=?").run(new Date(Date.now()-3600000).toISOString(),old.id);
  db.trace({...event,runId:"codex:mcp:123",metadata:{projectId:p.id,sessionLinked:false}});
  db.trace({...event,runId:"demo",demo:true});db.trace({...event,runId:"failed",outcome:"error"});
  db.trace({...event,runId:"other",metadata:{projectId:"another-project",sessionLinked:true}});
  const usage=db.projectActivity(p.id);
  assert.equal(usage.linked,2);assert.equal(usage.active,1);assert.equal(usage.unlinkedCalls,1);
  assert.equal(usage.sessions.find(s=>s.threadId==="codex:thread-1")?.calls,2);
  assert.throws(()=>db.projectActivity("missing"),/not found/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

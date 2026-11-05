import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {spawn,spawnSync} from "node:child_process";
import {BrainDB} from "../src/core/database.ts";
import {DatabaseSync} from "node:sqlite";
import {seed} from "../src/styles/seed.ts";
import {createBrainHttpServer} from "../src/server/http.ts";

function fixture() { const dir=mkdtempSync(join(tmpdir(),"pb-trace-"));const db=new BrainDB(join(dir,"brain.sqlite"));return {dir,db,close(){db.close();rmSync(dir,{recursive:true,force:true});}}; }

test("complete sample library has 50+ global records and remains idempotent",()=>{
  const f=fixture();try{assert.ok(seed(f.db)>=50);const all=f.db.list({limit:300});assert.ok(all.length>=50);assert.ok(["preference","skill","example","review","tool"].every(k=>all.some(r=>r.kind===k)));
    assert.equal(seed(f.db),0);assert.equal(Object.keys(f.db.summary()).includes("projects"),false);
    assert.ok(all.filter(r=>r.kind==="tool").every(r=>r.backend===null || r.backend?.enabled===false));
  }finally{f.close();}
});

test("trace persistence, version evidence, reverse lookup and separate demos",()=>{
  const f=fixture();try{
    seed(f.db);const rule=f.db.list({kind:"preference",status:"active"}).find(r=>r.title==="Editable draw.io architecture style");assert.ok(rule);
    const event=f.db.trace({agent:"claude",channel:"hook",eventType:"hook.prompt.context",outcome:"emitted",runId:"claude:session-a",
      recordIds:[rule.id],recordVersions:{[rule.id]:rule.version},metadata:{contextChars:123,promptHash:"hashonly",secret:"NEVER_KEEP"}});
    assert.equal(event.recordVersions[rule.id],1);
    assert.equal(f.db.listTrace({runId:"claude:session-a"}).length,1);
    assert.equal(f.db.listTrace({runId:"claude:other"}).length,0);
    assert.equal(f.db.listTrace({runId:"\' OR 1=1 --"}).length,0);
    const newer=f.db.update(rule.id,{kind:rule.kind,domain:rule.domain,title:rule.title,summary:rule.summary,content:rule.content+" Updated.",tags:rule.tags,priority:rule.priority,status:rule.status,checks:rule.checks,backend:rule.backend},1);
    assert.equal(newer.version,2);
    const matches=f.db.listTrace({recordId:rule.id});assert.equal(matches.length,1);assert.equal(matches[0].recordVersions[rule.id],1);
    assert.ok(!JSON.stringify(matches).includes("NEVER_KEEP"));
    assert.equal(f.db.traceStats().promptMatches,1);
    assert.ok(f.db.seedTraceDemo()>0);assert.equal(f.db.seedTraceDemo(),0);
    assert.equal(f.db.traceStats().promptMatches,1);
    assert.ok(f.db.listTrace({includeDemo:true}).some(r=>r.demo));
    assert.ok(f.db.clearTraceDemo()>0);assert.equal(f.db.listTrace({includeDemo:true}).length,1);
  }finally{f.close();}
});

test("real CLI hooks persist only metadata and a private prompt fingerprint",()=>{
  const f=fixture();try{
    seed(f.db);f.db.close();
    const prompt="Create architecture diagram CONFIDENTIAL_PROMPT_NOT_TO_STORE";
    const run=(agent:"claude"|"codex",phase:"session"|"prompt",input:unknown)=>spawnSync(process.execPath,[resolve("scripts/run.mjs"),resolve("src/cli.ts"),"hook",agent,phase],{
      cwd:f.dir,env:{...process.env,PB_HOME:f.dir},input:JSON.stringify(input),encoding:"utf8"});
    for(const agent of ["claude","codex"] as const) {
      const startup=run(agent,"session",{session_id:"session-foo"});assert.equal(startup.status,0,startup.stderr);assert.equal(JSON.parse(startup.stdout).hookSpecificOutput.hookEventName,"SessionStart");
      const task=run(agent,"prompt",{session_id:"session-foo",prompt});assert.equal(task.status,0,task.stderr);assert.match(task.stdout,/drawing|diagram/i);
    }
    const file=readFileSync(join(f.dir,"brain.sqlite"));assert.equal(file.includes(Buffer.from(prompt)),false);
    assert.equal(file.includes(Buffer.from("CONFIDENTIAL_PROMPT_NOT_TO_STORE")),false);
    const db=new BrainDB(join(f.dir,"brain.sqlite"));
    const all=db.listTrace();assert.equal(all.filter(e=>e.eventType==="hook.session.context").length,2);
    assert.equal(all.filter(e=>e.eventType==="hook.prompt.context").length,2);
    assert.ok(all.every(e=>e.runId.includes("session-foo")));
    const hashes=all.filter(e=>e.eventType==="hook.prompt.context").map(e=>e.metadata.promptHash);
    assert.equal(hashes[0],hashes[1]);assert.equal(typeof hashes[0],"string");
    const versioned=all.find(e=>e.eventType==="hook.prompt.context" && e.recordIds.length>0);assert.ok(versioned);
    assert.ok(Object.keys(versioned.recordVersions).length>0);db.close();
  }finally{rmSync(f.dir,{recursive:true,force:true});}
});

test("actual MCP process attributes agent and records discovery and skill load",{timeout:14000},async()=>{
  const f=fixture();seed(f.db);const rec=f.db.list({kind:"skill",status:"active"}).find(x=>x.domain==="diagrams");assert.ok(rec);f.db.close();
  const child=spawn(process.execPath,[resolve("scripts/run.mjs"),resolve("src/cli.ts"),"mcp"],{
    cwd:f.dir,env:{...process.env,PB_HOME:f.dir,PB_AGENT:"claude"},stdio:["pipe","pipe","pipe"]});
  let buffer="",stderr="";const waiting=new Map<number,(msg:any)=>void>();let seq=0;
  child.stderr.on("data",c=>stderr+=c.toString());
  child.stdout.on("data",c=>{buffer+=c.toString();while(buffer.includes("\n")){const at=buffer.indexOf("\n");const line=buffer.slice(0,at);buffer=buffer.slice(at+1);if(!line.trim())continue;const result=JSON.parse(line);waiting.get(result.id)?.(result);waiting.delete(result.id);}});
  async function call(method:string,params:any={}) {const id=++seq;return await new Promise<any>((yes,no)=>{const timer=setTimeout(()=>no(new Error(`Timeout ${method} ${stderr}`)),6000);waiting.set(id,(r)=>{clearTimeout(timer);yes(r);});child.stdin.write(JSON.stringify({jsonrpc:"2.0",id,method,params})+"\n");});}
  try {
    await call("initialize",{protocolVersion:"2025-11-25",clientInfo:{name:"test",version:"1"}});
    await call("tools/list");
    const search=await call("tools/call",{name:"brain_discover",arguments:{task:"draw.io architecture diagram"}});assert.ok(!search.result.isError);
    const get=await call("tools/call",{name:"brain_get",arguments:{id:rec.id}});assert.ok(!get.result.isError);
    const review=await call("tools/call",{name:"brain_review",arguments:{domain:"writing",content:"TBD"}});assert.ok(!review.result.isError);
    const err=await call("tools/call",{name:"brain_get",arguments:{id:"wrong"}});assert.equal(err.result.isError,true);
  }finally{child.kill();await new Promise<void>(done=>child.once("close",()=>done()));}
  const db=new BrainDB(join(f.dir,"brain.sqlite"));try{
    const events=db.listTrace();assert.ok(events.some(e=>e.eventType==="mcp.initialize"));
    assert.ok(events.some(e=>e.eventType==="mcp.brain_discover"));
    assert.ok(events.some(e=>e.eventType==="mcp.brain_get" && e.recordVersions[rec.id]===1));
    assert.ok(events.some(e=>e.eventType==="mcp.brain_review" && e.metadata.passed===false));
    assert.ok(events.some(e=>e.eventType==="mcp.brain_get" && e.outcome==="error"));
    assert.ok(events.every(e=>e.agent==="claude"));
    assert.ok(!JSON.stringify(events).includes("TBD"));
  }finally{db.close();rmSync(f.dir,{recursive:true,force:true});}
});

test("local trace API exposes reverse lookup and protects mutations",async()=>{
  const f=fixture();seed(f.db);const rule=f.db.list({kind:"preference"})[0];f.db.trace({agent:"codex",channel:"hook",eventType:"hook.prompt.context",recordIds:[rule.id],recordVersions:{[rule.id]:rule.version}});
  const server=createBrainHttpServer(f.db);try{
    await new Promise<void>(done=>server.listen(0,"127.0.0.1",done));const a=server.address();assert.ok(a && typeof a==="object");const base=`http://127.0.0.1:${a.port}`;
    assert.equal((await fetch(base+"/api/trace")).status,200);
    assert.equal((await fetch(base+"/api/trace/demo",{method:"POST"})).status,200);
    const headers={Authorization:"Bearer test-secret"};
    const list=await fetch(`${base}/api/trace?recordId=${rule.id}`,{headers});assert.equal(list.status,200);const events=await list.json();assert.equal(events.length,1);
    assert.equal(events[0].recordVersions[rule.id],rule.version);
    const demo=await fetch(`${base}/api/trace/demo`,{method:"POST",headers});assert.equal(demo.status,200);
    const s=await fetch(`${base}/api/trace/stats`,{headers});const stats=await s.json();assert.equal(stats.events,1);
    const after=await fetch(`${base}/api/trace?demo=1`,{headers});const full=await after.json();assert.ok(full.length>1);
    const samples=await fetch(`${base}/api/examples/seed`,{method:"POST",headers});assert.equal((await samples.json()).created,0);
    const invalid=await fetch(`${base}/api/trace/demo`,{method:"DELETE",headers:{...headers,Origin:"https://evil.example"}});assert.equal(invalid.status,403);
  }finally{await new Promise<void>(done=>server.close(()=>done()));f.close();}
});

test("UI delivers Trace Explorer and feature help for every main tab",()=>{
  const html=readFileSync(resolve("public/index.html"),"utf8");const code=readFileSync(resolve("public/app.js"),"utf8");
  assert.match(html,/data-view="trace"/);assert.match(html,/id="helpDialog"/);assert.match(code,/trace_reverse/);assert.match(code,/traceDemo/);
  for(const k of ["overview","preference","skill","example","review","tool","discover","activation","feedback","history","trace"])
    assert.match(code,new RegExp(`${k}:\\s*\\{\\s*what:`));
  assert.match(code,/What it does/);assert.match(code,/How it works/);assert.match(code,/Why it matters/);
});

test("upgrade from legacy style database adds trace tables without losing records",()=>{
  const dir=mkdtempSync(join(tmpdir(),"pb-upgrade-"));const filename=join(dir,"brain.sqlite");
  try {
    // Simulate a v1.1 database created before trace_events existed.
    const db0=new DatabaseSync(filename);
    db0.exec(`CREATE TABLE records(id TEXT PRIMARY KEY,snapshot TEXT NOT NULL,kind TEXT NOT NULL,domain TEXT NOT NULL,status TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE revisions(id TEXT PRIMARY KEY,record_id TEXT NOT NULL,version INTEGER NOT NULL,action TEXT NOT NULL,snapshot TEXT NOT NULL,at TEXT NOT NULL,UNIQUE(record_id,version));
      CREATE TABLE feedback(id TEXT PRIMARY KEY,record_id TEXT,rating TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE audit(id TEXT PRIMARY KEY,action TEXT NOT NULL,target TEXT NOT NULL,created_at TEXT NOT NULL,detail TEXT NOT NULL);`);
    const item={id:"11111111-1111-1111-1111-111111111111",kind:"preference",domain:"writing",title:"My earlier custom style",summary:"Preserve me",content:"Always review terminology",tags:["personal"],priority:80,status:"active",checks:[],backend:null,version:3,createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-02T00:00:00Z"};
    db0.prepare("INSERT INTO records(id,snapshot,kind,domain,status,version,updated_at) VALUES(?,?,?,?,?,?,?)").run(item.id,JSON.stringify(item),item.kind,item.domain,item.status,item.version,item.updatedAt);
    db0.close();
    const upgraded=new BrainDB(filename);try{
      assert.equal(upgraded.get(item.id)?.version,4); // Discovery metadata adds a revision.
      assert.match(upgraded.get(item.id)?.useWhen||"",/technical documents/);
      assert.ok(upgraded.get(item.id)?.tags.includes("documentation"));
      assert.equal(upgraded.get(item.id)?.content,item.content);
      assert.equal(upgraded.traceStats().events,0);
      upgraded.trace({agent:"claude",channel:"hook",eventType:"hook.session.context",recordIds:[item.id],recordVersions:{[item.id]:3}});
      assert.equal(upgraded.listTrace({recordId:item.id})[0].recordVersions[item.id],3);
    }finally{upgraded.close();}
  }finally{rmSync(dir,{recursive:true,force:true});}
});

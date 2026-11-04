import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {BrainDB} from "../src/core/database.ts";
import {callTool} from "../src/agents/mcp.ts";
import {repositoryEvidence,readRepositoryEvidence} from "../src/projects/repository-evidence.ts";

test("source-backed amendments enforce freshness/conflicts, private scope and repeat-safe updates",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-amend-")),repo=join(dir,"repo"),db=new BrainDB(join(dir,"brain.sqlite"));mkdirSync(repo);
 try{
  const style=db.create({kind:"preference",domain:"coding",title:"Coding",summary:"",content:"Keep personal edits.",tags:[],priority:90,status:"active",checks:[],backend:null});
  const p=db.saveProject({name:"Owner",description:"",assignments:[{recordId:style.id,override:null}]}),q=db.saveProject({name:"Other",description:"",assignments:[{recordId:style.id,override:null}]});
  writeFileSync(join(repo,".personal-brain.json"),JSON.stringify({projectId:p.id}));writeFileSync(join(repo,"ADR.md"),"Amendment: app owns UI remotes.");
  db.db.prepare("INSERT INTO meta(key,value) VALUES(?,?)").run("repository:"+p.id,repo);
  const {file,digest}=readRepositoryEvidence(repo,"ADR.md");
  const args={projectId:p.id,id:style.id,expectedVersion:style.version,expectedProjectVersion:p.version,sourceFiles:[{file,digest}],conflicts:[],changes:{content:"Keep personal edits. App owns UI remotes per ADR amendment."}};
  const conflict=await callTool(db,"brain_update_project_style",{...args,conflicts:["Conflicting explicit rule needs resolution"]});assert.ok(conflict.isError);assert.equal(db.project(p.id).version,1);
  writeFileSync(join(repo,"ADR.md"),"Changed after inspection");assert.match((await callTool(db,"brain_update_project_style",args)).content[0].text,/evidence changed/);
  writeFileSync(join(repo,"ADR.md"),"Amendment: app owns UI remotes.");
  const result=await callTool(db,"brain_update_project_style",args);assert.ok(!result.isError);const applied=JSON.parse(result.content[0].text);
  assert.equal(applied.record.projectId,p.id);assert.notEqual(applied.record.id,style.id);assert.match(applied.record.content,/Source: ADR.md/);
  assert.equal(db.get(style.id)!.content,"Keep personal edits.");assert.equal(db.project(q.id).assignments[0].recordId,style.id);
  const retry=await callTool(db,"brain_update_project_style",{...args,id:applied.record.id,expectedVersion:applied.record.version,expectedProjectVersion:applied.projectVersion});
  assert.ok(!retry.isError);const repeated=JSON.parse(retry.content[0].text);assert.equal(repeated.record.id,applied.record.id);assert.equal(repeated.record.version,applied.record.version);assert.equal(repeated.projectVersion,applied.projectVersion);
  assert.equal(db.list({projectId:p.id}).filter(r=>r.projectId===p.id).length,1);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test("repository evidence excludes unsafe paths and bounds/paginates source reads",()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-evidence-")),repo=join(dir,"repo");mkdirSync(repo);
 try{
  writeFileSync(join(dir,"outside.md"),"outside");symlinkSync(join(dir,"outside.md"),join(repo,"link.md"));
  writeFileSync(join(repo,".env"),"secret");writeFileSync(join(repo,"large.ts"),"x".repeat(65537));
  mkdirSync(join(repo,".claude"));writeFileSync(join(repo,".claude/cache.ts"),"Auxiliary cache");
  for(let i=0;i<205;i++)writeFileSync(join(repo,`code-${i}.ts`),"const x=1;");
  assert.throws(()=>readRepositoryEvidence(repo,"../outside.md"),/Unsupported/);assert.throws(()=>readRepositoryEvidence(repo,"link.md"),/inside/);
  assert.throws(()=>readRepositoryEvidence(repo,".env"),/Unsupported/);assert.throws(()=>readRepositoryEvidence(repo,"large.ts"),/64 KiB/);
  const first=repositoryEvidence(repo,[]);assert.equal(first.files.length,200);assert.equal(first.nextOffset,200);assert.ok(!first.files.includes("link.md"));
  assert.ok(!first.files.some(file=>file.startsWith(".claude/")));
  const next=repositoryEvidence(repo,[],200);assert.equal(next.files.length,6);assert.equal(next.nextOffset,null);
  const result=repositoryEvidence(repo,["code-0.ts"]);assert.equal(result.evidence[0].content,"const x=1;");assert.equal(result.evidence[0].digest.length,64);
  writeFileSync(join(repo,"AGENTS.md"),"Project rules");assert.equal(repositoryEvidence(repo).evidence[0].file,"AGENTS.md");
 }finally{rmSync(dir,{recursive:true,force:true});}
});

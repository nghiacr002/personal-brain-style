import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {BrainDB} from "../src/core/database.ts";
import {installedSkills,matchSkill,discoverProject,getInstalledSkill} from "../src/projects/skill-discovery.ts";
import {createBrainHttpServer} from "../src/server/http.ts";
import {callTool} from "../src/agents/mcp.ts";
const put=(file:string,text:string)=>{mkdirSync(resolve(file,".."),{recursive:true});writeFileSync(file,text);};
const skill=(name:string,body="Skill instructions")=>`---\nname: ${name}\ndescription: Test skill\n---\n${body}`;

test("inventory covers global, agent, plugin and project skills; reports missing/ambiguous refs and bounds reads",()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-skills-")),home=join(dir,"home"),repo=join(dir,"repo");
 try{
  put(join(home,".agents/skills/writer/SKILL.md"),skill("writer"));
  put(join(home,".codex/skills/review/SKILL.md"),skill("review","Codex version"));
  put(join(home,".claude/skills/review/SKILL.md"),skill("review","Claude version"));
  put(join(home,".codex/plugins/cache/docs/v1/skills/docs/SKILL.md"),skill("docs"));
  put(join(repo,".agents/skills/local/SKILL.md"),skill("local"));
  put(join(repo,".codex/skills/large/SKILL.md"),"x".repeat(70000));
  symlinkSync(join(home,".agents/skills"),join(home,".agents/skills/loop"),process.platform==='win32'?'junction':'dir');
  const inventory=installedSkills(repo,home);
  assert.equal(inventory.skills.length,5);assert.ok(inventory.issues.some(i=>i.type==="unreadable"));
  assert.equal(matchSkill("writer (when writing)",inventory.skills).status,"available");
  assert.equal(matchSkill("docs:docs",inventory.skills).status,"available");
  assert.equal(matchSkill("review",inventory.skills).status,"ambiguous");
  assert.equal(matchSkill("absent",inventory.skills).status,"missing");
  put(join(repo,".claude/skills/review/SKILL.md"),skill("review","Project version"));
  assert.equal(matchSkill("review",installedSkills(repo,home).skills).skills[0].scope,"project");
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test("discovery reads source evidence and selected targets without creating drafts or domains",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-discovery-")),repo=join(dir,"repo"),home=join(dir,"home"),db=new BrainDB(join(dir,"brain.sqlite"));
 try{
  const style=db.create({kind:"preference",domain:"coding",title:"Coding",summary:"",content:"Existing personal rule",tags:[],externalSkills:["missing"],priority:90,status:"active",checks:[],backend:null});
  const p=db.saveProject({name:"Owner",description:"",assignments:[{recordId:style.id,override:null}]}),q=db.saveProject({name:"Other",description:"",assignments:[]});
  put(join(repo,".personal-brain.json"),JSON.stringify({projectId:p.id}));put(join(repo,"AGENTS.md"),"Read amended ADRs.");
  put(join(repo,"docs/adr.md"),"Amendment: use app-owned remotes.");put(join(repo,"apps/main.ts"),"export const owner = 'app';");
  put(join(repo,".env"),"SECRET");put(join(repo,"node_modules/hidden.ts"),"UNRELATED");
  put(join(repo,".agents/skills/private/SKILL.md"),skill("private","PRIVATE SKILL BODY"));
  db.db.prepare("INSERT INTO meta(key,value) VALUES(?,?)").run("repository:"+p.id,repo);
  const removal=db.deletionPreview("domain","general");db.deleteWithPreview("domain","general",removal.fingerprint);
  const before=db.domains();
  const report=discoverProject(db,p.id,true,home,["docs/adr.md","apps/main.ts"]);
  assert.deepEqual(db.domains(),before);assert.equal(db.list({projectId:p.id}).length,1);
  assert.equal(report.selectedStyles[0].id,style.id);assert.equal(report.projectVersion,p.version);
  assert.equal(report.evidence.length,2);assert.match(report.evidence[0].content,/Amendment/);
  assert.ok(report.files.includes("apps/main.ts"));assert.ok(!report.files.some(f=>f.includes("node_modules")||f===".env"));
  assert.ok(report.issues.some(i=>i.type==="missing-skill"));assert.ok(report.issues.some(i=>i.type==="legacy-request"));
  assert.match(report.workflow,/brain_update_project_style/);assert.equal(db.project(p.id).version,1);
  assert.doesNotMatch(JSON.stringify(report.skills),/PRIVATE SKILL BODY/);
  assert.match(getInstalledSkill(db,p.id,report.skills[0].id,home).content,/PRIVATE SKILL BODY/);
  assert.throws(()=>getInstalledSkill(db,q.id,report.skills[0].id,home),/not found/);
  assert.ok((await callTool(db,"brain_discover_project",{projectId:p.id,createDraft:"yes"})).isError);
  assert.ok((await callTool(db,"brain_discover_project",{projectId:p.id,files:"bad"})).isError);
  const mcp=await callTool(db,"brain_discover_project",{projectId:p.id,files:["docs/adr.md"]});assert.ok(!mcp.isError);assert.equal(JSON.parse(mcp.content[0].text).evidence[0].file,"docs/adr.md");
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test("session hook directs agent-led personalization without creating or applying generic drafts",()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-discovery-hook-")),repo=join(dir,"repo");
 try{
  const db=new BrainDB(join(dir,"brain.sqlite"));const p=db.saveProject({name:"Project",description:"",assignments:[]});
  const removal=db.deletionPreview("domain","general");db.deleteWithPreview("domain","general",removal.fingerprint);db.close();
  put(join(repo,".personal-brain.json"),JSON.stringify({projectId:p.id}));put(join(repo,"AGENTS.md"),"PRIVATE_REPOSITORY_CONVENTIONS");
  for(let i=0;i<2;i++){
   const out=spawnSync(process.execPath,[resolve("scripts/run.mjs"),resolve("src/cli.ts"),"hook","codex","session"],{cwd:dir,env:{...process.env,PB_HOME:dir,PB_PROJECT_ID:""},input:JSON.stringify({cwd:repo,session_id:"test"}),encoding:"utf8"});
   assert.equal(out.status,0,out.stderr);const context=JSON.parse(out.stdout).hookSpecificOutput.additionalContext;assert.match(context,/Project discovery/);assert.match(context,/brain_update_project_style/);assert.doesNotMatch(context,/PRIVATE_REPOSITORY_CONVENTIONS/);
  }
  const check=new BrainDB(join(dir,"brain.sqlite"));try{const rows=check.list({projectId:p.id});assert.equal(rows.length,0);assert.equal(check.hasDomain("repository-conventions"),false);assert.equal(check.hasDomain("general"),false);assert.equal(check.project(p.id).assignments.length,0);}finally{check.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});


test("HTTP discovery remains read-only; item lists surface missing skills",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-discovery-http-")),repo=join(dir,"repo"),db=new BrainDB(join(dir,"brain.sqlite"));
 const server=createBrainHttpServer(db);
 const request=(url:string,method="GET",origin?:string)=>new Promise<{status:number,data:any}>(resolve=>{
  let status=0;server.emit("request",{url,method,headers:origin?{origin}:{},async *[Symbol.asyncIterator](){}},{setHeader(){},writeHead(code:number){status=code;},end(text:string){resolve({status,data:JSON.parse(text)});}});
 });
 try{
  const p=db.saveProject({name:"HTTP",description:"",assignments:[]});put(join(repo,".personal-brain.json"),JSON.stringify({projectId:p.id}));put(join(repo,"AGENTS.md"),"Test conventions");
  db.db.prepare("INSERT INTO meta(key,value) VALUES(?,?)").run("repository:"+p.id,repo);
  const preview=await request("/api/projects/"+p.id+"/discovery");assert.equal(preview.status,200);assert.equal(preview.data.selectedStyles.length,0);
  const created=await request("/api/projects/"+p.id+"/discovery","POST");assert.equal(created.status,200);assert.equal(created.data.projectId,p.id);assert.equal(db.list({projectId:p.id}).filter(r=>r.projectId===p.id).length,0);
  const record=db.create({projectId:p.id,kind:"preference",domain:"coding",title:"Missing skill",summary:"",content:"Test",tags:[],externalSkills:["not-installed-unique-test-skill"],priority:70,status:"draft",checks:[],backend:null});
  const items=(await request("/api/items?projectId="+p.id)).data;assert.deepEqual(items.find((r:any)=>r.id===record.id).skillWarnings,["not-installed-unique-test-skill: missing"]);
  const denied=await request("/api/projects/"+p.id+"/discovery","POST","https://example.org");assert.equal(denied.status,403);
 }finally{server.close();db.close();rmSync(dir,{recursive:true,force:true});}
});

test('rescanning rereads changed skill files and explicit IDs remain loadable during conflicts',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pb-rescan-')),home=join(dir,'home'),db=new BrainDB(join(dir,'brain.sqlite'));
 try{
  const project=db.saveProject({name:'Scan',description:'',assignments:[]});
  const first=join(home,'.agents/skills/review/SKILL.md'),second=join(home,'.codex/skills/review/SKILL.md');
  put(first,skill('review','First version'));put(second,skill('review','Other version'));
  const result=matchSkill('review',installedSkills(undefined,home).skills);
  assert.equal(result.status,'ambiguous');
  assert.match(getInstalledSkill(db,project.id,result.skills[0].id,home).content,/version/);
  put(second,skill('review','First version'));
  assert.equal(matchSkill('review',installedSkills(undefined,home).skills).status,'available');
  rmSync(first);rmSync(second);
  assert.equal(matchSkill('review',installedSkills(undefined,home).skills).status,'missing');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

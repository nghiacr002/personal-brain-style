import {configureDesktop} from './agents/desktop-install.ts';
import { spawnSync } from "node:child_process";
import { chmodSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BrainDB, defaultHome, dbPath } from "./core/database.ts";
import {seedGlobalStyles} from "./styles/global-style-seed.ts";
import { createBrainHttpServer } from "./server/http.ts";
import { mcpMain } from "./agents/mcp.ts";
import { executeHook, simulateHook } from "./agents/hooks.ts";
import { manageHookConfig } from "./agents/hook-install.ts";

const scriptPath=resolve(fileURLToPath(import.meta.url));
const runnerPath=resolve(dirname(scriptPath),"../scripts/run.mjs");
const arg=process.argv[2]||"serve";
const db=new BrainDB();
const seeded=seedGlobalStyles(db);
if(arg==="desktop") {
  const action=process.argv[3]||'preview';const options:{file?:string;projectId?:string;dataDir:string}={dataDir:defaultHome()};
  try{
    for(let i=4;i<process.argv.length;i+=2){const flag=process.argv[i],value=process.argv[i+1];if(!value||value.startsWith('--')||!['--config','--project'].includes(flag))throw new Error('Use --project ID or --config PATH');if(flag==='--project'){db.project(value);options.projectId=value;}else options.file=value;}
    console.log(JSON.stringify(configureDesktop(action,options),null,2));
  }catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}finally{db.close();}
}else if(arg==="mcp") {
  if(["claude","codex"].includes(process.argv[3]||""))process.env.PB_AGENT=process.argv[3];
  if(process.argv[3]==="chatgpt"&&!process.argv[4])throw new Error("ChatGPT requires an explicit project ID: mcp chatgpt <projectId>");
  await mcpMain(db,process.argv[3]==="chatgpt"?process.argv[4]:undefined);
  db.close();
}else if(arg==="chatgpt-connect") {
  const project=db.project(process.argv[3]||"");
  db.close();
  const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
  const command=[process.execPath,runnerPath,scriptPath,"mcp","chatgpt",project.id].map(quote).join(" ");
  console.log("Connecting ChatGPT to "+project.name+" (read-only).");
  const child=spawnSync("bash",[resolve(dirname(scriptPath),"../scripts/connect-chatgpt.sh"),command],{stdio:"inherit",env:process.env});
  if(child.error)console.error(child.error.message);
  process.exitCode=child.status??1;
}else if(arg==="serve"||arg==="setup") {
  const port=Number(process.env.PB_PORT||4177);
  const server=createBrainHttpServer(db);
  server.listen(port,"127.0.0.1",()=>{
    console.log(`\n  Personal Brain — Personal Style Studio\n  http://127.0.0.1:${port}\n  Data: ${dbPath()}\n`);
  });
  process.once("SIGINT",()=>{server.close(()=>{db.close();process.exit(0);});});
}else if(arg==="hook"){
  const agent=process.argv[3];const phase=process.argv[4];
  if(!["claude","codex"].includes(agent)||!["session","prompt"].includes(phase)){console.error("Usage: hook claude|codex session|prompt");process.exitCode=2;}
  else executeHook(db,agent as "claude"|"codex",phase as "session"|"prompt");
  db.close();
}else if(arg==="hooks"){
  const action=process.argv[3]||"status";const agents=process.argv[4]||"both";
  if(!["install","remove","status"].includes(action)||!["claude","codex","both"].includes(agents)){console.error("Usage: hooks install|remove|status [claude|codex|both]");process.exitCode=2;}
  else for(const agent of agents==="both"?["claude","codex"]:[agents]){const result=manageHookConfig(action as "install"|"remove"|"status",agent as "claude"|"codex");console.log(JSON.stringify(result));}
  db.close();
}else if(arg==="preview"){
  const agent=process.argv[3]||"claude";const phase=process.argv[4]||"session";const task=process.argv.slice(5).join(" ");
  if(!["claude","codex"].includes(agent)||!["session","prompt"].includes(phase)){console.error("Usage: preview claude|codex session|prompt [task]");process.exitCode=2;}
  else console.log(simulateHook(db,agent as "claude"|"codex",phase as "session"|"prompt",{prompt:task}));
  db.close();
}else if(arg==="seed"){
  console.log(`Added ${seeded} global library records. Existing changes preserved.`);db.close();
}else if(arg==="trace") {
  const action=process.argv[3]||"stats";
  if(action==="stats")console.log(JSON.stringify(db.traceStats(),null,2));
  else if(action==="demo")console.log(`Added ${db.seedTraceDemo()} marked demonstration events`);
  else if(action==="clear-demo")console.log(`Deleted ${db.clearTraceDemo()} demonstration events`);
  else if(action==="export")console.log(JSON.stringify(db.listTrace({includeDemo:process.argv.includes("--demo"),limit:500}),null,2));
  else {console.error("Usage: trace stats|demo|clear-demo|export [--demo]");process.exitCode=2;}
  db.close();
}else if(arg==="doctor"){
  console.log(JSON.stringify({node:process.version,nodeSupported:Number(process.versions.node.split(".")[0])>=22,db:dbPath(),dataDir:defaultHome(),summary:db.summary(),toolProxyEnabled:process.env.PB_ENABLE_TOOL_PROXY==="1",mcpRegistration:{claude:`claude mcp add --transport stdio --scope user personal-brain -- node ${runnerPath} ${scriptPath} mcp claude`,codex:`codex mcp add personal-brain -- node ${runnerPath} ${scriptPath} mcp codex`}},null,2));db.close();
}else if(arg==="bootstrap"){
  console.log(db.bootstrap());db.close();
}else if(arg==="export"){
  console.log(JSON.stringify({schema:"personal-brain-style/1",exportedAt:new Date().toISOString(),records:db.list({limit:300}),projects:db.projects(),feedback:db.listFeedback()},null,2));db.close();
}else if(arg==="backup"){
  const file=process.argv[3];
  if(!file) {console.error("Usage: npm run cli -- backup /absolute/path/brain-backup.sqlite");process.exitCode=2;}
  else {const location=resolve(file);db.db.prepare("VACUUM INTO ?").run(location);chmodSync(location,0o600);console.log(`Consistent SQLite backup saved to ${location}`);}
  db.close();
}else{
  console.error("Usage: npm start | npm run mcp | npm run seed | npm run cli -- doctor|bootstrap|export|backup|trace|hooks|hook|preview");db.close();process.exitCode=2;
}

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, chmodSync, renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

export type Agent = "claude" | "codex";
export type InstallOptions={home?:string;claudeFile?:string;codexFile?:string;node?:string;entry?:string;platform?:NodeJS.Platform};
const HOOK_ID="personal-brain-style";

function shellQuote(value:string) { return `'${value.replace(/'/g,`'\\''`)}'`; }
export function hookCommand(agent:Agent,phase:"session"|"prompt",opts:InstallOptions={}) {
  const entry=opts.entry||resolve(dirname(fileURLToPath(import.meta.url)),"../cli.ts");
  const runner=resolve(dirname(fileURLToPath(import.meta.url)),"../../scripts/run.mjs");
  if((opts.platform||process.platform)==='win32'){
    const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
    const script='& '+[opts.node||process.execPath,runner,entry,'hook',agent,phase].map(quote).join(' ')+'; exit $LASTEXITCODE';
    return 'powershell.exe -NoProfile -NonInteractive -EncodedCommand '+Buffer.from(script,'utf16le').toString('base64');
  }
  return `${shellQuote(opts.node||process.execPath)} ${shellQuote(runner)} ${shellQuote(entry)} hook ${agent} ${phase}`;
}
function load(file:string):Record<string,any> {
  if(!existsSync(file))return {};
  const content=JSON.parse(readFileSync(file,"utf8"));
  if(!content || typeof content!=="object" || Array.isArray(content))throw new Error(`Invalid configuration ${file}`);
  return content;
}
function ensureHooks(config:Record<string,any>) {
  if(!config.hooks)config.hooks={};
  if(typeof config.hooks!=="object" || Array.isArray(config.hooks))throw new Error("Invalid hooks structure");
}
function own(entry:any):boolean {return entry?.statusMessage===HOOK_ID;}
// Own commands are tagged with a benign statusMessage to make safe removal deterministic.
function stripOwn(config:Record<string,any>) {
  ensureHooks(config);
  for(const event of ["SessionStart","UserPromptSubmit"]) {
    const list=config.hooks[event];if(!Array.isArray(list))continue;
    config.hooks[event]=list.map((group:any)=>{
      if(!group || !Array.isArray(group.hooks))return group;
      return {...group,hooks:group.hooks.filter((h:any)=>h?.statusMessage!==HOOK_ID && !own(h))};
    }).filter((group:any)=>!Array.isArray(group?.hooks)||group.hooks.length);
    if(!config.hooks[event].length)delete config.hooks[event];
  }
  if(!Object.keys(config.hooks).length)delete config.hooks;
}
function add(config:Record<string,any>,agent:Agent,opts:InstallOptions) {
  ensureHooks(config);
  for(const [event,phase] of [["SessionStart","session"],["UserPromptSubmit","prompt"]] as const) {
    const handler:any={type:"command",command:hookCommand(agent,phase,opts),statusMessage:HOOK_ID,timeout:10};
    if(agent==='claude'){
      handler.command=opts.node||process.execPath;
      handler.args=[resolve(dirname(fileURLToPath(import.meta.url)),"../../scripts/run.mjs"),opts.entry||resolve(dirname(fileURLToPath(import.meta.url)),"../cli.ts"),'hook',agent,phase];
    }
    if(agent==="codex")handler.additionalContextLimit=2500;
    (config.hooks[event] ||= []).push({hooks:[handler]});
  }
}
function save(file:string,data:Record<string,any>) {
  mkdirSync(dirname(file),{recursive:true,mode:0o700});
  if(existsSync(file))copyFileSync(file,`${file}.personal-brain-backup-${Date.now()}`);
  const tmp=`${file}.personal-brain-tmp-${process.pid}`;
  writeFileSync(tmp,JSON.stringify(data,null,2)+"\n",{mode:0o600});chmodSync(tmp,0o600);
  renameSync(tmp,file);
}

export function manageHookConfig(action:"install"|"remove"|"status",agent:Agent,opts:InstallOptions={}) {
  const home=opts.home||homedir();
  const file=agent==="claude"?(opts.claudeFile||join(home,".claude","settings.json")):(opts.codexFile||join(home,".codex","hooks.json"));
  const config=load(file);
  const previous=JSON.stringify(config);
  const installed=["SessionStart","UserPromptSubmit"].some(event=>Array.isArray(config.hooks?.[event]) && config.hooks[event].some((g:any)=>g?.hooks?.some((h:any)=>h?.statusMessage===HOOK_ID || own(h))));
  if(action==="status")return {agent,file,installed,changed:false};
  stripOwn(config);
  if(action==="install")add(config,agent,opts);
  const changed=previous!==JSON.stringify(config);
  if(changed)save(file,config);
  return {agent,file,installed:action==="install",changed};
}

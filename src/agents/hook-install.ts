import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, chmodSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { launcher } from "./launcher.ts";

export type Agent = "claude" | "codex" | "opencode";
export type InstallOptions={home?:string;claudeFile?:string;codexFile?:string;opencodeFile?:string;node?:string;entry?:string;platform?:NodeJS.Platform};
const HOOK_ID="personal-brain-style";

function shellQuote(value:string) { return `'${value.replace(/'/g,`'\\''`)}'`; }
// Explicit paths (tests, custom installs) win; otherwise agents start Personal Brain the way this copy was installed.
function baseArgv(opts:InstallOptions){
  if(opts.node||opts.entry)return [opts.node||process.execPath,resolve(dirname(fileURLToPath(import.meta.url)),"../../scripts/run.mjs"),opts.entry||resolve(dirname(fileURLToPath(import.meta.url)),"../cli.ts")];
  return launcher().argv;
}
export function hookCommand(agent:Agent,phase:"session"|"prompt",opts:InstallOptions={}) {
  const base=baseArgv(opts);
  if((opts.platform||process.platform)==='win32'){
    const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
    const script='& '+[...base,'hook',agent,phase].map(quote).join(' ')+'; exit $LASTEXITCODE';
    return 'powershell.exe -NoProfile -NonInteractive -EncodedCommand '+Buffer.from(script,'utf16le').toString('base64');
  }
  return `${base.map(shellQuote).join(" ")} hook ${agent} ${phase}`;
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
      const base=baseArgv(opts);
      handler.command=base[0];
      handler.args=[...base.slice(1),'hook',agent,phase];
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

// OpenCode has no shell hooks: one managed plugin registers the MCP server (config hook)
// and injects the same session/prompt context the other agents receive from their hooks.
const OPENCODE_MARKER="// personal-brain-style managed plugin";
export function opencodePlugin(opts:InstallOptions={}){
  const command=baseArgv(opts);
  return `${OPENCODE_MARKER}
// Reinstalling Personal Brain hooks overwrites this file; remove it with: personal-brain hooks remove opencode
import { spawn } from "node:child_process";
const COMMAND = ${JSON.stringify(command)};
function hook(phase, input) {
  return new Promise(done => {
    let out = "";
    const child = spawn(COMMAND[0], [...COMMAND.slice(1), "hook", "opencode", phase], { stdio: ["pipe", "pipe", "ignore"] });
    const timer = setTimeout(() => child.kill(), 10000);
    child.stdout.on("data", chunk => { out += chunk; });
    child.on("error", () => { clearTimeout(timer); done(""); });
    child.on("close", () => { clearTimeout(timer); try { done(JSON.parse(out).hookSpecificOutput.additionalContext || ""); } catch { done(""); } });
    child.stdin.end(JSON.stringify(input));
  });
}
export const PersonalBrain = async ({ directory }) => {
  const sessions = new Map();
  return {
    config: async config => {
      config.mcp ??= {};
      config.mcp["personal-brain"] ??= { type: "local", command: [...COMMAND, "mcp", "opencode"], enabled: true };
    },
    "chat.message": async (input, output) => {
      const prompt = output.parts.filter(part => part.type === "text" && !part.synthetic).map(part => part.text).join("\\n");
      const state = sessions.get(input.sessionID) || {};
      if (state.startup === undefined) state.startup = await hook("session", { cwd: directory, session_id: input.sessionID });
      state.prompt = prompt ? await hook("prompt", { cwd: directory, session_id: input.sessionID, prompt }) : "";
      sessions.set(input.sessionID, state);
    },
    "experimental.chat.system.transform": async (input, output) => {
      const state = input.sessionID && sessions.get(input.sessionID);
      if (!state) return;
      for (const text of [state.startup, state.prompt]) if (text) output.system.push(text);
    },
  };
};
`;
}
function manageOpencode(action:"install"|"remove"|"status",opts:InstallOptions){
  const file=opts.opencodeFile||join(opts.home||homedir(),".config","opencode","plugins","personal-brain.js");
  const current=existsSync(file)?readFileSync(file,"utf8"):null;
  if(current!==null&&!current.startsWith(OPENCODE_MARKER))throw new Error(`Refusing to modify ${file}: it is not managed by Personal Brain`);
  const installed=current!==null;
  if(action==="status")return {agent:"opencode" as const,file,installed,changed:false};
  if(action==="remove"){if(installed)unlinkSync(file);return {agent:"opencode" as const,file,installed:false,changed:installed};}
  const next=opencodePlugin(opts);
  if(current!==next){mkdirSync(dirname(file),{recursive:true,mode:0o700});writeFileSync(file,next,{mode:0o600});}
  return {agent:"opencode" as const,file,installed:true,changed:current!==next};
}

export function manageHookConfig(action:"install"|"remove"|"status",agent:Agent,opts:InstallOptions={}) {
  if(agent==="opencode")return manageOpencode(action,opts);
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

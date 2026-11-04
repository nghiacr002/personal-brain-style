import { complianceReminder } from "../instructions/compliance.ts";
import { dirname } from "node:path";
import { resolveProjectScope } from "../projects/project-scope.ts";
import { readFileSync } from "node:fs";
import { BrainDB, rankRecord } from "../core/database.ts";
import type { BrainRecord, Domain } from "../core/models.ts";

/** Personal Brain supplies context; it never starts a second LLM turn. */
export type AgentKind = "claude" | "codex";
export type HookPhase = "session" | "prompt";

function classify(task: string): Domain[] {
  const t = task.toLowerCase(); const result: Domain[]=[];
  if (/diagram|draw\b|drawing|drawio|draw\.io|mermaid|excalidraw|flowchart|visualiz|topology|sequence diagram|architecture diagram|sơ đồ|bản vẽ|thiết kế sơ đồ/.test(t)) result.push("diagrams");
  if (/architect|system design|solution design|microservice|integration|infrastructure|kiến trúc/.test(t)) result.push("architecture");
  if (/brd|srs|document|report|requirement|proposal|memo|specification|write|writing|viết|tài liệu/.test(t)) result.push("writing");
  if (/review|audit|verify|validate|check|critic|quality|kiểm tra|đánh giá/.test(t)) result.push("reviews");
  if (/code|coding|implement|debug|refactor|typescript|python/.test(t)) result.push("coding");
  if (/ux|ui|prototype|wireframe|design system|mockup/.test(t)) result.push("design");
  if (/technology|tech selection|azure|cloud service/.test(t)) result.push("technology");
  if (/think|plan|compare|decid|tradeoff|trade-off|strategy|phân tích/.test(t)) result.push("thinking");
  return result;
}

export function startupContext(db: BrainDB,projectId?:string): string {
  // Deliberately small, so full specialty skills can load on demand.
  const baseline=db.bootstrap(1600,projectId);
  const scopeInstruction=projectId?`Project scope: ${projectId}. Pass projectId "${projectId}" on every Personal Brain MCP call. `:"";
  return `${baseline}\n\nPERSONAL BRAIN AUTO ACTIVATION\n${scopeInstruction}`+
    `Personal Brain is the user's global working style; it does not contain project memory. `+
    `For each substantive diagram, architecture, writing, design or review task, apply the matching skill and style automatically. `+
    `The UserPromptSubmit hook supplies matching record references, not full instructions. `+
    `For substantive work, call brain_discover and brain_get for matching styles and required links; reuse only the same ID/version/scope already read in this conversation; `+
    `Read available external skills on demand with brain_get_installed_skill; flag missing or ambiguous references. `+
    `Do not ask the user to request skill discovery. Respect direct user instructions over style defaults. `+
    `Never claim a tool or visual validator was run unless it actually ran.\n\n${complianceReminder}`;
}

export function taskContext(db:BrainDB, prompt: string, onMatch?: (matches:BrainRecord[],domains:Domain[])=>void,projectId?:string): string | null {
  const task=prompt.trim().slice(0,4000);
  if(!task || task.length<4) return null;
  const domains=classify(task);
  const candidates=db.scopedRecords(projectId)
    .filter(r=>r.kind==="skill" || r.kind==="preference" || r.kind==="review" || r.kind==="example" || r.kind==="tool")
    .map(r=>({record:r,score:rankRecord(r,task)+(domains.includes(r.domain)?30:0)}))
    .filter(v=>v.score>0)
    .sort((a,b)=>b.score-a.score || b.record.priority-a.record.priority);
  const selected:BrainRecord[]=[];
  // Skills are most important; use at most 2, 2 preferences, and one review/tool hint.
  const limits:Record<string,number>={skill:2,preference:2,review:1,example:1,tool:1};
  const counts:Record<string,number>={};
  let used=0;
  for (const {record:r} of candidates) {
    if ((counts[r.kind]||0)>=(limits[r.kind]||0)) continue;
    const size=r.title.length+r.id.length+r.domain.length+80;
    if(used+size>1200)continue;
    selected.push(r);counts[r.kind]=(counts[r.kind]||0)+1;used+=size;
  }
  if(!selected.length)return null;
  onMatch?.(selected, domains);
  const sections=selected.map(r=>`[${r.kind} | ${r.domain}] ${r.title} | version ${r.version} | id ${r.id}`).join("\n");
  return `PERSONAL BRAIN TASK MATCH — INDEX ONLY\n${projectId?`Project scope: ${projectId}. Pass this projectId on every call.\n`:""}`+
    `${sections}\n\nLoad relevant records with brain_get, including requiredLinked instructions, skills and review criteria. `+
    `Reuse instructions only if this conversation already contains the same record ID, version and scope. `+
    `Read required external skills on demand; never claim unavailable skills were used. `+
    `Use brain_discover if these matches are insufficient. Explicit user requirements take precedence. Full instructions have not been injected.\n\n${complianceReminder}`;

}

export function formatHookOutput(event:"SessionStart"|"UserPromptSubmit", context:string|null): string {
  if(!context)return "";
  return JSON.stringify({hookSpecificOutput:{hookEventName:event,additionalContext:context}});
}

export function simulateHook(db: BrainDB, agent:AgentKind, phase:HookPhase, input:unknown): string {
  // Both agents support the same event-specific JSON shape.
  void agent;
  const obj=(input && typeof input==="object" && !Array.isArray(input)) ? input as Record<string,unknown> : {};
  if(phase==="session") return formatHookOutput("SessionStart",startupContext(db));
  return formatHookOutput("UserPromptSubmit",taskContext(db,typeof obj.prompt==="string"?obj.prompt:""));
}

export function executeHook(db:BrainDB, agent:AgentKind, phase:HookPhase) {
  let input:unknown={};
  try {const raw=readFileSync(0,"utf8").slice(0,1048576);input=raw.trim()?JSON.parse(raw):{};}catch { /* Fail open when host supplies malformed input. */ }
  try {
    const obj=(input && typeof input==="object" && !Array.isArray(input)) ? input as Record<string,unknown> : {};
    const scope=resolveProjectScope(undefined,typeof obj.cwd==="string"?obj.cwd:process.cwd());
    const projectId=scope.projectId;
    if(projectId)db.project(projectId);
    const sessionId = typeof obj.session_id === "string" ? obj.session_id : typeof obj.thread_id === "string" ? obj.thread_id : null;
    const runId = sessionId ? `${agent}:${sessionId.slice(0,100)}` : `${agent}:hook:unlinked`;
    if(phase==="session") {
      let discoveryNote="";
      if(projectId&&!db.db.prepare("SELECT 1 FROM meta WHERE key=?").get("discovery-paused:"+projectId)){
        try{
          if(scope.file)db.db.prepare("INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)").run("repository:"+projectId,dirname(scope.file));
          discoveryNote="\nProject discovery: before substantive repository work, call brain_discover_project. Read source evidence and ADR amendments, compare current selected styles, and apply justified project-only amendments through brain_update_project_style using sourceFiles digests and current versions. Preserve personal edits; flag unresolved conflicts rather than choosing silently. Skip unchanged styles. Do not create a generic conventions draft or a capability. Full source analysis is performed by you, not the startup hook.";
        }catch(e){discoveryNote="\nProject discovery needs attention: "+(e instanceof Error?e.message:String(e)).slice(0,220);}
      }
      const context = startupContext(db,projectId)+discoveryNote;
      db.trace({agent,channel:"hook",eventType:"hook.session.context",outcome:"emitted",runId,
        recordIds:db.bootstrapWithRecords(1600,projectId).records.map(r=>r.id),
        recordVersions:Object.fromEntries(db.bootstrapWithRecords(1600,projectId).records.map(r=>[r.id,r.version])),
        metadata:{note:"Index only; full instructions load through brain_get",contextChars:context.length,sessionLinked:!!sessionId,projectId:projectId||null}});
      process.stdout.write(formatHookOutput("SessionStart",context)+"\n");
    } else {
      const prompt = typeof obj.prompt === "string" ? obj.prompt : "";
      const matches:BrainRecord[]=[]; const domains:Domain[]=[];
      const context=taskContext(db,prompt,(found,matched)=>{matches.push(...found);domains.push(...matched);},projectId);
      db.trace({agent,channel:"hook",eventType:context?"hook.prompt.context":"hook.prompt.no_match",
        outcome:context?"emitted":"skipped",runId,recordIds:matches.map(r=>r.id),
        recordVersions:Object.fromEntries(matches.map(r=>[r.id,r.version])),metadata:{note:"Index only; full instructions load through brain_get",projectId:projectId||null,promptChars:prompt.length,
          promptHash:db.fingerprint(prompt),
          matchedDomains:domains.join(","),contextChars:context?.length||0,sessionLinked:!!sessionId}});
      if(context)process.stdout.write(formatHookOutput("UserPromptSubmit",context)+"\n");
    }
  } catch(e) { console.error(`Personal Brain hook skipped: ${e instanceof Error?e.message:String(e)}`); }
}

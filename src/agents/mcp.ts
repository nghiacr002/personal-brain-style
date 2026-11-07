import {resolveInstructions} from "../instructions/resolve.ts";
import {prepareInstructions} from "../instructions/instruction-set.ts";
import {reviewArtifacts} from "../instructions/artifact-review.ts";
import {requirementChecklist} from "../core/requirements.ts";
import { complianceInstructions, readOnlyComplianceInstructions } from "../instructions/compliance.ts";
import {readRepositoryEvidence} from "../projects/repository-evidence.ts";
import { createInterface } from "node:readline";
import { resolveProjectScope } from "../projects/project-scope.ts";
import { discoverProject, getInstalledSkill, installedSkills, projectFolder, skillReferences } from "../projects/skill-discovery.ts";
import { BrainDB } from "../core/database.ts";
import { BrainError, KINDS, type Kind, type Domain } from "../core/models.ts";
import { invokeBackend, inspectBackend } from "./bridge.ts";
import { packageVersion } from "./launcher.ts";

// Only advertise the lifecycle implemented by this server.
export const MCP_PROTOCOL_VERSION = "2025-11-25";

const schemaObject = (properties:Record<string,unknown>,required:string[]=[]) => ({type:"object",properties,required,additionalProperties:false});
const text = (value:unknown) => ({content:[{type:"text",text:typeof value==="string"?value:JSON.stringify(value,null,2)}]});
const errorText=(error:unknown)=>({isError:true,content:[{type:"text",text:error instanceof Error?error.message:String(error)}]});
const str={type:"string"};
const whenSchema=schemaObject({activities:{type:"array",items:str},formats:{type:"array",items:str},languages:{type:"array",items:str},frameworks:{type:"array",items:str},targets:{type:"array",items:str}});
const preferencesSchema={type:"array",items:schemaObject({key:str,value:str},["key","value"])};
const contextSchema=schemaObject({activity:str,formats:{type:"array",items:str},languages:{type:"array",items:str},frameworks:{type:"array",items:str},targets:{type:"array",items:str},preferences:preferencesSchema});
const contractSchema={appliesWhen:whenSchema,compatibility:{type:"boolean"},standardLanguage:str,preferences:preferencesSchema,supportingLinks:{type:"array",items:schemaObject({recordId:str,when:whenSchema},["recordId","when"])},skillBindings:{type:"array",items:schemaObject({name:str,when:whenSchema,required:{type:"boolean"},fallback:str},["name","required","fallback"])}};
const requirementsSchema={type:"array",maxItems:30,items:schemaObject({id:str,label:str,type:{type:"string",enum:["artifact","manual"]},extension:str,extensions:{type:"array",items:str},when:whenSchema},["id","label","type"])};

export function tools() {
  return [
    {name:"brain_discover_project",description:"Read repository source evidence, file index, selected-style IDs/versions and installed skill findings. Analyze conventions and ADR amendment precedence, then amend selected styles with brain_update_project_style. Read-only: never creates generic drafts or capabilities. Use files to read up to 8 relevant source/test/ADR files and fileOffset to page the index.",inputSchema:schemaObject({projectId:str,files:{type:"array",items:str,maxItems:8},fileOffset:{type:"integer",minimum:0},createDraft:{type:"boolean",description:"Deprecated; ignored. Discovery is read-only."}},["projectId"])},
    {name:"brain_get_installed_skill",description:"Load an installed skill's instructions on demand using an ID returned by brain_discover_project or brain_get. Does not execute or install it. Requires explicit project scope.",inputSchema:schemaObject({projectId:str,id:str},["projectId","id"])},
    {name:"brain_projects",description:"List project IDs for explicit scoped style selection.",inputSchema:schemaObject({})},
    {name:"brain_create_project_style",description:"Create a new project-private style and select it by default. Requires explicit projectId and current expectedProjectVersion from brain_projects. Global styles and other projects are unchanged. Use brain_update_project_style when the capability already has a selected style; select:false creates an unselected alternative. Use keyId as stable slug: a global match is personalized, a project-private match is updated, otherwise a new private style is created.",inputSchema:schemaObject({projectId:str,threadId:str,expectedProjectVersion:{type:"integer",minimum:1},select:{type:"boolean"},style:schemaObject({...contractSchema,keyId:str,domain:str,title:str,summary:str,content:str,useWhen:str,tags:{type:"array",items:str},requiredIds:{type:"array",items:str},principles:{type:"array",items:str},externalSkills:{type:"array",items:str},reviewCriteria:{type:"array",items:str},examples:{type:"array",items:str},requirements:requirementsSchema},["domain","title","summary","content"])},["projectId","expectedProjectVersion","style"])},
    {name:"brain_update_project_style",description:"Update a selected project style or skill record, including external skill references, examples and review rules. Requires explicit projectId. Shared records become private copies; global records and other projects are unchanged. Read brain_get and brain_projects first for current versions. For repository amendments supply sourceFiles from discovery and conflicts: [] after resolving conflicts. Source changes or unresolved conflicts reject the update. Returns the updated record and project version.",inputSchema:schemaObject({projectId:str,id:str,threadId:str,sourceFiles:{type:"array",maxItems:8,items:schemaObject({file:str,digest:str},["file","digest"])},conflicts:{type:"array",items:str},expectedVersion:{type:"integer",minimum:1},expectedProjectVersion:{type:"integer",minimum:1},changes:schemaObject({...contractSchema,requirements:requirementsSchema,title:str,summary:str,content:str,useWhen:{type:"string",maxLength:600},principles:{type:"array",items:str},externalSkills:{type:"array",items:str},reviewCriteria:{type:"array",items:str},examples:{type:"array",items:str},requiredIds:{type:"array",items:str},tags:{type:"array",items:str},priority:{type:"integer",minimum:0,maximum:100},checks:{type:"array",items:{type:"object"}}})},["projectId","id","expectedVersion","expectedProjectVersion","changes"])},
    {name:"brain_bootstrap",description:"Retrieve concise global personal working style. Use at session start when you need user preferences.",inputSchema:schemaObject({cwd:str,threadId:str,projectId:str})},
    {name:"brain_discover",description:"Search available personal preferences, drawing skills, writing procedures, review standards and registered MCP tools by task intent, discovery keywords and Use when guidance. Returns a compact index only; call brain_get for full instructions and required links.",inputSchema:schemaObject({cwd:str,threadId:str,projectId:str,task:{type:"string"},context:contextSchema,kinds:{type:"array",items:{type:"string",enum:KINDS}},limit:{type:"integer",minimum:1,maximum:30}},["task"])},
    {name:"brain_resolve",description:"Resolve task applicability, provenance and preference conflicts without writing. Supply explicit activity, formats and task preference choices in context; resolve unknown conditions before work. Does not certify semantic completeness.",inputSchema:schemaObject({projectId:str,task:str,context:contextSchema,recordIds:{type:"array",items:str,maxItems:20}},["projectId","task","recordIds"])},
    {name:"brain_prepare",description:"Prepare a version-bound task instruction set after discovery. Returns full selected instructions, transitive dependencies and review checklist. Use before substantive project work; pass instructionSetId to brain_review. Stores task and version fingerprints locally, not proof of compliance.",inputSchema:schemaObject({projectId:str,threadId:str,task:str,context:contextSchema,recordIds:{type:"array",items:str,maxItems:20}},["projectId","task","recordIds"])},
    {name:"brain_get",description:"Load full content and instructions of a discovered skill, personal preference, example, or review rule.",inputSchema:schemaObject({cwd:str,threadId:str,projectId:str,id:str,host:{type:"string",enum:["codex","claude","opencode","chatgpt"]}},["id"])},
    {name:"brain_style",description:"Get current personal style instructions for a specific domain.",inputSchema:schemaObject({cwd:str,threadId:str,projectId:str,domain:{type:"string",description:"Registered domain ID from a library record"}},["domain"])},
    {name:"brain_review",description:"Run deterministic text checks, or review project artifacts against applicable styles. For artifact review supply projectId and instructionSetId from brain_prepare (or legacy task/recordIds), repository-relative artifacts and evidence bound to checklist record versions. Agent-reported passes remain unverified; file presence does not prove editability or visual quality. Reports are saved in project activity.",inputSchema:schemaObject({cwd:str,threadId:str,projectId:str,instructionSetId:str,context:contextSchema,domain:str,content:str,task:str,recordIds:{type:"array",items:str,maxItems:20},artifacts:{type:"array",items:str,maxItems:30},evidence:{type:"array",maxItems:300,items:schemaObject({recordId:str,recordVersion:{type:"integer",minimum:1},requirementId:str,status:{type:"string",enum:["pass","fail","not_verified"]},note:str},["recordId","recordVersion","requirementId","status","note"])}})},
    {name:"brain_feedback",description:"Log proposed personal-style feedback for human review. Does not automatically edit styles.",inputSchema:schemaObject({rating:{type:"string",enum:["accepted","rejected","correction"]},note:str,recordId:str},["rating","note"])},
    {name:"brain_inspect_tool",description:"Inspect the tool names and schemas exposed by an enabled and approved external MCP server. Requires administrator opt-in.",inputSchema:schemaObject({id:str},["id"])},
    {name:"brain_call_tool",description:"Invoke a registered external MCP tool ONLY when approved and explicitly enabled by local administrator. Otherwise returns disabled.",inputSchema:schemaObject({id:str,arguments:{type:"object"}},["id"])},
  ];
}
export async function callTool(db:BrainDB,name:string,args:Record<string,unknown>={},workingDirectory?:string) {
  try {
    if(args.host!==undefined&&!["codex","claude","opencode","chatgpt"].includes(String(args.host)))throw new BrainError("Invalid host");
    if(args.projectId!==undefined&&typeof args.projectId!=="string")throw new BrainError("Invalid project ID");
    if(args.threadId!==undefined&&(typeof args.threadId!=="string"||!args.threadId.trim()||args.threadId.length>100))throw new BrainError("Thread ID must have 1-100 characters");
    if(args.cwd!==undefined&&typeof args.cwd!=="string")throw new BrainError("Invalid working directory");
    const scoped=["brain_bootstrap","brain_discover","brain_get","brain_style","brain_prepare","brain_resolve","brain_review"].includes(name);
    const projectId=scoped&&(args.projectId!==undefined||args.cwd!==undefined||workingDirectory!==undefined)?resolveProjectScope(args.projectId as string|undefined,args.cwd as string|undefined||workingDirectory).projectId:args.projectId as string|undefined;
    switch(name) {
      case "brain_discover_project":
        if(typeof projectId!=="string"||!projectId.trim())throw new BrainError("Explicit projectId required");
        if(args.createDraft!==undefined&&typeof args.createDraft!=="boolean")throw new BrainError("createDraft must be boolean");
        return text(discoverProject(db,projectId,args.createDraft===true,undefined,args.files as string[]|undefined,args.fileOffset===undefined?0:args.fileOffset as number));
      case "brain_get_installed_skill":
        if(typeof projectId!=="string"||!projectId.trim()||typeof args.id!=="string")throw new BrainError("Explicit projectId and skill ID required");
        return text(getInstalledSkill(db,projectId,args.id));
      case "brain_projects":return text(db.projects());
      case "brain_create_project_style": {
        if(typeof projectId!=="string"||!projectId.trim()||!Number.isInteger(args.expectedProjectVersion))throw new BrainError("Explicit projectId and expectedProjectVersion required");
        if(args.select!==undefined&&typeof args.select!=="boolean")throw new BrainError("select must be boolean");
        return text(db.createProjectStyle(projectId,args.style,args.expectedProjectVersion as number,args.select!==false));
      }
      case "brain_update_project_style": {
        if(typeof args.projectId!=="string"||!args.projectId.trim())throw new BrainError("Explicit projectId is required for updates");
        if(typeof args.id!=="string"||!Number.isInteger(args.expectedVersion)||!Number.isInteger(args.expectedProjectVersion))throw new BrainError("Record ID and expected record/project versions are required");
        if(!args.changes||typeof args.changes!=="object"||Array.isArray(args.changes)||!Object.keys(args.changes).length)throw new BrainError("Non-empty changes object required");
        const allowed=["appliesWhen","compatibility","standardLanguage","preferences","supportingLinks","skillBindings","requirements","title","summary","content","principles","externalSkills","reviewCriteria","examples","requiredIds","tags","useWhen","priority","checks"];
        if(Object.keys(args.changes).some(key=>!allowed.includes(key)))throw new BrainError("Unsupported update field");
        if(args.conflicts!==undefined&&(!Array.isArray(args.conflicts)||!args.conflicts.every(v=>typeof v==="string")))throw new BrainError("Invalid conflicts");
        if(Array.isArray(args.conflicts)&&args.conflicts.length)throw new BrainError("Resolve repository/style conflicts before applying amendments","CONFLICT",409);
        let changes=args.changes as Record<string,unknown>;
        if(args.sourceFiles!==undefined){
          if(!Array.isArray(args.sourceFiles)||!args.sourceFiles.length||args.sourceFiles.length>8)throw new BrainError("Supply 1-8 source evidence files");
          if(!Array.isArray(args.conflicts))throw new BrainError("Provide conflicts: [] after reviewing evidence and precedence");
          const folder=projectFolder(db,args.projectId);
          const citations=args.sourceFiles.map(value=>{
            if(!value||typeof value!=="object"||typeof value.file!=="string"||typeof value.digest!=="string")throw new BrainError("Invalid source evidence");
            const evidence=readRepositoryEvidence(folder,value.file);
            if(evidence.digest!==value.digest)throw new BrainError("Repository evidence changed: "+value.file+". Read it again before updating.","CONFLICT",409);
            return "Source: "+evidence.file+" (SHA-256 "+evidence.digest+")";
          });
          const current=db.scopedRecords(args.projectId).find(r=>r.id===args.id);
          if(!current)throw new BrainError("Record is not selected in this project","NOT_FOUND",404);
          const content=changes.content===undefined?current.content:changes.content;
          if(typeof content!=="string")throw new BrainError("Invalid content");
          const missing=citations.filter(line=>!content.includes(line));
          changes={...changes,content:content+(missing.length?"\n\nRepository evidence:\n"+missing.join("\n"):"")};
        }
        const record=db.personalizeRecord(args.projectId,args.id,changes,args.expectedVersion as number,args.expectedProjectVersion as number);
        return text({record,projectVersion:db.project(args.projectId).version,scope:"project"});
      }
      case "brain_resolve":
        if(!projectId)throw new BrainError("Explicit projectId required");
        return text({...resolveInstructions(db,projectId,args),complianceInstructions});
      case "brain_prepare":
        if(!projectId)throw new BrainError("Explicit projectId required");
        return text({...prepareInstructions(db,projectId,args),complianceInstructions});
      case "brain_bootstrap": return text(db.bootstrap(3500,projectId)+"\n\n"+complianceInstructions);
      case "brain_discover": {
        const task=String(args.task||"");
        if(!task || task.length>4000) throw new BrainError("Task must have 1-4000 characters");
        const kinds=Array.isArray(args.kinds)?args.kinds.filter(k=>KINDS.includes(k)):undefined;
        return text(db.discover(task,kinds as Kind[]|undefined,Number(args.limit)||12,projectId,args.context as any));
      }
      case "brain_get": {
        const r=db.scopedRecords(projectId).find(r=>r.id===String(args.id||"")); if(!r||r.status!=="active") throw new BrainError("Record not found or not active","NOT_FOUND",404);
        const linked=db.requiredRecords([r],projectId).filter(link=>link.id!==r.id);
        let folder:string|undefined;if(projectId)try{folder=projectFolder(db,projectId);}catch{/* Availability can still be checked for agent/global skills. */}
        const inventory=installedSkills(folder);
        return text({...r,complianceInstructions,requirementChecklist:requirementChecklist([r,...linked]),requiredLinked:linked,skillAvailability:skillReferences([r,...linked],inventory.skills,args.host as string|undefined),skillScanIssues:inventory.issues,skillLoading:"Use brain_get_installed_skill with projectId and an available skill ID to load relevant instructions on demand. Missing or ambiguous references need attention."});
      }
      case "brain_style": {
        if(!db.hasDomain(args.domain)) throw new BrainError("Invalid domain");
        const domain=args.domain as Domain;
        return text(db.requiredRecords(db.scopedRecords(projectId).filter(r=>r.kind==="preference").filter(r=>r.domain===domain||r.domain==="general"),projectId).map(r=>({id:r.id,keyId:r.keyId,title:r.title,content:r.content,examples:r.examples||[],principles:r.principles||[],externalSkills:r.externalSkills||[],reviewCriteria:r.reviewCriteria||[],priority:r.priority,version:r.version})));
      }
      case "brain_review": {
        if(args.instructionSetId!==undefined||args.artifacts!==undefined||args.evidence!==undefined||args.recordIds!==undefined||args.task!==undefined){
          if(!projectId)throw new BrainError("Artifact review requires project scope");
          if(args.content!==undefined&&(typeof args.content!=="string"||args.content.length>150000))throw new BrainError("Invalid artifact text");
          return text({...reviewArtifacts(db,projectId,args),complianceInstructions});
        }
        if(typeof args.content!=="string")throw new BrainError("Text review requires content");
        const content=String(args.content||""); if(content.length>150000) throw new BrainError("Artifact text exceeds 150000 characters");
        return text({...db.evaluate(content,db.hasDomain(args.domain)?args.domain as Domain:"general",projectId),complianceInstructions});
      }
      case "brain_feedback": {
        return text({recorded:true,approval:"pending",feedback:db.addFeedback({rating:String(args.rating||""),note:String(args.note||""),recordId:args.recordId?String(args.recordId):null})});
      }
      case "brain_inspect_tool": {
        const record=db.get(String(args.id||""));
        if(!record || record.kind!=="tool" || record.status!=="active" || !record.backend) throw new BrainError("Registered tool not found","NOT_FOUND",404);
        return text(await inspectBackend(record.backend));
      }
      case "brain_call_tool": {
        const record=db.get(String(args.id||""));
        if(!record || record.kind!=="tool" || record.status!=="active" || !record.backend) throw new BrainError("Registered tool not found","NOT_FOUND",404);
        if(args.arguments && (typeof args.arguments!=="object" || Array.isArray(args.arguments))) throw new BrainError("arguments must be object");
        return text(await invokeBackend(record.backend,args.arguments as Record<string,unknown>||{}));
      }
      default: throw new BrainError("Unknown tool", "NOT_FOUND",404);
    }
  } catch(e) {return errorText(e);}
}

export async function mcpMain(db:BrainDB, chatProjectId?:string) {
  if(chatProjectId)db.project(chatProjectId);
  const deliveryInstructions=chatProjectId?readOnlyComplianceInstructions:complianceInstructions;
  const exposedTools=chatProjectId?tools().filter(t=>["brain_bootstrap","brain_discover","brain_get","brain_style","brain_resolve"].includes(t.name)).map(t=>({...t,annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}})):tools();
  // stdout is exclusively used for MCP JSON-RPC; never write log text here.
  const readline=createInterface({input:process.stdin,crlfDelay:Infinity});
  let clientName = "unknown";
  let agent: "claude" | "codex" | "opencode" | "chatgpt" | "unknown" = chatProjectId ? "chatgpt" : process.env.PB_AGENT==="claude" ? "claude" : process.env.PB_AGENT==="codex" ? "codex" : process.env.PB_AGENT==="opencode" ? "opencode" : "unknown";
  const mcpRunId=()=>`${agent}:mcp:${process.pid}`;
  for await (const line of readline) {
    if(!line.trim())continue;
    let request:Record<string,any>;
    try { request=JSON.parse(line); } catch {process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Parse error"}})+"\n");continue;}
    if(!request||typeof request!=="object"||Array.isArray(request)||request.jsonrpc!=="2.0"||typeof request.method!=="string"){
      process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:null,error:{code:-32600,message:"Invalid Request"}})+"\n");continue;
    }
    if(request.id===undefined||request.id===null) continue; // notifications
    let response:Record<string,unknown>;
    try {
      let result:unknown;
      switch(request.method) {
        case "initialize": {
          if(typeof request.params?.protocolVersion!=="string"||!request.params.protocolVersion.trim())throw new BrainError("initialize requires a protocolVersion string");
          clientName=String(request.params?.clientInfo?.name||"unknown").slice(0,80);
          if(agent==="unknown") {const n=clientName.toLowerCase();agent=n.includes("claude")?"claude":n.includes("codex")?"codex":n.includes("opencode")?"opencode":"unknown";}
          result={protocolVersion:MCP_PROTOCOL_VERSION,capabilities:{tools:{listChanged:false},resources:{listChanged:false},prompts:{listChanged:false}},serverInfo:{name:"personal-brain-style",version:packageVersion()||"unknown"},instructions:(chatProjectId?`Read-only ChatGPT connection pinned to project ${chatProjectId}. Call brain_bootstrap, then brain_discover and brain_get for relevant styles. Local CLI skills cannot execute in ChatGPT; report unavailable skills honestly. `:"")+"This server stores personal working style, not project data.\n\n"+(chatProjectId?readOnlyComplianceInstructions:complianceInstructions)};
          db.trace({agent,channel:"mcp",runId:mcpRunId(),eventType:"mcp.initialize",outcome:"success",metadata:{client:clientName,projectId:chatProjectId||null}});
          break;
        }
        case "ping": result={};break;
        case "tools/list": {
          result={tools:exposedTools};
          db.trace({agent,channel:"mcp",runId:mcpRunId(),eventType:"mcp.tools.list",outcome:"success",metadata:{count:exposedTools.length,projectId:chatProjectId||null}});
          break;
        }
        case "tools/call": {
          const name=String(request.params?.name||"").slice(0,80);
          const args=(request.params?.arguments && typeof request.params.arguments==="object") ? request.params.arguments as Record<string,unknown> : {};
          if(chatProjectId){
            if(!exposedTools.some(t=>t.name===name))throw new BrainError("Tool unavailable in ChatGPT mode");
            if(args.cwd!==undefined||(args.projectId!==undefined&&args.projectId!==chatProjectId))throw new BrainError("This connection is pinned to one project");
            args.projectId=chatProjectId;
          }
          if(["brain_bootstrap","brain_discover","brain_get","brain_style","brain_prepare","brain_resolve","brain_review"].includes(name)){
            if(args.projectId!==undefined&&typeof args.projectId!=="string")throw new BrainError("Invalid project ID");
            if(args.cwd!==undefined&&typeof args.cwd!=="string")throw new BrainError("Invalid working directory");
            const scope=resolveProjectScope(args.projectId as string|undefined,args.cwd as string|undefined||process.cwd());
            if(scope.projectId)args.projectId=scope.projectId;
          }
          if(chatProjectId&&name==="brain_get"){
            const record=db.scopedRecords(chatProjectId).find(r=>r.id===args.id&&r.status==="active");
            if(!record)result=errorText(new BrainError("Record not found or not active","NOT_FOUND",404));
            else{
              const linked=db.requiredRecords([record],chatProjectId).filter(r=>r.id!==record.id);
              result=text({...record,requiredLinked:linked,requirementChecklist:requirementChecklist([record,...linked]),complianceInstructions,skillLoading:"External skills are references only. This connection does not read local skill files or execute CLI skills."});
            }
          }else result=await callTool(db,name,{...args,...(name==="brain_get"&&agent!=="unknown"?{host:agent}:{})});
          if(chatProjectId&&result&&typeof result==='object'){
            const payload=result as {content?:Array<{text?:string}>};
            if(payload.content?.[0]?.text){
              try{const info=JSON.parse(payload.content[0].text);if(info.complianceInstructions)info.complianceInstructions=readOnlyComplianceInstructions;payload.content[0].text=JSON.stringify(info,null,2);}
              catch{payload.content[0].text=payload.content[0].text.replaceAll(complianceInstructions,readOnlyComplianceInstructions);}
            }
          }
          const response=result as {isError?:boolean;content?:Array<{text?:string}>};
          const recordIds:string[]=[];
          if(typeof args.id==="string" && /^[a-f0-9-]{36}$/i.test(args.id)) recordIds.push(args.id);
          let resultCount=0, checkCount=0, passed=false;
          const recordVersions:Record<string,number>={};
          if(!response.isError && name==="brain_bootstrap") for(const item of db.bootstrapWithRecords(3500,typeof args.projectId==="string"?args.projectId:undefined).records){recordIds.push(item.id);recordVersions[item.id]=item.version;}
          if(!response.isError && response.content?.[0]?.text && ["brain_discover","brain_style","brain_review","brain_get","brain_prepare"].includes(name)) {
            try {
              const info=JSON.parse(response.content[0].text);
              if(name==="brain_get"||name==="brain_prepare") for(const row of info.requiredLinked||info.records||[]){recordIds.push(row.id);recordVersions[row.id]=row.version;}
              if(["brain_discover","brain_style"].includes(name) && Array.isArray(info)) {resultCount=info.length;for(const row of info) if(typeof row?.id==="string") {recordIds.push(row.id);if(Number.isInteger(row.version))recordVersions[row.id]=row.version;}}
              if(name==="brain_review") {checkCount=Number(info.automated??info.results?.filter((r:any)=>r.verification==="file-presence-only").length??0);passed=info.reviewId?info.status==="pass":info.passed===true;}
            }catch {/* Never store tool payloads. */}
          }
          for(const id of recordIds) if(recordVersions[id]===undefined) {const r=db.get(id);if(r)recordVersions[id]=r.version;}
          db.trace({agent,channel:"mcp",runId:typeof args.threadId==="string"?`${agent}:${args.threadId}`:mcpRunId(),eventType:`mcp.${name}`,outcome:response.isError?"error":"success",recordIds,recordVersions,
            metadata:{projectId:["brain_discover_project","brain_get_installed_skill","brain_create_project_style","brain_update_project_style","brain_bootstrap","brain_discover","brain_get","brain_style","brain_prepare","brain_resolve","brain_review"].includes(name)?(typeof args.projectId==="string"?args.projectId:process.env.PB_PROJECT_ID||null):null,sessionLinked:typeof args.threadId==="string",tool:name,resultCount,checkCount,passed,domain:String(args.domain||"").slice(0,40),promptChars:typeof args.task==="string"?args.task.length:0}});
          break;
        }
        case "resources/list": result={resources:[{uri:"brain://style/baseline",name:"Personal working style",description:"Concise user preferences",mimeType:"text/plain"}]};break;
        case "resources/read": {
          if(request.params?.uri!=="brain://style/baseline") throw new BrainError("Unknown resource","NOT_FOUND",404);
          result={contents:[{uri:"brain://style/baseline",mimeType:"text/plain",text:db.bootstrap(3500,chatProjectId||resolveProjectScope().projectId)}]};break;
        }
        case "prompts/list": result={prompts:[{name:"personalized_task",description:"Plan a task using personal style and skill discovery",arguments:[{name:"task",required:true}]}]};break;
        case "prompts/get": {
          if(request.params?.name!=="personalized_task") throw new BrainError("Unknown prompt");
          const task=String(request.params?.arguments?.task||"");
          result={description:"Use Personal Brain to personalize a task",messages:[{role:"user",content:{type:"text",text:`Follow my personal working style. First call brain_discover for: ${task}. Load relevant skills through brain_get, then complete the task.\n\n${deliveryInstructions}`}}]};break;
        }
        default: throw new BrainError("Method not found","METHOD_NOT_FOUND",404);
      }
      response={jsonrpc:"2.0",id:request.id,result};
    } catch(e) {response={jsonrpc:"2.0",id:request.id,error:{code:e instanceof BrainError&&e.code==="METHOD_NOT_FOUND"?-32601:-32602,message:e instanceof Error?e.message:String(e)}};}
    process.stdout.write(JSON.stringify(response)+"\n");
  }
}

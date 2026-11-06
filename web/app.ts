type Kind="preference"|"skill"|"example"|"review"|"tool";
type View=Kind|"skills"|"fusion"|"domains"|"projects"|"overview"|"discover"|"feedback"|"history"|"activation"|"trace"|"baseline"|"review_simulator";
type RecordItem={sourceStyleId?:string;sourceVersion?:number;supportingLinks?:Array<{recordId:string;when:unknown}>;skillBindings?:Array<{name:string;required:boolean;fallback:string;when?:unknown}>;preferences?:Array<{key:string;value:string}>;keyId?:string;requirements?:Array<{id:string;label:string;type:string;extension?:string}>;useWhen?:string;skillWarnings?:string[];projectId?:string;id:string;kind:Kind;domain:string;title:string;summary:string;content:string;tags:string[];requiredIds?:string[];examples?:string[];principles?:string[];externalSkills?:string[];reviewCriteria?:string[];priority:number;status:string;version:number;updatedAt:string;createdAt:string;checks:unknown[];backend:unknown};
type Summary={projectDefaultStyleIds?:string[];domainRegistry?:Array<{id:string;name:string;combinable?:boolean;styles?:number;skills?:number;examples?:number;rules?:number;projects?:number}>;total:number;revisions:number;feedback:number;counts:Record<Kind,number>};
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const main=$("main"),editor=$("editor") as HTMLDialogElement,revisions=$("revisions") as HTMLDialogElement;
const labels:Record<string,string>={skills:"Skill discovery",fusion:"Fusion",domains:"Capabilities",projects:"Projects",baseline:"Startup index",review_simulator:"Text Review",overview:"Overview",preference:"My Preferences",skill:"Skills",example:"Templates",review:"Review Standards",tool:"MCP Tool Catalog",discover:"Style discovery",feedback:"Feedback",history:"Activity",activation:"Agent setup",trace:"Trace Explorer"};
const icons:Record<string,string>={preference:"✦",skill:"▦",example:"◈",review:"✓",tool:"⛓"};
let active:View="overview",items:RecordItem[]=[],editing:RecordItem|null=null,search="",domain="all",summary:Summary|null=null;

const esc=(v:unknown)=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]||ch));
function domainRegistry():NonNullable<Summary["domainRegistry"]>{return summary?.domainRegistry||["general","thinking","architecture","diagrams","writing","coding","technology","reviews","communication","design","tools"].map(id=>({id,name:id}));}
function domainName(id:string){return domainRegistry().find(d=>d.id===id)?.name||id;}
function domainOptions(selected:string){return domainRegistry().map(d=>`<option value="${esc(d.id)}" ${d.id===selected?'selected':''}>${esc(d.name)}</option>`).join("");}
const formatTime=(s:string)=>new Date(s).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const kindLabel=(kind:string)=>({preference:"Preference",skill:"Skill",example:"Template",review:"Review rule",tool:"MCP tool"} as Record<string,string>)[kind]||kind;
const ch=(kind:string)=>`<span class="chip ${esc(kind)}">${esc(kindLabel(kind))}</span>`;
const empty=(title:string,desc:string)=>`<div class="empty"><span>◌</span><b>${esc(title)}</b><p>${esc(desc)}</p></div>`;

// Every major feature includes an accessible info button with concrete How / Why guidance.
type Help={title?:string;group?:string;what:string;how:string;why:string;limitations:string;example:string};
const HELP:Record<string,Help>={
  skills:{what:"Installed skills and the styles that require them.",how:"Choose global or project scope, search the inventory, and filter to Needs attention. Expand installations to compare file locations; Rescan skills rereads installed files.",why:"Find missing requirements and conflicting copies before using them with an agent.",limitations:"Scanning does not install skills or select a conflicting copy.",example:"Two styles requiring the same skill appear together in one row."},
  projects:{what:"Project-specific working preferences.",how:"Assign active shared records and optional instruction overrides. Only selections and their required dependencies apply.",why:"Use different working styles across projects without copying the library.",limitations:"Agents need an explicit project ID. Selecting a project here does not switch agent sessions.",example:"Use a sky blue design style for one project and a minimal design style for another."},
  overview:{what:"An inventory of personal working methods shared across agent runtimes.",how:"Shows active preferences, skills, examples, checks and recorded revisions. Edit from the library; agents read the latest approved versions.",why:"Keep your personal work style consistent without copying the same instructions into each conversation.",limitations:"The dashboard is not a project-memory manager or an agent-runtime monitor.",example:"Add a global writing rule; both Claude and Codex receive it in subsequent tasks."},
  preference:{what:"Global personal design, thinking and writing preferences.",how:"Store each rule as a versioned record with a domain, tags and priority. Startup and task hooks select relevant rules.",why:"Your work standards become portable between Claude Code and Codex.",limitations:"These rules influence generated output; they cannot force an agent to obey them.",example:"Require compact rounded diagrams with orthogonal connectors."},
  skill:{what:"Step-by-step procedures an agent can discover for a task.",how:"The prompt hook selects matching skills; an MCP agent can search with brain_discover and retrieve full text using brain_get.",why:"Reusable procedures are more reliable and easier to improve than a monolithic prompt.",limitations:"A discovered skill is not evidence of executed steps.",example:"For a diagram, choose a layout, generate draw.io XML and validate it."},
  example:{what:"Reusable templates: document outlines, code scaffolds or prompt starters you define once and reuse.",how:"Store a template under a capability with searchable tags. Copy it from the Library, or let agents find it through MCP discovery.",why:"Starting from an agreed template keeps outputs consistent and saves rewriting the same structure.",limitations:"Examples are general templates, never private project facts or automatically rendered artifacts.",example:"An acceptance-criteria template with actors, triggers and results."},
  review:{what:"Your quality criteria, including deterministic text checks and manual rubrics.",how:"Define checks for forbidden/required terms and length. Call brain_review to evaluate provided text. Visual inspections require external rendering.",why:"Detect recurring issues before accepting an output.",limitations:"A text check does not prove diagrams render or architectures are correct.",example:"Reject document placeholders such as TBD; separately inspect visual connector crossings."},
  tool:{what:"A catalog of external MCP capabilities available to your agents.",how:"Store a tool description. An administrator can configure and enable its command and tool name after review. Agents discover, inspect and invoke using MCP.",why:"Agents find the right drawing or document tool without loading every tool's definition.",limitations:"Catalog entries do not install servers. External invocation remains disabled until configured and approved.",example:"Register an approved draw.io MCP for editable diagrams."},
  discover:{what:"A simulator to inspect which styles and skills match a proposed task.",how:"Searches active records and ranks matches. Use the review simulator to test deterministic checks. This runs from the UI, not an agent.",why:"Find missing tags and improve discovery without spending model tokens.",limitations:"UI searches do not prove Claude or Codex called the MCP server.",example:"Search 'draw an architecture diagram' and verify a drawing skill appears."},
  activation:{what:"Automatically supplies personal style to Claude Code and Codex.",how:"SessionStart sends a compact index. UserPromptSubmit suggests matching record IDs and versions. MCP remains available for deeper retrieval.",why:"You do not need to type 'load my style' at every new session.",limitations:"Hook installation does not prove a live agent executed the hook. Confirm this in Trace Explorer.",example:"Start Claude, ask to draw a diagram and inspect its recorded hook.prompt.context event."},
  feedback:{what:"Human feedback about accepted work, corrections and rejected output.",how:"Record feedback against a style record or generally; later use it to propose and approve rule revisions.",why:"Prevent the same mistake from repeating across agents.",limitations:"Feedback is not model fine-tuning and does not change active preferences automatically.",example:"Record that a diagram had unnecessary crossing lines; edit the approved diagram rule."},
  history:{what:"An audit trail of style edits, restores and feedback.",how:"Every record edit creates a new immutable revision. Open a record's History to restore an earlier snapshot as a new version.",why:"Make style changes reversible and explainable.",limitations:"The activity log is not agent trace telemetry; use Trace Explorer for live agent events.",example:"Restore version 2 of your writing rules without deleting later history."},
  trace:{what:"Reverse trace of Personal Brain calls made by Claude Code and Codex.",how:"Collects SessionStart and prompt hook deliveries plus MCP initialization, search, get, review and feedback calls. Filter by agent, channel or knowledge record, then inspect which records and versions were delivered.",why:"Understand whether the Brain was contacted, which instructions were emitted and where the process stopped.",limitations:"A delivered instruction is not proof it affected the final answer. MCP processes and hook sessions may not share a correlation ID. Prompts and tool payloads are not stored.",example:"For a draw.io request, confirm hook.prompt.context listed your drawing style; then look for mcp.brain_get or mcp.brain_review."},
  trace_filters:{title:"Filter activity",group:"Trace Explorer",what:"Narrows the timeline below to the events you care about.",how:"Project limits events and the metric counts to one project. Agent and Channel narrow the timeline by Claude/Codex and hook/MCP. Reverse by rule shows only events that mention one style or skill. Refresh reloads, and Export saves the visible events as JSON.",why:"Answers questions like 'did Codex ever load my review checklist in this project?'",limitations:"Metric counts follow the Project filter only. Demo traces stay hidden unless you include them.",example:"Project Personal Brain + Reverse by rule 'UI/UX preferences' lists every event that delivered that style."},
  trace_samples:{title:"Sample traces",group:"Trace Explorer",what:"Creates or clears clearly marked synthetic events so you can see how a full trace looks.",how:"Generate adds demo events tagged DEMO ONLY; Clear removes them. They appear in the timeline only when Include demo traces is ticked.",why:"Lets you learn the timeline without waiting for real agent activity.",limitations:"Demo events never count in the metrics and are not evidence of real agent behavior.",example:"Generate, tick Include demo traces, and follow one demo run from hook to review."},
  trace_timeline:{title:"Observed event timeline",group:"Trace Explorer",what:"Every recorded hook and MCP call that matches your filters, newest first.",how:"Each row shows the event, project, agent, outcome and session, plus the style records it delivered and their versions. Inspect recorded evidence shows the raw metadata.",why:"Lets you trace a specific agent session back to the exact style versions it received.",limitations:"Hook sessions and MCP sessions can have different IDs, so one conversation may appear as unlinked rows.",example:"A brain_get row listing 'Warm terracotta\u2026 v2' shows the agent loaded that version."},
  revisions_metric:{title:"Revisions",group:"Overview \u00b7 metric",what:"The total number of saved versions across all records in your library.",how:"Every save, restore or project update creates a new version. Old versions are kept until the record itself is deleted. Open Change history to browse them.",why:"Shows how actively your styles are evolving, and that edits add versions instead of overwriting.",limitations:"A high count is not a quality signal. It includes small wording fixes.",example:"Editing one style three times adds 3."},
  knowledge_library:{title:"Knowledge library",group:"Overview",what:"The six library records changed most recently.",how:"Sorted by last update. Selecting a title opens it in the record editor.",why:"A quick way back to what you were working on.",limitations:"Shows shared library records only; project-private copies appear in their project.",example:"After updating the palette, its record appears at the top."},
  trace_startup:{title:"Startup injections",group:"Trace Explorer \u00b7 metric",what:"How many times a session-start hook sent Personal Brain's compact style index into a new Claude Code or Codex session.",how:"Counts real hook.session.context events, excluding demo data, for the project selected in Filter activity. Agent and channel filters do not change this number.",why:"Shows whether new sessions are actually receiving your style index.",limitations:"One injection per session is expected. It proves the index was sent, not that the agent read it.",example:"3 new Claude sessions today add 3."},
  trace_prompt:{title:"Task matches",group:"Trace Explorer \u00b7 metric",what:"How many prompts triggered the task hook to suggest matching style records (IDs and versions).",how:"Counts real hook.prompt.context events for the selected project. Each one is a prompt where the hook found relevant records.",why:"Tells you whether your styles' keywords and Use-when text actually match the work you ask for.",limitations:"A match only suggests records. The agent still decides whether to load them with brain_get.",example:"Asking 'draw a network diagram' adds 1 if a diagram style matched."},
  trace_tokens:{title:"Estimated context tokens",group:"Trace Explorer \u00b7 metric",what:"A rough size of all the text the hooks added to agent context.",how:"Sums the characters of emitted hook events for the selected project and divides by 4.",why:"Helps you spot styles or indexes that make every prompt expensive.",limitations:"It is an estimate, not model input/output usage, cached tokens or billing. MCP responses are not included.",example:"A 2,000-character index sent 10 times is about 5,000 tokens."},
  trace_discovery:{title:"Discovery calls",group:"Trace Explorer \u00b7 metric",what:"How many times an agent searched your library through the brain_discover MCP tool.",how:"Counts real mcp.brain_discover calls for the selected project.",why:"Shows agents looking for styles beyond what the hook suggested.",limitations:"A search returns a shortlist only. It does not mean any record was loaded or used.",example:"An agent searching for 'review checklist' before a code review adds 1."},
  trace_loads:{title:"Instruction loads",group:"Trace Explorer \u00b7 metric",what:"How many times an agent loaded a record's full instructions with the brain_get MCP tool.",how:"Counts real mcp.brain_get calls for the selected project. Loading one style counts once, even when it pulls in required linked records.",why:"The best available signal that agents read your full instructions instead of only the index.",limitations:"Loading is not following. Check outputs or review calls for evidence of compliance.",example:"Opening the UI/UX style before a design task adds 1."},
  trace_reviews:{title:"Review calls",group:"Trace Explorer \u00b7 metric",what:"How many compliance reports agents submitted with the brain_review MCP tool.",how:"Counts real mcp.brain_review calls for the selected project. Each report lists checks with pass, fail or not-verified evidence.",why:"The only metric where agents report checking their work against your styles.",limitations:"Agent-reported passes stay Not verified, and a review call does not prove the artifact is correct.",example:"An agent finishing a UI change and submitting its checklist adds 1."},
  external_skills:{title:"Procedure references",group:"Overview · metric",what:"External procedure references in your preferences, including legacy required skills and structured bindings.",how:"Counts each reference, including optional bindings. Applicability is resolved per task.",why:"Preferences describe desired behavior; external skills supply procedures when relevant.",limitations:"A reference does not install a skill or prove it was read. Optional missing procedures do not block work.",example:"A renderer used only for Draw.io counts as one reference."},
  review_criteria:{title:"Style review criteria",group:"Overview \u00b7 metric",what:"The total number of review criteria written into your styles in the library.",how:"Adds up every line in each style's Review criteria field. Agents see them as a checklist when they load a style.",why:"Shows how much of your library can actually be checked, not just followed.",limitations:"Most criteria are manual checks that need evidence. Retrieval does not prove they were checked.",example:"A design style with 6 criteria contributes 6."},
  activation_hooks:{title:"Hook status",group:"Agent setup",what:"Whether the Personal Brain hooks are installed in your Claude Code and Codex configuration files.",how:"Reads each agent's settings file and checks for the Personal Brain hook entries. 'Changed' means the file differs from what activation wrote.",why:"Without the hooks, new sessions get no style index and prompts get no task matches.",limitations:"Installed is not running. Codex also requires you to trust the hooks in /hooks. Confirm real events in Trace Explorer.",example:"Claude Code: Installed \u00b7 Codex: Not installed \u2192 run the activation script."},
  activation_auto:{title:"Automatic behavior",group:"Agent setup",what:"What the hooks do on their own once installed.",how:"SessionStart sends a compact style index. UserPromptSubmit matches each prompt and suggests record IDs and versions. Agents then load full instructions with brain_get.",why:"You do not need to say 'load my style' in every session.",limitations:"Hooks only supply context. They do not send prompts, run a second agent or store project memory.",example:"You type 'review this PR'; the hook suggests your review checklist record."},
  field_kind:{title:"Type",group:"Record editor · field",what:"Preference, Template, Review rule or MCP Tool.",how:"Preferences describe desired behavior, templates provide starting points, review rules define checks and tools describe MCP capabilities. Technical procedures belong in external skills.",why:"The type determines where the record appears and how agents discover it.",limitations:"Changing a type preserves history but changes its classification.",example:"Use a Preference for 'prefer square boxes' and reference a drawing skill for technical steps."},
  field_domain:{title:"Capability type",group:"Record editor \u00b7 field",what:"The capability group this record belongs to, such as Design, Coding or Diagrams.",how:"Used to group and filter records in the Library and Capabilities screens, and as a discovery signal.",why:"Consistent grouping makes records easy to find and keeps the capability counts accurate.",limitations:"Grouping does not limit which projects can select the record.",example:"A color palette record belongs under Design system."},
  field_priority:{title:"Priority (0\u2013100)",group:"Record editor \u00b7 field",what:"How strongly this record is ranked when several records match.",how:"With no search query, records are ordered by priority. With a query, it breaks ties between equal matches.",why:"Puts your most important rules first in the index and task suggestions.",limitations:"Priority changes ordering only. It cannot force an agent to obey a rule.",example:"Set a core review standard to 95 and a niche example to 60."},
  field_status:{title:"Status",group:"Record editor \u00b7 field",what:"Whether agents can receive this record: Active, Draft or Archived.",how:"Only Active records are sent in the startup index and returned by discovery. Draft and Archived records stay in the library and history.",why:"Lets you work on a rule without agents seeing it yet, or retire one without deleting it.",limitations:"Projects that already selected a now-archived record keep the selection until you change it.",example:"Save a new palette as Draft, review it, then switch it to Active."},
  library:{what:"Examples for all personal working style domains.",how:"Use the sample library loader to add missing example records. It never replaces titles already present.",why:"Provide concrete starting material for drawing, writing, architecture and review.",limitations:"These are editable examples, not universal rules or project knowledge.",example:"Seed Mermaid syntax guidance, editable draw.io procedures, review rubrics and UI standards."},
  trace_reverse:{what:"Find all observed events that mention one selected knowledge record.",how:"Choose a preference or skill. Trace Explorer filters by its record ID and shows the recorded version used in each event.",why:"Check whether a specific rule was actually delivered or requested over time.",limitations:"An event referencing a rule is not proof the agent complied with it.",example:"Select 'Editable draw.io architecture style' and find relevant Claude and Codex hook deliveries."},
  trace_demo:{what:"Clearly marked synthetic trace walkthroughs.",how:"Create example Claude and Codex timelines, then enable Show demos. Demo events are stored separately from live statistics and may be removed.",why:"Understand trace data before connecting real agents.",limitations:"Demonstrations are not real Claude or Codex activity.",example:"A sample diagram flow shows session hook, task hook, discover, get and review."},
  fields:{what:"The schema for a personal style record.",how:"Type selects skill, preference, example, review or tool. Domain and tags drive retrieval. Priority affects ordering. Status controls agent visibility; saving creates a revision.",why:"Well-structured records improve discovery and allow safe rollback.",limitations:"Do not store passwords or project secrets in personal style records.",example:"Type Skill; domain Diagrams; tags drawio, architecture; priority 95."},
  revision:{what:"Immutable history for a single style record.",how:"Updating or restoring always creates a new version while preserving old snapshots.",why:"You can test improvements and recover a previous style rule.",limitations:"Restoring rules does not undo output already generated by an agent.",example:"Restore a compact layout rule from v2 while keeping v3 and v4 in history."},
  baseline:{what:"Compact record index loaded at agent startup.",how:"Bootstrap lists active style titles, IDs and versions within a character budget. brain_get retrieves full instructions and required links on demand.",why:"Keep routine context small while preserving essential working standards.",limitations:"The index may omit records when its budget is reached; discovery can find them.",example:"Startup identifies writing and architecture styles; the agent retrieves only styles relevant to its task."},
  review_simulator:{what:"Test text validation locally before using the rule with an agent.",how:"Paste content, choose a domain and run stored deterministic checks.",why:"See what automated checks can detect and what still needs a human inspection.",limitations:"It is not a full document or diagram renderer.",example:"Paste a BRD containing TBD and inspect the failure."}
};
const helpTitle=(key:string)=>HELP[key]?.title||labels[key]||key.replace(/_/g," ").replace(/\b\w/g,s=>s.toUpperCase());
const infoButton=(key:string)=>`<button type="button" class="info-button" data-info="${esc(key)}" aria-label="About ${esc(helpTitle(key))}" title="About ${esc(helpTitle(key))}">i</button>`;
function showHelp(key:string){const entry=HELP[key]||HELP.overview;$("helpTitle").textContent=helpTitle(key);$("helpGroup").textContent=entry.group||"How Personal Brain works";
  $("helpContent").innerHTML=[
    ["What it does",entry.what],["How it works",entry.how],["Why it matters",entry.why],["Example",entry.example],["Limits and evidence",entry.limitations]
  ].map(([title,text])=>`<section class="help-part"><h3>${esc(title)}</h3><p>${esc(text)}</p></section>`).join("");
  ($( "helpDialog") as HTMLDialogElement).showModal();}

let page=1;
let libraryMode:"table"|"map"="table";
const pageSize=8;
function pageItems<T>(rows:T[]):T[]{page=Math.max(1,Math.min(page,Math.ceil(rows.length/pageSize)||1));return rows.slice((page-1)*pageSize,page*pageSize);}
function pagination(total:number){const pages=Math.ceil(total/pageSize);return pages>1?`<nav class="pagination" aria-label="Results pages"><span>Page ${page} of ${pages} · ${total} records</span><button class="button ghost small" data-page="${page-1}" ${page===1?"disabled":""}>Previous</button><button class="button ghost small" data-page="${page+1}" ${page===pages?"disabled":""}>Next</button></nav>`:"";}
let toastTimer:ReturnType<typeof setTimeout>;
function toast(message:string){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3200);}
async function api<T=unknown>(url:string,options:RequestInit={}):Promise<T>{
  const result=await fetch(url,{...options,headers:{...(options.body?{"Content-Type":"application/json"}:{}),...options.headers}});
  if(!result.ok){let data:{message?:string}={};try{data=await result.json();}catch{}throw new Error(data.message||`Request failed ${result.status}`);}
  return result.json() as Promise<T>;
}
function layout(title:string,desc:string,action:string="",body:string=""){
  updateUrl();
  main.innerHTML=`<div class="hero"><div><div class="title-with-info"><h1>${esc(title)}</h1>${infoButton(active)}</div><p>${esc(desc)}</p></div>${action}</div>${body}`;
  $("breadcrumb").textContent=title;
}
function styleContract(r:RecordItem){return (r.sourceStyleId?`<p>Private preference · based on global version ${esc(r.sourceVersion??'unknown')} · global identity ${esc(r.sourceStyleId)}</p>`:'')+(r.preferences?.length?`<h4>Preference values</h4><ul>${r.preferences.map(p=>`<li>${esc(p.key)}: ${esc(p.value)}</li>`).join('')}</ul>`:'')+(r.skillBindings?.length?`<h4>External procedures</h4><ul>${r.skillBindings.map(p=>`<li>${esc(p.name)} · ${p.required?'Required when applicable':'Optional'}${p.when?' · '+esc(JSON.stringify(p.when)):''}<br>${esc(p.fallback)}</li>`).join('')}</ul>`:'')+(r.supportingLinks?.length?`<h4>Conditional supporting guidance</h4><ul>${r.supportingLinks.map(p=>`<li>${esc(items.find(i=>i.id===p.recordId)?.title||p.recordId)} · ${esc(JSON.stringify(p.when))}</li>`).join('')}</ul>`:'')+(r.useWhen?`<h4>Use when</h4><p>${esc(r.useWhen)}</p>`:"")+[["Principles",r.principles],["Legacy skill references",r.externalSkills],["Worked examples",r.examples],["Review criteria",r.reviewCriteria],["Mandatory requirements",r.requirements?.map(x=>x.label+(x.extension?" ("+x.extension+" file required)":""))]].map(([title,values])=>Array.isArray(values)&&values.length?`<h4>${title}</h4><ul>${values.map(v=>`<li>${esc(v)}</li>`).join("")}</ul>`:"").join("");}
function recordTable(rows:RecordItem[]){
  if(!rows.length)return empty("No records yet","Create your first record, or adjust your search.");
  return `${rows.some(item=>item.skillWarnings?.length)?`<div class="section-heading">${skillResolutionHelp()}<button class="button ghost small" data-action="skills-rescan">Rescan skills</button></div>`:""}<div class="table-scroll"><table class="record-table"><thead><tr><th scope="col">Name &amp; details</th><th scope="col">Capability type</th><th scope="col">References</th><th scope="col">Status</th><th scope="col">Version</th><th scope="col">Actions</th></tr></thead><tbody>${rows.map(item=>`<tr><td><strong>${esc(item.title)}</strong><p>${esc(item.summary)}</p>${item.skillWarnings?.length?`<details class="skill-warning"><summary>${skillIssueLabel(item.skillWarnings)}</summary><ul>${item.skillWarnings.map(w=>`<li>${skillWarningExplanation(w)}</li>`).join("")}</ul></details>`:""}<details class="table-details"><summary>${item.kind==='preference'?'View style guidelines':'View details'}</summary><pre>${esc(item.content)}</pre>${styleContract(item)}${item.requiredIds?.length?`<p>Required-linked: ${item.requiredIds.map(id=>esc(items.find(r=>r.id===id)?.title||id)).join(", ")}</p>`:""}</details></td><td>${esc(domainName(item.domain))}</td><td><button class="button ghost small" data-dependencies="${esc(item.id)}" aria-label="Manage dependencies for ${esc(item.title)}">${item.requiredIds?.length||0} linked records</button><p class="reference-counts">${(item.externalSkills?.length||0)+(item.skillBindings?.length||0)} procedure references · ${item.reviewCriteria?.length||0} rules · ${item.examples?.length||0} examples</p></td><td><span class="tag">${esc(item.status)}</span></td><td>v${item.version}</td><td><div class="row-actions">${item.kind==="example"?iconAction('copy','Copy template '+item.title,`data-copy-template="${esc(item.id)}"`):""}${iconAction('edit','Edit '+item.title,`data-edit="${esc(item.id)}"`)}${iconAction('history','History of '+item.title,`data-history="${esc(item.id)}"`)}${iconAction('remove','Delete '+item.title,`data-remove-kind="record" data-remove-id="${esc(item.id)}"`)}${item.projectId&&active==="projects"?`<button class="button ghost small" data-publish="${item.id}">Publish to global</button>`:""}</div></td></tr>`).join("")}</tbody></table></div>`;
}

let selectedGraphNode="";
let graphShowContents=false;
let graph3d=false,graphYaw=0,graphPitch=0,graphSize=1000;
let graphPoints=new Map<string,{x:number;y:number;z:number}>();
let graphOwners=new Map<string,string>();
const graphTypeNames:Record<string,string>={preference:"Preference",skill:"Skill",review:"Review rule",example:"Template",tool:"Tool"};
let graphRecords=new Map<string,RecordItem>();
function dependencyMap(roots:RecordItem[]){
  selectedGraphNode="";
  if(!roots.length)return empty("No matching styles","Adjust your search or create a style.");
  const nodes=new Map<string,RecordItem>();
  const collect=(r:RecordItem)=>{if(nodes.has(r.id))return;nodes.set(r.id,r);for(const id of r.requiredIds||[]){const linked=items.find(i=>i.id===id);collect(linked||{id,title:"Unavailable dependency",domain:"unknown",status:"unavailable",requiredIds:[]} as unknown as RecordItem);}};
  roots.forEach(collect);
  const styleCount=nodes.size;
  graphRecords=new Map(nodes);
  graphOwners=new Map();
  if(graphShowContents)for(const parent of [...nodes.values()]){
    const root={...parent,requiredIds:[...(parent.requiredIds||[])]};nodes.set(root.id,root);
    for(const [kind,values] of [["skill",root.externalSkills],["review",root.reviewCriteria],["example",root.examples]] as const){
      values?.forEach((value,index)=>{
        const id=`${root.id}:${kind}:${index}`;root.requiredIds!.push(id);graphOwners.set(id,root.id);
        const node={...parent,id,kind,title:value,summary:`${graphTypeNames[kind]} belonging to ${parent.title}`,content:value,domain:parent.domain,status:"reference",requiredIds:[],externalSkills:[],reviewCriteria:[],examples:[],principles:[]};
        nodes.set(id,node);graphRecords.set(id,node);
      });
    }
  }
  const links=[...nodes.values()].flatMap(r=>(r.requiredIds||[]).map(id=>({from:r.id,to:id})));
  graphYaw=0;graphPitch=0;
  const radius=Math.max(280,Math.sqrt(nodes.size)*115);
  const width=radius*2+240,height=width;graphSize=width;
  graphPoints=new Map();
  const entries=[...nodes.values()];
  entries.forEach((r,i)=>{const angle=i*2.399963,spread=radius*Math.sqrt((i+.5)/entries.length);graphPoints.set(r.id,{x:spread*Math.cos(angle),y:spread*Math.sin(angle),z:radius*.4*Math.sin(i*1.7)});});
  // A bounded spring layout keeps connected content near its owning style.
  for(let pass=0;pass<100;pass++){
    for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
      const a=graphPoints.get(entries[i].id)!,b=graphPoints.get(entries[j].id)!;let dx=b.x-a.x,dy=b.y-a.y;const d=Math.hypot(dx,dy)||1;
      if(d<190){const push=(190-d)*.08;dx=dx/d*push;dy=dy/d*push;a.x-=dx;a.y-=dy;b.x+=dx;b.y+=dy;}
    }
    for(const link of links){const a=graphPoints.get(link.from)!,b=graphPoints.get(link.to)!;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;const pull=(d-210)*.008;a.x+=dx/d*pull;a.y+=dy/d*pull;b.x-=dx/d*pull;b.y-=dy/d*pull;}
  }
  // Finish with collision separation so spring attraction cannot leave labels overlapping.
  for(let pass=0;pass<40;pass++)for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    const a=graphPoints.get(entries[i].id)!,b=graphPoints.get(entries[j].id)!;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
    if(d<180){const shift=(180-d)/2+.1;a.x-=dx/d*shift;a.y-=dy/d*shift;b.x+=dx/d*shift;b.y+=dy/d*shift;}
  }
  const positions=new Map([...graphPoints].map(([id,p])=>[id,projectGraphPoint(p)]));
  const edges=links.map(e=>{
    const a=positions.get(e.from)!,b=positions.get(e.to)!;
    const distance=Math.hypot(b.x-a.x,b.y-a.y)||1,dx=(b.x-a.x)/distance,dy=(b.y-a.y)/distance;
    const path=`M ${a.x+dx*72*a.scale} ${a.y+dy*72*a.scale} L ${b.x-dx*78*b.scale} ${b.y-dy*78*b.scale}`;
    return `<path class="dependency-edge" data-from="${esc(e.from)}" data-to="${esc(e.to)}" d="${path}" marker-end="url(#dependencyArrow)"><title>${esc(nodes.get(e.from)?.title)} ${graphOwners.has(e.to)?"contains":"requires"} ${esc(nodes.get(e.to)?.title)}</title></path>`;
  }).join("");
  const boxes=[...nodes.values()].map(r=>{const p=positions.get(r.id)!;const label=r.title.length>76?r.title.slice(0,73)+"…":r.title;return `<foreignObject data-graph-position="${esc(r.id)}" x="${p.x-72}" y="${p.y-72}" width="144" height="144" transform="translate(${p.x*(1-p.scale)} ${p.y*(1-p.scale)}) scale(${p.scale})"><div xmlns="http://www.w3.org/1999/xhtml" class="dependency-node graph-orb graph-type-${r.kind||"preference"} ${roots.some(root=>root.id===r.id)?"":"dependency-context"}"><button type="button" data-graph-node="${esc(r.id)}" aria-pressed="false" title="${esc(r.title)}" aria-label="Explore ${esc(r.title)}"><strong>${esc(label)}</strong><small>${esc(graphTypeNames[r.kind]||"Style")}</small></button></div></foreignObject>`;}).join("");
  return `<p class="dependency-legend">Arrows mean “requires”, not execution order. ${styleCount} styles shown · ${nodes.size} total nodes. Select to highlight links and inspect content. Drag the background to ${graph3d?'rotate':'pan'}; drag nodes to arrange.</p><div class="graph-toolbar"><button class="button ghost small" data-graph-contents="toggle" aria-pressed="${graphShowContents}">${graphShowContents?"Show styles only":"Show all content nodes"}</button><div class="graph-key" aria-label="Node type legend">${Object.entries(graphTypeNames).map(([kind,label])=>`<span class="graph-key-item graph-type-${kind}"><i aria-hidden="true"></i>${label}</span>`).join("")}</div><div class="graph-controls" role="group" aria-label="Graph controls"><button class="button ghost small" data-graph-mode="2d" aria-pressed="${!graph3d}">2D</button><button class="button ghost small" data-graph-mode="3d" aria-pressed="${graph3d}">3D</button><button class="button ghost small" data-graph-orbit="left" aria-label="Rotate left">↶</button><button class="button ghost small" data-graph-orbit="right" aria-label="Rotate right">↷</button><button class="button ghost small" data-graph-zoom="in" aria-label="Zoom in">＋</button><button class="button ghost small" data-graph-zoom="out" aria-label="Zoom out">−</button><button class="button ghost small" data-graph-zoom="fit">Fit graph</button></div></div><div class="graph-workspace"><div class="dependency-canvas graph-explorer" tabindex="0" role="region" aria-label="Style dependency map"><svg id="dependencyGraph" data-size="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Required style relationships"><defs><marker id="dependencyArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dependency-arrow" d="M 0 0 L 10 5 L 0 10 z"/></marker></defs><g class="dependency-edges">${edges}</g>${boxes}</svg></div><aside id="graphDetails" class="graph-details" aria-label="Selected node details" hidden></aside></div>`;
}

function highlightDependencyNode(id:string){
  selectedGraphNode=selectedGraphNode===id?"":id;
  const neighbors=new Set([selectedGraphNode]);
  document.querySelectorAll<SVGPathElement>(".dependency-edge").forEach(edge=>{
    const connected=edge.dataset.from===selectedGraphNode||edge.dataset.to===selectedGraphNode;
    edge.classList.toggle("is-highlighted",!!selectedGraphNode&&connected);
    edge.classList.toggle("is-muted",!!selectedGraphNode&&!connected);
    if(selectedGraphNode&&connected){neighbors.add(edge.dataset.from!);neighbors.add(edge.dataset.to!);edge.parentElement?.appendChild(edge);}
  });
  const detail=graphRecords.get(selectedGraphNode)||items.find(r=>r.id===selectedGraphNode);
  if($("graphDetails")){ $("graphDetails").hidden=!detail; $("graphDetails").innerHTML=detail?`<div class="graph-drawer-head"><strong>Node details</strong><button class="button ghost small" data-action="graph-close" aria-label="Close node details">Close ×</button></div><h3>${esc(detail.title)}</h3><p>${esc(detail.summary)}</p>${detail.status==="reference"?`<pre>${esc(detail.content)}</pre><button class="button ghost small" data-edit="${esc(graphOwners.get(detail.id)||"")}">Edit owning style</button>`:`<div class="row-actions"><button class="button ghost small" data-edit="${esc(detail.id)}">Edit style</button></div>${styleContract(detail)}`}`:"";}
  document.querySelectorAll<HTMLButtonElement>("[data-graph-node]").forEach(node=>{
    node.setAttribute("aria-pressed",String(node.dataset.graphNode===selectedGraphNode));
    node.classList?.toggle("is-linked",!!selectedGraphNode&&neighbors.has(node.dataset.graphNode!));
    node.classList?.toggle("is-muted",!!selectedGraphNode&&!neighbors.has(node.dataset.graphNode!));
  });
}

function closeGraphDetails(){
  const id=selectedGraphNode;if(!id)return;
  highlightDependencyNode(id);
  document.querySelectorAll<HTMLButtonElement>("[data-graph-node]").forEach(node=>{if(node.dataset.graphNode===id)node.focus();});
}

function zoomGraph(action:string){
  const svg=document.getElementById("dependencyGraph");if(!svg)return;
  const size=Number(svg.dataset.size),v=(svg.getAttribute("viewBox")||"").split(" ").map(Number);
  if(action==="fit"){
    const points=[...graphPoints.values()].map(projectGraphPoint);
    if(points.length){const minX=Math.min(...points.map(p=>p.x-90*p.scale)),minY=Math.min(...points.map(p=>p.y-90*p.scale)),maxX=Math.max(...points.map(p=>p.x+90*p.scale)),maxY=Math.max(...points.map(p=>p.y+90*p.scale));const span=Math.max(maxX-minX,maxY-minY);svg.setAttribute("viewBox",`${(minX+maxX-span)/2} ${(minY+maxY-span)/2} ${span} ${span}`);}
    else svg.setAttribute("viewBox",`0 0 ${size} ${size}`);return;
  }
  const width=Math.max(size/5,Math.min(size*2,v[2]*(action==="in"?.8:1.25)));
  svg.setAttribute("viewBox",`${v[0]+(v[2]-width)/2} ${v[1]+(v[3]-width)/2} ${width} ${width}`);
}
function projectGraphPoint(p:{x:number;y:number;z:number}){
  const yaw=graph3d?graphYaw:0,pitch=graph3d?graphPitch:0;
  const x=p.x*Math.cos(yaw)+p.z*Math.sin(yaw),z=-p.x*Math.sin(yaw)+p.z*Math.cos(yaw);
  const y=p.y*Math.cos(pitch)-z*Math.sin(pitch),depth=p.y*Math.sin(pitch)+z*Math.cos(pitch);
  const scale=graph3d?1/(1+depth/(graphSize*2)):1;
  return {x:graphSize/2+x*scale,y:graphSize/2+y*scale,scale,depth};
}
function updateGraphProjection(){
  const positions=new Map([...graphPoints].map(([id,p])=>[id,projectGraphPoint(p)]));
  document.querySelectorAll<SVGForeignObjectElement>("[data-graph-position]").forEach(node=>{
    const p=positions.get(node.dataset.graphPosition!);if(!p)return;
    node.setAttribute("x",String(p.x-72));node.setAttribute("y",String(p.y-72));
    node.setAttribute("transform",`translate(${p.x*(1-p.scale)} ${p.y*(1-p.scale)}) scale(${p.scale})`);
  });
  document.querySelectorAll<SVGPathElement>(".dependency-edge").forEach(edge=>{
    const a=positions.get(edge.dataset.from!),b=positions.get(edge.dataset.to!);if(!a||!b)return;
    const d=Math.hypot(b.x-a.x,b.y-a.y)||1,dx=(b.x-a.x)/d,dy=(b.y-a.y)/d;
    edge.setAttribute("d",`M ${a.x+dx*72*a.scale} ${a.y+dy*72*a.scale} L ${b.x-dx*78*b.scale} ${b.y-dy*78*b.scale}`);
  });
}
let graphDragged=false;
let graphPan:{svg:Element;x:number;y:number;view:number[];scale:number;node?:string;yaw:number;pitch:number}|null=null;
document.addEventListener("pointerdown",event=>{
  const target=event.target as Element,svg=target.closest("#dependencyGraph");
  if(!svg||event.button!==0)return;
  const view=(svg.getAttribute("viewBox")||"").split(" ").map(Number),rect=svg.getBoundingClientRect();
  event.preventDefault();
  (target.closest("[data-graph-node]") as HTMLElement|null)?.focus();
  graphDragged=false;
  graphPan={svg,x:event.clientX,y:event.clientY,view,scale:view[2]/Math.min(rect.width,rect.height),node:(target.closest("[data-graph-node]") as HTMLElement)?.dataset.graphNode,yaw:graphYaw,pitch:graphPitch};
});
document.addEventListener("pointermove",event=>{
  if(!graphPan)return;const {svg,x,y,view,scale,node,yaw,pitch}=graphPan;
  const dx=event.clientX-x,dy=event.clientY-y;if(Math.abs(dx)+Math.abs(dy)<4)return;graphDragged=true;
  svg.setPointerCapture(event.pointerId);
  if(node){const p=graphPoints.get(node);if(p){const projection=projectGraphPoint(p),sx=dx*scale/projection.scale,sy=dy*scale/projection.scale;
    const cy=graph3d?Math.cos(graphYaw):1,syaw=graph3d?Math.sin(graphYaw):0,cp=graph3d?Math.cos(graphPitch):1,sp=graph3d?Math.sin(graphPitch):0;
    p.x+=sx*cy+sy*sp*syaw;p.y+=sy*cp;p.z+=sx*syaw-sy*sp*cy;updateGraphProjection();}graphPan.x=event.clientX;graphPan.y=event.clientY;
  }else if(graph3d){graphYaw=yaw+dx*.008;graphPitch=pitch+dy*.008;updateGraphProjection();}
  else svg.setAttribute("viewBox",`${view[0]-dx*scale} ${view[1]-dy*scale} ${view[2]} ${view[3]}`);
});
document.addEventListener("pointerup",()=>{graphPan=null;});
document.addEventListener("pointercancel",()=>{graphPan=null;graphDragged=false;});
document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&selectedGraphNode&&!(event.target as Element).closest("dialog")){event.preventDefault();closeGraphDetails();return;}
  const target=event.target as Element;if(!target.closest(".graph-explorer")||!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))return;
  event.preventDefault();const id=(target.closest("[data-graph-node]") as HTMLElement)?.dataset.graphNode;
  const dx=event.key==="ArrowLeft"?-20:event.key==="ArrowRight"?20:0,dy=event.key==="ArrowUp"?-20:event.key==="ArrowDown"?20:0;
  if(id){const point=graphPoints.get(id);if(point){point.x+=dx;point.y+=dy;}}
  else if(graph3d){graphYaw+=dx*.01;graphPitch+=dy*.01;}
  else {const svg=document.getElementById("dependencyGraph");if(svg){const v=(svg.getAttribute("viewBox")||"").split(" ").map(Number);svg.setAttribute("viewBox",`${v[0]+dx} ${v[1]+dy} ${v[2]} ${v[3]}`);}}
  updateGraphProjection();
});
document.addEventListener("wheel",event=>{
  if(!(event.target as Element).closest("#dependencyGraph"))return;
  event.preventDefault();zoomGraph(event.deltaY<0?"in":"out");
},{passive:false});

async function refresh(){
  try{
    summary=await api<Summary>("/api/summary");
    items=(await api<RecordItem[]>("/api/items")).filter(r=>r.status!=="archived");
    await render();
  }catch(e){
    summary=null;
    layout("Local server unavailable","Start the server in Terminal, then retry.","",`<div class="card panel"><p role="alert">${esc(e instanceof Error?e.message:"Could not load local data.")}</p><button class="button primary space-top-16" data-action="retry">Retry</button></div>`);
  }
}
async function render(){
  if(!summary)return refresh();
  if(["discover","baseline","review_simulator"].includes(active))diagnosticProjects=await api<ProjectConfig[]>("/api/projects");
  document.querySelectorAll("[data-view]").forEach(el=>el.classList.toggle("active",(el as HTMLElement).dataset.view===(["preference","skill","example","review"].includes(active)?"preference":active)));
  if(["trace","skills","discover","baseline"].includes(active)&&$("advancedNav"))($("advancedNav") as HTMLDetailsElement).open=true;
  if(active==="skills")return skillDiscovery();
  if(active==="projects")return projectScreen();
  if(active==="overview")return overview();
  if(active==="fusion")return fusionScreen();
  if(active==="domains")return domainsScreen();
  if(active==="discover"||active==="baseline"||active==="review_simulator")return discover();
  if(active==="activation")return activation();
  if(active==="feedback")return feedback();
  if(active==="history")return activity();
  if(active==="trace")return traceExplorer();
  records(active);
}
let domainEditing="",newDomainDraft="";
const domainDrafts=new Map<string,string>();
function domainsScreen(){
  const registry=domainRegistry().filter(d=>d.name.toLowerCase().includes(search.toLowerCase()));
  layout("Capabilities","Manage the capabilities shown on your overview and used to organize styles.",'<div class="page-actions"><button class="button ghost" data-view="preference">Back to library</button><button class="button primary" data-action="capability-add">＋ Add capability</button></div>',`<p id="domainError" class="form-error" role="alert"></p><form id="capabilitySearchForm" class="toolbar"><input id="capabilitySearch" class="search" type="search" aria-label="Search capabilities" placeholder="Search capabilities…" value="${esc(search)}" /></form><p class="results-count">${registry.length} capabilities</p><div class="table-scroll"><table class="record-table domains-table"><thead><tr><th scope="col">Capability type</th><th scope="col" class="num">Styles</th><th scope="col" class="num">Skills</th><th scope="col" class="num">Examples</th><th scope="col" class="num">Rules</th><th scope="col" class="num">Projects</th><th scope="col">Actions</th></tr></thead><tbody>${pageItems(registry).map(d=>`<tr class="project-link-row" data-capability-row="${esc(d.id)}"><td>${domainEditing===d.id?`<form id="domainRename"><label class="sr-only" for="domain-${esc(d.id)}">New name for ${esc(d.name)}</label><input id="domain-${esc(d.id)}" value="${esc(domainDrafts.get(d.id)??d.name)}" required maxlength="60" /><label class="check-inline"><input type="checkbox" id="domainCombinable-${esc(d.id)}" ${d.combinable?"checked":""} /> Projects can combine its styles</label></form>`:`<span class="cap-name"><a href="#/library?domain=${encodeURIComponent(d.id)}"><strong>${esc(d.name)}</strong></a>${d.combinable?'<span class="tag" title="A project can select several styles from this capability">Combinable</span>':''}</span>${domainDrafts.has(d.id)?'<small>Unsaved name</small>':''}`}</td><td class="num">${d.styles||0}</td><td class="num">${d.skills||0}</td><td class="num">${d.examples||0}</td><td class="num">${d.rules||0}</td><td class="num">${d.projects||0}</td><td><div class="row-actions">${domainEditing===d.id?`<button type="submit" form="domainRename" class="button primary small">Save</button><button type="button" class="button ghost small" data-cancel-domain="${esc(d.id)}">Cancel</button>`:`<button type="button" class="button ghost small" data-edit-domain="${esc(d.id)}" aria-label="Rename ${esc(d.name)}">Rename</button><button type="button" class="button ghost small" data-remove-kind="domain" data-remove-id="${esc(d.id)}">Delete</button>`}</div></td></tr>`).join("")}</tbody></table></div>${pagination(registry.length)}<p class="hint">Counts include global styles and their dependencies. Skills are requirements, not installed copies.</p>`);
  $("capabilitySearch").addEventListener("input",()=>{const input=$("capabilitySearch") as HTMLInputElement;const start=input.selectionStart,end=input.selectionEnd;search=input.value;page=1;updateUrl(true);domainsScreen();const next=$("capabilitySearch") as HTMLInputElement;next.focus();if(start!==null&&start!==undefined)next.setSelectionRange(start,end);});
  $("capabilitySearchForm").addEventListener("submit",ev=>{ev.preventDefault();search=($("capabilitySearch") as HTMLInputElement).value;page=1;domainsScreen();});
  if(domainEditing&&$("domainRename")){
    $("domain-"+domainEditing).addEventListener("input",()=>{domainDrafts.set(domainEditing,($("domain-"+domainEditing) as HTMLInputElement).value);});
    $("domainRename").addEventListener("submit",ev=>{ev.preventDefault();void saveDomainName(domainEditing);});
  }
}
async function saveDomainName(id?:string){
  try{
    const name=($(id?"domain-"+id:"domainName") as HTMLInputElement).value;
    const combinable=id?($("domainCombinable-"+id) as HTMLInputElement).checked:document.querySelector<HTMLInputElement>('input[name="domainMode"]:checked')?.value!=="single";
    await api("/api/domains"+(id?"/"+encodeURIComponent(id):""),{method:id?"PUT":"POST",body:JSON.stringify({name,combinable,expectedName:id?domainName(id):undefined})});
    summary=await api<Summary>("/api/summary");
    $("domainError").textContent="";
    if(id){domainDrafts.delete(id);domainEditing="";}else {newDomainDraft="";($("capabilityDialog") as HTMLDialogElement).close();}
    await render();
    toast(id?"Capability saved":"Capability created");
  }catch(e){$(id?"domainError":"capabilityCreateError").textContent=e instanceof Error?e.message:String(e);}
}
function overview(){
  const s=summary!;
  const recent=[...items].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,4);
  layout("Overview",recent[0]?`Last change: ${recent[0].title} · ${formatTime(recent[0].updatedAt)}`:"Manage global styles and the styles each project uses.",`<button class="button primary" data-view="projects">Open projects</button>`,
  `<section class="metrics">${[
    ["✦",s.counts.preference,"My Preferences","Global working principles"],
    ["▦",items.filter(r=>r.kind==="preference").reduce((n,r)=>n+(r.externalSkills?.length||0)+(r.skillBindings?.length||0),0),"Procedure references","Defined within My Preferences"],
    ["✓",items.filter(r=>r.kind==="preference").reduce((n,r)=>n+(r.reviewCriteria?.length||0),0),"Style review criteria","Defined within My Preferences"],
    ["↺",s.revisions,"Revisions","Versioned changes"]].map(a=>`<div class="card metric"><h2>${a[1]}</h2><div class="field-caption"><button class="link-btn" data-view="${a[2]==="Revisions"?"history":"preference"}">${a[2]}</button>${infoButton(({"My Preferences":"preference","Procedure references":"external_skills","Style review criteria":"review_criteria","Revisions":"revisions_metric"} as Record<string,string>)[String(a[2])]||"preference")}</div></div>`).join("")}</section>
  <section class="columns"><div class="card panel"><div class="panel-head"><div><h2>Knowledge library ${infoButton("knowledge_library")}</h2><p>Your most recent working preferences</p></div><button class="link-btn" data-view="preference">Browse library →</button></div>${recent.map(r=>`<div class="activity-line"><div class="activity-text"><button class="link-btn recent-record" data-edit="${esc(r.id)}">${esc(r.title)}</button><p>${esc(domainName(r.domain))} · ${esc(r.kind)} · v${r.version}</p></div><span class="activity-time">${esc(formatTime(r.updatedAt))}</span></div>`).join("")||empty("No records","Create your first style to get started")}</div>
  <div class="card panel capability-panel"><h3>Capabilities</h3><div class="cap-list">${domainRegistry().map(d=>`<a class="cap-pill" href="#/library?domain=${encodeURIComponent(d.id)}">${esc(d.name)}</a>`).join("")}</div><button class="link-btn panel-foot" data-view="domains">Manage capabilities →</button></div></section>`);
}
function records(kind:Kind){
  items=items.filter(r=>!r.projectId);
  const matches=[...items].sort((a,b)=>Number(b.tags.includes("style-recipe"))-Number(a.tags.includes("style-recipe"))).filter(r=>r.kind===kind && (domain==="all"||r.domain===domain) && (!search||[r.title,r.summary,r.useWhen||"",r.content,...r.tags].join(" ").toLowerCase().includes(search.toLowerCase())));
  const desc:Record<string,string>={preference:"Manage your working preferences across AI tools.",skill:"Discoverable procedures that guide how agents perform specialized tasks.",example:"Reusable templates — document outlines, code scaffolds or prompts — that you and your agents start new work from.",review:"Reusable quality rules with optional deterministic validation checks.",tool:"Discoverable MCP capabilities. External invocation is disabled until you explicitly authorize it."};
  const toolbar=`<div class="toolbar library-filters">${kind!=="tool"?'<select id="libraryType" class="select" aria-label="Library category">'+(["preference","example","review"] as Kind[]).map(k=>'<option value="'+k+'" '+(k===kind?"selected":"")+'>'+kindLabel(k)+'s</option>').join("")+'</select>':""}<input id="searchBox" aria-label="Search library" class="search" type="search" placeholder="Search ${esc(kindLabel(kind).toLowerCase())}s…" value="${esc(search)}" /><select id="domainFilter" aria-label="Filter by capability type" class="select"><option value="all">All capabilities</option>${domainOptions(domain)}</select></div>`;
  const visible=pageItems(matches);
  layout(kind==="tool"?labels[kind]:"Library",desc[kind],`<div class="page-actions"><div class="view-toggle" role="group" aria-label="Library view"><button class="button ghost" data-library-mode="table" aria-pressed="${libraryMode==="table"}">Table</button><button class="button ghost" data-library-mode="map" aria-pressed="${libraryMode==="map"}">Dependency map</button></div><button class="button ghost" data-action="catalog-preview">Review catalog updates</button><button class="button primary" data-action="add">＋ New ${esc(kindLabel(kind))}</button></div>`,`${toolbar}<p class="results-count">${matches.length} ${esc(kindLabel(kind).toLowerCase())}${matches.length===1?"":"s"} · ${domain==="all"?"All capabilities":esc(domainName(domain))}</p><section class="record-list">${libraryMode==="map"?dependencyMap(matches):recordTable(visible)}</section><div id="recordPagination">${libraryMode==="map"?"":pagination(matches.length)}</div>`);

  $("libraryType")?.addEventListener("change",ev=>{active=(ev.target as HTMLSelectElement).value as Kind;page=1;search="";domain="all";records(active as Kind);});
  const sb=$("searchBox") as HTMLInputElement;
  sb?.addEventListener("input",()=>{search=sb.value;page=1;updateUrl(true);const container=document.querySelector(".record-list");if(container){const found=items.filter(r=>r.kind===kind&&(domain==="all"||r.domain===domain)&&[r.title,r.summary,r.useWhen||"",r.content,...r.tags].join(" ").toLowerCase().includes(search.toLowerCase()));const count=document.querySelector(".results-count");if(count)count.textContent=String(found.length)+" "+kindLabel(kind).toLowerCase()+(found.length===1?"":"s")+" · "+(domain==="all"?"All capabilities":domainName(domain));container.innerHTML=libraryMode==="map"?dependencyMap(found):recordTable(pageItems(found));$("recordPagination").innerHTML=libraryMode==="map"?"":pagination(found.length);}});
  $("domainFilter")?.addEventListener("change",ev=>{domain=(ev.target as HTMLSelectElement).value;page=1;records(kind);});
}
type ComplianceReview={pendingTextChecks?:number;at:string;task:string;status:string;note:string;scope:string;results:Array<{style:string;label:string;recordVersion:number;status:string;verification:string;agentReported:string|null;note:string;artifacts:string[]}>;textFindings?:Array<{check:string;passed:boolean}>};
type ProjectActivity={complianceReviews?:ComplianceReview[];linked:number;active:number;unlinkedCalls:number;sessions:{agent:string;threadId:string;lastSeen:string;calls:number;estimatedContextTokens?:number;active:boolean}[]};
type ProjectConfig={activity?:ProjectActivity;id:string;name:string;description:string;assignments:{recordId:string;override:string|null}[];version:number;updatedAt:string};
let selectedProject:ProjectConfig|null=null;
let projectEditing=false;
let projectTab:"styles"|"map"|"personal"|"activity"|"setup"="styles";
async function repositoryRequest(projectId:string,folder:string,action:"link"|"test"){
  for(let attempt=0;;attempt++){
    try{return await api<{file:string;matches?:boolean;projectId?:string;records?:{title:string}[]}>(`/api/projects/${projectId}/repository`,{method:"POST",body:JSON.stringify({folder,action})});}
    catch(e){
      if(!(e instanceof TypeError))throw e;
      if(attempt===3)throw new Error("Cannot reach the local server. Check that npm start is running, wait for the server URL in Terminal, then retry. Your folder path has been kept.");
      $("repositoryResult").textContent="Waiting for the local server to restart…";
      await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
    }
  }
}
function iconAction(icon:"edit"|"history"|"publish"|"remove"|"open"|"copy",label:string,attribute:string){
  const paths={open:'<path d="M4 12h16 m-6-6 6 6-6 6"/>',edit:'<path d="m16 3 5 5-12 12H4v-5L16 3Z M14 5l5 5"/>',history:'<path d="M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2"/>',publish:'<path d="M12 16V3 m-5 5 5-5 5 5 M4 15v6h16v-6"/>',remove:'<path d="M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7"/>',copy:'<path d="M8 8h12v12H8z M16 8V4H4v12h4"/>'};
  return `<button type="button" class="button ghost icon-action" ${attribute} aria-label="${esc(label)}" title="${esc(label)}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[icon]}</svg><span class="action-tooltip" aria-hidden="true">${esc(label)}</span></button>`;
}
function projectStyleActions(r:RecordItem){
  return `<div class="row-actions project-style-actions">${iconAction('edit','Edit for project',`data-edit="${esc(r.id)}"`)}${iconAction('history','History',`data-history="${esc(r.id)}"`)}${r.projectId?iconAction('publish','Publish to global',`data-publish="${esc(r.id)}"`)+iconAction('remove','Delete private style',`data-remove-kind="record" data-remove-id="${esc(r.id)}"`):''}</div>`;
}
function projectOnboardingPrompt(id:string){
  return `Personalize the selected styles for Personal Brain project ${id} from this existing repository.

1. Use projectId "${id}" on every Personal Brain call. Call brain_discover_project to read the linked repository evidence and selected styles. Discovery itself is read-only. If no styles are selected or the repository link is wrong, report that before making changes.
2. Inspect repository instructions, architecture documents and ADR amendments, representative backend/frontend code, tests and build configuration. Use files/fileOffset to retrieve additional evidence as needed. Extract established conventions, not proposed improvements. Preserve explicit amendments over superseded rules; flag unresolved contradictions.
3. Read selected styles and required links with brain_get; use brain_projects for the current project version. Preserve existing personal edits. Check installed skill references; report missing or ambiguous skills instead of inventing links.
4. Amend only selected styles where source evidence justifies a change. Include discovery keywords and Use when, principles, instructions, required skills, concrete examples and review criteria where relevant. Use brain_update_project_style with expectedVersion, expectedProjectVersion and sourceFiles containing the current file/digest pairs from discovery. Supply conflicts: [] only after resolving conflicts; leave affected styles unchanged when conflicts remain.
5. Shared styles must become project-private copies; existing private styles update in place. Keep the updated styles selected. Do not change global styles, other projects, capability types or repository source files. Do not create generic drafts. Refresh discovery and versions after each update; skip unchanged styles.
6. Verify with scoped brain_discover and brain_get. Report changed style titles/versions, source evidence, preserved dependencies, unresolved conflicts and missing skills. Distinguish changes saved in Personal Brain from suggestions that were not applied.`;
}
function projectAgentGuide(id:string){
  return `<section class="agent-guide repository-settings"><div class="section-heading"><div><h2>Repository connection</h2><p>Manage the folder linked to this project.</p></div></div>
    <div class="repository-field"><label for="repositoryFolder">Repository folder</label><div class="folder-input"><input id="repositoryFolder" placeholder="Absolute path to your repository" spellcheck="false" autocomplete="off" /><button type="button" class="button ghost" id="browseRepositoryFolder" data-action="repository-browse">Browse folders</button></div></div>
    <div class="row-actions"><button type="button" class="button primary" data-action="repository-link">Save folder</button><button type="button" class="button ghost" data-action="repository-test">Check connection</button></div><p id="repositoryResult" role="status" aria-live="polite"></p>
    <div class="repository-configure"><div><h2>Project styles</h2><p>Use the same AI discovery and style selection workflow as project creation. Review changes before saving; global styles stay unchanged.</p></div><button class="button primary" data-action="project-edit">Discover & personalize with AI</button></div>
    <details><summary>Agent connection details</summary><p>Open this folder in your connected agent. Its project configuration selects the styles automatically.</p><p>Project ID: <code>${esc(id)}</code></p><a href="#/activation">Manage agent setup</a></details></section>`;
}
let removalPreview:{kind:string;id:string;fingerprint:string}|null=null;
async function previewRemoval(kind:string,id:string){
  const preview=await api<{kind:string;id:string;title:string;fingerprint:string;records:Array<{title:string}>;linkedRecords:Array<{title:string}>;projects:Array<{name:string}>;restored:Array<{title:string}>}>(`/api/removal/${kind}/${id}`);
  removalPreview=preview;
  $("removalTitle").textContent=kind==="reset"?"Reset project styles":"Delete "+preview.title;
  $("removalContent").innerHTML=`<p>This permanently removes ${preview.records.length} record(s), their embedded skills/examples/rules, revisions, feedback and related trace events. ${preview.linkedRecords.length} surviving record(s) will have these dependency links removed; ${preview.projects.length} project(s) are affected. Shared dependencies are preserved.</p><details><summary>Affected links and projects</summary><ul>${preview.linkedRecords.map(r=>`<li>Unlink: ${esc(r.title)}</li>`).join("")}${preview.projects.map(p=>`<li>Project: ${esc(p.name)}</li>`).join("")}</ul></details><details><summary>Records to remove</summary><ul>${preview.records.map(r=>`<li>${esc(r.title)}</li>`).join("")||"<li>None</li>"}</ul></details>${kind==="reset"?`<p>All private styles and instruction overrides will be removed. Restore the shared selections saved before customization (or current shared selections if no baseline was saved):</p><ul>${preview.restored.map(r=>`<li>${esc(r.title)}</li>`).join("")||"<li>No available shared selections</li>"}</ul><p>Automatic repository-personalization reminders are paused after reset. You can explicitly run discovery with your agent.</p>`:""}${kind==="project"?"<p>The project and its activity will be removed. Repository files are not deleted; remove its .personal-brain.json link before starting another session there.</p>":""}<p>This cannot be undone.</p>`;
  $("removalError").textContent="";($("removalDialog") as HTMLDialogElement).showModal();
}
type ProjectDiscovery={folder:string|null;skills:Array<{id:string;name:string;scope:string;agent:string;file:string}>;references:Array<{recordId:string;title?:string;reference:string;status:string;skills?:Array<{name:string;scope:string;agent:string;file:string}>}>;issues:Array<{type:string;message:string;recordId?:string}>;projectVersion:number;selectedStyles:Array<{id:string;title:string;version:number;private:boolean}>;files:string[];totalFiles:number;truncated:boolean;workflow:string;limitations:string};
let skillPage=0;
let skillProject="",skillQuery="",skillStatus="all",skillRecord="";
let skillScan:Pick<ProjectDiscovery,"skills"|"references"|"issues">={skills:[],references:[],issues:[]};
async function showProjectDiscovery(recordId?:string){
  skillProject=selectedProject?.id||"";skillRecord=recordId||"";skillStatus=recordId?"issues":"all";skillQuery="";active="skills";await render();
}
function renderSkillResults(){
  const query=skillQuery.toLowerCase();
  const refs=skillScan.references.filter(ref=>!skillRecord||ref.recordId===skillRecord);
  const groups=new Map<string,{name:string;status:string;styles:Set<string>;skills:ProjectDiscovery["skills"]}>();
  for(const ref of refs){
    const name=ref.reference.replace(/\s*\([^)]*\)\s*$/,"").trim();
    const key=(ref.skills?.map(s=>s.file).sort().join("|")||name.toLowerCase());
    const group=groups.get(key)||{name,status:ref.status,styles:new Set<string>(),skills:ref.skills as ProjectDiscovery["skills"]||[]};
    group.styles.add(ref.title||ref.recordId);groups.set(key,group);
  }
  if(!skillRecord)for(const skill of skillScan.skills){
    if([...groups.values()].some(g=>g.skills.some(s=>s.file===skill.file)))continue;
    const key="installed:"+skill.name.toLowerCase();
    const group=groups.get(key)||{name:skill.name,status:"installed",styles:new Set<string>(),skills:[]};group.skills.push(skill);groups.set(key,group);
  }
  const rows=[...groups.values()].filter(g=>(skillStatus==="all"||skillStatus==="issues"&&["missing","ambiguous"].includes(g.status)||skillStatus==="required"&&g.styles.size>0)&&[g.name,...g.styles,...g.skills.map(s=>s.file+" "+s.agent)].join(" ").toLowerCase().includes(query));
  rows.sort((a,b)=>({missing:0,ambiguous:1,available:2,installed:3}[a.status]! - {missing:0,ambiguous:1,available:2,installed:3}[b.status]!)||a.name.localeCompare(b.name));
  $("skillResults").innerHTML=`<p class="hint" role="status">${rows.length} matching skills</p><div class="table-scroll"><table class="record-table skill-diagnostics-table"><thead><tr><th>Skill</th><th>Status</th><th>Required by</th><th>Installations</th></tr></thead><tbody>${rows.slice(skillPage*20,(skillPage+1)*20).map(g=>`<tr><td><strong>${esc(g.name)}</strong></td><td><span class="tag ${g.status==='missing'?'bad':g.status==='ambiguous'?'warn':g.status==='available'?'ok':''}">${g.status==='missing'?'Missing':g.status==='ambiguous'?'Conflicting copies':g.status==='available'?'Ready':'Installed'}</span></td><td>${[...g.styles].map(t=>`<div>${esc(t)}</div>`).join('')||'—'}</td><td>${g.skills.length?`<details><summary>${g.skills.length} ${g.skills.length===1?'installation':'installations'}</summary>${g.skills.map(s=>`<p>${esc(s.scope)} · ${esc(s.agent)}<code>${esc(s.file)}</code></p>`).join('')}</details>`:'No matching installation'}</td></tr>`).join('')||'<tr><td colspan="4">No skills match these filters.</td></tr>'}</tbody></table></div><div class="pagination"><span>Page ${skillPage+1} of ${Math.max(1,Math.ceil(rows.length/20))}</span><button class="button ghost small" data-action="skill-prev" ${skillPage===0?'disabled':''}>Previous</button><button class="button ghost small" data-action="skill-next" ${(skillPage+1)*20>=rows.length?'disabled':''}>Next</button></div>`;
}
async function skillDiscovery(){
  skillPage=0;
  const projects=await api<ProjectConfig[]>("/api/projects");
  layout("Skill discovery","Find installed skills and resolve requirements for your styles.",'<button class="button primary" data-action="skill-scan">Rescan skills</button>',`<section class="card panel"><div class="skill-filters"><label>Project scope<select id="skillProject"><option value="">Global styles</option>${projects.map(p=>`<option value="${esc(p.id)}" ${p.id===skillProject?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label>Search skills<input type="search" id="skillQuery" value="${esc(skillQuery)}" placeholder="Name, style, agent or path…"></label><label>Show<select id="skillStatus">${[['all','All skills'],['issues','Needs attention'],['required','Required skills']].map(([v,t])=>`<option value="${v}" ${v===skillStatus?'selected':''}>${t}</option>`).join('')}</select></label></div>${skillRecord?'<button class="button ghost small" data-action="skill-clear-style">Clear style filter</button>':''}<div id="skillScanMessage" role="status">Scanning installed skills…</div><div id="skillResults"></div></section>${skillResolutionHelp()}`);
  $("skillProject").addEventListener('change',async()=>{skillProject=($("skillProject") as HTMLSelectElement).value;skillRecord="";await skillDiscovery();});
  $("skillQuery").addEventListener('input',()=>{skillPage=0;skillQuery=($("skillQuery") as HTMLInputElement).value;updateUrl(true);renderSkillResults();});
  $("skillStatus").addEventListener('change',()=>{skillPage=0;skillStatus=($("skillStatus") as HTMLSelectElement).value;updateUrl();renderSkillResults();});
  updateUrl();
  try{const scope=skillProject;const data=await api<typeof skillScan>("/api/skills?projectId="+encodeURIComponent(scope));if(active!=="skills"||scope!==skillProject)return;skillScan=data;$("skillScanMessage").innerHTML=data.issues.length?`<details><summary>Scan notices (${data.issues.length})</summary><ul>${data.issues.map(i=>`<li>${esc(i.message)}</li>`).join('')}</ul></details>`:'';renderSkillResults();}
  catch(e){$("skillScanMessage").textContent=e instanceof Error?e.message:String(e);}
}
function skillResolutionHelp(){
 return `<details class="skill-resolution-help"><summary>How to resolve skill issues</summary><p><strong>Missing:</strong> install the skill or correct its name in the style’s Required external skills field.</p><p><strong>Conflicting copies:</strong> compare installations and choose the intended version in your skill or plugin manager. A project-local installation takes precedence over global and agent copies; differing project-local copies still conflict.</p><p>Agents receive the conflict and candidate installation IDs. They can inspect a specific ID; Personal Brain does not choose a version automatically.</p><p>After making changes, click <strong>Rescan skills</strong>. This rereads installed skill files without changing them.</p></details>`;
}
function skillWarningExplanation(warning:string){
 return `<strong>${esc(warning.replace(/: (missing|ambiguous)$/, ''))}</strong> — ${warning.endsWith(': missing')?'Missing':'Conflicting copies'}`;
}
function skillIssueLabel(warnings:string[]){
 const missing=warnings.filter(w=>w.endsWith(": missing")).length;
 const ambiguous=warnings.length-missing;
 return [missing?`${missing} missing skill${missing===1?'':'s'}`:'',ambiguous?`${ambiguous} skill${ambiguous===1?' has':'s have'} conflicting copies`:''].filter(Boolean).join(' · ');
}
async function projectScreen(){
  if(selectedProject)items=(await api<RecordItem[]>("/api/items?projectId="+encodeURIComponent(selectedProject.id))).filter(r=>r.status!=="archived");
  if(projectEditing){projectForm();return;}
  if(selectedProject){
    selectedProject=await api<ProjectConfig>(`/api/projects/${selectedProject.id}`);
    let activity:ProjectActivity|null=null;let activityError="";
    try{activity=await api<ProjectActivity>(`/api/projects/${selectedProject.id}/activity`);}catch(e){activityError=e instanceof Error?e.message:String(e);}
    let resolved:Array<RecordItem&{source:string}>=[];let scopeError="";
    try{resolved=await api<Array<RecordItem&{source:string}>>(`/api/projects/${selectedProject.id}/resolved`);}catch(e){scopeError=e instanceof Error?e.message:String(e);}
    const skillIssues=items.flatMap(r=>(r.skillWarnings||[]).map(reference=>({recordId:r.id,reference})));
    const tabs=`<nav class="project-tabs" aria-label="Project sections">${([['styles','Styles'],['map','Dependency map'],['activity','Agent activity'],['setup','Repository setup']] as const).map(([key,title])=>`<a href="#/projects/${encodeURIComponent(selectedProject!.id)}${key==='styles'?'':'?tab='+key}" ${(projectTab===key||(key==='styles'&&projectTab==='personal'))?'aria-current="page"':''}>${title}</a>`).join("")}</nav>`;
    const status=`<div class="project-status-strip"><span><strong>${selectedProject.assignments.length}</strong> selected</span><span><strong>${scopeError?'—':resolved.filter(r=>r.source==='Required dependency').length}</strong> required dependencies</span><span>${activityError?'Activity unavailable':`<strong>${activity?.active??0}</strong> recently active · <strong>${activity?.linked??0}</strong> linked conversations`}</span></div>`;
    const availableStyles=[...resolved,...items.filter(r=>r.projectId===selectedProject!.id&&!resolved.some(selected=>selected.id===r.id)).map(r=>({...r,source:"Not selected"}))];
    const styleRows=projectTab==="personal"?availableStyles.filter(r=>r.projectId===selectedProject!.id):availableStyles;
    const styles=`<div class="section-heading"><div><h2>Project styles</h2><p class="hint">Selected styles, dependencies and private records in one place. Private records marked Not selected are not applied.</p></div><button class="button ghost small" data-action="private-style">New personalized style</button></div>
      <div class="page-actions style-scope-toolbar" aria-label="Style scope"><a class="button ghost small" href="#/projects/${encodeURIComponent(selectedProject.id)}" ${projectTab==='styles'?'aria-current="page"':''}>All styles (${availableStyles.length})</a><a class="button ghost small" href="#/projects/${encodeURIComponent(selectedProject.id)}?tab=personal" ${projectTab==='personal'?'aria-current="page"':''}>Private to this project (${availableStyles.filter(r=>r.projectId===selectedProject!.id).length})</a></div>
      ${scopeError?`<p role="alert">${esc(scopeError)} <button class="button ghost small" data-action="project-edit">Review selections</button></p>`:""}
      ${styleRows.length?`<div class="table-scroll"><table class="record-table project-styles-table"><thead><tr><th scope="col">Style</th><th scope="col">Capability / type</th><th scope="col">Source</th><th scope="col">Actions</th></tr></thead><tbody>${pageItems(styleRows).map(r=>`<tr><td><strong>${esc(r.title)}</strong>${skillIssues.some(issue=>issue.recordId===r.id)?`<p role="status"><button class="button ghost small" data-skill-issues="${esc(r.id)}">${skillIssueLabel(skillIssues.filter(issue=>issue.recordId===r.id).map(issue=>issue.reference))}</button></p>`:""}<details class="table-details"><summary>View style guidelines</summary><pre>${esc(r.content)}</pre>${styleContract(r)}</details></td><td>${esc(domainName(r.domain))}<p>${esc(kindLabel(r.kind))}</p></td><td><span class="tag">${esc(r.projectId?"Project-only": "Shared")}</span><p>${esc(r.source)} · ${esc(r.status)}</p></td><td>${projectStyleActions(r)}</td></tr>`).join("")}</tbody></table></div>${pagination(styleRows.length)}`:`<div class="selection-empty"><h2>${projectTab==='personal'?'No project-only styles yet':'No styles selected'}</h2><p>Select shared styles in Configure project, or create a personalized style. Editing a shared selection creates a private copy.</p><div class="row-actions"><button class="button ghost small" data-action="project-edit">Configure project</button><button class="button ghost small" data-action="private-style">New personalized style</button></div></div>`}`;
    const content=projectTab==='map'?(scopeError?`<p role="alert">${esc(scopeError)}</p>`:dependencyMap(resolved)):(projectTab==='personal'||projectTab==='styles')?styles:projectTab==='activity'?projectActivityPanel(activity,activityError):`<div class="project-scope"><div class="project-id"><span class="chip">Project ID</span><code>${esc(selectedProject.id)}</code></div>${projectAgentGuide(selectedProject.id)}</div>`;
    layout(selectedProject.name,selectedProject.description&&selectedProject.description!==selectedProject.name?selectedProject.description:"Manage this project's working styles and agent connections.",`<div class="page-actions"><button class="button primary" data-action="project-edit">Configure project</button><details class="page-overflow"><summary class="button ghost">More</summary><div><button class="button ghost small" data-remove-kind="reset" data-remove-id="${esc(selectedProject.id)}">Reset styles</button><button class="button ghost small" data-remove-kind="project" data-remove-id="${esc(selectedProject.id)}">Delete project</button></div></details></div>`,status+tabs+content);
    if(projectTab==='setup'){
      const agents=[...new Set((activity?.sessions||[]).map(s=>s.agent))];
      $("repositoryResult").textContent=agents.length?"Observed agent calls: "+agents.join(", ")+". This confirms prior use, not a live connection.":"No project-linked agent calls observed yet.";
      try{const state=await api<{folder:string;linked:boolean;error:string}>(`/api/projects/${selectedProject.id}/repository`);
        ($("repositoryFolder") as HTMLInputElement).value=state.folder;
        $("repositoryResult").textContent+=(state.linked?" Repository link verified.":" Repository link not verified.")+(state.error?" "+state.error:"");
      }catch{$("repositoryResult").textContent+=" Repository status unavailable.";}
    }
    return;
  }
  const projects=await api<ProjectConfig[]>("/api/projects");
  const matches=()=>projects.filter(p=>[p.name,p.description].join(" ").toLowerCase().includes(search.toLowerCase()));
  const found=matches();
  layout("Projects","Choose a project to manage its styles and agent connections.",'<button class="button primary" data-action="project-new">＋ New Project</button>',
    projects.length?`<div class="toolbar project-list-toolbar"><input id="projectSearch" class="search" type="search" aria-label="Search projects" placeholder="Search projects…" value="${esc(search)}" /><span id="projectCount" class="hint" aria-live="polite">${found.length} of ${projects.length} projects</span></div><div id="projectList">${projectListTable(found)}</div><div id="projectPagination">${pagination(found.length)}</div><p class="hint project-activity-note">Recently active: a call received in the last 15 minutes.</p>`:
    empty("Create your first project","Select reusable styles from your library, then link a repository to load them automatically."));
  $("projectSearch")?.addEventListener("input",()=>{search=($("projectSearch") as HTMLInputElement).value;page=1;const found=matches();$("projectList").innerHTML=projectListTable(found);$("projectPagination").innerHTML=pagination(found.length);$("projectCount").textContent=`${found.length} of ${projects.length} projects`;updateUrl(true);});
}
function projectListTable(projects:ProjectConfig[]){
  if(!projects.length)return empty("No matching projects","Try a different project name.");
  return `<div class="table-scroll"><table class="record-table projects-table"><thead><tr><th scope="col">Project</th><th scope="col">Selections</th><th scope="col">Agent activity</th><th scope="col">Updated</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${pageItems(projects).map(p=>`<tr class="project-link-row" data-project-row="${esc(p.id)}"><td><a class="project-title-link" href="#/projects/${encodeURIComponent(p.id)}">${esc(p.name)}</a>${p.description&&p.description!==p.name?`<p>${esc(p.description)}</p>`:''}</td><td><span class="tag ${p.assignments.length?'':'needs-selection'}">${p.assignments.length?p.assignments.length+' selected':'No styles selected'}</span></td><td>${p.activity?`<strong>${p.activity.active} recently active</strong><p>${p.activity.linked} linked conversations</p>`:'<span class="hint">Not available</span>'}</td><td>${esc(formatTime(p.updatedAt))}</td><td><div class="row-actions project-list-actions">${iconAction('open',`Open ${p.name}`,`data-project="${esc(p.id)}"`)}${iconAction('remove',`Delete ${p.name}`,`data-remove-kind="project" data-remove-id="${esc(p.id)}"`)}</div></td></tr>`).join("")}</tbody></table></div>`;
}

function projectActivityPanel(activity:ProjectActivity|null,error:string){
  return `<section class="project-scope agent-activity"><div class="section-heading"><h2>Agent conversations · ${error?"Activity unavailable":`${activity?.active??0} recently active / ${activity?.linked??0} linked`}</h2><button type="button" class="button ghost small" data-action="project-refresh">Refresh activity</button></div><p class="hint">Recently active: a call received in the last 15 minutes.</p>${error?`<p role="alert">${esc(error)}</p>`:`<p class="hint">${activity?.unlinkedCalls??0} calls without a conversation ID (not counted as threads).</p><div class="table-scroll"><table class="record-table"><thead><tr><th>Agent / thread</th><th>Activity</th><th>Estimated context tokens</th><th>Last seen</th></tr></thead><tbody>${pageItems(activity?.sessions||[]).map(s=>`<tr><td><strong>${esc(s.agent)}</strong><p>${esc(s.threadId)}</p></td><td>${s.active?"Recently active":"No recent activity"}<p><a href="#/trace?projectId=${encodeURIComponent(selectedProject!.id)}&amp;agent=${encodeURIComponent(s.agent)}&amp;runId=${encodeURIComponent(s.threadId)}">View audit history · ${s.calls} calls</a></p></td><td>${s.estimatedContextTokens??0}<p class="hint">Hook characters ÷ 4; not AI billing</p></td><td>${esc(formatTime(s.lastSeen))}</td></tr>`).join("")||'<tr><td colspan="4">No linked conversations observed yet. Start an agent with this project scope and enabled hooks.</td></tr>'}</tbody></table></div>${pagination(activity?.sessions.length||0)}`}</section>`;
}
function projectForm(){
  onboardingAbort?.abort();onboardingAbort=null;onboardingStep=0;
  const eligible=items.filter(r=>(!r.projectId||r.projectId===selectedProject?.id)&&(r.status==="active"&&r.kind!=="tool")&&(selectedProject||r.kind==='preference')||selectedProject?.assignments.some(a=>a.recordId===r.id));
  layout(selectedProject?"Configure project":"New project",selectedProject?"Choose the records for this project. Global defaults apply only when no project is specified.":"Link your source folder, discover relevant styles, and review your selections before creating the project.","",
    `<form id="projectForm" class="project-form"><div class="project-meta"><div class="field"><label for="projectName">Project name</label><input id="projectName" required maxlength="150" value="${esc(selectedProject?.name||"")}" /></div><div class="field"><label for="projectDescription">Description (optional)</label><input id="projectDescription" maxlength="1200" value="${esc(selectedProject?.description||"")}" /></div></div>
    <div class="style-selector"><div class="field style-search-field"><label for="assignmentSearch">Search styles</label><input id="assignmentSearch" type="search" placeholder="Search by name, capability or keyword…" /><p id="assignmentSearchResult" class="hint" aria-live="polite"></p></div><div class="style-selection-toolbar"><label class="inline-field"><input id="selectedOnly" type="checkbox" /> Selected only <span id="selectedCount" class="tag" aria-live="polite"></span></label><span id="availableCount" class="hint"></span></div><div id="availableAssignments" class="assignment-list">${eligible.map(r=>{const a=selectedProject?selectedProject.assignments.find(a=>a.recordId===r.id):summary?.projectDefaultStyleIds?.includes(r.id)?{recordId:r.id,override:null}:undefined;return `<article class="assignment-row" data-assignment-row="${esc(r.id)}" data-slot="${esc(r.kind+":"+r.domain+(domainRegistry().find(d=>d.id===r.domain)?.combinable?":"+r.id:""))}"><label class="assignment-choice"><input type="checkbox" name="assignment" value="${esc(r.id)}" ${a?"checked":""} /><span><strong>${esc(r.title)}</strong><small>${esc(domainName(r.domain))} · ${esc(kindLabel(r.kind))} · ${r.projectId?"Project-private":"Shared library"}</small></span><span class="assignment-state tag"></span></label><p class="hint">${esc(r.summary)}</p>${r.requiredIds?.length?`<details class="assignment-dependencies"><summary>${r.requiredIds.length} required dependencies</summary><ul>${r.requiredIds.map(id=>`<li>${esc(items.find(i=>i.id===id)?.title||"Unavailable record")}</li>`).join("")}</ul></details>`:""}<details class="shared-instructions"><summary>Style guidelines &amp; requirements</summary><pre>${esc(r.content)}</pre>${styleContract(r)}</details><details class="project-override" ${a?.override?"open":""} ${a?"":"hidden"}><summary>Customize for this project</summary><label for="override-${esc(r.id)}" class="hint">Optional project-only override: replaces the shared instruction text in this project. Keep applicable shared requirements in your text. Leave blank to inherit the global style; global records and other projects are unchanged.</label><textarea id="override-${esc(r.id)}" rows="3" maxlength="100000" ${a?"":"disabled"}>${esc(a?.override||"")}</textarea></details></article>`;}).join("")||'<p class="hint">No active library records available. Activate a style in Library to select it here.</p>'}</div><p id="noAssignments" class="selection-empty" hidden>No styles selected. Turn off Selected only to browse styles.</p></div>
    <div class="project-save-bar"><span id="projectSelectionSummary" aria-live="polite"></span><div class="page-actions"><button type="button" class="button soft" data-action="project-cancel">Cancel</button><button type="submit" class="button primary">Save project</button></div></div><div class="form-error" id="projectError" role="alert"></div></form>`);
  projectFormDirty=false;syncProjectSelection();
  $("assignmentSearch").addEventListener("input",filterProjectStyles);
  $("selectedOnly").addEventListener("change",filterProjectStyles);
  filterProjectStyles();
  if(!selectedProject)setupProjectWizard();
  else {
    $("projectForm").querySelector('.project-meta')!.insertAdjacentHTML('afterend',aiDiscoverySection());
    bindAiDiscovery();
  }
}
let onboardingStep=0,onboardingAbort:AbortController|null=null;
async function openFolderBrowser(inputId:string,buttonId="browseOnboardingFolder",errorId="projectError"){
  const input=$(inputId) as HTMLInputElement,button=$(buttonId) as HTMLButtonElement;
  button.disabled=true;button.textContent='Choose in folder dialog…';$(errorId).textContent='';
  try{
    const result=await api<{path:string|null}>('/api/folders/select',{method:'POST'});
    if(result.path&&input.isConnected){input.value=result.path;input.dispatchEvent(new Event('input',{bubbles:true}));}
  }catch(error){if(input.isConnected)$(errorId).textContent=error instanceof Error?error.message:String(error);}
  finally{button.disabled=false;button.textContent='Browse folders';if(button.isConnected)button.focus();}
}
function filterProjectStyles(){
  const query=($("assignmentSearch") as HTMLInputElement).value.trim().toLowerCase();let visible=0;
  const selectedOnly=($("selectedOnly") as HTMLInputElement)?.checked;
  const rows=Array.from(document.querySelectorAll<HTMLElement>('[data-assignment-row]'));
  for(const row of rows){
    const r=items.find(r=>r.id===row.dataset.assignmentRow)!;
    const selected=row.querySelector<HTMLInputElement>('input[name="assignment"]')!.checked;
    row.hidden=!!(selectedOnly&&!selected)||![r.title,r.summary,domainName(r.domain),...(r.tags||[])].join(' ').toLowerCase().includes(query);
    if(!row.hidden)visible++;
  }
  $("noAssignments").hidden=!selectedOnly||rows.some(row=>row.querySelector<HTMLInputElement>('input[name="assignment"]')!.checked);
  $("assignmentSearchResult").textContent=visible?`${visible} ${selectedOnly?'selected ':''}styles shown`:'No matching styles. Clear the search or turn off Selected only.';
}
function aiDiscoverySection(){return `<section><h2 tabindex="-1" class="wizard-heading">Discover &amp; personalize with AI</h2><p>Codex or Claude recommends styles and drafts project-specific guidelines using repository evidence. Review each suggestion before saving; global styles stay unchanged.</p><p class="hint">Selected source text and style guidelines are sent to your chosen CLI provider. Requires an installed, signed-in CLI. Source may contain sensitive information; review the folder before starting.</p><div class="wizard-ai-actions"><label class="inline-field">Agent<select id="onboardingAgent"><option value="codex">Codex</option><option value="claude">Claude</option></select></label><button type="button" class="button ghost" id="onboardingAnalyze">Discover &amp; personalize</button><button type="button" class="button ghost" id="onboardingStop" hidden>Cancel analysis</button></div><div id="onboardingFindings" role="status" aria-live="polite"><p>Analysis is optional. Continue to select styles manually.</p></div></section>`;}
function bindAiDiscovery(){
  $("onboardingAnalyze").addEventListener('click',()=>void analyzeOnboarding());
  $("onboardingStop").addEventListener('click',()=>onboardingAbort?.abort());
}
function setupProjectWizard(){
  const form=$("projectForm") as HTMLFormElement;form.noValidate=true;form.classList.add('project-wizard');
  const steps=['Project & folder','Discover & personalize','Select styles','Review'];
  form.insertAdjacentHTML('afterbegin',`<ol class="wizard-steps" aria-label="Project setup progress">${steps.map((s,i)=>`<li data-wizard-label="${i}"><span>${i+1}</span>${s}</li>`).join('')}</ol>`);
  const meta=form.querySelector<HTMLElement>('.project-meta')!;meta.dataset.wizardStep='0';
  meta.insertAdjacentHTML('beforeend','<div class="field wizard-folder"><label for="onboardingFolder">Repository folder</label><div class="folder-input"><input id="onboardingFolder" required placeholder="Absolute path on the computer running Personal Brain" aria-describedby="folderHint" /><button type="button" class="button ghost" id="browseOnboardingFolder">Browse folders</button></div><p id="folderHint" class="hint">Choose an existing folder. Finishing setup writes .personal-brain.json here so agents can detect this project.</p></div>');
  const selections=form.querySelector<HTMLElement>('.style-selector')!;
  const select=document.createElement('section');select.dataset.wizardStep='2';meta.after(select);select.append(selections);
  select.insertAdjacentHTML('afterbegin','<h2 tabindex="-1" class="wizard-heading">Choose your starting styles</h2><p>Review AI suggestions or choose styles yourself.</p>');
  meta.insertAdjacentHTML('afterend',aiDiscoverySection().replace('<section>','<section data-wizard-step="1">'));
  select.insertAdjacentHTML('afterend','<section data-wizard-step="3"><h2 tabindex="-1" class="wizard-heading">Review your project</h2><div id="onboardingReview"></div><p class="hint">Only selected styles and required dependencies apply. Shared styles remain unchanged. Accepted AI drafts are saved as project-only overrides.</p></section>');
  form.querySelector('.project-save-bar .page-actions')!.insertAdjacentHTML('afterbegin','<button type="button" class="button ghost" id="onboardingBack">Back</button>');
  $("browseOnboardingFolder").addEventListener("click",()=>openFolderBrowser("onboardingFolder"));
  $("onboardingBack").addEventListener('click',()=>showOnboardingStep(onboardingStep-1));
  bindAiDiscovery();
  $("onboardingFolder").addEventListener('input',()=>{$("onboardingFindings").textContent='Folder changed. Run analysis again for current recommendations.';document.querySelectorAll('.wizard-recommendation').forEach(el=>el.remove());});
  showOnboardingStep(0,false);
}
function showOnboardingStep(step:number,focus=true){
  onboardingStep=step;
  document.querySelectorAll<HTMLElement>('[data-wizard-step]').forEach(el=>el.hidden=Number(el.dataset.wizardStep)!==step);
  document.querySelectorAll<HTMLElement>('[data-wizard-label]').forEach(el=>{if(Number(el.dataset.wizardLabel)===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  $("onboardingBack").hidden=step===0;
  $("projectForm").querySelector('button[type="submit"]')!.textContent=step===3?'Create project':step===1?'Continue to styles':'Continue';
  $("projectForm").querySelector('button[type="submit"]')!.className=step===1?'button ghost':'button primary';
  $("projectError").textContent='';
  $("projectSelectionSummary").hidden=step!==2;
  if(step===3){
    const chosen=Array.from(document.querySelectorAll<HTMLInputElement>('input[name="assignment"]:checked'));
    $("onboardingReview").innerHTML=`<dl class="wizard-review"><dt>Project</dt><dd>${esc(($("projectName") as HTMLInputElement).value)}</dd><dt>Repository</dt><dd>${esc(($("onboardingFolder") as HTMLInputElement).value)}</dd><dt>Selected styles (${chosen.length})</dt><dd>${chosen.length?`<ul>${chosen.map(input=>`<li>${esc(items.find(r=>r.id===input.value)!.title)}</li>`).join('')}</ul>`:'No styles selected. Agents will receive no project styles.'}</dd></dl>`;
  }
  if(focus)(document.querySelector<HTMLElement>(`[data-wizard-step="${step}"] .wizard-heading, [data-wizard-step="${step}"] input`))?.focus();
}
async function advanceOnboarding(){
  const form=$("projectForm"),button=form.querySelector<HTMLButtonElement>('button[type="submit"]')!;button.disabled=true;
  try{
    if(onboardingStep===0){
      for(const id of ['projectName','projectDescription','onboardingFolder'])if(!($(id) as HTMLInputElement).reportValidity())return;
      if(!($("projectName") as HTMLInputElement).value.trim())throw new Error('Enter a project name.');
      const result=await api<{folder:string}>('/api/onboarding/folder',{method:'POST',body:JSON.stringify({folder:($("onboardingFolder") as HTMLInputElement).value})});
      if($("projectForm")!==form)return;
      ($("onboardingFolder") as HTMLInputElement).value=result.folder;
    }
    showOnboardingStep(onboardingStep+1);
  }catch(error){if($("projectForm")===form)$("projectError").textContent=error instanceof Error?error.message:String(error);}
  finally{button.disabled=false;}
}
async function analyzeOnboarding(){
  const form=$("projectForm"),controller=new AbortController();onboardingAbort=controller;
  const buttons=Array.from(form.querySelectorAll<HTMLButtonElement>('.project-save-bar button, #onboardingAnalyze'));
  buttons.forEach(b=>b.disabled=true);$("onboardingStop").hidden=false;
  $("onboardingFindings").textContent='Analyzing repository… This may take up to five minutes.';
  try{
    const result=await api<{recommendations:Array<{id:string;reason:string;customizationNote?:string;projectGuidelines?:string}>;files:string[];issues:Array<{message:string}>;limited:boolean}>('/api/onboarding/analyze',{method:'POST',signal:controller.signal,body:JSON.stringify({projectId:selectedProject?.id,folder:($("onboardingFolder") as HTMLInputElement)?.value,agent:($("onboardingAgent") as HTMLSelectElement).value})});
    if($("projectForm")!==form)return;
    document.querySelectorAll('.wizard-recommendation').forEach(el=>el.remove());
    for(const recommendation of result.recommendations){
      const row=Array.from(form.querySelectorAll<HTMLElement>('[data-assignment-row]')).find(r=>r.dataset.assignmentRow===recommendation.id);
      if(!row)continue;
      const proposal=document.createElement('details');proposal.className='wizard-recommendation';
      proposal.innerHTML=`<summary>AI suggestion &amp; project draft</summary><p>${esc(recommendation.reason)}</p><p>${esc(recommendation.customizationNote||'')}</p>${recommendation.projectGuidelines?`<pre>${esc(recommendation.projectGuidelines)}</pre>`:'<p>No repository-specific adaptation is justified. Use the existing style.</p>'}<button type="button" class="button ghost small">Use suggestion</button>`;
      row.querySelector('.assignment-choice')!.after(proposal);
      proposal.querySelector('button')!.addEventListener('click',()=>{
        const checkbox=row.querySelector<HTMLInputElement>('input[name="assignment"]')!;
        if(checkbox.disabled){$("projectError").textContent='Remove the other selected style in this capability before using this suggestion.';return;}
        const field=row.querySelector<HTMLTextAreaElement>('textarea')!;
        if(recommendation.projectGuidelines){
          if(field.value.trim()&&!confirm('Replace this project customization with the AI draft?'))return;
          field.value=items.find(r=>r.id===recommendation.id)!.content+'\n\nProject-specific guidelines\n'+recommendation.projectGuidelines;
        }
        checkbox.checked=true;projectFormDirty=true;syncProjectSelection();
        proposal.querySelector('button')!.textContent='Suggestion applied to draft';
      });
    }
    $("onboardingFindings").innerHTML=`<p><strong>${result.recommendations.length} styles suggested.</strong> Review each AI suggestion on its style card and choose Use suggestion to add it to your project draft. Nothing is saved yet.</p><ul>${result.recommendations.map(r=>`<li><strong>${esc(items.find(i=>i.id===r.id)?.title||r.id)}</strong> — ${esc(r.reason)}</li>`).join('')}</ul><details><summary>Evidence and limitations</summary><p>Read: ${result.files.map(esc).join(', ')}. This is a bounded scan, not a complete code review.</p>${result.limited?'<p>The file index was truncated.</p>':''}${result.issues.map(i=>`<p>${esc(i.message)}</p>`).join('')}</details>`;
  }catch(error){if($("projectForm")===form)$("onboardingFindings").textContent=controller.signal.aborted?'Analysis cancelled. Retry or continue to select styles manually.':(error instanceof Error?error.message:String(error))+' You can retry or continue manually.';}
  finally{if($("projectForm")===form){buttons.forEach(b=>b.disabled=false);$("onboardingStop").hidden=true;}if(onboardingAbort===controller)onboardingAbort=null;}
}
let projectFormDirty=false;
function confirmLeaveProject(){if(!projectFormDirty||!document.getElementById("projectForm"))return true;if(!confirm("Discard unsaved project changes?"))return false;onboardingAbort?.abort();projectFormDirty=false;return true;}
function syncProjectSelection(){
  const rows=Array.from(document.querySelectorAll<HTMLElement>("[data-assignment-row]"));
  const selectedSlots=new Set(rows.filter(row=>row.querySelector<HTMLInputElement>('input[name="assignment"]')!.checked).map(row=>row.dataset.slot));
  const required=new Set<string>();
  const collectRequired=(id:string)=>{for(const child of items.find(r=>r.id===id)?.requiredIds||[]){if(required.has(child))continue;required.add(child);collectRequired(child);}};
  rows.filter(row=>row.querySelector<HTMLInputElement>('input[name="assignment"]')!.checked).forEach(row=>collectRequired(row.dataset.assignmentRow!));
  let selected=0,overrides=0;
  for(const row of rows){
    const input=row.querySelector<HTMLInputElement>('input[name="assignment"]')!;
    const chosen=input.checked;const field=row.querySelector<HTMLTextAreaElement>("textarea")!;
    const custom=chosen&&!!field.value.trim();
    if(chosen)selected++;if(custom)overrides++;
    input.disabled=!chosen&&selectedSlots.has(row.dataset.slot);
    field.disabled=!chosen;
    row.querySelector<HTMLElement>(".project-override")!.hidden=!chosen;
    row.querySelector<HTMLElement>(".assignment-state")!.textContent=chosen?(custom?"Project override":items.find(r=>r.id===row.dataset.assignmentRow)?.projectId?"Selected · project-private":"Selected · shared"):(required.has(input.value)?"Required dependency":input.disabled?"Another record selected":"Not selected");
    row.classList.toggle("is-selected",chosen);
  }
  $("selectedCount").textContent=String(selected)+" selected";
  $("availableCount").textContent=String(rows.length-selected)+" available";
  $("noAssignments").hidden=selected>0;
  $("projectSelectionSummary").textContent=`${selected} selected · ${overrides} overrides · Changes apply after saving`;
  if($("assignmentSearch"))filterProjectStyles();
}
async function saveProject(ev:Event){
  ev.preventDefault();
  if(!selectedProject&&onboardingStep<3){await advanceOnboarding();return;}
  const assignments=Array.from(document.querySelectorAll<HTMLInputElement>('input[name="assignment"]:checked')).map(input=>({recordId:input.value,override:($( "override-"+input.value) as HTMLTextAreaElement).value.trim()||null}));
  const project={name:($("projectName") as HTMLInputElement).value,description:($("projectDescription") as HTMLInputElement).value,assignments};
  try{
    const submit=$("projectForm").querySelector<HTMLButtonElement>('button[type="submit"]')!;submit.disabled=true;
    try{selectedProject=await api<ProjectConfig>(selectedProject?`/api/projects/${selectedProject.id}`:"/api/onboarding/create",{method:selectedProject?"PUT":"POST",body:JSON.stringify(selectedProject?{project,expectedVersion:selectedProject.version}:{project,folder:($("onboardingFolder") as HTMLInputElement).value})});}
    finally{submit.disabled=false;}
    projectFormDirty=false;
    projectEditing=false;page=1;await projectScreen();
  }catch(e){$("projectError").textContent=e instanceof Error?e.message:String(e);}
}
async function activation(){
  type AgentStatus={agent:string;file:string;installed:boolean;changed:boolean};
  const statuses=await api<{claude:AgentStatus;codex:AgentStatus;opencode:AgentStatus}>("/api/activation");
  const info=await aboutReady;const cli="personal-brain";
  const copyLine=(command:string,label:string)=>`<div class="copy-command"><pre class="setup-command">${esc(command)}</pre><button type="button" class="button ghost small" data-copy-command="${esc(command)}" aria-label="Copy ${esc(label)}">Copy</button></div>`;
  // The command is always personal-brain; these are the fallbacks when it is not installed or not on PATH.
  const otherWays=(sub:string)=>info?`<details><summary>Other ways to run it</summary><ul class="plain-list run-options"><li><b>Without installing</b>, through npx${copyLine(info.npx+" "+sub,"npx command")}</li>${info.mode==="source"?`<li><b>From this source checkout</b>${copyLine(info.raw+" "+sub,"full command")}</li>`:""}</ul></details>`:"";
  const chatProjects=await api<ProjectConfig[]>("/api/projects");
  const okIcon='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  const warnIcon='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 7v6 M12 17h.01"/></svg>';
  const agents=[
    {key:"claude",name:"Claude Code",status:statuses.claude,does:"Startup and prompt hooks add your style index to each session.",command:cli+" connect claude",sub:"connect claude",after:`Installs the hooks and registers the MCP server with the claude CLI. Then restart Claude Code.`},
    {key:"codex",name:"Codex CLI",status:statuses.codex,does:"Startup and prompt hooks add your style index to each session.",command:cli+" connect codex",sub:"connect codex",after:`Installs the hooks and registers the MCP server with the codex CLI. Then restart Codex, open <code>/hooks</code> and trust the Personal Brain hooks.`},
    {key:"opencode",name:"OpenCode",status:statuses.opencode,does:"One plugin registers the MCP server and adds your style index to each session. Your <code>opencode.json</code> is not edited.",command:cli+" connect opencode",sub:"connect opencode",after:`Installs the plugin. Then restart OpenCode.`}
  ];
  layout("Agent setup","Connect your coding agents and ChatGPT to your styles.","",
    `${info&&!info.onPath?`<div class="notice" role="note"><p><strong>The <code>personal-brain</code> command is not installed on this computer.</strong> Install it once, then the commands below work as shown. To run without installing, open <b>Other ways to run it</b> on a card.</p>${copyLine("npm install -g personal-brain-style@beta","install command")}</div>`:""}<section class="agent-grid">${agents.map(a=>`<article class="card panel agent-card" data-agent="${a.key}"><div class="spread-row"><h2>${esc(a.name)}</h2><span class="chip ${a.status.installed?"ok":"bad"}">${a.status.installed?okIcon+" Connected":warnIcon+" Not connected"}</span></div><p>${a.does}</p><div class="copy-command"><pre class="setup-command">${esc(a.command)}</pre><button type="button" class="button ghost small" data-copy-command="${esc(a.command)}" aria-label="Copy ${esc(a.name)} install command">Copy</button></div><p class="hint">${a.after} To undo, run <code>${esc(a.command.replace(" connect "," disconnect "))}</code>.</p>${otherWays(a.sub)}<p class="hint">Installed file: <code>${esc(a.status.file)}</code></p></article>`).join("")}</section>
    <p class="hint space-top-12">Connected means the Personal Brain hook or plugin file is installed. It does not prove the agent has loaded or trusted it; Trace Explorer shows real activity. Connect every agent at once with <code>${esc(cli)} connect all</code>.</p>${info?.mode==="npx"?`<div class="notice" role="note"><strong>You are running Personal Brain through npx.</strong> Hooks and plugins point to the npx cache, which npm can clear. For connections that keep working, install it once with <code>npm install -g personal-brain-style</code>, then use <code>personal-brain</code> in place of <code>npx --yes personal-brain-style</code> and reinstall the hooks.</div>`:""}
    <section class="card panel chat-setup" aria-labelledby="chatTitle">
      <div class="spread-row"><h2 id="chatTitle">ChatGPT</h2><span id="chatStatus" class="chip bad">Not connected</span></div>
      <p>Let ChatGPT look up one project's styles while you chat. It can read styles but cannot change them or run local skills.</p>
      <label class="inline-field">Project<select id="chatProject"><option value="">Choose a project</option>${chatProjects.map(p=>`<option value="${esc(p.id)}" ${chatProjects.length===1?"selected":""}>${esc(p.name)}</option>`).join("")}</select></label>
      <div id="chatSetup" class="space-top-12"><p class="hint">Choose a project to see the setup steps.</p></div>
    </section>
`);
  main.querySelectorAll<HTMLButtonElement>("[data-copy-command]").forEach(b=>b.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(b.dataset.copyCommand!);toast("Command copied");}catch{toast("Select the command text to copy it.");}}));
  let chatPoll:ReturnType<typeof setTimeout>|undefined;
  // Ticks are a per-viewer convenience; storage may be unavailable, so every read and write is guarded.
  const ticked=(project:string)=>{try{return new Set<string>(JSON.parse(localStorage.getItem("pb-chat-steps:"+project)||"[]"));}catch{return new Set<string>();}};
  const saveTicks=(project:string,set:Set<string>)=>{try{localStorage.setItem("pb-chat-steps:"+project,JSON.stringify([...set]));}catch{/* progress just isn't remembered */}};
  const showChat=async()=>{
    clearTimeout(chatPoll);
    const id=($("chatProject") as HTMLSelectElement).value;
    if(!id){$("chatSetup").innerHTML='<p class="hint">Choose a project to see the setup steps.</p>';return;}
    try{
      const [setup,seen]=await Promise.all([api<{connectCommand:string;connectRaw:string;connectNpx:string;commandOnPath:boolean;tunnelClient:boolean}>("/api/chatgpt/setup?projectId="+encodeURIComponent(id)),api<TraceEntry[]>(`/api/trace?limit=50&agent=chatgpt&channel=mcp&projectId=${encodeURIComponent(id)}`)]);
      if(active!=="activation"||($("chatProject") as HTMLSelectElement).value!==id)return;
      // Handshakes also come from tunnel-client doctor; only a real tool call proves ChatGPT is using it.
      const ticks=ticked(id),last=seen.find(e=>e.eventType!=="mcp.initialize"&&e.eventType!=="mcp.tools.list");
      const done=(n:string)=>n==="1"?setup.tunnelClient&&ticks.has("1"):n==="2"?ticks.has("2"):n==="3"?ticks.has("3")||!!last:!!last;
      const status=$("chatStatus");status.className="chip "+(last?"ok":"bad");status.textContent=last?"Connected · last request "+formatTime(last.occurredAt):"Not connected";
      const check=(n:string,label:string)=>`<label class="check-inline"><input type="checkbox" data-chat-step="${n}" ${ticks.has(n)?"checked":""} /> ${label}</label>`;
      const step=(n:string,title:string,body:string)=>`<li class="${done(n)?"done":""}"><span class="step-mark" aria-hidden="true">${done(n)?'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>':n}</span><div><h3>${title}${done(n)?' <span class="sr-only">(done)</span>':""}</h3>${body}</div></li>`;
      $("chatSetup").innerHTML=`<ol class="setup-steps">
        ${step("1","Check you have what you need",`<ul class="plain-list"><li>${setup.tunnelClient?'<span class="tag ok">Found</span> tunnel-client is installed on this computer.':'<span class="tag bad">Missing</span> Install tunnel-client from <a href="https://platform.openai.com/settings/organization/tunnels" target="_blank" rel="noreferrer">OpenAI Platform → Tunnels ↗</a>, then reopen this page.'}</li><li>A ChatGPT workspace where an admin allows custom MCP servers.</li><li>OpenAI Platform roles: Tunnels <b>Read + Manage</b> to create a tunnel, Tunnels <b>Read + Use</b> to run it. New roles can take up to 30 minutes.</li></ul>${check("1","My workspace and roles are ready")}`)}
        ${step("2","Create a tunnel and a key on OpenAI Platform",`<ol><li>Open <a href="https://platform.openai.com/settings/organization/tunnels" target="_blank" rel="noreferrer">Tunnels ↗</a>, create a tunnel, link it to your ChatGPT workspace, and copy its ID (starts with <code>tunnel_</code>).</li><li>Open <a href="https://platform.openai.com/settings/organization/api-keys" target="_blank" rel="noreferrer">API keys ↗</a> and create a key with Tunnels Read + Use. Keep it for the next step; Personal Brain never stores it.</li></ol>${check("2","I have the tunnel ID and the key")}`)}
        ${step("3","Start the tunnel on this computer",`<p>Copy this command and paste it into Terminal. It asks for the tunnel ID and the key (typed hidden), checks the setup, then starts the tunnel. Keep Terminal open while you use ChatGPT; Ctrl+C stops it.</p><div class="copy-command"><pre class="setup-command">${esc(setup.connectCommand)}</pre><button type="button" class="button primary small" id="copyChatConnect">Copy command</button></div><details${setup.commandOnPath?"":" open"}><summary>Other ways to run it</summary><ul class="plain-list run-options">${setup.commandOnPath?"":`<li><b>Install the command once</b> (recommended)<div class="copy-command"><pre class="setup-command">npm install -g personal-brain-style@beta</pre><button type="button" class="button ghost small" data-copy-command="npm install -g personal-brain-style@beta" aria-label="Copy install command">Copy</button></div></li>`}<li><b>Without installing</b>, through npx<div class="copy-command"><pre class="setup-command">${esc(setup.connectNpx)}</pre><button type="button" class="button ghost small" data-copy-command="${esc(setup.connectNpx)}" aria-label="Copy npx command">Copy</button></div></li>${info?.mode==="source"?`<li><b>From this source checkout</b><div class="copy-command"><pre class="setup-command">${esc(setup.connectRaw)}</pre><button type="button" class="button ghost small" data-copy-command="${esc(setup.connectRaw)}" aria-label="Copy full command">Copy</button></div></li>`:""}</ul></details>${check("3","Terminal says the tunnel is healthy")}`)}
        ${step("4","Add it in ChatGPT",`<ol><li>Open <a href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer">ChatGPT Plugins ↗</a>, select <b>+</b> → <b>Add custom MCP server</b>.</li><li>Under <b>Connection</b> choose <b>Tunnel</b>, pick your tunnel, then <b>I understand and want to continue</b> → <b>Create as a plugin</b>.</li><li>In a chat, turn the plugin on and ask: <i>“Use Personal Brain to find my styles for writing a BRD.”</i></li></ol><p class="hint" role="status">${last?`ChatGPT reached Personal Brain at ${esc(formatTime(last.occurredAt))}. You're set up.`:"Waiting for ChatGPT's first request… this updates by itself."}</p>`)}
      </ol>
      <details><summary>What ChatGPT can see</summary><p>Only this project's selected styles and the styles they require, including their text and examples. No repository files, local skills or edits. Each request appears in Trace Explorer under ChatGPT.</p></details>`;
      $("chatSetup").querySelectorAll<HTMLButtonElement>("[data-copy-command]").forEach(b=>b.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(b.dataset.copyCommand!);toast("Command copied");}catch{toast("Select the command text to copy it.");}}));
      $("copyChatConnect").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(setup.connectCommand);toast("Command copied — paste it into Terminal");}catch{toast("Select the command text to copy it.");}});
      $("chatSetup").querySelectorAll<HTMLInputElement>("[data-chat-step]").forEach(box=>box.addEventListener("change",()=>{const set=ticked(id);if(box.checked)set.add(box.dataset.chatStep!);else set.delete(box.dataset.chatStep!);saveTicks(id,set);void showChat().then(()=>($("chatSetup").querySelector(`[data-chat-step="${box.dataset.chatStep}"]`) as HTMLInputElement|null)?.focus());}));
      if(!last)chatPoll=setTimeout(()=>{if(active==="activation"&&!document.hidden)void showChat();else if(active==="activation")chatPoll=setTimeout(showChat,5000);},5000);
    }catch(e){$("chatSetup").textContent=e instanceof Error?e.message:String(e);}
  };
  $("chatProject").addEventListener("change",showChat);
  if(($("chatProject") as HTMLSelectElement).value)void showChat();
}
let diagnosticProject="",diagnosticProjects:ProjectConfig[]=[];
function diagnosticScope(){return `<div class="toolbar"><label class="inline-field">Project scope<select id="diagnosticProject"><option value="">Global defaults (no project)</option>${diagnosticProjects.map(p=>`<option value="${esc(p.id)}" ${diagnosticProject===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></label><p class="hint">Diagnostics simulate retrieval and checks; they do not contact an agent.</p></div>`;}
function discover(){
  if(active==="baseline"){layout("Startup index","Preview the compact index for the selected scope.","",`${diagnosticScope()}<div class="card panel space-top-18"><h2>Baseline context ${infoButton("baseline")}</h2><p>Record titles, IDs and versions only. Full instructions load through brain_get when needed.</p><button data-action="bootstrap" class="button soft baseline-action">Show startup index</button><div class="code-output" id="bootstrapResults">Choose Show startup index to preview.</div></div>`);return;}
  if(active==="review_simulator"){layout("Text validation","Run deterministic text checks; manual review criteria remain pending.","",`${diagnosticScope()}<div class="card panel space-top-18"><h2>Text review simulator ${infoButton("review_simulator")}</h2><div class="field"><label for="reviewDomain">Capability type</label><select id="reviewDomain" class="select">${domainOptions("writing")}</select></div><div class="field"><label for="reviewText">Artifact text</label><textarea id="reviewText" rows="4" placeholder="Paste document text here"></textarea></div><button class="button primary small" data-action="review">Run checks</button><div id="reviewResults" class="code-output review-output">Waiting for input.</div></div>`);return;}
  layout("Style discovery","Find styles, skills and tools for one task.","",`${diagnosticScope()}<div class="split-box discovery-grid"><section class="card panel"><h2>Find the right skill ${infoButton("discover")}</h2><p>Describe the task in natural language.</p><div class="field space-top-20"><label for="discoveryTask">Task</label><textarea id="discoveryTask" rows="4">Draw an editable IoT platform architecture diagram with clear service boundaries</textarea></div><button class="button primary" data-action="discover">Discover capabilities</button></section><section class="card panel"><h2>Discovery results</h2><div class="code-output" id="discoveryResults">Run a discovery search to inspect matching skills, styles, and tools.</div></section></div>`);
}

async function feedback(){
  const records=await api<Array<{id:string,recordId:string|null,rating:string,note:string,createdAt:string}>>("/api/feedback");
  layout("Feedback Inbox","Record feedback to guide future style updates.","",`<div class="columns"><div class="card panel"><h2>Feedback history ${infoButton("feedback")}</h2><div class="feedback-list space-top-18">${pageItems(records).map(r=>`<div class="feedback-item"><div class="spread-row">${ch(r.rating)}<span class="hint">${esc(formatTime(r.createdAt))}</span></div><p>${esc(r.note)}</p></div>`).join("")||empty("No feedback","Corrections will appear here")}</div>${pagination(records.length)}</div><div class="card panel"><h2>Capture a correction</h2><p>Feedback does not rewrite your global style automatically.</p><div class="field space-top-20"><label>Feedback type</label><select id="fbRating"><option value="correction">Correction</option><option value="accepted">Accepted outcome</option><option value="rejected">Rejected outcome</option></select></div><div class="field"><label>Feedback</label><textarea id="fbNote" rows="6" placeholder="Explain your preference or correction"></textarea></div><button class="button primary" data-action="feedback">Record feedback</button></div></div>`);
}
async function activity(){
  const records=await api<Array<{action:string,target:string,detail:string,createdAt:string}>>("/api/audit");
  layout("Activity & Versioning","Every edit creates a new revision. Review activity and restore past versions from the library.","",`<div class="card panel"><h2>Recent activity ${infoButton("history")}</h2>${pageItems(records).map(r=>`<div class="activity-line"><span class="activity-icon">↺</span><div class="activity-text"><b>${esc(r.action)} · ${esc(r.detail)}</b><p>${esc(r.target)}</p></div><span class="activity-time">${esc(formatTime(r.createdAt))}</span></div>`).join("")||empty("No activity","Create a record to start your revision history")}${pagination(records.length)}</div>`);
}

type TraceEntry={id:string;occurredAt:string;runId:string;agent:string;channel:string;eventType:string;outcome:string;recordIds:string[];recordVersions:Record<string,number>;metadata:Record<string,unknown>;demo:boolean};
type TraceStats={estimatedContextTokens?:number;tokenUsageNote?:string;events:number;startup:number;promptMatches:number;discovery:number;retrieval:number;reviews:number;feedback:number;note:string};
let fusionCurrent="",fusionSelected="",fusionStarting=false;
let fusionProjects:string[]|null=null,fusionAgent="codex",fusionPoll:ReturnType<typeof setTimeout>|undefined;
type FusionRun={id:string;agent:string;status:string;createdAt:string;projectIds?:string[];proposals?:number;decided?:number};
const fusionAgentName=(a:string)=>a==="claude"?"Claude":"Codex";
const fusionStatus:Record<string,string>={running:"Analyzing",ready:"Ready to review",failed:"Failed",cancelled:"Cancelled"};
function elapsed(from:string){const s=Math.max(0,Math.round((Date.now()-new Date(from).getTime())/1000));return s<60?`${s}s`:`${Math.floor(s/60)}m ${s%60}s`;}
async function fusionScreen(){
 clearTimeout(fusionPoll);
 const [projects,runs]=await Promise.all([api<ProjectConfig[]>("/api/projects"),api<FusionRun[]>("/api/fusion")]);
 if(fusionCurrent&&!runs.some(r=>r.id===fusionCurrent))fusionCurrent="";
 const job=fusionCurrent?await api<any>("/api/fusion/"+encodeURIComponent(fusionCurrent)):null;
 if(active!=="fusion")return;
 const decision=(id:string)=>(job.applied||[]).includes(id)?"published":(job.rejected||[]).includes(id)?"rejected":"open";
 if(job?.proposals.length&&!job.proposals.some((p:any)=>p.targetId===fusionSelected))fusionSelected=job.proposals.find((p:any)=>decision(p.targetId)==="open")?.targetId||job.proposals[0].targetId;
 const chosen=fusionProjects??projects.map(p=>p.id);
 const chosenStyles=projects.filter(p=>chosen.includes(p.id)).reduce((n,p)=>n+(p.assignments||[]).length,0);
 const step=!job||fusionStarting?1:job.status==="running"?2:3;
 const steps=["Choose projects","Agent compares styles","Review and publish"].map((label,i)=>`<li class="${i+1<step?"done":i+1===step?"current":""}" ${i+1===step?'aria-current="step"':""}><span>${i+1}</span>${label}</li>`).join("");
 const picker=`<form id="fusionForm" class="fusion-start">
  <div class="spread-row"><h2>Which projects should the agent learn from?</h2><div class="row-actions"><button type="button" class="link-btn" data-fusion-all="1">Select all</button><button type="button" class="link-btn" data-fusion-all="0">Clear</button></div></div>
  <fieldset class="fusion-project-grid"><legend class="sr-only">Projects</legend>${projects.map(p=>`<label class="fusion-project ${chosen.includes(p.id)?"is-chosen":""}"><input type="checkbox" name="fusionProject" value="${esc(p.id)}" ${chosen.includes(p.id)?"checked":""} /><span><strong>${esc(p.name)}</strong><small>${(p.assignments||[]).length} selected styles</small></span></label>`).join("")||'<p>No projects yet. Create a project first, then come back to compare its styles.</p>'}</fieldset>
  <div class="fusion-run-row">
   <fieldset class="seg"><legend class="sr-only">Agent</legend>${["codex","claude"].map(a=>`<label><input type="radio" name="fusionAgent" value="${a}" ${fusionAgent===a?"checked":""} /><span>${fusionAgentName(a)}</span></label>`).join("")}</fieldset>
   <button class="button primary" type="submit" ${chosen.length?"":"disabled"}>${chosen.length?`Analyze ${chosen.length} project${chosen.length===1?"":"s"}`:"Choose a project"}</button>
   <span class="hint">${chosen.length?`${chosenStyles} selected styles will be compared. Takes up to five minutes.`:"Choose at least one project to start."}</span>
  </div>
  <p id="fusionError" class="form-error" role="alert"></p>
  <details class="fusion-privacy"><summary>What is sent to the agent</summary><p>The selected projects' styles and their required styles are sent to your signed-in ${fusionAgentName(fusionAgent)} CLI. Repository files and traces are not sent. Nothing changes until you publish a proposal.</p></details>
 </form>`;
 let runPanel="";
 if(job&&!fusionStarting){
  const open=job.proposals.filter((p:any)=>decision(p.targetId)==="open").length;
  const head=`<div class="spread-row"><div><h2>${esc(fusionStatus[job.status]||job.status)}</h2><p class="hint">${esc(fusionAgentName(job.agent))} · ${esc(projects.filter(p=>(job.projectIds||[]).includes(p.id)).map(p=>p.name).join(", ")||"Projects removed")} · started ${esc(formatTime(job.createdAt))}</p></div><button type="button" class="button ghost" data-fusion-new>New analysis</button></div>`;
  if(job.status==="running")runPanel=`${head}<div class="fusion-progress" role="status"><span class="spinner" aria-hidden="true"></span><div><strong>Comparing styles…</strong><p class="hint">Running for <span id="fusionElapsed">${elapsed(job.createdAt)}</span>. You can leave this page; the run continues and appears in Recent analyses.</p></div><button class="button ghost" id="fusionCancel">Cancel analysis</button></div>`;
  else if(job.status!=="ready")runPanel=`${head}<div class="notice" role="alert"><strong>${job.status==="cancelled"?"The analysis was cancelled.":"The analysis did not finish."}</strong>${job.error?`<p>${esc(job.error)}</p>`:""}<p>Check that the ${esc(fusionAgentName(job.agent))} CLI is installed and signed in, then try again.</p><button type="button" class="button primary" data-fusion-retry>Try again</button></div>`;
  else if(!job.proposals.length)runPanel=`${head}${empty("No changes proposed","Your shared styles already cover what these projects do. Try again after projects add or personalize styles.")}`;
  else{
   const list=job.proposals.map((p:any)=>{const d=decision(p.targetId);const label=d==="published"?"Published":d==="rejected"?"Rejected":p.conflicts.length?"Has conflicts":"To review";return `<button type="button" data-fusion-proposal="${esc(p.targetId)}" aria-pressed="${p.targetId===fusionSelected}"><strong>${esc(p.title)}</strong><span class="tag ${d==="published"?"ok":d==="rejected"?"":p.conflicts.length?"bad":"warn"}">${label}</span></button>`;}).join("");
   const detail=job.proposals.filter((p:any)=>p.targetId===fusionSelected).map((p:any)=>{
    const old=job.targets.find((r:any)=>r.id===p.targetId);const d=decision(p.targetId);
    const supporting=["summary","useWhen","tags","principles","examples","externalSkills","reviewCriteria"].map(k=>`<h4>${esc(({summary:"Summary",useWhen:"Use when",tags:"Discovery keywords",principles:"Principles",examples:"Examples",externalSkills:"Required skills",reviewCriteria:"Review criteria"} as Record<string,string>)[k])}</h4><pre>${esc(typeof (p[k]??old?.[k])==="string"?(p[k]??old?.[k]):(p[k]??old?.[k]??[]).join("\n"))}</pre>`).join("");
    return `<article class="fusion-proposal"><p class="eyebrow">Updates ${esc(old?.title)} · v${esc(old?.version)} → v${Number(old?.version)+1}</p><h3>${esc(p.title)}</h3><p class="fusion-rationale">${esc(p.rationale)}</p>
     ${p.conflicts.length?`<div class="notice" role="alert"><strong>Resolve these conflicts in the source styles, then analyze again:</strong><ul>${p.conflicts.map((c:string)=>`<li>${esc(c)}</li>`).join("")}</ul></div>`:""}
     <div class="fusion-compare"><section><h4>Current guidelines</h4><pre>${esc(old?.content)}</pre></section><section><h4>Proposed guidelines</h4><pre>${esc(p.content)}</pre></section></div>
     <details><summary>Learned from ${p.sourceIds.length} source style${p.sourceIds.length===1?"":"s"}</summary><ul>${p.sourceIds.map((id:string)=>{const r=job.sources.find((r:any)=>r.id===id);return `<li>${esc(r?.title)} · v${esc(r?.version)} · ${esc(projects.find(x=>x.id===(r?.contextProjectId||r?.projectId))?.name||"Shared")}</li>`;}).join("")}</ul></details>
     <details><summary>Proposed summary, keywords, principles and criteria</summary>${supporting}<p class="hint">Mandatory requirements, automated checks, required links and skills stay as they are.</p></details>
     <footer class="fusion-decision"><p class="hint">Publishing creates a new version of the shared style for every project that uses it. Project-only copies are not changed.</p><div class="row-actions"><button class="button ghost" data-fusion-reject="${esc(p.targetId)}" ${d!=="open"?"disabled":""}>Reject</button><button class="button primary" data-fusion-apply="${esc(p.targetId)}" ${p.conflicts.length||d!=="open"?"disabled":""}>${d==="published"?"Published":d==="rejected"?"Rejected":"Publish update"}</button></div></footer></article>`;}).join("");
   runPanel=`${head}<p class="fusion-counts" role="status">${job.proposals.length} proposal${job.proposals.length===1?"":"s"} · ${open} to review · ${(job.applied||[]).length} published · ${(job.rejected||[]).length} rejected</p><div class="fusion-workbench"><nav class="fusion-proposal-list" aria-label="Proposals">${list}</nav><div class="fusion-detail">${detail}</div></div>`;
  }
 }
 const history=runs.length?`<div class="table-scroll"><table class="record-table"><thead><tr><th scope="col">Started</th><th scope="col">Projects</th><th scope="col">Agent</th><th scope="col">Result</th><th scope="col"><span class="sr-only">Open</span></th></tr></thead><tbody>${runs.map(r=>`<tr ${r.id===fusionCurrent?'class="is-selected"':''}><td>${esc(formatTime(r.createdAt))}</td><td>${esc((r.projectIds||[]).map(id=>projects.find(p=>p.id===id)?.name||"Removed project").join(", "))}</td><td>${esc(fusionAgentName(r.agent))}</td><td><span class="tag ${r.status==="ready"?"ok":r.status==="failed"?"bad":""}">${esc(fusionStatus[r.status]||r.status)}</span>${r.status==="ready"?` <small>${r.proposals??0} proposals · ${r.decided??0} decided</small>`:""}</td><td><button class="button ghost small" data-fusion-run="${esc(r.id)}" aria-pressed="${r.id===fusionCurrent}">${r.id===fusionCurrent?"Viewing":"Open"}</button></td></tr>`).join("")}</tbody></table></div>`:'<p class="hint">Your analyses will appear here.</p>';
 layout("Fusion","Turn what works in your projects into better shared styles. You review every proposal before anything changes.","",`
 <ol class="fusion-steps" aria-label="Fusion steps">${steps}</ol>
 <section class="card panel fusion-main">${job&&!fusionStarting?runPanel:picker}</section>
 <section class="fusion-history"><div class="section-heading"><h2>Recent analyses</h2><span class="hint">${runs.length} run${runs.length===1?"":"s"}</span></div>${history}</section>`);
 const form=document.getElementById("fusionForm") as HTMLFormElement|null;
 if(form){
  const sync=()=>{fusionProjects=Array.from(form.querySelectorAll<HTMLInputElement>('input[name="fusionProject"]:checked')).map(x=>x.value);fusionAgent=form.querySelector<HTMLInputElement>('input[name="fusionAgent"]:checked')?.value||"codex";};
  form.addEventListener("change",async ev=>{sync();const focus=(ev.target as HTMLInputElement).value;await fusionScreen();main.querySelector<HTMLInputElement>(`#fusionForm input[value="${CSS.escape(focus)}"]`)?.focus();});
  main.querySelectorAll<HTMLButtonElement>("[data-fusion-all]").forEach(b=>b.addEventListener("click",async()=>{fusionProjects=b.dataset.fusionAll==="1"?projects.map(p=>p.id):[];await fusionScreen();}));
  form.addEventListener("submit",async ev=>{ev.preventDefault();sync();const button=form.querySelector('button[type="submit"]') as HTMLButtonElement;button.disabled=true;button.textContent="Starting…";
   try{const r=await api<{id:string}>("/api/fusion",{method:"POST",body:JSON.stringify({agent:fusionAgent,projectIds:fusionProjects??projects.map(p=>p.id)})});fusionCurrent=r.id;fusionStarting=false;await fusionScreen();}
   catch(e){$("fusionError").textContent=e instanceof Error?e.message:String(e);button.disabled=false;button.textContent="Try again";}});
 }
 main.querySelectorAll<HTMLButtonElement>("[data-fusion-new]").forEach(b=>b.addEventListener("click",async()=>{fusionStarting=true;await fusionScreen();}));
 main.querySelectorAll<HTMLButtonElement>("[data-fusion-retry]").forEach(b=>b.addEventListener("click",async()=>{fusionProjects=job.projectIds||null;fusionAgent=job.agent||"codex";fusionStarting=true;await fusionScreen();}));
 if(job?.status==="running"&&!fusionStarting){
  const id=fusionCurrent;
  const poll=async()=>{if(active!=="fusion"||fusionCurrent!==id||fusionStarting)return;try{const current=await api<any>("/api/fusion/"+encodeURIComponent(id));if(active!=="fusion"||fusionCurrent!==id)return;if(current.status==="running"){const t=document.getElementById("fusionElapsed");if(t)t.textContent=elapsed(current.createdAt);fusionPoll=setTimeout(poll,2500);}else await fusionScreen();}catch(e){toast(String(e));}};
  fusionPoll=setTimeout(poll,2500);
 }
 main.querySelectorAll<HTMLButtonElement>('[data-fusion-proposal]').forEach(b=>b.addEventListener("click",async()=>{fusionSelected=b.dataset.fusionProposal!;await fusionScreen();main.querySelector<HTMLButtonElement>(`[data-fusion-proposal="${CSS.escape(fusionSelected)}"]`)?.focus();}));
 const next=()=>{fusionSelected=job.proposals.find((p:any)=>p.targetId!==fusionSelected&&decision(p.targetId)==="open")?.targetId||fusionSelected;};
 main.querySelectorAll<HTMLButtonElement>('[data-fusion-reject]').forEach(b=>b.addEventListener("click",async()=>{b.disabled=true;try{await api('/api/fusion/'+fusionCurrent+'/reject',{method:'POST',body:JSON.stringify({targetId:b.dataset.fusionReject})});next();toast("Proposal rejected");await fusionScreen();}catch(e){toast(e instanceof Error?e.message:String(e));b.disabled=false;}}));
 main.querySelectorAll<HTMLButtonElement>('[data-fusion-apply]').forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Publish this proposal? Projects using the shared style get the new version. Project-only copies are not changed."))return;b.disabled=true;try{await api('/api/fusion/'+fusionCurrent+'/apply',{method:'POST',body:JSON.stringify({targetId:b.dataset.fusionApply})});next();toast("Shared style updated");await fusionScreen();}catch(e){toast(e instanceof Error?e.message:String(e));b.disabled=false;}}));
 $("fusionCancel")?.addEventListener("click",async()=>{try{await api("/api/fusion/"+fusionCurrent+"/cancel",{method:"POST",body:"{}"});await fusionScreen();}catch(e){toast(String(e));}});
 main.querySelectorAll<HTMLButtonElement>('[data-fusion-run]').forEach(b=>b.addEventListener("click",async()=>{fusionCurrent=b.dataset.fusionRun!;fusionStarting=false;await fusionScreen();}));
}

let traceProject="all",traceAgent="all",traceChannel="all",traceRecord="all",traceRun="",traceDemo=false;
function traceQuery(){const query=new URLSearchParams({limit:"300",projectId:traceProject,agent:traceAgent,channel:traceChannel});if(traceRun)query.set("runId",traceRun);if(traceRecord!=="all")query.set("recordId",traceRecord);if(traceDemo)query.set("demo","1");return query.toString();}
let traceTimer:ReturnType<typeof setTimeout>|undefined,traceLive=true;
async function traceExplorer(){
  clearTimeout(traceTimer);
  const [stats,events,projects]=await Promise.all([api<TraceStats>(`/api/trace/stats?projectId=${encodeURIComponent(traceProject)}`),api<TraceEntry[]>(`/api/trace?${traceQuery()}`),api<ProjectConfig[]>("/api/projects")]);
  const traceItems=traceProject!=="all"&&traceProject!=="unscoped"?await api<RecordItem[]>(`/api/projects/${encodeURIComponent(traceProject)}/resolved`):items;
  const recordOptions=[...traceItems].sort((a,b)=>a.title.localeCompare(b.title)).map(r=>`<option value="${esc(r.id)}" ${traceRecord===r.id?"selected":""}>${esc(r.title)} — ${esc(r.kind)}</option>`).join("");
  const kpi=[
    [stats.startup,"Startup injections","trace_startup","How often a session startup hook emitted baseline context"],
    [stats.promptMatches,"Task matches","trace_prompt","How often a task hook emitted relevant instructions"],
    [stats.estimatedContextTokens??0,"Estimated context tokens","trace_tokens","All recorded hooks · characters ÷ 4, not AI usage or billing"],
    [stats.discovery,"Discovery calls","trace_discovery","MCP search calls made by connected agents"],
    [stats.retrieval,"Instruction loads","trace_loads","Full record retrieval calls through the MCP"],
    [stats.reviews,"Review calls","trace_reviews","Submitted artifact text validations through the MCP"]
  ];
  const reverse = traceRecord!=="all"?traceItems.find(r=>r.id===traceRecord):null;
  const rows=pageItems(events).map(e=>{
    const refs=e.recordIds.slice(0,12).map(id=>{const item=traceItems.find(x=>x.id===id);return `<span class="trace-ref" title="Version at time of call">${esc(item?.title||id.slice(0,8))} <small>v${esc(e.recordVersions?.[id]||"?")}</small></span>`;}).join("");
    const meta=Object.entries({...e.metadata,...(typeof e.metadata?.contextChars==="number"?{estimatedContextTokens:Math.ceil(e.metadata.contextChars/4)}:{})}).filter(([k])=>k!=="complianceReport").map(([k,v])=>`<span><b>${esc(k)}</b> ${esc(v)}</span>`).join("");
    return `<article class="trace-event ${e.demo?"trace-demo":""}">
      <div class="trace-rail"><span class="trace-dot ${esc(e.channel)}${/error|fail|denied|reject/i.test(e.outcome)?" bad":""}"></span></div>
      <div class="trace-body">
        <div class="trace-heading"><div><span class="chip ${esc(e.channel)}">${esc(e.channel)}</span><b>${esc(e.eventType)}</b>${e.demo?'<span class="trace-tag">DEMO ONLY</span>':""}</div><time>${esc(formatTime(e.occurredAt))}</time></div>
        <div class="trace-sub"><span class="tag">${esc(projects.find(p=>p.id===e.metadata?.projectId)?.name||"No project")}</span><span class="agent-label">${esc(e.agent)}</span><span class="trace-outcome ${/error|fail|denied|reject/i.test(e.outcome)?"bad":"ok"}">${esc(e.outcome)}</span><code>${esc(e.runId)}</code></div>
        ${refs?`<div class="trace-refs">${refs}</div>`:""}
        <details><summary>Request / response audit</summary><h4>Request metadata</h4><pre>${esc(JSON.stringify({event:e.eventType,sessionId:e.runId,tool:e.metadata.tool,domain:e.metadata.domain,taskCharacters:e.metadata.promptChars},null,2))}</pre><h4>Response metadata</h4><pre>${esc(JSON.stringify({outcome:e.outcome,recordIds:e.recordIds,recordVersions:e.recordVersions,resultCount:e.metadata.resultCount,checkCount:e.metadata.checkCount,passed:e.metadata.passed},null,2))}</pre><p class="hint">Metadata only; request and response bodies were not recorded.</p></details><details><summary>Inspect recorded evidence</summary><div class="trace-metadata">${meta||"No metadata was captured"}</div></details>
      </div>
    </article>`;
  }).join("");
  layout("Trace Explorer","Inspect observed style retrieval and review activity by project.","",
    `<section class="trace-metrics">${kpi.map(([value,title,key,description])=>`<div class="card trace-metric"><div class="trace-metric-top"><span>${esc(title)}</span>${infoButton(String(key))}</div><b>${value}</b><small>${esc(description)}</small></div>`).join("")}</section>
    <div class="card panel trace-controls">
      <div class="panel-head"><div><h2>Filter activity ${infoButton("trace_filters")}</h2></div><button class="button soft small" data-action="trace-export">Export visible JSON</button></div>
      <div class="trace-filters">
        <label>Project<select id="traceProject"><option value="all">All projects</option><option value="unscoped" ${traceProject==="unscoped"?"selected":""}>No project</option>${projects.map(p=>`<option value="${esc(p.id)}" ${traceProject===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></label><label>Agent<select id="traceAgent"><option value="all">All agents</option>${["claude","codex","opencode","chatgpt","unknown"].map(a=>`<option value="${a}" ${traceAgent===a?"selected":""}>${a}</option>`).join("")}</select></label>
        <label>Channel<select id="traceChannel"><option value="all">All channels</option>${["hook","mcp"].map(a=>`<option value="${a}" ${traceChannel===a?"selected":""}>${a}</option>`).join("")}</select></label>
        <label class="filter-wide">Style or skill<select id="traceRecord"><option value="all">All styles and skills</option>${recordOptions}</select></label>
        <label class="filter-session">Session ID<input id="traceRun" value="${esc(traceRun)}" placeholder="All sessions" /></label>
      </div>
      ${reverse?`<div class="notice"><b>Reverse trace active:</b> ${esc(reverse.title)} — current v${reverse.version}. Event badges show the version recorded at emission, which can differ from the current version.</div>`:""}
      <div class="trace-actions"><button class="button ghost small" data-action="trace-refresh">Refresh</button><span class="hint">${events.length} matching events shown · ${stats.events} real events in this project scope</span></div>
    </div>
    <section class="trace-results space-top-18"><div class="card panel">
       <div class="panel-head"><div><h2>Observed event timeline ${infoButton("trace_timeline")}</h2><p>Newest first. Each record was produced by a hook or MCP call.</p></div><div class="live-status"><label class="check-inline"><input type="checkbox" id="traceLive" ${traceLive?"checked":""} /> Live updates</label><span class="hint" id="traceUpdated" role="status">${traceLive?"Checked "+new Date().toLocaleTimeString():"Paused"}</span></div></div>
       <div class="trace-timeline">${rows||empty("No matching trace events","Run Claude, Codex, OpenCode or ChatGPT with Personal Brain connected; their calls appear here")}</div>${pagination(events.length)}
     </div></section>`);
  $("traceLive").addEventListener("change",()=>{traceLive=($("traceLive") as HTMLInputElement).checked;$("traceUpdated").textContent=traceLive?"Live":"Paused";});
  // Live timeline: poll quietly and re-render only when the visible result set changed.
  // Pauses while the user reads an expanded event, edits a filter, pages back or hides the tab.
  const shown=events.map(e=>e.id).join(",");
  const tick=async()=>{
    if(active!=="trace")return;
    const busy=!traceLive||document.hidden||page!==1||!!main.querySelector(".trace-timeline details[open]")||!!document.activeElement?.closest(".trace-controls");
    if(!busy){
      try{
        const latest=await api<TraceEntry[]>(`/api/trace?${traceQuery()}`);
        if(active!=="trace")return;
        if(latest.map(e=>e.id).join(",")!==shown){const y=window.scrollY;await traceExplorer();window.scrollTo(0,y);return;}
        const label=document.getElementById("traceUpdated");if(label)label.textContent="Checked "+new Date().toLocaleTimeString();
      }catch{/* Keep the current timeline; the next tick retries. */}
    }
    traceTimer=setTimeout(tick,5000);
  };
  traceTimer=setTimeout(tick,5000);
  for(const id of ["traceProject","traceAgent","traceChannel","traceRecord","traceRun"]){$(id).addEventListener("change",async()=>{
    page=1;const changedProject=traceProject!==($('traceProject') as HTMLSelectElement).value;traceProject=($('traceProject') as HTMLSelectElement).value;traceAgent=($('traceAgent') as HTMLSelectElement).value;
    traceChannel=($('traceChannel') as HTMLSelectElement).value;
    traceRun=changedProject?'':($('traceRun') as HTMLInputElement).value.trim();
    traceRecord=changedProject?'all':($('traceRecord') as HTMLSelectElement).value;
    updateUrl();await traceExplorer();
  });}
}

function showEditorTab(index:number,focus=false){
  document.querySelectorAll<HTMLButtonElement>('#editor [data-editor-tab]').forEach(button=>{const selected=Number(button.dataset.editorTab)===index;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;if(selected&&focus)button.focus();});
  for(let i=0;i<4;i++)$("editPanel"+i).hidden=i!==index;
}
function filterEditorLinks(){
  const query=($("editRequiredSearch") as HTMLInputElement).value.trim().toLowerCase();let visible=0,selected=0;
  document.querySelectorAll<HTMLElement>('#editRequired .dependency-choice').forEach(row=>{row.hidden=!(row.textContent||'').toLowerCase().includes(query);if(!row.hidden)visible++;if(row.querySelector<HTMLInputElement>('input')?.checked)selected++;});
  $("editRequiredCount").textContent=`${visible} matching styles · ${selected} selected`;
}
let editorDirty=false;
function closeEditor(){if(editorDirty&&!confirm("Discard unsaved changes to this record?"))return;editorDirty=false;editor.close();}
function openEditor(record:RecordItem|null=null){
  editing=record;
  $("editKindField").hidden=record?.kind==="skill";
  const projectEdit=record&&active==="projects"&&selectedProject;
  if(projectEdit&&record){const recordId=record.id;const override=selectedProject!.assignments.find(a=>a.recordId===recordId)?.override;if(override)record={...record,content:override};}
  $("editorTitle").textContent=projectEdit?record!.projectId?"Edit project-only style":"Customize project style":record?"Edit style":active==="projects"&&selectedProject?"Create project-private style":"Create knowledge record";
  $("editDomain").innerHTML=domainOptions(record?.domain||"general");
  const fields:Record<string,string>={editContract:JSON.stringify({preferences:record?.preferences||[],supportingLinks:record?.supportingLinks||[],skillBindings:record?.skillBindings||[]},null,2),editKeyId:record?.keyId||"",editKind:(record?.kind==="skill"?"preference":record?.kind)||(["preference","example","review","tool"].includes(active)?active:"preference"),editDomain:record?.domain||"general",editTitle:record?.title||"",editSummary:record?.summary||"",editUseWhen:record?.useWhen||"",editExamples:record?.examples?.join("\n")||"",editPrinciples:record?.principles?.join("\n")||"",editExternalSkills:record?.externalSkills?.join("\n")||"",editReviewCriteria:record?.reviewCriteria?.join("\n")||"",editContent:record?.content||"",editTags:record?.tags.join(", ")||"",editPriority:String(record?.priority??70),editStatus:record?.status||"active",editRequirements:record?.requirements?.length?JSON.stringify(record.requirements,null,2):"",editChecks:record?.checks.length?JSON.stringify(record.checks,null,2):"",editBackend:record?.backend?JSON.stringify(record.backend,null,2):""};
  for(const [id,value] of Object.entries(fields))($(id) as HTMLInputElement).value=value;
  ($("editKeyId") as HTMLInputElement).readOnly=!!record;
  const linked=new Set(record?.requiredIds||[]);
  const owner=record?.projectId||(active==="projects"?selectedProject?.id:undefined);
  const choices=items.filter(r=>(!r.projectId||r.projectId===owner)&&r.id!==record?.id&&(r.status==="active"||linked.has(r.id)));
  const checkbox=(id:string,title:string,detail:string)=>`<label class="dependency-choice"><input type="checkbox" name="requiredStyle" value="${esc(id)}" ${linked.has(id)?"checked":""} /><span><strong>${esc(title)}</strong><small>${esc(detail)}</small></span></label>`;
  $("editRequired").innerHTML=choices.map(r=>checkbox(r.id,r.title,domainName(r.domain)+(r.status!=="active"?" · "+r.status:""))).join("")+
    [...linked].filter(id=>!items.some(r=>r.id===id)).map(id=>checkbox(id,"Unavailable dependency",id+" · remove this link or restore the record")).join("")||'<p class="hint">No active records available to link.</p>';
  ($("editRequiredSearch") as HTMLInputElement).value="";filterEditorLinks();showEditorTab(0);
  $("editError").textContent="";editorDirty=false;editor.showModal();
}
function parseJson<T>(input:string,fallback:T):T{if(!input.trim())return fallback;try{return JSON.parse(input) as T;}catch{throw new Error("Invalid JSON in requirements, checks or tool backend");}}
function lines(id:string){return ($(id) as HTMLTextAreaElement).value.split("\n").map(s=>s.trim()).filter(Boolean);}
async function saveEditor(ev:SubmitEvent){ev.preventDefault();
  try{const record={...parseJson<Record<string,unknown>>(($("editContract") as HTMLTextAreaElement).value,{}),keyId:($("editKeyId") as HTMLInputElement).value.trim()||undefined,projectId:editing?.projectId||(active==="projects"&&selectedProject?selectedProject?.id:undefined),kind:editing?.kind==="skill"?"skill":($("editKind") as HTMLInputElement).value,domain:($("editDomain") as HTMLInputElement).value,title:($("editTitle") as HTMLInputElement).value,
    summary:($("editSummary") as HTMLInputElement).value,content:($("editContent") as HTMLTextAreaElement).value,
    requiredIds:Array.from(document.querySelectorAll<HTMLInputElement>('#editRequired input[name="requiredStyle"]:checked')).map(o=>o.value),
    useWhen:($("editUseWhen") as HTMLInputElement).value,tags:($("editTags") as HTMLInputElement).value.split(",").map(t=>t.trim()).filter(Boolean),priority:Number(($("editPriority") as HTMLInputElement).value),status:($("editStatus") as HTMLInputElement).value,
    examples:lines("editExamples"),principles:lines("editPrinciples"),externalSkills:lines("editExternalSkills"),reviewCriteria:lines("editReviewCriteria"),
    requirements:parseJson(($("editRequirements") as HTMLTextAreaElement).value,[]),checks:parseJson(($("editChecks") as HTMLTextAreaElement).value,[]),backend:parseJson(($("editBackend") as HTMLTextAreaElement).value,null)};
    if(record.kind==="tool"&&record.backend) {if(!confirm("External MCP tool commands can access your computer. Only configure trusted tools and leave them disabled until reviewed. Continue?"))return;}
    if(editing&&active==="projects"&&selectedProject&&(!editing.projectId||selectedProject.assignments.some(a=>a.recordId===editing!.id)))await api(`/api/projects/${selectedProject.id}/items/${editing.id}`,{method:"PUT",body:JSON.stringify({expectedVersion:editing.version,expectedProjectVersion:selectedProject.version,record})});
    else if(editing)await api(`/api/items/${editing.id}${editing.projectId?"?projectId="+encodeURIComponent(editing.projectId):""}`,{method:"PUT",body:JSON.stringify({expectedVersion:editing.version,record})});
    else await api("/api/items",{method:"POST",body:JSON.stringify(record)});
    editorDirty=false;editor.close();toast("Saved a new version successfully");await refresh();
  }catch(e){$("editError").textContent=e instanceof Error?e.message:String(e);}
}
async function showHistory(id:string){
  const record=items.find(i=>i.id===id);if(!record)return;
  const history=await api<Array<{version:number,action:string,at:string,snapshot:RecordItem}>>(`/api/items/${id}/history${record.projectId?"?projectId="+encodeURIComponent(record.projectId):""}`);
  $("historyTitle").textContent=record.title;
  const global=record.sourceStyleId?await api<RecordItem>(`/api/items/${record.sourceStyleId}`).catch(()=>null):null;
  const globalHistory=global&&record.sourceVersion?await api<Array<{version:number;snapshot:RecordItem}>>(`/api/items/${global.id}/history`).catch(()=>[]):[];
  const base=globalHistory.find(r=>r.version===record.sourceVersion)?.snapshot;
  const comparison=(r:RecordItem)=>JSON.stringify({content:r.content,preferences:r.preferences,requiredIds:r.requiredIds,supportingLinks:r.supportingLinks,skillBindings:r.skillBindings,externalSkills:r.externalSkills,requirements:r.requirements,reviewCriteria:r.reviewCriteria},null,2);
  const origin=global?`<details><summary>Compare private preference with global v${global.version} (base ${record.sourceVersion??'unknown'})</summary><h3>Original base</h3><pre>${base?esc(comparison(base)):'Base snapshot unavailable; do not infer what changed.'}</pre><h3>Current global</h3><pre>${esc(comparison(global))}</pre><h3>Current private</h3><pre>${esc(comparison(record))}</pre><p>No automatic rebase is performed. Restore history or edit deliberately after comparing.</p></details>`:'';
  $("historyContent").innerHTML=origin+history.map(r=>`<div class="history-entry"><div><b>Version ${r.version} · ${esc(r.action)}</b><p>${esc(formatTime(r.at))}</p><p>${esc(r.snapshot.summary.slice(0,100))}</p></div>${r.version<record.version?`<button class="button ghost small" data-restore="${id}" data-version="${r.version}">Restore</button>`:'<span class="chip">Current</span>'}</div>`).join("");
  revisions.showModal();
}
async function restoreRecord(id:string,version:number){const rec=items.find(i=>i.id===id);if(!rec)return;
  if(!confirm(`Restore version ${version}? This creates a new version and preserves all history.`))return;
  try{await api(`/api/items/${id}/restore${rec.projectId?"?projectId="+encodeURIComponent(rec.projectId):""}`,{method:"POST",body:JSON.stringify({version,expectedVersion:rec.version})});revisions.close();toast("Restored as a new version");await refresh();}catch(e){toast(e instanceof Error?e.message:String(e));}
}
async function delegated(ev:MouseEvent){const target=ev.target as HTMLElement;const button=target.closest<HTMLButtonElement>("button");
  if(!button){const capability=target.closest<HTMLElement>("[data-capability-row]");if(capability&&!target.closest("a,input,select,textarea")&&!window.getSelection()?.toString()){location.hash="/library?domain="+encodeURIComponent(capability.dataset.capabilityRow!);return;}const row=target.closest<HTMLElement>("[data-project-row]");if(row&&!target.closest("a,input,select,textarea")){try{selectedProject=await api<ProjectConfig>(`/api/projects/${row.dataset.projectRow}`);active="projects";projectEditing=false;projectTab="styles";page=1;await projectScreen();}catch(e){toast(e instanceof Error?e.message:String(e));}}return;}
  try{
    if(button.dataset.action==='catalog-preview'){
      const candidates=await api<Array<{id:string;version:number;title:string;eligible:boolean;reason:string;before:string;after:string}>>('/api/catalog-upgrade');
      $('historyTitle').textContent='Review preference catalog updates';
      $('historyContent').innerHTML=candidates.map(c=>`<article><h3>${esc(c.title)}</h3><p>${esc(c.reason)}</p><details><summary>Compare content, requirements and procedure bindings</summary><h4>Current</h4><pre>${esc(c.before)}</pre><h4>Proposed</h4><pre>${esc(c.after)}</pre></details>${c.eligible?`<button class="button" data-catalog-apply="${esc(c.id)}" data-version="${c.version}">Apply this update</button>`:''}</article>`).join('')||'<p>No catalog updates available.</p>';revisions.showModal();return;
    }
    if(button.dataset.catalogApply){
      button.disabled=true;button.textContent='Applying…';
      try{await api('/api/catalog-upgrade',{method:'POST',body:JSON.stringify({id:button.dataset.catalogApply,expectedVersion:Number(button.dataset.version)})});button.textContent='Applied';toast('Updated shared preference; private copies preserved');await refresh();}
      catch(e){button.disabled=false;button.textContent='Apply this update';const error=document.createElement('p');error.setAttribute('role','alert');error.textContent=e instanceof Error?e.message:String(e);button.after(error);}return;
    }
    if(button.dataset.copyOnboarding){
      try{await navigator.clipboard.writeText(projectOnboardingPrompt(button.dataset.copyOnboarding));toast("Onboarding prompt copied");}
      catch{toast("Could not copy. Select and copy the visible onboarding prompt.");}return;
    }
    if(button.dataset.removeKind){await previewRemoval(button.dataset.removeKind,button.dataset.removeId!);return;}
    if(button.dataset.action==="removal-cancel"){($("removalDialog") as HTMLDialogElement).close();removalPreview=null;return;}
    if(button.dataset.action==="removal-confirm"&&removalPreview){
      button.disabled=true;
      try{const {kind,id,fingerprint}=removalPreview;await api(`/api/removal/${kind}/${id}`,{method:"POST",body:JSON.stringify({fingerprint})});($("removalDialog") as HTMLDialogElement).close();removalPreview=null;if(kind==="project"&&selectedProject?.id===id){selectedProject=null;projectEditing=false;}await refresh();toast(kind==="reset"?"Project styles reset":"Deleted");}catch(e){$("removalError").textContent=e instanceof Error?e.message:String(e);}finally{button.disabled=false;}return;
    }
    if(button.dataset.graphContents){graphShowContents=!graphShowContents;const host=document.querySelector(".graph-workspace")?.parentElement;if(host){await render();zoomGraph("fit");}return;}
    if(button.dataset.graphMode){graph3d=button.dataset.graphMode==="3d";graphYaw=0;graphPitch=0;updateGraphProjection();document.querySelectorAll<HTMLElement>("[data-graph-mode]").forEach(el=>el.setAttribute("aria-pressed",String((el.dataset.graphMode==="3d")===graph3d)));return;}
    if(button.dataset.graphOrbit){graphYaw+=button.dataset.graphOrbit==="left"?-.2:.2;updateGraphProjection();return;}
    if(button.dataset.graphZoom){zoomGraph(button.dataset.graphZoom);return;}
    if(button.dataset.publish&&selectedProject){
      const record=items.find(r=>r.id===button.dataset.publish&&r.projectId===selectedProject!.id);if(!record)return;
      if(!confirm(`Publish "${record.title}" to the global library? This creates shared copies of this record and its required private dependencies, including their instructions, skill references, examples and rules. Active copies become available as global defaults and to other projects. This project's private records and selections stay unchanged.`))return;
      const result=await api<{published:RecordItem[]}>(`/api/projects/${selectedProject.id}/items/${record.id}/publish`,{method:"POST",body:JSON.stringify({expectedVersion:record.version})});
      toast(`Published ${result.published.length} shared record(s)`);await refresh();return;
    }
    if(button.dataset.action==="private-style"){openEditor();return;}
    if(button.dataset.action==="capability-add"){
      ($("domainName") as HTMLInputElement).value=newDomainDraft;$("capabilityCreateError").textContent="";document.querySelector<HTMLInputElement>('input[name="domainMode"][value="combine"]')!.checked=true;
      ($("capabilityDialog") as HTMLDialogElement).showModal();$("domainName").focus();return;
    }
    if(button.dataset.action==="capability-close"){($("capabilityDialog") as HTMLDialogElement).close();return;}
    if(button.dataset.libraryMode){libraryMode=button.dataset.libraryMode==="map"?"map":"table";records(active as Kind);return;}
    if(button.dataset.action==="graph-close"){closeGraphDetails();return;}
    if(button.dataset.graphNode){if(graphDragged){graphDragged=false;return;}highlightDependencyNode(button.dataset.graphNode);return;}
    if(button.dataset.dependencies){const item=items.find(i=>i.id===button.dataset.dependencies);if(item){openEditor(item);showEditorTab(2);$("editRequiredSearch").focus();}return;}
    if(button.dataset.project){selectedProject=await api<ProjectConfig>(`/api/projects/${button.dataset.project}`);projectEditing=false;projectTab="styles";page=1;await projectScreen();return;}
    if(button.dataset.page){page=Number(button.dataset.page);await render();return;}
    if(button.dataset.info){showHelp(button.dataset.info);return;}
    if(button.dataset.editDomain){domainEditing=button.dataset.editDomain;domainsScreen();$("domain-"+domainEditing).focus();return;}
    if(button.dataset.copyTemplate){const t=items.find(r=>r.id===button.dataset.copyTemplate);if(t){try{await navigator.clipboard.writeText(t.content);toast("Template copied");}catch{toast("Open the template and copy its content.");}}return;}
    if(button.dataset.cancelDomain){domainDrafts.delete(button.dataset.cancelDomain);domainEditing="";domainsScreen();return;}
    if(button.dataset.view){if(!confirmLeaveProject())return;active=button.dataset.view as View;items=items.filter(r=>!r.projectId);selectedProject=null;projectEditing=false;search="";domain="all";page=1;await render();return;}
    if(button.dataset.edit){const item=items.find(i=>i.id===button.dataset.edit);if(item)openEditor(item);return;}
    if(button.dataset.rescanSkills){await showProjectDiscovery(button.dataset.rescanSkills==="all"?undefined:button.dataset.rescanSkills);return;}
    if(button.dataset.skillIssues){await showProjectDiscovery(button.dataset.skillIssues);return;}
    if(button.dataset.history){await showHistory(button.dataset.history);return;}
    if(button.dataset.restore){await restoreRecord(button.dataset.restore,Number(button.dataset.version));return;}
    switch(button.dataset.action){
      case "skills-rescan":button.disabled=true;await refresh();return;
      case "repository-browse":await openFolderBrowser("repositoryFolder","browseRepositoryFolder","repositoryResult");break;
      case "repository-link":
      case "repository-test":{
        if(!selectedProject)break;
        const folder=($("repositoryFolder") as HTMLInputElement).value.trim();
        const result=$("repositoryResult");
        if(!folder){result.textContent="Enter the absolute path to your repository folder.";$("repositoryFolder").focus();break;}
        button.disabled=true;result.textContent="Checking…";
        try{
          const link=button.dataset.action==="repository-link";
          const data=await repositoryRequest(selectedProject.id,folder,link?"link":"test");
          result.textContent=link?`Linked: ${data.file}. Start a new agent session in this repository.`:data.matches?`Configuration ready: ${data.records?.length||0} records resolved for this project. Confirm agent calls in Agent conversations.`:`This folder resolves to ${data.projectId||"global defaults"}, not this project.`;
        }catch(e){result.textContent=e instanceof Error?e.message:String(e);}
        finally{button.disabled=false;}
        break;
      }
      case "skill-prev":skillPage--;renderSkillResults();break;
      case "skill-next":skillPage++;renderSkillResults();break;
      case "skill-scan":await skillDiscovery();break;
      case "skill-clear-style":skillRecord="";await skillDiscovery();break;
      case "project-refresh":await projectScreen();break;
      case "project-new":selectedProject=null;projectEditing=true;projectForm();break;
      case "project-edit":projectEditing=true;projectForm();break;
      case "project-cancel":if(!confirmLeaveProject())break;projectEditing=false;await projectScreen();break;

      case "trace-refresh":{await traceExplorer();break;}
      case "trace-export":{const data=await api<TraceEntry[]>(`/api/trace?${traceQuery()}`);const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),items:data},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="personal-brain-trace.json";link.click();URL.revokeObjectURL(url);break;}
      case "import-styles":{await api("/api/styles/seed",{method:"POST"});search="";domain="all";await refresh();toast("Sample styles loaded; existing edits preserved");break;}
      case "seed":{const r=await api<{created:number}>("/api/examples/seed",{method:"POST"});toast(`${r.created} new examples added; existing edits preserved`);await refresh();break;}
      case "retry":await refresh();break;
      case "add":openEditor();break;
      case "discover":{diagnosticProject=($("diagnosticProject") as HTMLSelectElement).value;$("discoveryResults").textContent=JSON.stringify(await api(`/api/discover?projectId=${encodeURIComponent(diagnosticProject)}&q=${encodeURIComponent(($("discoveryTask") as HTMLTextAreaElement).value)}`),null,2);break;}
      case "bootstrap":{diagnosticProject=($("diagnosticProject") as HTMLSelectElement).value;$("bootstrapResults").textContent=(await api<{text:string}>("/api/bootstrap?projectId="+encodeURIComponent(diagnosticProject))).text;break;}
      case "review":{diagnosticProject=($("diagnosticProject") as HTMLSelectElement).value;$("reviewResults").textContent=JSON.stringify(await api("/api/review",{method:"POST",body:JSON.stringify({projectId:diagnosticProject||undefined,domain:($("reviewDomain") as HTMLInputElement).value,content:($("reviewText") as HTMLTextAreaElement).value})}),null,2);break;}
      case "feedback":{const note=($("fbNote") as HTMLTextAreaElement).value.trim();if(!note)throw new Error("Feedback note required");await api("/api/feedback",{method:"POST",body:JSON.stringify({rating:($("fbRating") as HTMLSelectElement).value,note})});toast("Feedback recorded for review");await feedback();break;}
    }
  }catch(e){toast(e instanceof Error?e.message:String(e));}
}
document.addEventListener("click",delegated);
type About={version:string;builtAt:string|null;mode:"source"|"npx"|"global";cli:string;onPath:boolean;npx:string;raw:string};
let about:About|null=null;
const aboutReady=api<About>("/api/about").then(a=>{about=a;const el=document.getElementById("buildInfo");if(el)el.innerHTML=`<strong>Personal Brain v${esc(a.version)}</strong><br>Built ${a.builtAt?esc(new Date(a.builtAt).toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})):"unknown"}`;return a;}).catch(()=>null);
function setMenu(open:boolean){document.querySelector(".sidebar")?.classList.toggle("menu-open",open);$("menuToggle").setAttribute("aria-expanded",String(open));}
$("menuToggle").addEventListener("click",()=>setMenu($("menuToggle").getAttribute("aria-expanded")!=="true"));
document.addEventListener("click",ev=>{if((ev.target as HTMLElement).closest?.(".sidebar [data-view]"))setMenu(false);});
document.addEventListener("change",ev=>{const target=ev.target as HTMLInputElement;if(target.name==="assignment")syncProjectSelection();});
document.addEventListener("input",ev=>{const target=ev.target as HTMLElement;if(target.closest("#projectForm"))projectFormDirty=true;if(target.id.startsWith("override-"))syncProjectSelection();});
document.addEventListener("submit",ev=>{if((ev.target as HTMLElement).id==="projectForm")void saveProject(ev);});
$("closeEditor").addEventListener("click",closeEditor);
$("cancelEditor").addEventListener("click",closeEditor);
$("editForm").addEventListener("input",event=>{if((event.target as HTMLElement).id!=="editRequiredSearch")editorDirty=true;});
$("editRequiredSearch").addEventListener("input",filterEditorLinks);
$("editRequired").addEventListener("change",filterEditorLinks);
document.querySelectorAll<HTMLButtonElement>('#editor [data-editor-tab]').forEach((button,index)=>{
  button.addEventListener('click',()=>showEditorTab(index));
  button.addEventListener('keydown',event=>{const next=event.key==='ArrowRight'?(index+1)%4:event.key==='ArrowLeft'?(index+3)%4:event.key==='Home'?0:event.key==='End'?3:null;if(next!==null){event.preventDefault();showEditorTab(next,true);}});
});
$("editForm").addEventListener('invalid',event=>{const panel=(event.target as HTMLElement).closest('[role="tabpanel"]');if(panel)showEditorTab(Number(panel.id.replace('editPanel','')));},true);
editor.addEventListener("cancel",ev=>{ev.preventDefault();closeEditor();});
$("closeRevisions").addEventListener("click",()=>revisions.close());
$("closeHelp").addEventListener("click",()=>($("helpDialog") as HTMLDialogElement).close());
$("domainName").addEventListener("input",()=>{newDomainDraft=($("domainName") as HTMLInputElement).value;});
$("domainCreate").addEventListener("submit",ev=>{ev.preventDefault();void saveDomainName();});
$("editForm").addEventListener("submit",ev=>{void saveEditor(ev as SubmitEvent);});
function currentRoute(){
  let path=active as string;
  const params=new URLSearchParams();
  if(["preference","skill","example","review"].includes(active)){
    path="library";if(active!=="preference")params.set("type",active);
  }
  if(active==="projects")path+=selectedProject?"/"+encodeURIComponent(selectedProject.id)+(projectEditing?"/configure":""):projectEditing?"/new":"";
  if(["preference","skill","example","review","tool"].includes(active)){
    if(search)params.set("q",search);if(domain!=="all")params.set("domain",domain);if(libraryMode!=="table")params.set("mode",libraryMode);
  }
  if(active==="trace"){params.set("projectId",traceProject);params.set("agent",traceAgent);params.set("channel",traceChannel);if(traceRun)params.set("runId",traceRun);if(traceRecord!=="all")params.set("recordId",traceRecord);if(traceDemo)params.set("demo","1");}
  if(active==="skills"){if(skillProject)params.set("projectId",skillProject);if(skillQuery)params.set("q",skillQuery);if(skillRecord)params.set("recordId",skillRecord);params.set("status",skillStatus);}
  if(active==="domains"&&search)params.set("q",search);
  if(active==="projects"){if(selectedProject&&projectTab!=="styles"&&!projectEditing)params.set("tab",projectTab);if(!selectedProject&&search)params.set("q",search);}
  if(page>1)params.set("page",String(page));
  return "#/"+path+(params.size?"?"+params.toString():"");
}
let readingRoute=false;
function updateUrl(replace=false){
  if(typeof window==="undefined"||readingRoute)return;
  const route=currentRoute();
  if(window.location.hash!==route)window.history[replace||!window.location.hash?"replaceState":"pushState"](null,"",route);
}
async function readRoute(){
  const raw=window.location.hash.replace(/^#\/?/,"");const [path,query=""]=raw.split("?");
  const parts=path.split("/");const params=new URLSearchParams(query);
  active=parts[0]==="library"?(["preference","example","review"].includes(params.get("type")||"")?params.get("type") as Kind:"preference"):Object.hasOwn(labels,parts[0])?parts[0] as View:"overview";
  if(active==="skill")active="preference";
  search=params.get("q")||"";domain=params.get("domain")||"all";libraryMode=params.get("mode")==="map"?"map":"table";
  page=Math.max(1,Math.min(10000,Number(params.get("page"))||1));
  projectTab=params.get("tab")==="map"?"map":params.get("tab")==="personal"?"personal":params.get("tab")==="activity"?"activity":params.get("tab")==="setup"?"setup":"styles";
  if(active==="trace"){traceRun=params.get("runId")||"";traceProject=params.get("projectId")||"all";traceAgent=params.get("agent")||"all";traceChannel=params.get("channel")||"all";traceRecord=params.get("recordId")||"all";traceDemo=params.get("demo")==="1";}
  if(active==="skills"){skillProject=params.get("projectId")||"";skillQuery=params.get("q")||"";skillRecord=params.get("recordId")||"";skillStatus=["issues","required"].includes(params.get("status")||"")?params.get("status")!:"all";}
  selectedProject=null;projectEditing=false;
  if(active==="projects"&&parts[1]){
    if(parts[1]==="new")projectEditing=true;
    else if(/^[a-f0-9-]{36}$/i.test(parts[1])){selectedProject=await api<ProjectConfig>("/api/projects/"+encodeURIComponent(parts[1]));projectEditing=parts[2]==="configure";}
  }
}
async function loadRoute(){
  try{readingRoute=true;await readRoute();await refresh();readingRoute=false;updateUrl(true);}
  catch(e){layout("Could not open this page",e instanceof Error?e.message:String(e),'<button class="button primary" data-view="projects">All projects</button>');}
  finally{readingRoute=false;}
}
if(typeof window!=="undefined"){
  window.addEventListener("hashchange",ev=>{if(!confirmLeaveProject()){history.replaceState(null,"",ev.oldURL);return;}void loadRoute();});
  window.addEventListener("beforeunload",ev=>{if(editorDirty||(projectFormDirty&&document.getElementById("projectForm")))ev.preventDefault();});
  void loadRoute();
}else void refresh();

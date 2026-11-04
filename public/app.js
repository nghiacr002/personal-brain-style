"use strict";
const $ = (id) => document.getElementById(id);
const main = $("main"), editor = $("editor"), revisions = $("revisions");
const labels = { fusion: "Fusion", domains: "Capabilities", projects: "Projects", baseline: "Startup index", review_simulator: "Text Review", overview: "Overview", preference: "My Styles", skill: "Skills", example: "Approved Examples", review: "Review Standards", tool: "MCP Tool Catalog", discover: "Discovery Lab", feedback: "Feedback", history: "Activity", activation: "Agent setup", trace: "Trace Explorer" };
const icons = { preference: "✦", skill: "▦", example: "◈", review: "✓", tool: "⛓" };
let active = "overview", items = [], editing = null, search = "", domain = "all", summary = null;
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch] || ch));
function domainRegistry() { return summary?.domainRegistry || ["general", "thinking", "architecture", "diagrams", "writing", "coding", "technology", "reviews", "communication", "design", "tools"].map(id => ({ id, name: id })); }
function domainName(id) { return domainRegistry().find(d => d.id === id)?.name || id; }
function domainOptions(selected) { return domainRegistry().map(d => `<option value="${esc(d.id)}" ${d.id === selected ? 'selected' : ''}>${esc(d.name)}</option>`).join(""); }
const formatTime = (s) => new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const kindLabel = (kind) => kind === "preference" ? "Style" : kind;
const ch = (kind) => `<span class="chip ${esc(kind)}">${esc(kindLabel(kind))}</span>`;
const empty = (title, desc) => `<div class="empty"><span>◌</span><b>${esc(title)}</b><p>${esc(desc)}</p></div>`;
const HELP = {
    projects: { what: "Project-specific working preferences.", how: "Assign active shared records and optional instruction overrides. Only selections and their required dependencies apply.", why: "Use different working styles across projects without copying the library.", limitations: "Agents need an explicit project ID. Selecting a project here does not switch agent sessions.", example: "Use a sky blue design style for one project and a minimal design style for another." },
    overview: { what: "An inventory of personal working methods shared across agent runtimes.", how: "Shows active preferences, skills, examples, checks and recorded revisions. Edit from the library; agents read the latest approved versions.", why: "Keep your personal work style consistent without copying the same instructions into each conversation.", limitations: "The dashboard is not a project-memory manager or an agent-runtime monitor.", example: "Add a global writing rule; both Claude and Codex receive it in subsequent tasks." },
    preference: { what: "Global personal design, thinking and writing preferences.", how: "Store each rule as a versioned record with a domain, tags and priority. Startup and task hooks select relevant rules.", why: "Your work standards become portable between Claude Code and Codex.", limitations: "These rules influence generated output; they cannot force an agent to obey them.", example: "Require compact rounded diagrams with orthogonal connectors." },
    skill: { what: "Step-by-step procedures an agent can discover for a task.", how: "The prompt hook selects matching skills; an MCP agent can search with brain_discover and retrieve full text using brain_get.", why: "Reusable procedures are more reliable and easier to improve than a monolithic prompt.", limitations: "A discovered skill is not evidence of executed steps.", example: "For a diagram, choose a layout, generate draw.io XML and validate it." },
    example: { what: "Reusable reference content demonstrating your preferred format and quality.", how: "Store examples with a domain and searchable tags; agents can request matching examples through MCP.", why: "Concrete examples reduce ambiguity when explaining style.", limitations: "Examples are general templates, never private project facts or automatically rendered artifacts.", example: "An acceptance-criteria template with actors, triggers and results." },
    review: { what: "Your quality criteria, including deterministic text checks and manual rubrics.", how: "Define checks for forbidden/required terms and length. Call brain_review to evaluate provided text. Visual inspections require external rendering.", why: "Detect recurring issues before accepting an output.", limitations: "A text check does not prove diagrams render or architectures are correct.", example: "Reject document placeholders such as TBD; separately inspect visual connector crossings." },
    tool: { what: "A catalog of external MCP capabilities available to your agents.", how: "Store a tool description. An administrator can configure and enable its command and tool name after review. Agents discover, inspect and invoke using MCP.", why: "Agents find the right drawing or document tool without loading every tool's definition.", limitations: "Catalog entries do not install servers. External invocation remains disabled until configured and approved.", example: "Register an approved draw.io MCP for editable diagrams." },
    discover: { what: "A simulator to inspect which styles and skills match a proposed task.", how: "Searches active records and ranks matches. Use the review simulator to test deterministic checks. This runs from the UI, not an agent.", why: "Find missing tags and improve discovery without spending model tokens.", limitations: "UI searches do not prove Claude or Codex called the MCP server.", example: "Search 'draw an architecture diagram' and verify a drawing skill appears." },
    activation: { what: "Automatically supplies personal style to Claude Code and Codex.", how: "SessionStart sends a compact index. UserPromptSubmit suggests matching record IDs and versions. MCP remains available for deeper retrieval.", why: "You do not need to type 'load my style' at every new session.", limitations: "Hook installation does not prove a live agent executed the hook. Confirm this in Trace Explorer.", example: "Start Claude, ask to draw a diagram and inspect its recorded hook.prompt.context event." },
    feedback: { what: "Human feedback about accepted work, corrections and rejected output.", how: "Record feedback against a style record or generally; later use it to propose and approve rule revisions.", why: "Prevent the same mistake from repeating across agents.", limitations: "Feedback is not model fine-tuning and does not change active preferences automatically.", example: "Record that a diagram had unnecessary crossing lines; edit the approved diagram rule." },
    history: { what: "An audit trail of style edits, restores and feedback.", how: "Every record edit creates a new immutable revision. Open a record's History to restore an earlier snapshot as a new version.", why: "Make style changes reversible and explainable.", limitations: "The activity log is not agent trace telemetry; use Trace Explorer for live agent events.", example: "Restore version 2 of your writing rules without deleting later history." },
    trace: { what: "Reverse trace of Personal Brain calls made by Claude Code and Codex.", how: "Collects SessionStart and prompt hook deliveries plus MCP initialization, search, get, review and feedback calls. Filter by agent, channel or knowledge record, then inspect which records and versions were delivered.", why: "Understand whether the Brain was contacted, which instructions were emitted and where the process stopped.", limitations: "A delivered instruction is not proof it affected the final answer. MCP processes and hook sessions may not share a correlation ID. Prompts and tool payloads are not stored.", example: "For a draw.io request, confirm hook.prompt.context listed your drawing style; then look for mcp.brain_get or mcp.brain_review." },
    trace_filters: { title: "Filter activity", group: "Trace Explorer", what: "Narrows the timeline below to the events you care about.", how: "Project limits events and the metric counts to one project. Agent and Channel narrow the timeline by Claude/Codex and hook/MCP. Reverse by rule shows only events that mention one style or skill. Refresh reloads, and Export saves the visible events as JSON.", why: "Answers questions like 'did Codex ever load my review checklist in this project?'", limitations: "Metric counts follow the Project filter only. Demo traces stay hidden unless you include them.", example: "Project Personal Brain + Reverse by rule 'UI/UX preferences' lists every event that delivered that style." },
    trace_samples: { title: "Sample traces", group: "Trace Explorer", what: "Creates or clears clearly marked synthetic events so you can see how a full trace looks.", how: "Generate adds demo events tagged DEMO ONLY; Clear removes them. They appear in the timeline only when Include demo traces is ticked.", why: "Lets you learn the timeline without waiting for real agent activity.", limitations: "Demo events never count in the metrics and are not evidence of real agent behavior.", example: "Generate, tick Include demo traces, and follow one demo run from hook to review." },
    trace_timeline: { title: "Observed event timeline", group: "Trace Explorer", what: "Every recorded hook and MCP call that matches your filters, newest first.", how: "Each row shows the event, project, agent, outcome and session, plus the style records it delivered and their versions. Inspect recorded evidence shows the raw metadata.", why: "Lets you trace a specific agent session back to the exact style versions it received.", limitations: "Hook sessions and MCP sessions can have different IDs, so one conversation may appear as unlinked rows.", example: "A brain_get row listing 'Warm terracotta\u2026 v2' shows the agent loaded that version." },
    revisions_metric: { title: "Revisions", group: "Overview \u00b7 metric", what: "The total number of saved versions across all records in your library.", how: "Every save, restore or project update creates a new version. Old versions are kept until the record itself is deleted. Open Change history to browse them.", why: "Shows how actively your styles are evolving, and that edits add versions instead of overwriting.", limitations: "A high count is not a quality signal. It includes small wording fixes.", example: "Editing one style three times adds 3." },
    knowledge_library: { title: "Knowledge library", group: "Overview", what: "The six library records changed most recently.", how: "Sorted by last update. Selecting a title opens it in the record editor.", why: "A quick way back to what you were working on.", limitations: "Shows shared library records only; project-private copies appear in their project.", example: "After updating the palette, its record appears at the top." },
    trace_startup: { title: "Startup injections", group: "Trace Explorer \u00b7 metric", what: "How many times a session-start hook sent Personal Brain's compact style index into a new Claude Code or Codex session.", how: "Counts real hook.session.context events, excluding demo data, for the project selected in Filter activity. Agent and channel filters do not change this number.", why: "Shows whether new sessions are actually receiving your style index.", limitations: "One injection per session is expected. It proves the index was sent, not that the agent read it.", example: "3 new Claude sessions today add 3." },
    trace_prompt: { title: "Task matches", group: "Trace Explorer \u00b7 metric", what: "How many prompts triggered the task hook to suggest matching style records (IDs and versions).", how: "Counts real hook.prompt.context events for the selected project. Each one is a prompt where the hook found relevant records.", why: "Tells you whether your styles' keywords and Use-when text actually match the work you ask for.", limitations: "A match only suggests records. The agent still decides whether to load them with brain_get.", example: "Asking 'draw a network diagram' adds 1 if a diagram style matched." },
    trace_tokens: { title: "Estimated context tokens", group: "Trace Explorer \u00b7 metric", what: "A rough size of all the text the hooks added to agent context.", how: "Sums the characters of emitted hook events for the selected project and divides by 4.", why: "Helps you spot styles or indexes that make every prompt expensive.", limitations: "It is an estimate, not model input/output usage, cached tokens or billing. MCP responses are not included.", example: "A 2,000-character index sent 10 times is about 5,000 tokens." },
    trace_discovery: { title: "Discovery calls", group: "Trace Explorer \u00b7 metric", what: "How many times an agent searched your library through the brain_discover MCP tool.", how: "Counts real mcp.brain_discover calls for the selected project.", why: "Shows agents looking for styles beyond what the hook suggested.", limitations: "A search returns a shortlist only. It does not mean any record was loaded or used.", example: "An agent searching for 'review checklist' before a code review adds 1." },
    trace_loads: { title: "Instruction loads", group: "Trace Explorer \u00b7 metric", what: "How many times an agent loaded a record's full instructions with the brain_get MCP tool.", how: "Counts real mcp.brain_get calls for the selected project. Loading one style counts once, even when it pulls in required linked records.", why: "The best available signal that agents read your full instructions instead of only the index.", limitations: "Loading is not following. Check outputs or review calls for evidence of compliance.", example: "Opening the UI/UX style before a design task adds 1." },
    trace_reviews: { title: "Review calls", group: "Trace Explorer \u00b7 metric", what: "How many compliance reports agents submitted with the brain_review MCP tool.", how: "Counts real mcp.brain_review calls for the selected project. Each report lists checks with pass, fail or not-verified evidence.", why: "The only metric where agents report checking their work against your styles.", limitations: "Agent-reported passes stay Not verified, and a review call does not prove the artifact is correct.", example: "An agent finishing a UI change and submitting its checklist adds 1." },
    evidence_ladder: { title: "Evidence ladder", group: "Trace Explorer", what: "The levels of proof the trace data can give, from weakest to strongest.", how: "Each step needs the previous one: session context sent, task matched, instructions loaded, review submitted.", why: "Stops you reading 'a hook fired' as 'the agent followed my style'.", limitations: "Even the top step is agent-reported. Visual or semantic quality still needs your own review.", example: "Hook sent \u2192 brain_get loaded the style \u2192 brain_review submitted evidence." },
    external_skills: { title: "Required external skills", group: "Overview \u00b7 metric", what: "The total number of external skills listed across all your styles in the library.", how: "Adds up every entry in each style's Required external skills field. The same skill named in two styles counts twice.", why: "Agents must find and read these skills before applying a style, so a high count means more setup work per task.", limitations: "Listing a skill does not install it or prove an agent read it. Missing or ambiguous skill references show an explicit issue count in the Library.", example: "A UI style requiring ui-ux-pro-max and ponytail-review contributes 2." },
    review_criteria: { title: "Style review criteria", group: "Overview \u00b7 metric", what: "The total number of review criteria written into your styles in the library.", how: "Adds up every line in each style's Review criteria field. Agents see them as a checklist when they load a style.", why: "Shows how much of your library can actually be checked, not just followed.", limitations: "Most criteria are manual checks that need evidence. Retrieval does not prove they were checked.", example: "A design style with 6 criteria contributes 6." },
    activation_hooks: { title: "Hook status", group: "Agent setup", what: "Whether the Personal Brain hooks are installed in your Claude Code and Codex configuration files.", how: "Reads each agent's settings file and checks for the Personal Brain hook entries. 'Changed' means the file differs from what activation wrote.", why: "Without the hooks, new sessions get no style index and prompts get no task matches.", limitations: "Installed is not running. Codex also requires you to trust the hooks in /hooks. Confirm real events in Trace Explorer.", example: "Claude Code: Installed \u00b7 Codex: Not installed \u2192 run the activation script." },
    activation_auto: { title: "Automatic behavior", group: "Agent setup", what: "What the hooks do on their own once installed.", how: "SessionStart sends a compact style index. UserPromptSubmit matches each prompt and suggests record IDs and versions. Agents then load full instructions with brain_get.", why: "You do not need to say 'load my style' in every session.", limitations: "Hooks only supply context. They do not send prompts, run a second agent or store project memory.", example: "You type 'review this PR'; the hook suggests your review checklist record." },
    field_kind: { title: "Type", group: "Record editor \u00b7 field", what: "What kind of record this is: Style, Skill, Example, Review or MCP Tool.", how: "Agents treat each type differently. Styles are working rules, Skills are procedures, Examples show good output, Reviews are checklists and Tools describe external MCP servers.", why: "Picking the right type controls where the record appears in the Library and how discovery ranks it.", limitations: "Changing the type later keeps the history but may change which screens and searches show the record.", example: "A step-by-step draw.io procedure is a Skill; 'prefer square boxes' is a Style." },
    field_domain: { title: "Capability type", group: "Record editor \u00b7 field", what: "The capability group this record belongs to, such as Design, Coding or Diagrams.", how: "Used to group and filter records in the Library and Capabilities screens, and as a discovery signal.", why: "Consistent grouping makes records easy to find and keeps the capability counts accurate.", limitations: "Grouping does not limit which projects can select the record.", example: "A color palette record belongs under Design system." },
    field_priority: { title: "Priority (0\u2013100)", group: "Record editor \u00b7 field", what: "How strongly this record is ranked when several records match.", how: "With no search query, records are ordered by priority. With a query, it breaks ties between equal matches.", why: "Puts your most important rules first in the index and task suggestions.", limitations: "Priority changes ordering only. It cannot force an agent to obey a rule.", example: "Set a core review standard to 95 and a niche example to 60." },
    field_status: { title: "Status", group: "Record editor \u00b7 field", what: "Whether agents can receive this record: Active, Draft or Archived.", how: "Only Active records are sent in the startup index and returned by discovery. Draft and Archived records stay in the library and history.", why: "Lets you work on a rule without agents seeing it yet, or retire one without deleting it.", limitations: "Projects that already selected a now-archived record keep the selection until you change it.", example: "Save a new palette as Draft, review it, then switch it to Active." },
    library: { what: "Examples for all personal working style domains.", how: "Use the sample library loader to add missing example records. It never replaces titles already present.", why: "Provide concrete starting material for drawing, writing, architecture and review.", limitations: "These are editable examples, not universal rules or project knowledge.", example: "Seed Mermaid syntax guidance, editable draw.io procedures, review rubrics and UI standards." },
    trace_reverse: { what: "Find all observed events that mention one selected knowledge record.", how: "Choose a preference or skill. Trace Explorer filters by its record ID and shows the recorded version used in each event.", why: "Check whether a specific rule was actually delivered or requested over time.", limitations: "An event referencing a rule is not proof the agent complied with it.", example: "Select 'Editable draw.io architecture style' and find relevant Claude and Codex hook deliveries." },
    trace_demo: { what: "Clearly marked synthetic trace walkthroughs.", how: "Create example Claude and Codex timelines, then enable Show demos. Demo events are stored separately from live statistics and may be removed.", why: "Understand trace data before connecting real agents.", limitations: "Demonstrations are not real Claude or Codex activity.", example: "A sample diagram flow shows session hook, task hook, discover, get and review." },
    fields: { what: "The schema for a personal style record.", how: "Type selects skill, preference, example, review or tool. Domain and tags drive retrieval. Priority affects ordering. Status controls agent visibility; saving creates a revision.", why: "Well-structured records improve discovery and allow safe rollback.", limitations: "Do not store passwords or project secrets in personal style records.", example: "Type Skill; domain Diagrams; tags drawio, architecture; priority 95." },
    revision: { what: "Immutable history for a single style record.", how: "Updating or restoring always creates a new version while preserving old snapshots.", why: "You can test improvements and recover a previous style rule.", limitations: "Restoring rules does not undo output already generated by an agent.", example: "Restore a compact layout rule from v2 while keeping v3 and v4 in history." },
    baseline: { what: "Compact record index loaded at agent startup.", how: "Bootstrap lists active style titles, IDs and versions within a character budget. brain_get retrieves full instructions and required links on demand.", why: "Keep routine context small while preserving essential working standards.", limitations: "The index may omit records when its budget is reached; discovery can find them.", example: "Startup identifies writing and architecture styles; the agent retrieves only styles relevant to its task." },
    review_simulator: { what: "Test text validation locally before using the rule with an agent.", how: "Paste content, choose a domain and run stored deterministic checks.", why: "See what automated checks can detect and what still needs a human inspection.", limitations: "It is not a full document or diagram renderer.", example: "Paste a BRD containing TBD and inspect the failure." }
};
const helpTitle = (key) => HELP[key]?.title || labels[key] || key.replace(/_/g, " ").replace(/\b\w/g, s => s.toUpperCase());
const infoButton = (key) => `<button type="button" class="info-button" data-info="${esc(key)}" aria-label="About ${esc(helpTitle(key))}" title="About ${esc(helpTitle(key))}">i</button>`;
function showHelp(key) {
    const entry = HELP[key] || HELP.overview;
    $("helpTitle").textContent = helpTitle(key);
    $("helpGroup").textContent = entry.group || "How Personal Brain works";
    $("helpContent").innerHTML = [
        ["What it does", entry.what], ["How it works", entry.how], ["Why it matters", entry.why], ["Example", entry.example], ["Limits and evidence", entry.limitations]
    ].map(([title, text]) => `<section class="help-part"><h3>${esc(title)}</h3><p>${esc(text)}</p></section>`).join("");
    $("helpDialog").showModal();
}
let page = 1;
let libraryMode = "table";
const pageSize = 8;
function pageItems(rows) { page = Math.max(1, Math.min(page, Math.ceil(rows.length / pageSize) || 1)); return rows.slice((page - 1) * pageSize, page * pageSize); }
function pagination(total) { const pages = Math.ceil(total / pageSize); return pages > 1 ? `<nav class="pagination" aria-label="Results pages"><span>Page ${page} of ${pages} · ${total} records</span><button class="button ghost small" data-page="${page - 1}" ${page === 1 ? "disabled" : ""}>Previous</button><button class="button ghost small" data-page="${page + 1}" ${page === pages ? "disabled" : ""}>Next</button></nav>` : ""; }
let toastTimer;
function toast(message) { const el = $("toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3200); }
async function api(url, options = {}) {
    const result = await fetch(url, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
    if (!result.ok) {
        let data = {};
        try {
            data = await result.json();
        }
        catch { }
        throw new Error(data.message || `Request failed ${result.status}`);
    }
    return result.json();
}
function layout(title, desc, action = "", body = "") {
    updateUrl();
    main.innerHTML = `<div class="hero"><div><div class="title-with-info"><h1>${esc(title)}</h1>${infoButton(active)}</div><p>${esc(desc)}</p></div>${action}</div>${body}`;
    $("breadcrumb").textContent = title;
}
function styleContract(r) { return (r.useWhen ? `<h4>Use when</h4><p>${esc(r.useWhen)}</p>` : "") + [["Principles", r.principles], ["Required external skills", r.externalSkills], ["Worked examples", r.examples], ["Review criteria", r.reviewCriteria], ["Mandatory requirements", r.requirements?.map(x => x.label + (x.extension ? " (" + x.extension + " file required)" : ""))]].map(([title, values]) => Array.isArray(values) && values.length ? `<h4>${title}</h4><ul>${values.map(v => `<li>${esc(v)}</li>`).join("")}</ul>` : "").join(""); }
function recordTable(rows) {
    if (!rows.length)
        return empty("No records yet", "Create your first record, or adjust your search.");
    return `<div class="table-scroll"><table class="record-table"><thead><tr><th scope="col">Name &amp; instructions</th><th scope="col">Capability type</th><th scope="col">References</th><th scope="col">Status</th><th scope="col">Version</th><th scope="col">Actions</th></tr></thead><tbody>${rows.map(item => `<tr><td><strong>${esc(item.title)}</strong><p>${esc(item.summary)}</p>${item.skillWarnings?.length ? `<details class="skill-warning"><summary>${skillIssueLabel(item.skillWarnings)}</summary><ul>${item.skillWarnings.map(w => `<li>${skillWarningExplanation(w)}</li>`).join("")}</ul></details>` : ""}<details class="table-details"><summary>Read instructions</summary><pre>${esc(item.content)}</pre>${styleContract(item)}${item.requiredIds?.length ? `<p>Required-linked: ${item.requiredIds.map(id => esc(items.find(r => r.id === id)?.title || id)).join(", ")}</p>` : ""}</details></td><td>${esc(domainName(item.domain))}</td><td><button class="button ghost small" data-dependencies="${esc(item.id)}" aria-label="Manage dependencies for ${esc(item.title)}">${item.requiredIds?.length || 0} linked records</button><p class="reference-counts">${item.externalSkills?.length || 0} skills · ${item.reviewCriteria?.length || 0} rules · ${item.examples?.length || 0} examples</p></td><td><span class="tag">${esc(item.status)}</span></td><td>v${item.version}</td><td><div class="row-actions">${iconAction('edit', 'Edit ' + item.title, `data-edit="${esc(item.id)}"`)}${iconAction('history', 'History of ' + item.title, `data-history="${esc(item.id)}"`)}${iconAction('remove', 'Delete ' + item.title, `data-remove-kind="record" data-remove-id="${esc(item.id)}"`)}${item.projectId && active === "projects" ? `<button class="button ghost small" data-publish="${item.id}">Publish to global</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div>`;
}
let selectedGraphNode = "";
let graphShowContents = false;
let graph3d = false, graphYaw = 0, graphPitch = 0, graphSize = 1000;
let graphPoints = new Map();
let graphOwners = new Map();
const graphTypeNames = { preference: "Style", skill: "Skill", review: "Review rule", example: "Example", tool: "Tool" };
let graphRecords = new Map();
function dependencyMap(roots) {
    selectedGraphNode = "";
    if (!roots.length)
        return empty("No matching styles", "Adjust your search or create a style.");
    const nodes = new Map();
    const collect = (r) => { if (nodes.has(r.id))
        return; nodes.set(r.id, r); for (const id of r.requiredIds || []) {
        const linked = items.find(i => i.id === id);
        collect(linked || { id, title: "Unavailable dependency", domain: "unknown", status: "unavailable", requiredIds: [] });
    } };
    roots.forEach(collect);
    const styleCount = nodes.size;
    graphRecords = new Map(nodes);
    graphOwners = new Map();
    if (graphShowContents)
        for (const parent of [...nodes.values()]) {
            const root = { ...parent, requiredIds: [...(parent.requiredIds || [])] };
            nodes.set(root.id, root);
            for (const [kind, values] of [["skill", root.externalSkills], ["review", root.reviewCriteria], ["example", root.examples]]) {
                values?.forEach((value, index) => {
                    const id = `${root.id}:${kind}:${index}`;
                    root.requiredIds.push(id);
                    graphOwners.set(id, root.id);
                    const node = { ...parent, id, kind, title: value, summary: `${graphTypeNames[kind]} belonging to ${parent.title}`, content: value, domain: parent.domain, status: "reference", requiredIds: [], externalSkills: [], reviewCriteria: [], examples: [], principles: [] };
                    nodes.set(id, node);
                    graphRecords.set(id, node);
                });
            }
        }
    const links = [...nodes.values()].flatMap(r => (r.requiredIds || []).map(id => ({ from: r.id, to: id })));
    graphYaw = 0;
    graphPitch = 0;
    const radius = Math.max(280, Math.sqrt(nodes.size) * 115);
    const width = radius * 2 + 240, height = width;
    graphSize = width;
    graphPoints = new Map();
    const entries = [...nodes.values()];
    entries.forEach((r, i) => { const angle = i * 2.399963, spread = radius * Math.sqrt((i + .5) / entries.length); graphPoints.set(r.id, { x: spread * Math.cos(angle), y: spread * Math.sin(angle), z: radius * .4 * Math.sin(i * 1.7) }); });
    for (let pass = 0; pass < 100; pass++) {
        for (let i = 0; i < entries.length; i++)
            for (let j = i + 1; j < entries.length; j++) {
                const a = graphPoints.get(entries[i].id), b = graphPoints.get(entries[j].id);
                let dx = b.x - a.x, dy = b.y - a.y;
                const d = Math.hypot(dx, dy) || 1;
                if (d < 190) {
                    const push = (190 - d) * .08;
                    dx = dx / d * push;
                    dy = dy / d * push;
                    a.x -= dx;
                    a.y -= dy;
                    b.x += dx;
                    b.y += dy;
                }
            }
        for (const link of links) {
            const a = graphPoints.get(link.from), b = graphPoints.get(link.to);
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
            const pull = (d - 210) * .008;
            a.x += dx / d * pull;
            a.y += dy / d * pull;
            b.x -= dx / d * pull;
            b.y -= dy / d * pull;
        }
    }
    for (let pass = 0; pass < 40; pass++)
        for (let i = 0; i < entries.length; i++)
            for (let j = i + 1; j < entries.length; j++) {
                const a = graphPoints.get(entries[i].id), b = graphPoints.get(entries[j].id);
                const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
                if (d < 180) {
                    const shift = (180 - d) / 2 + .1;
                    a.x -= dx / d * shift;
                    a.y -= dy / d * shift;
                    b.x += dx / d * shift;
                    b.y += dy / d * shift;
                }
            }
    const positions = new Map([...graphPoints].map(([id, p]) => [id, projectGraphPoint(p)]));
    const edges = links.map(e => {
        const a = positions.get(e.from), b = positions.get(e.to);
        const distance = Math.hypot(b.x - a.x, b.y - a.y) || 1, dx = (b.x - a.x) / distance, dy = (b.y - a.y) / distance;
        const path = `M ${a.x + dx * 72 * a.scale} ${a.y + dy * 72 * a.scale} L ${b.x - dx * 78 * b.scale} ${b.y - dy * 78 * b.scale}`;
        return `<path class="dependency-edge" data-from="${esc(e.from)}" data-to="${esc(e.to)}" d="${path}" marker-end="url(#dependencyArrow)"><title>${esc(nodes.get(e.from)?.title)} ${graphOwners.has(e.to) ? "contains" : "requires"} ${esc(nodes.get(e.to)?.title)}</title></path>`;
    }).join("");
    const boxes = [...nodes.values()].map(r => { const p = positions.get(r.id); const label = r.title.length > 76 ? r.title.slice(0, 73) + "…" : r.title; return `<foreignObject data-graph-position="${esc(r.id)}" x="${p.x - 72}" y="${p.y - 72}" width="144" height="144" transform="translate(${p.x * (1 - p.scale)} ${p.y * (1 - p.scale)}) scale(${p.scale})"><div xmlns="http://www.w3.org/1999/xhtml" class="dependency-node graph-orb graph-type-${r.kind || "preference"} ${roots.some(root => root.id === r.id) ? "" : "dependency-context"}"><button type="button" data-graph-node="${esc(r.id)}" aria-pressed="false" title="${esc(r.title)}" aria-label="Explore ${esc(r.title)}"><strong>${esc(label)}</strong><small>${esc(graphTypeNames[r.kind] || "Style")}</small></button></div></foreignObject>`; }).join("");
    return `<p class="dependency-legend">Arrows mean “requires”, not execution order. ${styleCount} styles shown · ${nodes.size} total nodes. Select to highlight links and inspect content. Drag the background to ${graph3d ? 'rotate' : 'pan'}; drag nodes to arrange.</p><div class="graph-toolbar"><button class="button ghost small" data-graph-contents="toggle" aria-pressed="${graphShowContents}">${graphShowContents ? "Show styles only" : "Show all content nodes"}</button><div class="graph-key" aria-label="Node type legend">${Object.entries(graphTypeNames).map(([kind, label]) => `<span class="graph-key-item graph-type-${kind}"><i aria-hidden="true"></i>${label}</span>`).join("")}</div><div class="graph-controls" role="group" aria-label="Graph controls"><button class="button ghost small" data-graph-mode="2d" aria-pressed="${!graph3d}">2D</button><button class="button ghost small" data-graph-mode="3d" aria-pressed="${graph3d}">3D</button><button class="button ghost small" data-graph-orbit="left" aria-label="Rotate left">↶</button><button class="button ghost small" data-graph-orbit="right" aria-label="Rotate right">↷</button><button class="button ghost small" data-graph-zoom="in" aria-label="Zoom in">＋</button><button class="button ghost small" data-graph-zoom="out" aria-label="Zoom out">−</button><button class="button ghost small" data-graph-zoom="fit">Fit graph</button></div></div><div class="graph-workspace"><div class="dependency-canvas graph-explorer" tabindex="0" role="region" aria-label="Style dependency map"><svg id="dependencyGraph" data-size="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Required style relationships"><defs><marker id="dependencyArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dependency-arrow" d="M 0 0 L 10 5 L 0 10 z"/></marker></defs><g class="dependency-edges">${edges}</g>${boxes}</svg></div><aside id="graphDetails" class="graph-details" aria-label="Selected node details" hidden></aside></div>`;
}
function highlightDependencyNode(id) {
    selectedGraphNode = selectedGraphNode === id ? "" : id;
    const neighbors = new Set([selectedGraphNode]);
    document.querySelectorAll(".dependency-edge").forEach(edge => {
        const connected = edge.dataset.from === selectedGraphNode || edge.dataset.to === selectedGraphNode;
        edge.classList.toggle("is-highlighted", !!selectedGraphNode && connected);
        edge.classList.toggle("is-muted", !!selectedGraphNode && !connected);
        if (selectedGraphNode && connected) {
            neighbors.add(edge.dataset.from);
            neighbors.add(edge.dataset.to);
            edge.parentElement?.appendChild(edge);
        }
    });
    const detail = graphRecords.get(selectedGraphNode) || items.find(r => r.id === selectedGraphNode);
    if ($("graphDetails")) {
        $("graphDetails").hidden = !detail;
        $("graphDetails").innerHTML = detail ? `<div class="graph-drawer-head"><strong>Node details</strong><button class="button ghost small" data-action="graph-close" aria-label="Close node details">Close ×</button></div><h3>${esc(detail.title)}</h3><p>${esc(detail.summary)}</p>${detail.status === "reference" ? `<pre>${esc(detail.content)}</pre><button class="button ghost small" data-edit="${esc(graphOwners.get(detail.id) || "")}">Edit owning style</button>` : `<div class="row-actions"><button class="button ghost small" data-edit="${esc(detail.id)}">Edit style</button></div>${styleContract(detail)}`}` : "";
    }
    document.querySelectorAll("[data-graph-node]").forEach(node => {
        node.setAttribute("aria-pressed", String(node.dataset.graphNode === selectedGraphNode));
        node.classList?.toggle("is-linked", !!selectedGraphNode && neighbors.has(node.dataset.graphNode));
        node.classList?.toggle("is-muted", !!selectedGraphNode && !neighbors.has(node.dataset.graphNode));
    });
}
function closeGraphDetails() {
    const id = selectedGraphNode;
    if (!id)
        return;
    highlightDependencyNode(id);
    document.querySelectorAll("[data-graph-node]").forEach(node => { if (node.dataset.graphNode === id)
        node.focus(); });
}
function zoomGraph(action) {
    const svg = document.getElementById("dependencyGraph");
    if (!svg)
        return;
    const size = Number(svg.dataset.size), v = (svg.getAttribute("viewBox") || "").split(" ").map(Number);
    if (action === "fit") {
        const points = [...graphPoints.values()].map(projectGraphPoint);
        if (points.length) {
            const minX = Math.min(...points.map(p => p.x - 90 * p.scale)), minY = Math.min(...points.map(p => p.y - 90 * p.scale)), maxX = Math.max(...points.map(p => p.x + 90 * p.scale)), maxY = Math.max(...points.map(p => p.y + 90 * p.scale));
            const span = Math.max(maxX - minX, maxY - minY);
            svg.setAttribute("viewBox", `${(minX + maxX - span) / 2} ${(minY + maxY - span) / 2} ${span} ${span}`);
        }
        else
            svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
        return;
    }
    const width = Math.max(size / 5, Math.min(size * 2, v[2] * (action === "in" ? .8 : 1.25)));
    svg.setAttribute("viewBox", `${v[0] + (v[2] - width) / 2} ${v[1] + (v[3] - width) / 2} ${width} ${width}`);
}
function projectGraphPoint(p) {
    const yaw = graph3d ? graphYaw : 0, pitch = graph3d ? graphPitch : 0;
    const x = p.x * Math.cos(yaw) + p.z * Math.sin(yaw), z = -p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
    const y = p.y * Math.cos(pitch) - z * Math.sin(pitch), depth = p.y * Math.sin(pitch) + z * Math.cos(pitch);
    const scale = graph3d ? 1 / (1 + depth / (graphSize * 2)) : 1;
    return { x: graphSize / 2 + x * scale, y: graphSize / 2 + y * scale, scale, depth };
}
function updateGraphProjection() {
    const positions = new Map([...graphPoints].map(([id, p]) => [id, projectGraphPoint(p)]));
    document.querySelectorAll("[data-graph-position]").forEach(node => {
        const p = positions.get(node.dataset.graphPosition);
        if (!p)
            return;
        node.setAttribute("x", String(p.x - 72));
        node.setAttribute("y", String(p.y - 72));
        node.setAttribute("transform", `translate(${p.x * (1 - p.scale)} ${p.y * (1 - p.scale)}) scale(${p.scale})`);
    });
    document.querySelectorAll(".dependency-edge").forEach(edge => {
        const a = positions.get(edge.dataset.from), b = positions.get(edge.dataset.to);
        if (!a || !b)
            return;
        const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, dx = (b.x - a.x) / d, dy = (b.y - a.y) / d;
        edge.setAttribute("d", `M ${a.x + dx * 72 * a.scale} ${a.y + dy * 72 * a.scale} L ${b.x - dx * 78 * b.scale} ${b.y - dy * 78 * b.scale}`);
    });
}
let graphDragged = false;
let graphPan = null;
document.addEventListener("pointerdown", event => {
    const target = event.target, svg = target.closest("#dependencyGraph");
    if (!svg || event.button !== 0)
        return;
    const view = (svg.getAttribute("viewBox") || "").split(" ").map(Number), rect = svg.getBoundingClientRect();
    event.preventDefault();
    target.closest("[data-graph-node]")?.focus();
    graphDragged = false;
    graphPan = { svg, x: event.clientX, y: event.clientY, view, scale: view[2] / Math.min(rect.width, rect.height), node: target.closest("[data-graph-node]")?.dataset.graphNode, yaw: graphYaw, pitch: graphPitch };
});
document.addEventListener("pointermove", event => {
    if (!graphPan)
        return;
    const { svg, x, y, view, scale, node, yaw, pitch } = graphPan;
    const dx = event.clientX - x, dy = event.clientY - y;
    if (Math.abs(dx) + Math.abs(dy) < 4)
        return;
    graphDragged = true;
    svg.setPointerCapture(event.pointerId);
    if (node) {
        const p = graphPoints.get(node);
        if (p) {
            const projection = projectGraphPoint(p), sx = dx * scale / projection.scale, sy = dy * scale / projection.scale;
            const cy = graph3d ? Math.cos(graphYaw) : 1, syaw = graph3d ? Math.sin(graphYaw) : 0, cp = graph3d ? Math.cos(graphPitch) : 1, sp = graph3d ? Math.sin(graphPitch) : 0;
            p.x += sx * cy + sy * sp * syaw;
            p.y += sy * cp;
            p.z += sx * syaw - sy * sp * cy;
            updateGraphProjection();
        }
        graphPan.x = event.clientX;
        graphPan.y = event.clientY;
    }
    else if (graph3d) {
        graphYaw = yaw + dx * .008;
        graphPitch = pitch + dy * .008;
        updateGraphProjection();
    }
    else
        svg.setAttribute("viewBox", `${view[0] - dx * scale} ${view[1] - dy * scale} ${view[2]} ${view[3]}`);
});
document.addEventListener("pointerup", () => { graphPan = null; });
document.addEventListener("pointercancel", () => { graphPan = null; graphDragged = false; });
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && selectedGraphNode && !event.target.closest("dialog")) {
        event.preventDefault();
        closeGraphDetails();
        return;
    }
    const target = event.target;
    if (!target.closest(".graph-explorer") || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
        return;
    event.preventDefault();
    const id = target.closest("[data-graph-node]")?.dataset.graphNode;
    const dx = event.key === "ArrowLeft" ? -20 : event.key === "ArrowRight" ? 20 : 0, dy = event.key === "ArrowUp" ? -20 : event.key === "ArrowDown" ? 20 : 0;
    if (id) {
        const point = graphPoints.get(id);
        if (point) {
            point.x += dx;
            point.y += dy;
        }
    }
    else if (graph3d) {
        graphYaw += dx * .01;
        graphPitch += dy * .01;
    }
    else {
        const svg = document.getElementById("dependencyGraph");
        if (svg) {
            const v = (svg.getAttribute("viewBox") || "").split(" ").map(Number);
            svg.setAttribute("viewBox", `${v[0] + dx} ${v[1] + dy} ${v[2]} ${v[3]}`);
        }
    }
    updateGraphProjection();
});
document.addEventListener("wheel", event => {
    if (!event.target.closest("#dependencyGraph"))
        return;
    event.preventDefault();
    zoomGraph(event.deltaY < 0 ? "in" : "out");
}, { passive: false });
async function refresh() {
    try {
        summary = await api("/api/summary");
        items = (await api("/api/items")).filter(r => r.status !== "archived");
        await render();
    }
    catch (e) {
        summary = null;
        layout("Local server unavailable", "Start the server in Terminal, then retry.", "", `<div class="card panel"><p role="alert">${esc(e instanceof Error ? e.message : "Could not load local data.")}</p><button class="button primary space-top-16" data-action="retry">Retry</button></div>`);
    }
}
async function render() {
    if (!summary)
        return refresh();
    if (["discover", "baseline", "review_simulator"].includes(active))
        diagnosticProjects = await api("/api/projects");
    document.querySelectorAll("[data-view]").forEach(el => el.classList.toggle("active", el.dataset.view === (["preference", "skill", "example", "review"].includes(active) ? "preference" : active)));
    if (["discover", "baseline"].includes(active) && $("advancedNav"))
        $("advancedNav").open = true;
    if (active === "projects")
        return projectScreen();
    if (active === "overview")
        return overview();
    if (active === "fusion")
        return fusionScreen();
    if (active === "domains")
        return domainsScreen();
    if (active === "discover" || active === "baseline" || active === "review_simulator")
        return discover();
    if (active === "activation")
        return activation();
    if (active === "feedback")
        return feedback();
    if (active === "history")
        return activity();
    if (active === "trace")
        return traceExplorer();
    records(active);
}
let domainEditing = "", newDomainDraft = "";
const domainDrafts = new Map();
function domainsScreen() {
    const registry = domainRegistry().filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
    layout("Capabilities", "Manage the capabilities shown on your overview and used to organize styles.", '<div class="page-actions"><button class="button ghost" data-view="preference">Back to library</button><button class="button primary" data-action="capability-add">＋ Add capability</button></div>', `<p id="domainError" class="form-error" role="alert"></p><form id="capabilitySearchForm" class="toolbar"><input id="capabilitySearch" class="search" type="search" aria-label="Search capabilities" placeholder="Search capabilities…" value="${esc(search)}" /></form><p class="results-count">${registry.length} capabilities</p><div class="table-scroll"><table class="record-table domains-table"><thead><tr><th scope="col">Capability type</th><th scope="col">Styles</th><th scope="col">Skills</th><th scope="col">Examples</th><th scope="col">Rules</th><th scope="col">Projects</th><th scope="col">Actions</th></tr></thead><tbody>${pageItems(registry).map(d => `<tr class="project-link-row" data-capability-row="${esc(d.id)}"><td>${domainEditing === d.id ? `<form id="domainRename"><label class="sr-only" for="domain-${esc(d.id)}">New name for ${esc(d.name)}</label><input id="domain-${esc(d.id)}" value="${esc(domainDrafts.get(d.id) ?? d.name)}" required maxlength="60" /></form>` : `<a href="#/library?domain=${encodeURIComponent(d.id)}"><strong>${esc(d.name)}</strong></a>${domainDrafts.has(d.id) ? '<small>Unsaved name</small>' : ''}`}</td><td>${d.styles || 0}</td><td>${d.skills || 0}</td><td>${d.examples || 0}</td><td>${d.rules || 0}</td><td>${d.projects || 0}</td><td><div class="row-actions">${domainEditing === d.id ? `<button type="submit" form="domainRename" class="button primary small">Save</button><button type="button" class="button ghost small" data-cancel-domain="${esc(d.id)}">Cancel</button>` : `<button type="button" class="button ghost small" data-edit-domain="${esc(d.id)}" aria-label="Rename ${esc(d.name)}">Rename</button><button type="button" class="button ghost small" data-remove-kind="domain" data-remove-id="${esc(d.id)}">Delete</button>`}</div></td></tr>`).join("")}</tbody></table></div>${pagination(registry.length)}<p class="hint">Counts cover shared, non-archived records and their linked content. Skills count declared requirements, not installations. Projects count active selections and required dependencies. Private styles are excluded.</p>`);
    $("capabilitySearch").addEventListener("input", () => { const input = $("capabilitySearch"); const start = input.selectionStart, end = input.selectionEnd; search = input.value; page = 1; updateUrl(true); domainsScreen(); const next = $("capabilitySearch"); next.focus(); if (start !== null && start !== undefined)
        next.setSelectionRange(start, end); });
    $("capabilitySearchForm").addEventListener("submit", ev => { ev.preventDefault(); search = $("capabilitySearch").value; page = 1; domainsScreen(); });
    if (domainEditing && $("domainRename")) {
        $("domain-" + domainEditing).addEventListener("input", () => { domainDrafts.set(domainEditing, $("domain-" + domainEditing).value); });
        $("domainRename").addEventListener("submit", ev => { ev.preventDefault(); void saveDomainName(domainEditing); });
    }
}
async function saveDomainName(id) {
    try {
        const name = $(id ? "domain-" + id : "domainName").value;
        await api("/api/domains" + (id ? "/" + encodeURIComponent(id) : ""), { method: id ? "PUT" : "POST", body: JSON.stringify({ name, expectedName: id ? domainName(id) : undefined }) });
        summary = await api("/api/summary");
        $("domainError").textContent = "";
        if (id) {
            domainDrafts.delete(id);
            domainEditing = "";
        }
        else {
            newDomainDraft = "";
            $("capabilityDialog").close();
        }
        await render();
        toast(id ? "Capability type renamed" : "Capability type created");
    }
    catch (e) {
        $(id ? "domainError" : "capabilityCreateError").textContent = e instanceof Error ? e.message : String(e);
    }
}
function overview() {
    const s = summary;
    const recent = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
    layout("Overview", "Manage shared instructions and the styles each project uses.", `<button class="button primary" data-view="projects">Open projects</button>`, `<section class="metrics">${[
        ["✦", s.counts.preference, "My Styles", "Global working principles"],
        ["▦", items.filter(r => r.kind === "preference").reduce((n, r) => n + (r.externalSkills?.length || 0), 0), "Required external skills", "Defined within My Styles"],
        ["✓", items.filter(r => r.kind === "preference").reduce((n, r) => n + (r.reviewCriteria?.length || 0), 0), "Style review criteria", "Defined within My Styles"],
        ["↺", s.revisions, "Revisions", "Versioned changes"]
    ].map(a => `<div class="card metric"><h2>${a[1]}</h2><div class="field-caption"><button class="link-btn" data-view="${a[2] === "Revisions" ? "history" : "preference"}">${a[2]}</button>${infoButton({ "My Styles": "preference", "Required external skills": "external_skills", "Style review criteria": "review_criteria", "Revisions": "revisions_metric" }[String(a[2])] || "preference")}</div><p>${a[3]}</p></div>`).join("")}</section>
  <section class="columns"><div class="card panel"><div class="panel-head"><div><h2>Knowledge library ${infoButton("knowledge_library")}</h2><p>Your most recent personal rules and skills</p></div><button class="link-btn" data-view="preference">Browse library →</button></div>${recent.map(r => `<div class="activity-line"><div class="activity-text"><button class="link-btn recent-record" data-edit="${esc(r.id)}">${esc(r.title)}</button><p>${esc(domainName(r.domain))} · ${esc(r.kind)} · v${r.version}</p></div><span class="activity-time">${esc(formatTime(r.updatedAt))}</span></div>`).join("") || empty("No records", "Create your first style to get started")}</div>
  <div><div class="card panel"><h3>Capabilities</h3><div class="cap-list">${domainRegistry().map(d => `<a class="cap-pill" href="#/library?domain=${encodeURIComponent(d.id)}">${esc(d.name)}</a>`).join("")}</div><p class="capability-note">Library records are reusable. Projects select the instructions that apply to their work.</p></div></div></section>`);
}
function records(kind) {
    items = items.filter(r => !r.projectId);
    const matches = [...items].sort((a, b) => Number(b.tags.includes("style-recipe")) - Number(a.tags.includes("style-recipe"))).filter(r => r.kind === kind && (domain === "all" || r.domain === domain) && (!search || [r.title, r.summary, r.useWhen || "", r.content, ...r.tags].join(" ").toLowerCase().includes(search.toLowerCase())));
    const desc = { preference: "Create and manage the working styles you want Claude and Codex to use.", skill: "Discoverable procedures that guide how agents perform specialized tasks.", example: "Approved references that demonstrate your preferred output quality.", review: "Reusable quality rules with optional deterministic validation checks.", tool: "Discoverable MCP capabilities. External invocation is disabled until you explicitly authorize it." };
    const toolbar = `<div class="toolbar">${kind !== "tool" ? '<select id="libraryType" class="select" aria-label="Record type">' + ["preference", "skill", "example", "review"].map(k => '<option value="' + k + '" ' + (k === kind ? "selected" : "") + '>' + kindLabel(k) + '</option>').join("") + '</select>' : ""}<input id="searchBox" aria-label="Search records" class="search" type="search" placeholder="Search ${esc(kindLabel(kind))} records..." value="${esc(search)}" /><select id="domainFilter" aria-label="Filter by capability type" class="select"><option value="all">All capabilities</option>${domainOptions(domain)}</select></div>`;
    const visible = pageItems(matches);
    layout(kind === "tool" ? labels[kind] : "Library", desc[kind], `<div class="page-actions"><div class="view-toggle" role="group" aria-label="Library view"><button class="button ghost" data-library-mode="table" aria-pressed="${libraryMode === "table"}">Table</button><button class="button ghost" data-library-mode="map" aria-pressed="${libraryMode === "map"}">Dependency map</button></div><button class="button primary" data-action="add">＋ New ${esc(kindLabel(kind))}</button></div>`, `${toolbar}<p class="results-count">${matches.length} records · ${domain === "all" ? "All capabilities" : esc(domainName(domain))}</p><section class="record-list">${libraryMode === "map" ? dependencyMap(matches) : recordTable(visible)}</section><div id="recordPagination">${libraryMode === "map" ? "" : pagination(matches.length)}</div>`);
    $("libraryType")?.addEventListener("change", ev => { active = ev.target.value; page = 1; search = ""; domain = "all"; records(active); });
    const sb = $("searchBox");
    sb?.addEventListener("input", () => { search = sb.value; page = 1; updateUrl(true); const container = document.querySelector(".record-list"); if (container) {
        const found = items.filter(r => r.kind === kind && (domain === "all" || r.domain === domain) && [r.title, r.summary, r.useWhen || "", r.content, ...r.tags].join(" ").toLowerCase().includes(search.toLowerCase()));
        const count = document.querySelector(".results-count");
        if (count)
            count.textContent = String(found.length) + " records · " + (domain === "all" ? "All capabilities" : domainName(domain));
        container.innerHTML = libraryMode === "map" ? dependencyMap(found) : recordTable(pageItems(found));
        $("recordPagination").innerHTML = libraryMode === "map" ? "" : pagination(found.length);
    } });
    $("domainFilter")?.addEventListener("change", ev => { domain = ev.target.value; page = 1; records(kind); });
}
let selectedProject = null;
let projectEditing = false;
let projectTab = "styles";
async function repositoryRequest(projectId, folder, action) {
    for (let attempt = 0;; attempt++) {
        try {
            return await api(`/api/projects/${projectId}/repository`, { method: "POST", body: JSON.stringify({ folder, action }) });
        }
        catch (e) {
            if (!(e instanceof TypeError))
                throw e;
            if (attempt === 3)
                throw new Error("Cannot reach the local server. Check that npm start is running, wait for the server URL in Terminal, then retry. Your folder path has been kept.");
            $("repositoryResult").textContent = "Waiting for the local server to restart…";
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
    }
}
function iconAction(icon, label, attribute) {
    const paths = { open: '<path d="M4 12h16 m-6-6 6 6-6 6"/>', edit: '<path d="m16 3 5 5-12 12H4v-5L16 3Z M14 5l5 5"/>', history: '<path d="M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2"/>', publish: '<path d="M12 16V3 m-5 5 5-5 5 5 M4 15v6h16v-6"/>', remove: '<path d="M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7"/>' };
    return `<button type="button" class="button ghost icon-action" ${attribute} aria-label="${esc(label)}" title="${esc(label)}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[icon]}</svg><span class="action-tooltip" aria-hidden="true">${esc(label)}</span></button>`;
}
function projectStyleActions(r) {
    return `<div class="row-actions project-style-actions">${iconAction('edit', 'Edit for project', `data-edit="${esc(r.id)}"`)}${iconAction('history', 'History', `data-history="${esc(r.id)}"`)}${r.projectId ? iconAction('publish', 'Publish to global', `data-publish="${esc(r.id)}"`) + iconAction('remove', 'Delete private style', `data-remove-kind="record" data-remove-id="${esc(r.id)}"`) : ''}</div>`;
}
function projectOnboardingPrompt(id) {
    return `Personalize the selected styles for Personal Brain project ${id} from this existing repository.

1. Use projectId "${id}" on every Personal Brain call. Call brain_discover_project to read the linked repository evidence and selected styles. Discovery itself is read-only. If no styles are selected or the repository link is wrong, report that before making changes.
2. Inspect repository instructions, architecture documents and ADR amendments, representative backend/frontend code, tests and build configuration. Use files/fileOffset to retrieve additional evidence as needed. Extract established conventions, not proposed improvements. Preserve explicit amendments over superseded rules; flag unresolved contradictions.
3. Read selected styles and required links with brain_get; use brain_projects for the current project version. Preserve existing personal edits. Check installed skill references; report missing or ambiguous skills instead of inventing links.
4. Amend only selected styles where source evidence justifies a change. Include discovery keywords and Use when, principles, instructions, required skills, concrete examples and review criteria where relevant. Use brain_update_project_style with expectedVersion, expectedProjectVersion and sourceFiles containing the current file/digest pairs from discovery. Supply conflicts: [] only after resolving conflicts; leave affected styles unchanged when conflicts remain.
5. Shared styles must become project-private copies; existing private styles update in place. Keep the updated styles selected. Do not change global styles, other projects, capability types or repository source files. Do not create generic drafts. Refresh discovery and versions after each update; skip unchanged styles.
6. Verify with scoped brain_discover and brain_get. Report changed style titles/versions, source evidence, preserved dependencies, unresolved conflicts and missing skills. Distinguish changes saved in Personal Brain from suggestions that were not applied.`;
}
function projectAgentGuide(id) {
    return `<section class="agent-guide"><h3>Connect and personalize</h3><p>Link your source folder, then adapt selected styles using repository evidence.</p>
    <ol class="setup-steps">
    <li><strong>Connect your repository</strong><div class="repository-field"><label for="repositoryFolder">Repository folder (absolute path)</label><input id="repositoryFolder" placeholder="/path/to/your/repository" spellcheck="false" autocomplete="off" /></div><div class="page-actions"><button type="button" class="button primary small" data-action="repository-link">Link repository</button><button type="button" class="button ghost small" data-action="repository-test">Test connection</button></div><p id="repositoryResult" role="status" aria-live="polite"></p></li>
    <li><strong>Personalize with your agent</strong><p>Select starting styles in <button class="link-btn" data-action="project-edit">Configure project</button>, then open this repository in Codex or Claude. Copy the prompt into that session.</p><button type="button" class="button primary small" data-copy-onboarding="${esc(id)}">Copy onboarding prompt</button><details><summary>Preview prompt</summary><pre>${esc(projectOnboardingPrompt(id))}</pre></details><p class="hint">Linking alone does not analyze your source. The agent reads evidence and updates project-only copies; global versions stay unchanged.</p></li>
    <li><strong>Review the result</strong><p>Refresh the Styles tab to inspect project-only changes and selection status. Check dependencies in the map and observed calls in Trace Explorer.</p><details><summary>What to verify</summary><p>Review source evidence, unresolved conflicts and missing skills. Amended active styles stay selected. Separately created drafts need activation and selection. Startup provides a compact index; full instructions load on demand.</p></details></li></ol>
    <details><summary>First-time agent setup &amp; troubleshooting</summary><p>Connect once after installing personal-brain-style with npm using Node.js 22.13 or newer:</p><pre>personal-brain doctor
personal-brain hooks install both</pre><p>Restart existing agent sessions after installation. Check registration with <code>codex mcp get personal-brain</code> or <code>claude mcp get personal-brain</code>.</p><p>Then open your linked repository and run <code>codex</code> or <code>claude</code>. Hooks read the host working folder. MCP uses its process working folder, or a supplied cwd when the client starts it elsewhere. Hooks tell the agent which projectId to use on subsequent calls.</p><p>Explicit projectId or PB_PROJECT_ID takes precedence over the nearest .personal-brain.json. Without either, global defaults apply. Invalid configuration produces an error. Selecting a project in this browser does not switch agent sessions.</p><p>If an IDE cannot supply the repository folder, tell the agent: Use projectId <code>${esc(id)}</code> on Personal Brain calls, starting with brain_bootstrap, then brain_discover and brain_get; apply requiredLinked instructions. Supply the actual host threadId when available. Check Trace Explorer for observed calls.</p><p>Linking writes this file without replacing a different existing link:</p><pre>${esc(JSON.stringify({ projectId: id }, null, 2))}</pre><p>The connection test checks configuration and resolves styles locally; it does not prove that an agent has connected. Draft styles are not applied.</p></details></section>`;
}
let removalPreview = null;
async function previewRemoval(kind, id) {
    const preview = await api(`/api/removal/${kind}/${id}`);
    removalPreview = preview;
    $("removalTitle").textContent = kind === "reset" ? "Reset project styles" : "Delete " + preview.title;
    $("removalContent").innerHTML = `<p>This permanently removes ${preview.records.length} record(s), their embedded skills/examples/rules, revisions, feedback and related trace events. ${preview.linkedRecords.length} surviving record(s) will have these dependency links removed; ${preview.projects.length} project(s) are affected. Shared dependencies are preserved.</p><details><summary>Affected links and projects</summary><ul>${preview.linkedRecords.map(r => `<li>Unlink: ${esc(r.title)}</li>`).join("")}${preview.projects.map(p => `<li>Project: ${esc(p.name)}</li>`).join("")}</ul></details><details><summary>Records to remove</summary><ul>${preview.records.map(r => `<li>${esc(r.title)}</li>`).join("") || "<li>None</li>"}</ul></details>${kind === "reset" ? `<p>All private styles and instruction overrides will be removed. Restore the shared selections saved before customization (or current shared selections if no baseline was saved):</p><ul>${preview.restored.map(r => `<li>${esc(r.title)}</li>`).join("") || "<li>No available shared selections</li>"}</ul><p>Automatic repository-personalization reminders are paused after reset. You can explicitly run discovery with your agent.</p>` : ""}${kind === "project" ? "<p>The project and its activity will be removed. Repository files are not deleted; remove its .personal-brain.json link before starting another session there.</p>" : ""}<p>This cannot be undone.</p>`;
    $("removalError").textContent = "";
    $("removalDialog").showModal();
}
function skillReferenceTable(data, references = data.references) { return `<div class="table-scroll"><table class="record-table skill-links-table"><thead><tr><th>Requested by style</th><th>Required skill</th><th>Installation match</th></tr></thead><tbody>${references.map(ref => `<tr><td><strong>${esc(ref.title || data.selectedStyles.find(r => r.id === ref.recordId)?.title || ref.recordId)}</strong><small>${data.selectedStyles.some(r => r.id === ref.recordId) ? 'Applied in this project' : 'Private record · not applied'}</small></td><td>${esc(ref.reference)}</td><td><strong>${ref.status === 'available' ? 'Found' : ref.status === 'ambiguous' ? 'Multiple different copies' : 'Missing'}</strong><p>${ref.status === 'available' ? 'Matching installation found.' : ref.status === 'ambiguous' ? 'These copies contain different instructions, so Personal Brain cannot choose one. Compare the paths below. Use your skill or plugin manager to keep the intended version, or install one chosen copy in this repository’s .agents/skills folder, which takes precedence. Then run discovery again.' : 'Install this skill or correct the reference in the style.'}</p>${ref.skills?.length ? `<details><summary>Matching installations (${ref.skills.length})</summary><ul>${ref.skills.map(skill => `<li>${esc(skill.scope)} · ${esc(skill.agent)}<code>${esc(skill.file)}</code></li>`).join('')}</ul></details>` : ''}</td></tr>`).join('') || '<tr><td colspan="3">No external skills are required by these styles.</td></tr>'}</tbody></table></div>`; }
async function showProjectDiscovery(recordId) {
    if (!selectedProject)
        return;
    const projectId = selectedProject.id;
    const dialog = $("discoveryDialog");
    $("projectDiscoveryTitle").textContent = recordId ? "Resolve required skills" : "Style requirements & installed skills";
    if (!dialog.open)
        dialog.showModal();
    $("projectDiscoveryContent").textContent = "Inspecting repository and installed skills…";
    try {
        const data = await api(`/api/projects/${projectId}/discovery`);
        if (recordId) {
            const references = data.references.filter(ref => ref.recordId === recordId && ref.status !== "available");
            $("projectDiscoveryContent").innerHTML = `<p>Only unresolved requirements for this style are shown. <strong>Missing</strong> means no matching installation was found; <strong>Multiple different copies</strong> means the reference does not identify one version.</p>${references.length ? skillReferenceTable(data, references) : '<p role="status">All required skills now have a matching installation.</p>'}<p class="hint">For a missing skill, install it or correct its name in the style’s Required external skills field. For conflicting copies, choose an installation as described above; a name alone cannot distinguish different copies. This scan does not install skills or prove they were used.</p>`;
            return;
        }
        const scanIssues = data.issues.filter(issue => !['missing-skill', 'ambiguous-skill'].includes(issue.type));
        $("projectDiscoveryContent").innerHTML = `<p>A style defines how you work. Its required skills name the procedures an agent should use. One style can require several skills, and the same skill can serve several styles.</p>
      <h3>Style → required skill</h3><p class="hint">These links come from each style's Required external skills field. An installed match does not mean the skill has been loaded or used.</p>
      ${skillReferenceTable(data)}
      <p class="hint">To change a requirement, close this dialog and edit that style's Required external skills field. This scan does not change links or install skills.</p>
      <details><summary>All detected installations (${data.skills.length}) — not automatically linked</summary><p>Inventory across global, agent and project locations. Most entries may be unrelated to this project.</p>
      <label for="installedSkillSearch">Search installations</label><input id="installedSkillSearch" type="search" placeholder="Filter by skill, scope or agent…">
      <div class="table-scroll"><table class="record-table"><thead><tr><th>Skill</th><th>Scope / agent</th></tr></thead><tbody id="installedSkillRows"></tbody></table></div><div class="pagination"><span id="installedSkillCount"></span><button id="installedSkillPrevious" class="button ghost small">Previous</button><button id="installedSkillNext" class="button ghost small">Next</button></div><p id="installedSkillEmpty" hidden>No matching skills.</p></details>
      ${scanIssues.length ? `<details><summary>Scan limitations and other findings (${scanIssues.length})</summary><p>Unreadable or oversized files were skipped; these messages do not mean those skills are required by a style.</p><ul>${scanIssues.map(issue => `<li>${esc(issue.message)}</li>`).join('')}</ul></details>` : ''}
      <details><summary>Personalize styles from repository source</summary><p>${esc(data.folder || 'Link a repository in Repository setup first.')}</p><p>The agent reads your source and amends selected styles using evidence. The scan itself makes no changes.</p><button type="button" class="button ghost small" data-copy-onboarding="${esc(projectId)}">Copy onboarding prompt</button><details><summary>Preview prompt</summary><pre>${esc(projectOnboardingPrompt(projectId))}</pre></details>
      <details><summary>Repository source index (${data.totalFiles} files${data.truncated ? ' · scan limit reached' : ''})</summary><ul>${data.files.map(file => `<li><code>${esc(file)}</code></li>`).join('')}</ul></details><p class="hint">${esc(data.limitations)}</p></details>`;
        let skillPage = 0;
        const renderSkills = () => {
            const query = $("installedSkillSearch").value.trim().toLowerCase();
            const matches = data.skills.filter(skill => (skill.name + " " + skill.scope + " " + skill.agent).toLowerCase().includes(query));
            $("installedSkillRows").innerHTML = matches.slice(skillPage * 20, (skillPage + 1) * 20).map(skill => `<tr><td><strong>${esc(skill.name)}</strong><details><summary>Location</summary><code>${esc(skill.file)}</code></details></td><td>${esc(skill.scope)} · ${esc(skill.agent)}</td></tr>`).join("");
            $("installedSkillCount").textContent = `Page ${skillPage + 1} of ${Math.max(1, Math.ceil(matches.length / 20))} · ${matches.length} skills`;
            $("installedSkillPrevious").disabled = skillPage === 0;
            $("installedSkillNext").disabled = (skillPage + 1) * 20 >= matches.length;
            $("installedSkillEmpty").hidden = matches.length > 0;
        };
        $("installedSkillSearch").addEventListener("input", () => { skillPage = 0; renderSkills(); });
        $("installedSkillPrevious").addEventListener("click", () => { skillPage--; renderSkills(); });
        $("installedSkillNext").addEventListener("click", () => { skillPage++; renderSkills(); });
        renderSkills();
    }
    catch (e) {
        $("projectDiscoveryContent").textContent = e instanceof Error ? e.message : String(e);
    }
}
function skillWarningExplanation(warning) {
    const missing = warning.endsWith(': missing');
    const reference = warning.replace(/: (missing|ambiguous)$/, '');
    return `<strong>${esc(reference)}</strong><p>${missing ? 'No matching installed skill was found. The style requires this procedure, but the agent cannot load it.' : 'Several installed copies have this name but different instructions. Personal Brain cannot choose which instructions the agent should follow.'}</p><p>${missing ? 'Install the required skill for your agent or project, or edit the style’s Required external skills field if the name is incorrect.' : 'Compare the matching installations in the project’s Discover styles &amp; skills dialog. Keep the intended version using your skill or plugin manager, or install one chosen copy in the repository’s .agents/skills folder, which takes precedence. Do not delete copies blindly.'}</p><p>After correcting the installation or reference, refresh this page to scan again.</p>`;
}
function skillIssueLabel(warnings) {
    const missing = warnings.filter(w => w.endsWith(": missing")).length;
    const ambiguous = warnings.length - missing;
    return [missing ? `${missing} missing skill${missing === 1 ? '' : 's'}` : '', ambiguous ? `${ambiguous} skill${ambiguous === 1 ? ' has' : 's have'} conflicting copies` : ''].filter(Boolean).join(' · ');
}
async function projectScreen() {
    if (selectedProject)
        items = (await api("/api/items?projectId=" + encodeURIComponent(selectedProject.id))).filter(r => r.status !== "archived");
    if (projectEditing) {
        projectForm();
        return;
    }
    if (selectedProject) {
        selectedProject = await api(`/api/projects/${selectedProject.id}`);
        let activity = null;
        let activityError = "";
        try {
            activity = await api(`/api/projects/${selectedProject.id}/activity`);
        }
        catch (e) {
            activityError = e instanceof Error ? e.message : String(e);
        }
        let resolved = [];
        let scopeError = "";
        try {
            resolved = await api(`/api/projects/${selectedProject.id}/resolved`);
        }
        catch (e) {
            scopeError = e instanceof Error ? e.message : String(e);
        }
        const skillIssues = items.flatMap(r => (r.skillWarnings || []).map(reference => ({ recordId: r.id, reference })));
        const tabs = `<nav class="project-tabs" aria-label="Project sections">${[['styles', 'Styles'], ['map', 'Dependency map'], ['activity', 'Agent activity'], ['setup', 'Repository setup']].map(([key, title]) => `<a href="#/projects/${encodeURIComponent(selectedProject.id)}${key === 'styles' ? '' : '?tab=' + key}" ${(projectTab === key || (key === 'styles' && projectTab === 'personal')) ? 'aria-current="page"' : ''}>${title}</a>`).join("")}</nav>`;
        const status = `<div class="project-status-strip"><span><strong>${selectedProject.assignments.length}</strong> selected</span><span><strong>${scopeError ? '—' : resolved.filter(r => r.source === 'Required dependency').length}</strong> required dependencies</span><span>${activityError ? 'Activity unavailable' : `<strong>${activity?.active ?? 0}</strong> recently active · <strong>${activity?.linked ?? 0}</strong> linked conversations`}</span></div>`;
        const availableStyles = [...resolved, ...items.filter(r => r.projectId === selectedProject.id && !resolved.some(selected => selected.id === r.id)).map(r => ({ ...r, source: "Not selected" }))];
        const styleRows = projectTab === "personal" ? availableStyles.filter(r => r.projectId === selectedProject.id) : availableStyles;
        const styles = `<div class="section-heading"><div><h2>Project styles</h2><p class="hint">Selected styles, dependencies and private records in one place. Private records marked Not selected are not applied.</p></div><button class="button ghost small" data-action="private-style">New personalized style</button></div>
      <div class="page-actions style-scope-toolbar" aria-label="Style scope"><a class="button ghost small" href="#/projects/${encodeURIComponent(selectedProject.id)}" ${projectTab === 'styles' ? 'aria-current="page"' : ''}>All instructions (${availableStyles.length})</a><a class="button ghost small" href="#/projects/${encodeURIComponent(selectedProject.id)}?tab=personal" ${projectTab === 'personal' ? 'aria-current="page"' : ''}>Private to this project (${availableStyles.filter(r => r.projectId === selectedProject.id).length})</a></div>
      ${scopeError ? `<p role="alert">${esc(scopeError)} <button class="button ghost small" data-action="project-edit">Review selections</button></p>` : ""}
      ${styleRows.length ? `<div class="table-scroll"><table class="record-table project-styles-table"><thead><tr><th scope="col">Instruction</th><th scope="col">Capability / type</th><th scope="col">Source</th><th scope="col">Actions</th></tr></thead><tbody>${pageItems(styleRows).map(r => `<tr><td><strong>${esc(r.title)}</strong>${skillIssues.some(issue => issue.recordId === r.id) ? `<p role="status"><button class="button ghost small" data-skill-issues="${esc(r.id)}">${skillIssueLabel(skillIssues.filter(issue => issue.recordId === r.id).map(issue => issue.reference))}</button></p>` : ""}<details class="table-details"><summary>Read instructions</summary><pre>${esc(r.content)}</pre>${styleContract(r)}</details></td><td>${esc(domainName(r.domain))}<p>${esc(kindLabel(r.kind))}</p></td><td><span class="tag">${esc(r.projectId ? "Project-only" : "Shared")}</span><p>${esc(r.source)} · ${esc(r.status)}</p></td><td>${projectStyleActions(r)}</td></tr>`).join("")}</tbody></table></div>${pagination(styleRows.length)}` : `<div class="selection-empty"><h2>${projectTab === 'personal' ? 'No project-only styles yet' : 'No styles selected'}</h2><p>Select shared styles in Configure project, or create a personalized style. Editing a shared selection creates a private copy.</p><button class="button ghost small" data-action="project-edit">Configure project</button></div>`}`;
        const content = projectTab === 'map' ? (scopeError ? `<p role="alert">${esc(scopeError)}</p>` : dependencyMap(resolved)) : (projectTab === 'personal' || projectTab === 'styles') ? styles : projectTab === 'activity' ? projectActivityPanel(activity, activityError) : `<div class="project-scope"><div class="project-id"><span class="chip">Project ID</span><code>${esc(selectedProject.id)}</code></div>${projectAgentGuide(selectedProject.id)}</div>`;
        layout(selectedProject.name, selectedProject.description && selectedProject.description !== selectedProject.name ? selectedProject.description : "Manage this project's working styles and agent connections.", `<div class="page-actions"><button class="button ghost" data-action="project-list">All projects</button><button class="button ghost" data-action="project-discovery">Discover styles &amp; skills</button><button class="button primary" data-action="project-edit">Configure project</button><details class="page-overflow"><summary class="button ghost">More</summary><div><button class="button ghost small" data-remove-kind="reset" data-remove-id="${esc(selectedProject.id)}">Reset styles</button><button class="button ghost small" data-remove-kind="project" data-remove-id="${esc(selectedProject.id)}">Delete project</button></div></details></div>`, status + tabs + content);
        if (projectTab === 'setup') {
            const agents = [...new Set((activity?.sessions || []).map(s => s.agent))];
            $("repositoryResult").textContent = agents.length ? "Observed agent calls: " + agents.join(", ") + ". This confirms prior use, not a live connection." : "No project-linked agent calls observed yet.";
            try {
                const state = await api(`/api/projects/${selectedProject.id}/repository`);
                $("repositoryFolder").value = state.folder;
                $("repositoryResult").textContent += (state.linked ? " Repository link verified." : " Repository link not verified.") + (state.error ? " " + state.error : "");
            }
            catch {
                $("repositoryResult").textContent += " Repository status unavailable.";
            }
        }
        return;
    }
    const projects = await api("/api/projects");
    const matches = () => projects.filter(p => [p.name, p.description].join(" ").toLowerCase().includes(search.toLowerCase()));
    const found = matches();
    layout("Projects", "Choose a project to manage its styles and agent connections.", '<button class="button primary" data-action="project-new">＋ New Project</button>', projects.length ? `<div class="toolbar project-list-toolbar"><input id="projectSearch" class="search" type="search" aria-label="Search projects" placeholder="Search projects…" value="${esc(search)}" /><span id="projectCount" class="hint" aria-live="polite">${found.length} of ${projects.length} projects</span></div><div id="projectList">${projectListTable(found)}</div><div id="projectPagination">${pagination(found.length)}</div><p class="hint project-activity-note">Recently active = an observed call in the last 15 minutes. Linked conversations are identified threads, not live connections.</p>` :
        empty("Create your first project", "Select reusable styles from your library, then link a repository to load them automatically."));
    $("projectSearch")?.addEventListener("input", () => { search = $("projectSearch").value; page = 1; const found = matches(); $("projectList").innerHTML = projectListTable(found); $("projectPagination").innerHTML = pagination(found.length); $("projectCount").textContent = `${found.length} of ${projects.length} projects`; updateUrl(true); });
}
function projectListTable(projects) {
    if (!projects.length)
        return empty("No matching projects", "Try a different project name.");
    return `<div class="table-scroll"><table class="record-table projects-table"><thead><tr><th scope="col">Project</th><th scope="col">Selections</th><th scope="col">Agent activity</th><th scope="col">Updated</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${pageItems(projects).map(p => `<tr class="project-link-row" data-project-row="${esc(p.id)}"><td><a class="project-title-link" href="#/projects/${encodeURIComponent(p.id)}">${esc(p.name)}</a>${p.description && p.description !== p.name ? `<p>${esc(p.description)}</p>` : ''}</td><td><span class="tag ${p.assignments.length ? '' : 'needs-selection'}">${p.assignments.length ? p.assignments.length + ' selected' : 'No styles selected'}</span></td><td>${p.activity ? `<strong>${p.activity.active} recently active</strong><p>${p.activity.linked} linked conversations</p>` : '<span class="hint">Not available</span>'}</td><td>${esc(formatTime(p.updatedAt))}</td><td><div class="row-actions project-list-actions">${iconAction('open', `Open ${p.name}`, `data-project="${esc(p.id)}"`)}${iconAction('remove', `Delete ${p.name}`, `data-remove-kind="project" data-remove-id="${esc(p.id)}"`)}</div></td></tr>`).join("")}</tbody></table></div>`;
}
function complianceReviewPanel(reviews) {
    const label = (status) => status === 'pass' ? 'Pass' : status === 'fail' ? 'Fail' : 'Not verified';
    return `<section class="project-scope"><h2>Compliance reviews</h2><p class="hint">Style retrieval is not compliance. These are historical checks for the listed style versions, not certification of the current project. Latest 20 reviews.</p>${reviews.length ? reviews.map(r => `<details><summary>${esc(r.task)} · ${label(r.status)} · ${esc(formatTime(r.at))}</summary><p>${esc(r.scope)}</p><p>${esc(r.note)}</p>${r.pendingTextChecks ? `<p>${r.pendingTextChecks} text checks not verified: no text supplied.</p>` : ""}<div class="table-scroll"><table class="record-table"><thead><tr><th>Style / requirement</th><th>Verified result</th><th>Agent evidence</th></tr></thead><tbody>${r.results.map(result => `<tr><td><strong>${esc(result.style)} · v${result.recordVersion}</strong>${esc(result.label)}</td><td>${label(result.status)}<p>${esc(result.verification)}</p>${result.artifacts.map(path => `<code>${esc(path)}</code>`).join('<br>')}</td><td>${result.agentReported ? 'Reported: ' + label(result.agentReported) : 'No agent report'}<p>${esc(result.note)}</p></td></tr>`).join('')}</tbody></table></div>${r.textFindings?.length ? `<details><summary>Automated text checks</summary><ul>${r.textFindings.map(f => `<li>${f.passed ? 'Pass' : 'Fail'}: ${esc(f.check)}</li>`).join('')}</ul></details>` : ''}</details>`).join('') : '<p>No compliance reviews recorded. Ask the agent to call brain_review with the task, applicable style IDs, artifact paths and evidence.</p>'}</section>`;
}
function projectActivityPanel(activity, error) {
    return `${complianceReviewPanel(activity?.complianceReviews || [])}<section class="project-scope agent-activity"><div class="section-heading"><h2>Agent conversations · ${error ? "Activity unavailable" : `${activity?.active ?? 0} recently active / ${activity?.linked ?? 0} linked`}</h2><button type="button" class="button ghost small" data-action="project-refresh">Refresh activity</button></div><p class="hint">Recently active means an observed call in the last 15 minutes, not a confirmed running session. Linked counts distinct conversation IDs seen using this project. Counts update when you reopen or refresh.</p>${error ? `<p role="alert">${esc(error)}</p>` : `<p class="hint">${activity?.unlinkedCalls ?? 0} calls without a conversation ID (not counted as threads).</p><div class="table-scroll"><table class="record-table"><thead><tr><th>Agent / thread</th><th>Activity</th><th>Estimated context tokens</th><th>Last seen</th></tr></thead><tbody>${pageItems(activity?.sessions || []).map(s => `<tr><td><strong>${esc(s.agent)}</strong><p>${esc(s.threadId)}</p></td><td>${s.active ? "Recently active" : "No recent activity"}<p>${s.calls} observed calls</p></td><td>${s.estimatedContextTokens ?? 0}<p class="hint">Hook characters ÷ 4; not AI billing</p></td><td>${esc(formatTime(s.lastSeen))}</td></tr>`).join("") || '<tr><td colspan="4">No linked conversations observed yet. Start an agent with this project scope and enabled hooks.</td></tr>'}</tbody></table></div>${pagination(activity?.sessions.length || 0)}`}</section>`;
}
function projectForm() {
    const eligible = items.filter(r => (!r.projectId || r.projectId === selectedProject?.id) && (r.status === "active" && r.kind !== "tool") || selectedProject?.assignments.some(a => a.recordId === r.id));
    layout(selectedProject ? "Configure project" : "New project", selectedProject ? "Choose the records for this project. Global defaults apply only when no project is specified." : "A starter set is preselected. Uncheck any style you do not need; only your saved selections will apply.", "", `<form id="projectForm" class="project-form"><div class="project-meta"><div class="field"><label for="projectName">Project name</label><input id="projectName" required maxlength="150" value="${esc(selectedProject?.name || "")}" /></div><div class="field"><label for="projectDescription">Description (optional)</label><input id="projectDescription" maxlength="1200" value="${esc(selectedProject?.description || "")}" /></div></div>
    <section class="project-selection"><div class="selection-heading"><h2>Selected for this project</h2><span id="selectedCount" class="tag" aria-live="polite"></span></div><p class="hint">Only these records and their required dependencies apply. Shared instructions are used unless you add an override.</p><div id="selectedAssignments" class="assignment-list"></div><p id="noAssignments" class="selection-empty">No project selections. No styles will apply until you select records.</p></section>
    <section class="project-selection"><div class="selection-heading"><h2>Available records</h2><span id="availableCount" class="tag"></span></div><p class="hint">Check a record to select it. Choose one per type and domain; uncheck the current selection before choosing an alternative.</p><div id="availableAssignments" class="assignment-list">${eligible.map(r => { const a = selectedProject ? selectedProject.assignments.find(a => a.recordId === r.id) : summary?.projectDefaultStyleIds?.includes(r.id) ? { recordId: r.id, override: null } : undefined; return `<article class="assignment-row" data-assignment-row="${esc(r.id)}" data-slot="${esc(r.kind + ":" + r.domain)}"><label class="assignment-choice"><input type="checkbox" name="assignment" value="${esc(r.id)}" ${a ? "checked" : ""} /><span><strong>${esc(r.title)}</strong><small>${esc(domainName(r.domain))} · ${esc(kindLabel(r.kind))} · ${r.projectId ? "Project-private" : "Shared library"}</small></span><span class="assignment-state tag"></span></label><p class="hint">${esc(r.summary)}</p>${r.requiredIds?.length ? `<p class="hint">Requires: ${r.requiredIds.map(id => esc(items.find(i => i.id === id)?.title || "Unavailable record")).join(", ")}</p>` : ""}<details class="shared-instructions"><summary>Read shared instructions</summary><pre>${esc(r.content)}</pre>${styleContract(r)}</details><details class="project-override" ${a?.override ? "open" : ""} ${a ? "" : "hidden"}><summary>Customize instructions for this project (optional)</summary><label for="override-${esc(r.id)}" class="hint">Replaces shared instructions here only. Leave blank to use the shared version.</label><textarea id="override-${esc(r.id)}" rows="3" maxlength="100000" ${a ? "" : "disabled"}>${esc(a?.override || "")}</textarea></details></article>`; }).join("") || '<p class="hint">No active library records available. Activate a style in Library to select it here.</p>'}</div></section>
    <div class="project-save-bar"><span id="projectSelectionSummary" aria-live="polite"></span><div class="page-actions"><button type="button" class="button soft" data-action="project-cancel">Cancel</button><button type="submit" class="button primary">Save project</button></div></div><div class="form-error" id="projectError" role="alert"></div></form>`);
    projectFormDirty = false;
    syncProjectSelection();
}
let projectFormDirty = false;
function confirmLeaveProject() { if (!projectFormDirty || !document.getElementById("projectForm"))
    return true; if (!confirm("Discard unsaved project changes?"))
    return false; projectFormDirty = false; return true; }
function syncProjectSelection() {
    const rows = Array.from(document.querySelectorAll("[data-assignment-row]"));
    const selectedSlots = new Set(rows.filter(row => row.querySelector('input[name="assignment"]').checked).map(row => row.dataset.slot));
    const required = new Set();
    const collectRequired = (id) => { for (const child of items.find(r => r.id === id)?.requiredIds || []) {
        if (required.has(child))
            continue;
        required.add(child);
        collectRequired(child);
    } };
    rows.filter(row => row.querySelector('input[name="assignment"]').checked).forEach(row => collectRequired(row.dataset.assignmentRow));
    let selected = 0, overrides = 0;
    for (const row of rows) {
        const input = row.querySelector('input[name="assignment"]');
        const chosen = input.checked;
        const field = row.querySelector("textarea");
        const custom = chosen && !!field.value.trim();
        if (chosen)
            selected++;
        if (custom)
            overrides++;
        input.disabled = !chosen && selectedSlots.has(row.dataset.slot);
        field.disabled = !chosen;
        row.querySelector(".project-override").hidden = !chosen;
        row.querySelector(".assignment-state").textContent = chosen ? (custom ? "Project override" : "Selected · shared") : (required.has(input.value) ? "Required dependency" : input.disabled ? "Another record selected" : "Not selected");
        row.classList.toggle("is-selected", chosen);
        const parent = $(chosen ? "selectedAssignments" : "availableAssignments");
        if (row.parentElement !== parent)
            parent.appendChild(row);
    }
    $("selectedCount").textContent = String(selected) + " selected";
    $("availableCount").textContent = String(rows.length - selected) + " available";
    $("noAssignments").hidden = selected > 0;
    $("projectSelectionSummary").textContent = `${selected} selected · ${overrides} overrides · Changes apply after saving`;
}
async function saveProject(ev) {
    ev.preventDefault();
    const assignments = Array.from(document.querySelectorAll('input[name="assignment"]:checked')).map(input => ({ recordId: input.value, override: $("override-" + input.value).value.trim() || null }));
    const project = { name: $("projectName").value, description: $("projectDescription").value, assignments };
    try {
        selectedProject = await api(selectedProject ? `/api/projects/${selectedProject.id}` : "/api/projects", { method: selectedProject ? "PUT" : "POST", body: JSON.stringify(selectedProject ? { project, expectedVersion: selectedProject.version } : project) });
        projectEditing = false;
        page = 1;
        await projectScreen();
    }
    catch (e) {
        $("projectError").textContent = e instanceof Error ? e.message : String(e);
    }
}
async function activation() {
    const statuses = await api("/api/activation");
    const chatProjects = await api("/api/projects");
    const states = [statuses.claude, statuses.codex];
    const pathRows = states.map(s => `<div class="activity-line"><span class="activity-icon">${s.installed ? "✓" : "!"}</span><div class="activity-text"><b>${esc(s.agent === "claude" ? "Claude Code" : "Codex CLI")}</b><p>${esc(s.file)}</p></div><span class="chip">${s.installed ? "Installed" : "Not installed"}</span></div>`).join("");
    layout("Agent setup", "Connect agents once. Load full styles and skills only when the task needs them.", "", `<div class="columns"><div class="card panel"><h2>Hook status ${infoButton("activation_hooks")}</h2>${pathRows}<p class="hint">Status detects installed hook definitions. It does not prove that a live CLI has executed or trusted them.</p></div><div class="card panel"><h2>Activate on macOS</h2><p>After npm installation, run doctor for MCP registration commands, register your agent, then install lifecycle hooks.</p><div class="code-output">personal-brain doctor<br>personal-brain hooks install both</div><p class="hint">Restart Claude and Codex. In Codex, open /hooks and trust the Personal Brain hooks. Existing settings are preserved and backed up.</p></div></div>
    <section class="card panel space-top-18"><h2>ChatGPT chat</h2><p>Connect one project's selected styles through OpenAI Secure MCP Tunnel. This connection is read-only and does not execute local skills.</p><label class="inline-field">Project<select id="chatProject"><option value="">Choose a project</option>${chatProjects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label><div id="chatSetup" class="space-top-12"></div><p class="hint">Requires access to custom MCP plugins in your ChatGPT workspace and an OpenAI tunnel runtime key. <a href="https://developers.openai.com/api/docs/guides/secure-mcp-tunnels" target="_blank" rel="noreferrer">OpenAI setup guide ↗</a></p></section>
    <div class="card panel space-top-18"><h2>Automatic behavior ${infoButton("activation_auto")}</h2><p><b>SessionStart:</b> Load a compact style index and discovery policy. <b>UserPromptSubmit:</b> Match the task and supply record IDs and versions. Agents retrieve full instructions and required links with brain_get, then read external skills on demand. This does not submit an unsolicited user prompt or require a second AI harness.</p><p class="space-top-12">Try: <code>npm run cli -- preview claude prompt "Draw an architecture diagram"</code></p><p class="hint">The style records update live in SQLite; new prompts receive current versions. This does not store project memory.</p></div>`);
    $("chatProject").addEventListener("change", async () => {
        const id = $("chatProject").value;
        if (!id) {
            $("chatSetup").innerHTML = "";
            return;
        }
        try {
            const setup = await api("/api/chatgpt/setup?projectId=" + encodeURIComponent(id));
            if ($("chatProject").value !== id)
                return;
            $("chatSetup").innerHTML = `<p>Run one command in Terminal. The helper asks for your tunnel ID and a hidden runtime key, checks the configuration, and starts the connection.</p><button type="button" class="button primary" id="copyChatConnect">Copy connection command</button><pre class="code-output">${esc(setup.connectCommand)}</pre><p><a href="https://platform.openai.com/settings/organization/tunnels" target="_blank" rel="noreferrer">Create a tunnel / install tunnel-client ↗</a> · <a href="https://platform.openai.com/settings/organization/api-keys" target="_blank" rel="noreferrer">Create runtime key ↗</a></p><p>Once the terminal reports a healthy tunnel, <a href="https://chatgpt.com/#settings/Connectors" target="_blank" rel="noreferrer">add it in ChatGPT ↗</a> and enable it in your chat. Keep the terminal open.</p><details><summary>What is shared and how to use it</summary><p>Only this project's selected styles and required dependencies are available. Keys are entered in Terminal and are not saved by Personal Brain. Ask ChatGPT to use Personal Brain for your task; the server instructs it to discover and retrieve relevant styles. Local CLI skills cannot run in ChatGPT.</p><pre class="code-output">${esc(setup.command)}</pre></details>`;
            $("copyChatConnect").addEventListener("click", async () => {
                try {
                    await navigator.clipboard.writeText(setup.connectCommand);
                    toast("Connection command copied");
                }
                catch {
                    toast("Copy the command shown below the button.");
                }
            });
        }
        catch (e) {
            $("chatSetup").textContent = e instanceof Error ? e.message : String(e);
        }
    });
}
let diagnosticProject = "", diagnosticProjects = [];
function diagnosticScope() { return `<div class="toolbar"><label class="inline-field">Project scope<select id="diagnosticProject"><option value="">Global defaults (no project)</option>${diagnosticProjects.map(p => `<option value="${esc(p.id)}" ${diagnosticProject === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label><p class="hint">Diagnostics simulate retrieval and checks; they do not contact an agent.</p></div>`; }
function discover() {
    if (active === "baseline") {
        layout("Startup index", "Preview the compact index for the selected scope.", "", `${diagnosticScope()}<div class="card panel space-top-18"><h2>Baseline context ${infoButton("baseline")}</h2><p>Record titles, IDs and versions only. Full instructions load through brain_get when needed.</p><button data-action="bootstrap" class="button soft baseline-action">Show startup index</button><div class="code-output" id="bootstrapResults">Use brain_bootstrap in your agent to load the current style baseline.</div></div>`);
        return;
    }
    if (active === "review_simulator") {
        layout("Text validation", "Run deterministic text checks; manual review criteria remain pending.", "", `${diagnosticScope()}<div class="card panel space-top-18"><h2>Text review simulator ${infoButton("review_simulator")}</h2><div class="field"><label for="reviewDomain">Capability type</label><select id="reviewDomain" class="select">${domainOptions("writing")}</select></div><div class="field"><label for="reviewText">Artifact text</label><textarea id="reviewText" rows="4" placeholder="Paste document text here"></textarea></div><button class="button primary small" data-action="review">Run checks</button><div id="reviewResults" class="code-output review-output">Waiting for input.</div></div>`);
        return;
    }
    layout("Discovery Lab", "Find styles, skills and tools for one task.", "", `${diagnosticScope()}<div class="split-box discovery-grid"><section class="card panel"><h2>Find the right skill ${infoButton("discover")}</h2><p>Describe the task in natural language.</p><div class="field space-top-20"><label for="discoveryTask">Task</label><textarea id="discoveryTask" rows="4">Draw an editable IoT platform architecture diagram with clear service boundaries</textarea></div><button class="button primary" data-action="discover">Discover capabilities</button><p class="hint">Results include record IDs. Agents call brain_get to read full instructions.</p></section><section class="card panel"><h2>Discovery results</h2><div class="code-output" id="discoveryResults">Run a discovery search to inspect matching skills, styles, and tools.</div></section></div>`);
}
async function feedback() {
    const records = await api("/api/feedback");
    layout("Feedback Inbox", "Record accepted work, corrections and rejected outputs. These are evidence for human-approved style updates.", "", `<div class="columns"><div class="card panel"><h2>Feedback history ${infoButton("feedback")}</h2><div class="feedback-list space-top-18">${pageItems(records).map(r => `<div class="feedback-item"><div class="spread-row">${ch(r.rating)}<span class="hint">${esc(formatTime(r.createdAt))}</span></div><p>${esc(r.note)}</p></div>`).join("") || empty("No feedback", "Corrections will appear here")}</div>${pagination(records.length)}</div><div class="card panel"><h2>Capture a correction</h2><p>Feedback does not rewrite your global style automatically.</p><div class="field space-top-20"><label>Feedback type</label><select id="fbRating"><option value="correction">Correction</option><option value="accepted">Accepted outcome</option><option value="rejected">Rejected outcome</option></select></div><div class="field"><label>Feedback</label><textarea id="fbNote" rows="6" placeholder="Explain your preference or correction"></textarea></div><button class="button primary" data-action="feedback">Record feedback</button></div></div>`);
}
async function activity() {
    const records = await api("/api/audit");
    layout("Activity & Versioning", "Every edit creates a new revision. Review activity and restore past versions from the library.", "", `<div class="card panel"><h2>Recent activity ${infoButton("history")}</h2>${pageItems(records).map(r => `<div class="activity-line"><span class="activity-icon">↺</span><div class="activity-text"><b>${esc(r.action)} · ${esc(r.detail)}</b><p>${esc(r.target)}</p></div><span class="activity-time">${esc(formatTime(r.createdAt))}</span></div>`).join("") || empty("No activity", "Create a record to start your revision history")}${pagination(records.length)}</div>`);
}
let fusionCurrent = "", fusionSelected = "";
let fusionProjects = null, fusionAgent = "codex", fusionPoll;
async function fusionScreen() {
    clearTimeout(fusionPoll);
    const [projects, runs] = await Promise.all([api("/api/projects"), api("/api/fusion")]);
    if (fusionCurrent && !runs.some(r => r.id === fusionCurrent))
        fusionCurrent = "";
    const job = fusionCurrent ? await api("/api/fusion/" + encodeURIComponent(fusionCurrent)) : null;
    if (active !== "fusion")
        return;
    if (job?.proposals.length && !job.proposals.some((p) => p.targetId === fusionSelected))
        fusionSelected = job.proposals.find((p) => !job.applied.includes(p.targetId) && !(job.rejected || []).includes(p.targetId))?.targetId || job.proposals[0].targetId;
    layout("Fusion", "Learn reusable working methods from your projects and propose updates to shared styles.", "", `
 <details class="card panel fusion-setup" ${job ? "" : "open"}><summary>New analysis</summary><form id="fusionForm"><h2>Choose sources</h2><p>Select the projects whose style instructions the agent should compare. Effective project instructions, linked records and current shared styles are sent to your chosen CLI provider; repository files and traces are not included.</p>
 <fieldset class="fusion-projects"><legend>Projects</legend>${projects.map(p => `<label><input type="checkbox" name="fusionProject" value="${esc(p.id)}" ${fusionProjects === null || fusionProjects.includes(p.id) ? "checked" : ""} /> ${esc(p.name)}</label>`).join("")}</fieldset>
 <div class="toolbar"><label class="inline-field">Agent<select id="fusionAgent"><option value="codex" ${fusionAgent === "codex" ? "selected" : ""}>Codex</option><option value="claude" ${fusionAgent === "claude" ? "selected" : ""}>Claude</option></select></label><button class="button primary" type="submit" ${job?.status === "running" ? "disabled" : ""}>Analyze with agent</button></div><p id="fusionError" class="form-error" role="alert"></p><p class="hint">Requires an installed, authenticated CLI. Analysis can take up to five minutes. Review each proposal before publishing a new global version. Existing shared-style consumers will receive that version; private copies keep their own instructions.</p></form></details>
 <section class="fusion-history"><div class="section-heading"><h2>Analysis history</h2><span class="hint">${runs.length} recent runs</span></div>${runs.length ? `<div class="table-scroll"><table class="record-table"><thead><tr><th>Agent</th><th>Started</th><th>Status</th><th><span class="sr-only">Open analysis</span></th></tr></thead><tbody>${runs.map(r => `<tr ${r.id === fusionCurrent ? 'class="is-selected"' : ''}><td>${esc(r.agent === 'claude' ? 'Claude' : 'Codex')}</td><td>${esc(formatTime(r.createdAt))}</td><td><span class="tag">${esc(r.status)}</span></td><td><button class="button ghost small" data-fusion-run="${esc(r.id)}" aria-pressed="${r.id === fusionCurrent}">${r.id === fusionCurrent ? 'Viewing' : 'Review analysis'}</button></td></tr>`).join('')}</tbody></table></div>` : '<p>No analyses yet. Choose your projects above to start.</p>'}</section>
 ${job ? `<section class="card panel space-top-18"><div class="panel-head"><h2>Review proposals</h2><span class="tag">${esc(job.status)}</span><button class="button ghost" id="fusionRefresh">Refresh status</button></div>${job.error ? `<p role="alert">${esc(job.error)}</p>` : ""}${job.status === "running" ? '<p role="status">The agent is analyzing your styles. You can leave this page and reopen the run.</p><button class="button ghost" id="fusionCancel">Cancel analysis</button>' : ""}${job.status === "ready" && !job.proposals.length ? '<p>No reusable changes proposed.</p>' : ""}<div class="fusion-workbench">${job.proposals.length ? `<nav class="fusion-proposal-list" aria-label="Proposals">${job.proposals.map((p) => `<button type="button" data-fusion-proposal="${esc(p.targetId)}" aria-pressed="${p.targetId === fusionSelected}"><strong>${esc(p.title)}</strong><span>${job.applied.includes(p.targetId) ? 'Published' : (job.rejected || []).includes(p.targetId) ? 'Rejected' : p.conflicts.length ? 'Conflicts to resolve' : 'Awaiting review'}</span></button>`).join('')}</nav>` : ''}<div class="fusion-detail">${job.proposals.filter((p) => p.targetId === fusionSelected).map((p) => { const old = job.targets.find((r) => r.id === p.targetId); return `<article class="fusion-proposal"><h3>${esc(p.title)}</h3><p class="fusion-rationale">${esc(p.rationale)}</p><p class="hint">Target: ${esc(old?.title)} · v${esc(old?.version)} → v${Number(old?.version) + 1}</p><details><summary>Source styles</summary><ul>${p.sourceIds.map((id) => { const r = job.sources.find((r) => r.id === id); return `<li>${esc(r?.title)} · v${esc(r?.version)} · ${esc(projects.find(x => x.id === (r?.contextProjectId || r?.projectId))?.name || "Shared")}</li>`; }).join("")}</ul></details><details><summary>Compare current and proposed instructions</summary><div class="fusion-compare"><section><h4>Current</h4><pre>${esc(old?.content)}</pre></section><section><h4>Proposed</h4><pre>${esc(p.content)}</pre></section></div><h4>Proposed supporting content</h4>${["summary", "useWhen", "tags", "principles", "examples", "externalSkills", "reviewCriteria"].map(k => `<h4>${esc({ summary: "Summary", useWhen: "Use when", tags: "Discovery keywords", principles: "Principles", examples: "Examples", externalSkills: "Required skills", reviewCriteria: "Review criteria" }[k])}</h4><pre>${esc(typeof (p[k] ?? old?.[k]) === "string" ? (p[k] ?? old?.[k]) : (p[k] ?? old?.[k] ?? []).join("\n"))}</pre>`).join("")}</details><details><summary>What stays unchanged</summary><p>Mandatory requirements, automated checks, required links, skills and existing review criteria are preserved.</p></details>${p.conflicts.length ? `<p class="form-error">Conflicts — resolve in source styles and analyze again:</p><ul>${p.conflicts.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}<footer class="fusion-decision"><div><strong>Decision</strong><p class="hint">Publishing updates the shared style. Private copies stay unchanged.</p></div><div class="row-actions"><button class="button primary" data-fusion-apply="${esc(p.targetId)}" ${p.conflicts.length || job.applied.includes(p.targetId) || (job.rejected || []).includes(p.targetId) ? "disabled" : ""}>${job.applied.includes(p.targetId) ? "Published" : (job.rejected || []).includes(p.targetId) ? "Rejected" : "Publish update"}</button> <button class="button ghost" data-fusion-reject="${esc(p.targetId)}" ${job.applied.includes(p.targetId) || (job.rejected || []).includes(p.targetId) ? "disabled" : ""}>Reject proposal</button></div></footer></article>`; }).join("")}</div></div></section>` : ""}`);
    $("fusionForm").addEventListener("change", () => { fusionProjects = Array.from(document.querySelectorAll('input[name="fusionProject"]:checked')).map(x => x.value); fusionAgent = $("fusionAgent").value; });
    if (job?.status === "running") {
        const id = fusionCurrent;
        const poll = async () => { if (active !== "fusion" || fusionCurrent !== id)
            return; try {
            const current = await api("/api/fusion/" + encodeURIComponent(id));
            if (active !== "fusion" || fusionCurrent !== id)
                return;
            if (current.status === "running")
                fusionPoll = setTimeout(poll, 2500);
            else
                await fusionScreen();
        }
        catch (e) {
            toast(String(e));
        } };
        fusionPoll = setTimeout(poll, 2500);
    }
    main.querySelectorAll('[data-fusion-proposal]').forEach(b => b.addEventListener("click", async () => { fusionSelected = b.dataset.fusionProposal; await fusionScreen(); main.querySelector(`[data-fusion-proposal="${CSS.escape(fusionSelected)}"]`)?.focus(); }));
    main.querySelectorAll('[data-fusion-reject]').forEach(b => b.addEventListener("click", async () => { b.disabled = true; try {
        await api('/api/fusion/' + fusionCurrent + '/reject', { method: 'POST', body: JSON.stringify({ targetId: b.dataset.fusionReject }) });
        await fusionScreen();
    }
    catch (e) {
        toast(String(e));
        b.disabled = false;
    } }));
    $("fusionForm").addEventListener("submit", async (ev) => { ev.preventDefault(); const button = ev.currentTarget.querySelector('button[type="submit"]'); button.disabled = true; try {
        const projectIds = Array.from(document.querySelectorAll('input[name="fusionProject"]:checked')).map(x => x.value);
        const r = await api("/api/fusion", { method: "POST", body: JSON.stringify({ agent: $("fusionAgent").value, projectIds }) });
        fusionCurrent = r.id;
        await fusionScreen();
    }
    catch (e) {
        $("fusionError").textContent = e instanceof Error ? e.message : String(e);
        button.disabled = false;
    } });
    $("fusionCancel")?.addEventListener("click", async () => { try {
        await api("/api/fusion/" + fusionCurrent + "/cancel", { method: "POST", body: "{}" });
        await fusionScreen();
    }
    catch (e) {
        toast(String(e));
    } });
    $("fusionRefresh")?.addEventListener("click", () => fusionScreen());
    main.querySelectorAll('[data-fusion-run]').forEach(b => b.addEventListener("click", async () => { fusionCurrent = b.dataset.fusionRun; await fusionScreen(); }));
    main.querySelectorAll('[data-fusion-apply]').forEach(b => b.addEventListener("click", async () => { if (!confirm("Publish this reviewed proposal? Projects using the shared style will receive the new version. Private copies remain unchanged."))
        return; b.disabled = true; try {
        await api('/api/fusion/' + fusionCurrent + '/apply', { method: 'POST', body: JSON.stringify({ targetId: b.dataset.fusionApply }) });
        await fusionScreen();
    }
    catch (e) {
        toast(e instanceof Error ? e.message : String(e));
        b.disabled = false;
    } }));
}
let traceProject = "all", traceAgent = "all", traceChannel = "all", traceRecord = "all", traceDemo = false;
function traceQuery() { const query = new URLSearchParams({ limit: "300", projectId: traceProject, agent: traceAgent, channel: traceChannel }); if (traceRecord !== "all")
    query.set("recordId", traceRecord); if (traceDemo)
    query.set("demo", "1"); return query.toString(); }
async function traceExplorer() {
    const [stats, events, projects] = await Promise.all([api(`/api/trace/stats?projectId=${encodeURIComponent(traceProject)}`), api(`/api/trace?${traceQuery()}`), api("/api/projects")]);
    const traceItems = traceProject !== "all" && traceProject !== "unscoped" ? await api(`/api/projects/${encodeURIComponent(traceProject)}/resolved`) : items;
    const recordOptions = [...traceItems].sort((a, b) => a.title.localeCompare(b.title)).map(r => `<option value="${esc(r.id)}" ${traceRecord === r.id ? "selected" : ""}>${esc(r.title)} — ${esc(r.kind)}</option>`).join("");
    const kpi = [
        [stats.startup, "Startup injections", "trace_startup", "How often a session startup hook emitted baseline context"],
        [stats.promptMatches, "Task matches", "trace_prompt", "How often a task hook emitted relevant instructions"],
        [stats.estimatedContextTokens ?? 0, "Estimated context tokens", "trace_tokens", "All recorded hooks · characters ÷ 4, not AI usage or billing"],
        [stats.discovery, "Discovery calls", "trace_discovery", "MCP search calls made by connected agents"],
        [stats.retrieval, "Instruction loads", "trace_loads", "Full record retrieval calls through the MCP"],
        [stats.reviews, "Review calls", "trace_reviews", "Submitted artifact text validations through the MCP"]
    ];
    const reverse = traceRecord !== "all" ? traceItems.find(r => r.id === traceRecord) : null;
    const rows = pageItems(events).map(e => {
        const refs = e.recordIds.slice(0, 12).map(id => { const item = traceItems.find(x => x.id === id); return `<span class="trace-ref" title="Version at time of call">${esc(item?.title || id.slice(0, 8))} <small>v${esc(e.recordVersions?.[id] || "?")}</small></span>`; }).join("");
        const meta = Object.entries({ ...e.metadata, ...(typeof e.metadata?.contextChars === "number" ? { estimatedContextTokens: Math.ceil(e.metadata.contextChars / 4) } : {}) }).filter(([k]) => k !== "complianceReport").map(([k, v]) => `<span><b>${esc(k)}</b> ${esc(v)}</span>`).join("");
        return `<article class="trace-event ${e.demo ? "trace-demo" : ""}">
      <div class="trace-rail"><span class="trace-dot ${esc(e.channel)}"></span></div>
      <div class="trace-body">
        <div class="trace-heading"><div><span class="chip ${esc(e.channel)}">${esc(e.channel)}</span><b>${esc(e.eventType)}</b>${e.demo ? '<span class="trace-tag">DEMO ONLY</span>' : ""}</div><time>${esc(formatTime(e.occurredAt))}</time></div>
        <div class="trace-sub"><span class="tag">${esc(projects.find(p => p.id === e.metadata?.projectId)?.name || "No project")}</span><span class="agent-label">${esc(e.agent)}</span><span class="trace-outcome">${esc(e.outcome)}</span><code>${esc(e.runId)}</code></div>
        ${refs ? `<div class="trace-refs">${refs}</div>` : ""}
        <details><summary>Inspect recorded evidence</summary><div class="trace-metadata">${meta || "No metadata was captured"}</div><p class="hint">Context token estimates use characters ÷ 4; actual model usage is not available. Artifact contents are not collected. Explicit compliance submissions store task summaries, paths and evidence notes in project activity. MCP sessions and hooks may be unlinked.</p></details>
      </div>
    </article>`;
    }).join("");
    layout("Trace Explorer", "Inspect observed style retrieval and review activity by project.", "", `<details class="trace-explanation"><summary>About trace evidence and token estimates</summary><div class="trace-alert"><div><strong>What we can prove</strong><p>Hook context emitted · MCP tool requested · Skill IDs and versions retrieved · Text checks submitted.</p></div><div><strong>What we cannot yet prove</strong><p>That the agent obeyed an instruction or that the final diagram is visually correct. Session and MCP processes may have different run IDs.</p></div></div>
    <p class="hint">${esc(stats.tokenUsageNote || "Actual AI token usage is not reported by the current integrations.")}</p></details><section class="trace-metrics">${kpi.map(([value, title, key, description]) => `<div class="card trace-metric"><div class="trace-metric-top"><span>${esc(title)}</span>${infoButton(String(key))}</div><b>${value}</b><small>${esc(description)}</small></div>`).join("")}</section>
    <div class="card panel trace-controls">
      <div class="panel-head"><div><h2>Filter activity ${infoButton("trace_filters")}</h2><p>Start from an instruction or skill to find observed events and the version recorded to an agent.</p></div><button class="button soft small" data-action="trace-export">Export visible JSON</button></div>
      <div class="trace-filters">
        <label>Project<select id="traceProject"><option value="all">All projects</option><option value="unscoped" ${traceProject === "unscoped" ? "selected" : ""}>No project</option>${projects.map(p => `<option value="${esc(p.id)}" ${traceProject === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label><label>Agent<select id="traceAgent"><option value="all">All agents</option>${["claude", "codex", "chatgpt", "unknown"].map(a => `<option value="${a}" ${traceAgent === a ? "selected" : ""}>${a}</option>`).join("")}</select></label>
        <label>Channel<select id="traceChannel"><option value="all">All channels</option>${["hook", "mcp"].map(a => `<option value="${a}" ${traceChannel === a ? "selected" : ""}>${a}</option>`).join("")}</select></label>
        <label>Reverse by rule<select id="traceRecord"><option value="all">All styles and skills</option>${recordOptions}</select></label>
        <label class="trace-demo-toggle"><input id="traceDemo" type="checkbox" ${traceDemo ? "checked" : ""}/> Include demo traces</label>
      </div>
      ${reverse ? `<div class="notice"><b>Reverse trace active:</b> ${esc(reverse.title)} — current v${reverse.version}. Event badges show the version recorded at emission, which can differ from the current version.</div>` : ""}
      <div class="trace-actions"><button class="button ghost small" data-action="trace-refresh">Refresh</button><span class="hint">${events.length} matching events shown · ${stats.events} real events in this project scope</span></div><details class="trace-demo-tools"><summary>Demo data</summary><div class="trace-actions"><button class="button soft small" data-action="trace-demo-seed">Generate sample traces</button>${infoButton("trace_samples")}<button class="button ghost small" data-action="trace-demo-clear">Clear sample traces</button></div></details>
    </div>
    <section class="trace-results space-top-18"><div class="card panel">
       <div class="panel-head"><div><h2>Observed event timeline ${infoButton("trace_timeline")}</h2><p>Newest first. Each record was produced by a hook or MCP call.</p></div></div>
       <div class="trace-timeline">${rows || empty("No matching trace events", "Run Claude or Codex with activated hooks, or generate marked sample traces to explore the format")}</div>${pagination(events.length)}
     </div><details class="card panel trace-guide"><summary>Understanding evidence</summary><h2>Evidence ladder ${infoButton("evidence_ladder")}</h2>
       <div class="evidence-stage"><span>1</span><div><b>Session initialized</b><p>Evidence a startup hook emitted context or an MCP connection occurred, not agent compliance.</p></div></div>
       <div class="evidence-stage"><span>2</span><div><b>Task instruction matched</b><p>Rule IDs and versions emitted by prompt hook.</p></div></div>
       <div class="evidence-stage"><span>3</span><div><b>Knowledge actively retrieved</b><p>Observed brain_discover and brain_get calls.</p></div></div>
       <div class="evidence-stage"><span>4</span><div><b>Artifact review requested</b><p>Observed brain_review call and deterministic result.</p></div></div>
       <div class="evidence-stage"><span>5</span><div><b>Actual effectiveness</b><p>Requires independent artifact comparison, tests, or human acceptance. Not inferred from call counts.</p></div></div>
       <div class="notice"><b>Privacy:</b> Hooks store prompt fingerprints and metadata, not raw prompts. Explicit compliance reviews also store task summaries, artifact paths and evidence notes. Do not submit secrets in review evidence. Artifact file contents are not collected.</div>
     </details></section>`);
    for (const id of ["traceProject", "traceAgent", "traceChannel", "traceRecord", "traceDemo"]) {
        $(id).addEventListener("change", async () => {
            page = 1;
            const changedProject = traceProject !== $('traceProject').value;
            traceProject = $('traceProject').value;
            traceAgent = $('traceAgent').value;
            traceChannel = $('traceChannel').value;
            traceRecord = changedProject ? 'all' : $('traceRecord').value;
            traceDemo = $('traceDemo').checked;
            updateUrl();
            await traceExplorer();
        });
    }
}
let editorDirty = false;
function closeEditor() { if (editorDirty && !confirm("Discard unsaved changes to this record?"))
    return; editorDirty = false; editor.close(); }
function openEditor(record = null) {
    editing = record;
    const projectEdit = record && active === "projects" && selectedProject;
    if (projectEdit && record) {
        const recordId = record.id;
        const override = selectedProject.assignments.find(a => a.recordId === recordId)?.override;
        if (override)
            record = { ...record, content: override };
    }
    $("editorTitle").textContent = projectEdit ? record.projectId ? "Edit project-only style" : "Customize for this project — global style stays unchanged" : record ? `Edit ${record.title}` : active === "projects" && selectedProject ? "Create project-private style" : "Create knowledge record";
    $("editDomain").innerHTML = domainOptions(record?.domain || "general");
    const fields = { editKind: record?.kind || (["preference", "skill", "example", "review", "tool"].includes(active) ? active : "preference"), editDomain: record?.domain || "general", editTitle: record?.title || "", editSummary: record?.summary || "", editUseWhen: record?.useWhen || "", editExamples: record?.examples?.join("\n") || "", editPrinciples: record?.principles?.join("\n") || "", editExternalSkills: record?.externalSkills?.join("\n") || "", editReviewCriteria: record?.reviewCriteria?.join("\n") || "", editContent: record?.content || "", editTags: record?.tags.join(", ") || "", editPriority: String(record?.priority ?? 70), editStatus: record?.status || "active", editRequirements: record?.requirements?.length ? JSON.stringify(record.requirements, null, 2) : "", editChecks: record?.checks.length ? JSON.stringify(record.checks, null, 2) : "", editBackend: record?.backend ? JSON.stringify(record.backend, null, 2) : "" };
    for (const [id, value] of Object.entries(fields))
        $(id).value = value;
    const linked = new Set(record?.requiredIds || []);
    const owner = record?.projectId || (active === "projects" ? selectedProject?.id : undefined);
    const choices = items.filter(r => (!r.projectId || r.projectId === owner) && r.id !== record?.id && (r.status === "active" || linked.has(r.id)));
    const checkbox = (id, title, detail) => `<label class="dependency-choice"><input type="checkbox" name="requiredStyle" value="${esc(id)}" ${linked.has(id) ? "checked" : ""} /><span><strong>${esc(title)}</strong><small>${esc(detail)}</small></span></label>`;
    $("editRequired").innerHTML = choices.map(r => checkbox(r.id, r.title, domainName(r.domain) + (r.status !== "active" ? " · " + r.status : ""))).join("") +
        [...linked].filter(id => !items.some(r => r.id === id)).map(id => checkbox(id, "Unavailable dependency", id + " · remove this link or restore the record")).join("") || '<p class="hint">No active records available to link.</p>';
    $("editError").textContent = "";
    editorDirty = false;
    editor.showModal();
}
function parseJson(input, fallback) { if (!input.trim())
    return fallback; try {
    return JSON.parse(input);
}
catch {
    throw new Error("Invalid JSON in requirements, checks or tool backend");
} }
function lines(id) { return $(id).value.split("\n").map(s => s.trim()).filter(Boolean); }
async function saveEditor(ev) {
    ev.preventDefault();
    try {
        const record = { projectId: editing?.projectId || (active === "projects" && selectedProject ? selectedProject?.id : undefined), kind: $("editKind").value, domain: $("editDomain").value, title: $("editTitle").value,
            summary: $("editSummary").value, content: $("editContent").value,
            requiredIds: Array.from(document.querySelectorAll('#editRequired input[name="requiredStyle"]:checked')).map(o => o.value),
            useWhen: $("editUseWhen").value, tags: $("editTags").value.split(",").map(t => t.trim()).filter(Boolean), priority: Number($("editPriority").value), status: $("editStatus").value,
            examples: lines("editExamples"), principles: lines("editPrinciples"), externalSkills: lines("editExternalSkills"), reviewCriteria: lines("editReviewCriteria"),
            requirements: parseJson($("editRequirements").value, []), checks: parseJson($("editChecks").value, []), backend: parseJson($("editBackend").value, null) };
        if (record.kind === "tool" && record.backend) {
            if (!confirm("External MCP tool commands can access your computer. Only configure trusted tools and leave them disabled until reviewed. Continue?"))
                return;
        }
        if (editing && active === "projects" && selectedProject && (!editing.projectId || selectedProject.assignments.some(a => a.recordId === editing.id)))
            await api(`/api/projects/${selectedProject.id}/items/${editing.id}`, { method: "PUT", body: JSON.stringify({ expectedVersion: editing.version, expectedProjectVersion: selectedProject.version, record }) });
        else if (editing)
            await api(`/api/items/${editing.id}${editing.projectId ? "?projectId=" + encodeURIComponent(editing.projectId) : ""}`, { method: "PUT", body: JSON.stringify({ expectedVersion: editing.version, record }) });
        else
            await api("/api/items", { method: "POST", body: JSON.stringify(record) });
        editorDirty = false;
        editor.close();
        toast("Saved a new version successfully");
        await refresh();
    }
    catch (e) {
        $("editError").textContent = e instanceof Error ? e.message : String(e);
    }
}
async function showHistory(id) {
    const record = items.find(i => i.id === id);
    if (!record)
        return;
    const history = await api(`/api/items/${id}/history${record.projectId ? "?projectId=" + encodeURIComponent(record.projectId) : ""}`);
    $("historyTitle").textContent = record.title;
    $("historyContent").innerHTML = history.map(r => `<div class="history-entry"><div><b>Version ${r.version} · ${esc(r.action)}</b><p>${esc(formatTime(r.at))}</p><p>${esc(r.snapshot.summary.slice(0, 100))}</p></div>${r.version < record.version ? `<button class="button ghost small" data-restore="${id}" data-version="${r.version}">Restore</button>` : '<span class="chip">Current</span>'}</div>`).join("");
    revisions.showModal();
}
async function restoreRecord(id, version) {
    const rec = items.find(i => i.id === id);
    if (!rec)
        return;
    if (!confirm(`Restore version ${version}? This creates a new version and preserves all history.`))
        return;
    try {
        await api(`/api/items/${id}/restore${rec.projectId ? "?projectId=" + encodeURIComponent(rec.projectId) : ""}`, { method: "POST", body: JSON.stringify({ version, expectedVersion: rec.version }) });
        revisions.close();
        toast("Restored as a new version");
        await refresh();
    }
    catch (e) {
        toast(e instanceof Error ? e.message : String(e));
    }
}
async function delegated(ev) {
    const target = ev.target;
    const button = target.closest("button");
    if (!button) {
        const capability = target.closest("[data-capability-row]");
        if (capability && !target.closest("a,input,select,textarea") && !window.getSelection()?.toString()) {
            location.hash = "/library?domain=" + encodeURIComponent(capability.dataset.capabilityRow);
            return;
        }
        const row = target.closest("[data-project-row]");
        if (row && !target.closest("a,input,select,textarea")) {
            try {
                selectedProject = await api(`/api/projects/${row.dataset.projectRow}`);
                active = "projects";
                projectEditing = false;
                projectTab = "styles";
                page = 1;
                await projectScreen();
            }
            catch (e) {
                toast(e instanceof Error ? e.message : String(e));
            }
        }
        return;
    }
    try {
        if (button.dataset.copyOnboarding) {
            try {
                await navigator.clipboard.writeText(projectOnboardingPrompt(button.dataset.copyOnboarding));
                toast("Onboarding prompt copied");
            }
            catch {
                toast("Could not copy. Select and copy the visible onboarding prompt.");
            }
            return;
        }
        if (button.dataset.removeKind) {
            await previewRemoval(button.dataset.removeKind, button.dataset.removeId);
            return;
        }
        if (button.dataset.action === "removal-cancel") {
            $("removalDialog").close();
            removalPreview = null;
            return;
        }
        if (button.dataset.action === "removal-confirm" && removalPreview) {
            button.disabled = true;
            try {
                const { kind, id, fingerprint } = removalPreview;
                await api(`/api/removal/${kind}/${id}`, { method: "POST", body: JSON.stringify({ fingerprint }) });
                $("removalDialog").close();
                removalPreview = null;
                if (kind === "project" && selectedProject?.id === id) {
                    selectedProject = null;
                    projectEditing = false;
                }
                await refresh();
                toast(kind === "reset" ? "Project styles reset" : "Deleted");
            }
            catch (e) {
                $("removalError").textContent = e instanceof Error ? e.message : String(e);
            }
            finally {
                button.disabled = false;
            }
            return;
        }
        if (button.dataset.graphContents) {
            graphShowContents = !graphShowContents;
            const host = document.querySelector(".graph-workspace")?.parentElement;
            if (host) {
                await render();
                zoomGraph("fit");
            }
            return;
        }
        if (button.dataset.graphMode) {
            graph3d = button.dataset.graphMode === "3d";
            graphYaw = 0;
            graphPitch = 0;
            updateGraphProjection();
            document.querySelectorAll("[data-graph-mode]").forEach(el => el.setAttribute("aria-pressed", String((el.dataset.graphMode === "3d") === graph3d)));
            return;
        }
        if (button.dataset.graphOrbit) {
            graphYaw += button.dataset.graphOrbit === "left" ? -.2 : .2;
            updateGraphProjection();
            return;
        }
        if (button.dataset.graphZoom) {
            zoomGraph(button.dataset.graphZoom);
            return;
        }
        if (button.dataset.publish && selectedProject) {
            const record = items.find(r => r.id === button.dataset.publish && r.projectId === selectedProject.id);
            if (!record)
                return;
            if (!confirm(`Publish "${record.title}" to the global library? This creates shared copies of this record and its required private dependencies, including their instructions, skill references, examples and rules. Active copies become available as global defaults and to other projects. This project's private records and selections stay unchanged.`))
                return;
            const result = await api(`/api/projects/${selectedProject.id}/items/${record.id}/publish`, { method: "POST", body: JSON.stringify({ expectedVersion: record.version }) });
            toast(`Published ${result.published.length} shared record(s)`);
            await refresh();
            return;
        }
        if (button.dataset.action === "private-style") {
            openEditor();
            return;
        }
        if (button.dataset.action === "capability-add") {
            $("domainName").value = newDomainDraft;
            $("capabilityCreateError").textContent = "";
            $("capabilityDialog").showModal();
            $("domainName").focus();
            return;
        }
        if (button.dataset.action === "capability-close") {
            $("capabilityDialog").close();
            return;
        }
        if (button.dataset.libraryMode) {
            libraryMode = button.dataset.libraryMode === "map" ? "map" : "table";
            records(active);
            return;
        }
        if (button.dataset.action === "graph-close") {
            closeGraphDetails();
            return;
        }
        if (button.dataset.graphNode) {
            if (graphDragged) {
                graphDragged = false;
                return;
            }
            highlightDependencyNode(button.dataset.graphNode);
            return;
        }
        if (button.dataset.dependencies) {
            const item = items.find(i => i.id === button.dataset.dependencies);
            if (item) {
                openEditor(item);
                $("editRequired").focus();
            }
            return;
        }
        if (button.dataset.project) {
            selectedProject = await api(`/api/projects/${button.dataset.project}`);
            projectEditing = false;
            projectTab = "styles";
            page = 1;
            await projectScreen();
            return;
        }
        if (button.dataset.page) {
            page = Number(button.dataset.page);
            await render();
            return;
        }
        if (button.dataset.info) {
            showHelp(button.dataset.info);
            return;
        }
        if (button.dataset.editDomain) {
            domainEditing = button.dataset.editDomain;
            domainsScreen();
            $("domain-" + domainEditing).focus();
            return;
        }
        if (button.dataset.cancelDomain) {
            domainDrafts.delete(button.dataset.cancelDomain);
            domainEditing = "";
            domainsScreen();
            return;
        }
        if (button.dataset.view) {
            if (!confirmLeaveProject())
                return;
            active = button.dataset.view;
            items = items.filter(r => !r.projectId);
            selectedProject = null;
            projectEditing = false;
            search = "";
            domain = "all";
            page = 1;
            await render();
            return;
        }
        if (button.dataset.edit) {
            const item = items.find(i => i.id === button.dataset.edit);
            if (item)
                openEditor(item);
            return;
        }
        if (button.dataset.skillIssues) {
            await showProjectDiscovery(button.dataset.skillIssues);
            return;
        }
        if (button.dataset.history) {
            await showHistory(button.dataset.history);
            return;
        }
        if (button.dataset.restore) {
            await restoreRecord(button.dataset.restore, Number(button.dataset.version));
            return;
        }
        switch (button.dataset.action) {
            case "repository-link":
            case "repository-test": {
                if (!selectedProject)
                    break;
                const folder = $("repositoryFolder").value.trim();
                const result = $("repositoryResult");
                if (!folder) {
                    result.textContent = "Enter the absolute path to your repository folder.";
                    $("repositoryFolder").focus();
                    break;
                }
                button.disabled = true;
                result.textContent = "Checking…";
                try {
                    const link = button.dataset.action === "repository-link";
                    const data = await repositoryRequest(selectedProject.id, folder, link ? "link" : "test");
                    result.textContent = link ? `Linked: ${data.file}. Start a new agent session in this repository.` : data.matches ? `Configuration ready: ${data.records?.length || 0} records resolved for this project. Confirm agent calls in Agent conversations.` : `This folder resolves to ${data.projectId || "global defaults"}, not this project.`;
                }
                catch (e) {
                    result.textContent = e instanceof Error ? e.message : String(e);
                }
                finally {
                    button.disabled = false;
                }
                break;
            }
            case "project-discovery":
                await showProjectDiscovery();
                break;
            case "discovery-close":
                $("discoveryDialog").close();
                break;
            case "project-refresh":
                await projectScreen();
                break;
            case "project-new":
                selectedProject = null;
                projectEditing = true;
                projectForm();
                break;
            case "project-edit":
                projectEditing = true;
                projectForm();
                break;
            case "project-cancel":
                if (!confirmLeaveProject())
                    break;
                projectEditing = false;
                await projectScreen();
                break;
            case "project-list":
                selectedProject = null;
                projectEditing = false;
                projectTab = "styles";
                search = "";
                page = 1;
                await projectScreen();
                break;
            case "trace-demo-seed": {
                const r = await api("/api/trace/demo", { method: "POST" });
                traceDemo = true;
                toast(`${r.created} synthetic events created`);
                await traceExplorer();
                break;
            }
            case "trace-demo-clear": {
                await api("/api/trace/demo", { method: "DELETE" });
                toast("Synthetic traces cleared; real telemetry unchanged");
                await traceExplorer();
                break;
            }
            case "trace-refresh": {
                await traceExplorer();
                break;
            }
            case "trace-export": {
                const data = await api(`/api/trace?${traceQuery()}`);
                const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), items: data }, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "personal-brain-trace.json";
                link.click();
                URL.revokeObjectURL(url);
                break;
            }
            case "import-styles": {
                await api("/api/styles/seed", { method: "POST" });
                search = "";
                domain = "all";
                await refresh();
                toast("Sample styles loaded; existing edits preserved");
                break;
            }
            case "seed": {
                const r = await api("/api/examples/seed", { method: "POST" });
                toast(`${r.created} new examples added; existing edits preserved`);
                await refresh();
                break;
            }
            case "retry":
                await refresh();
                break;
            case "add":
                openEditor();
                break;
            case "discover": {
                diagnosticProject = $("diagnosticProject").value;
                $("discoveryResults").textContent = JSON.stringify(await api(`/api/discover?projectId=${encodeURIComponent(diagnosticProject)}&q=${encodeURIComponent($("discoveryTask").value)}`), null, 2);
                break;
            }
            case "bootstrap": {
                diagnosticProject = $("diagnosticProject").value;
                $("bootstrapResults").textContent = (await api("/api/bootstrap?projectId=" + encodeURIComponent(diagnosticProject))).text;
                break;
            }
            case "review": {
                diagnosticProject = $("diagnosticProject").value;
                $("reviewResults").textContent = JSON.stringify(await api("/api/review", { method: "POST", body: JSON.stringify({ projectId: diagnosticProject || undefined, domain: $("reviewDomain").value, content: $("reviewText").value }) }), null, 2);
                break;
            }
            case "feedback": {
                const note = $("fbNote").value.trim();
                if (!note)
                    throw new Error("Feedback note required");
                await api("/api/feedback", { method: "POST", body: JSON.stringify({ rating: $("fbRating").value, note }) });
                toast("Feedback recorded for review");
                await feedback();
                break;
            }
        }
    }
    catch (e) {
        toast(e instanceof Error ? e.message : String(e));
    }
}
document.addEventListener("click", delegated);
document.addEventListener("change", ev => { const target = ev.target; if (target.name === "assignment")
    syncProjectSelection(); });
document.addEventListener("input", ev => { const target = ev.target; if (target.closest("#projectForm"))
    projectFormDirty = true; if (target.id.startsWith("override-"))
    syncProjectSelection(); });
document.addEventListener("submit", ev => { if (ev.target.id === "projectForm")
    void saveProject(ev); });
$("closeEditor").addEventListener("click", closeEditor);
$("cancelEditor").addEventListener("click", closeEditor);
$("editForm").addEventListener("input", () => { editorDirty = true; });
editor.addEventListener("cancel", ev => { ev.preventDefault(); closeEditor(); });
$("closeRevisions").addEventListener("click", () => revisions.close());
$("closeHelp").addEventListener("click", () => $("helpDialog").close());
$("domainName").addEventListener("input", () => { newDomainDraft = $("domainName").value; });
$("domainCreate").addEventListener("submit", ev => { ev.preventDefault(); void saveDomainName(); });
$("editForm").addEventListener("submit", ev => { void saveEditor(ev); });
function currentRoute() {
    let path = active;
    const params = new URLSearchParams();
    if (["preference", "skill", "example", "review"].includes(active)) {
        path = "library";
        if (active !== "preference")
            params.set("type", active);
    }
    if (active === "projects")
        path += selectedProject ? "/" + encodeURIComponent(selectedProject.id) + (projectEditing ? "/configure" : "") : projectEditing ? "/new" : "";
    if (["preference", "skill", "example", "review", "tool"].includes(active)) {
        if (search)
            params.set("q", search);
        if (domain !== "all")
            params.set("domain", domain);
        if (libraryMode !== "table")
            params.set("mode", libraryMode);
    }
    if (active === "trace") {
        params.set("projectId", traceProject);
        params.set("agent", traceAgent);
        params.set("channel", traceChannel);
        if (traceRecord !== "all")
            params.set("recordId", traceRecord);
        if (traceDemo)
            params.set("demo", "1");
    }
    if (active === "domains" && search)
        params.set("q", search);
    if (active === "projects") {
        if (selectedProject && projectTab !== "styles" && !projectEditing)
            params.set("tab", projectTab);
        if (!selectedProject && search)
            params.set("q", search);
    }
    if (page > 1)
        params.set("page", String(page));
    return "#/" + path + (params.size ? "?" + params.toString() : "");
}
let readingRoute = false;
function updateUrl(replace = false) {
    if (typeof window === "undefined" || readingRoute)
        return;
    const route = currentRoute();
    if (window.location.hash !== route)
        window.history[replace || !window.location.hash ? "replaceState" : "pushState"](null, "", route);
}
async function readRoute() {
    const raw = window.location.hash.replace(/^#\/?/, "");
    const [path, query = ""] = raw.split("?");
    const parts = path.split("/");
    const params = new URLSearchParams(query);
    active = parts[0] === "library" ? (["preference", "skill", "example", "review"].includes(params.get("type") || "") ? params.get("type") : "preference") : Object.hasOwn(labels, parts[0]) ? parts[0] : "overview";
    search = params.get("q") || "";
    domain = params.get("domain") || "all";
    libraryMode = params.get("mode") === "map" ? "map" : "table";
    page = Math.max(1, Math.min(10000, Number(params.get("page")) || 1));
    projectTab = params.get("tab") === "map" ? "map" : params.get("tab") === "personal" ? "personal" : params.get("tab") === "activity" ? "activity" : params.get("tab") === "setup" ? "setup" : "styles";
    if (active === "trace") {
        traceProject = params.get("projectId") || "all";
        traceAgent = params.get("agent") || "all";
        traceChannel = params.get("channel") || "all";
        traceRecord = params.get("recordId") || "all";
        traceDemo = params.get("demo") === "1";
    }
    selectedProject = null;
    projectEditing = false;
    if (active === "projects" && parts[1]) {
        if (parts[1] === "new")
            projectEditing = true;
        else if (/^[a-f0-9-]{36}$/i.test(parts[1])) {
            selectedProject = await api("/api/projects/" + encodeURIComponent(parts[1]));
            projectEditing = parts[2] === "configure";
        }
    }
}
async function loadRoute() {
    try {
        readingRoute = true;
        await readRoute();
        await refresh();
        readingRoute = false;
        updateUrl(true);
    }
    catch (e) {
        layout("Could not open this page", e instanceof Error ? e.message : String(e), '<button class="button primary" data-view="projects">All projects</button>');
    }
    finally {
        readingRoute = false;
    }
}
if (typeof window !== "undefined") {
    window.addEventListener("hashchange", ev => { if (!confirmLeaveProject()) {
        history.replaceState(null, "", ev.oldURL);
        return;
    } void loadRoute(); });
    window.addEventListener("beforeunload", ev => { if (editorDirty || (projectFormDirty && document.getElementById("projectForm")))
        ev.preventDefault(); });
    void loadRoute();
}
else
    void refresh();

import { DatabaseSync } from "node:sqlite";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { validateRequirements } from "./requirements.ts";
import { discoveryMetadata } from "./discovery-metadata.ts";
import { BrainError, DOMAINS, type Project, type ProjectAssignment, type BrainRecord, type Domain, type Feedback, type Kind, type RecordInput, type Revision, type TestRule, validDomain, validKind, slug } from "./models.ts";

export const defaultHome = () => process.env.PB_HOME || join(homedir(), ".personal-brain-style");
export const dbPath = () => join(defaultHome(), "brain.sqlite");

function checkInput(raw: unknown): RecordInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BrainError("Expected record object");
  const x = raw as Record<string, unknown>;
  if(x.projectId!==undefined&&(typeof x.projectId!=="string"||!x.projectId))throw new BrainError("Invalid project scope");
  if(x.keyId!==undefined&&(typeof x.keyId!=="string"||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x.keyId)||x.keyId.length>150))throw new BrainError("Style key must be a lowercase slug of at most 150 characters");
  if (!validKind(x.kind)) throw new BrainError("Invalid record kind");
  if (!validDomain(x.domain)) throw new BrainError("Invalid style domain");
  for (const field of ["title", "summary", "content"] as const) {
    if (typeof x[field] !== "string") throw new BrainError(`Invalid ${field}`);
  }
  if (!(x.title as string).trim() || (x.title as string).length > 150) throw new BrainError("Title must have 1-150 characters");
  if ((x.summary as string).length > 1200 || (x.content as string).length > 100000) throw new BrainError("Record text too long");
  if (!Array.isArray(x.tags) || x.tags.length > 24 || !x.tags.every(t => typeof t === "string" && t.length < 80)) throw new BrainError("Invalid tags");
  if(x.useWhen!==undefined&&(typeof x.useWhen!=="string"||x.useWhen.length>600))throw new BrainError("Use when must be text of at most 600 characters");
  if (typeof x.priority !== "number" || !Number.isInteger(x.priority) || x.priority < 0 || x.priority > 100) throw new BrainError("Priority must be 0-100");
  if (!["active", "draft", "archived"].includes(String(x.status))) throw new BrainError("Invalid status");
  if (!Array.isArray(x.checks) || x.checks.length > 30) throw new BrainError("Invalid review checks");
  if(x.requiredIds!==undefined&&(!Array.isArray(x.requiredIds)||x.requiredIds.length>12||!x.requiredIds.every(id=>typeof id==="string")))throw new BrainError("Required links must contain at most 12 record IDs");
  for(const field of ["principles","externalSkills","reviewCriteria","examples"]){
    if(x[field]!==undefined&&(!Array.isArray(x[field])||(x[field] as unknown[]).length>30||!(x[field] as unknown[]).every(v=>typeof v==="string"&&v.trim().length>0&&v.length<=2000)))throw new BrainError("Invalid "+field);
  }
  const checks: TestRule[] = [];
  for (const c of x.checks) {
    if (!c || typeof c !== "object" || !["contains", "not_contains", "max_length", "min_length"].includes(c.type) ||
       !(typeof c.value === "string" || typeof c.value === "number")) throw new BrainError("Invalid review check");
    checks.push({ type: c.type, value: c.value, label: typeof c.label === "string" ? c.label.slice(0, 200) : undefined });
  }
  let backend = null;
  if (x.kind === "tool" && x.backend !== null && x.backend !== undefined) {
    const b = x.backend as Record<string, unknown>;
    if (typeof b.command !== "string" || !b.command.trim() || !Array.isArray(b.args) || !b.args.every(v => typeof v === "string") ||
      typeof b.toolName !== "string" || typeof b.enabled !== "boolean") throw new BrainError("Invalid MCP backend configuration");
    if (b.args.length > 30 || b.args.some((v: string) => v.length > 500)) throw new BrainError("Tool arguments too long");
    backend = { command: b.command, args: b.args, toolName: b.toolName, enabled: b.enabled, timeoutMs: Math.min(120000, Math.max(1000, Number(b.timeoutMs) || 30000)) };
  }
  return { keyId:(x.keyId as string|undefined)||slug(String(x.title))||"style", sourceStyleId:x.sourceStyleId as string|undefined, projectId:x.projectId as string|undefined, kind: x.kind, domain: x.domain, title: String(x.title).trim(), summary: String(x.summary), content: String(x.content), tags: x.tags as string[],
    useWhen:typeof x.useWhen==="string"?x.useWhen.trim():discoveryMetadata(x as unknown as RecordInput).useWhen,
    requirements:validateRequirements(x.requirements),
    examples:(x.examples||[]) as string[],principles:(x.principles||[]) as string[],externalSkills:(x.externalSkills||[]) as string[],reviewCriteria:(x.reviewCriteria||[]) as string[],
    priority: x.priority as number, status: x.status as RecordInput["status"], requiredIds:[...new Set((x.requiredIds||[]) as string[])], checks, backend };
}
const stopWords=new Set("the a an and or to of for in on with is it this that my me please let should have use when how can do we you all as at by from be are new using".split(" "));
function tokenize(s: string): string[] { return [...new Set(s.toLowerCase().normalize("NFKD").split(/[^\p{L}\p{N}]+/u).filter(t => t.length > 1&&!stopWords.has(t)))]; }
export function rankRecord(record: BrainRecord, query: string): number {
  if (!query.trim()) return record.priority / 20;
  const terms = tokenize(query);
  const fields=[record.title,record.tags.join(" "),record.useWhen||"",record.summary,[record.content,...record.externalSkills||[],...record.examples||[],...record.reviewCriteria||[]].join(" ")].map(value=>new Set(tokenize(value)));
  return terms.reduce((sum,t)=>sum+fields.reduce((score,words,index)=>score+(words.has(t)?[8,6,5,3,1][index]:0),0),0);
}

export class BrainDB {
  db: DatabaseSync;
  constructor(filePath: string = dbPath()) {
    mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filePath);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, snapshot TEXT NOT NULL, kind TEXT NOT NULL, domain TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS records_filter ON records(kind, domain, status);
      CREATE TABLE IF NOT EXISTS revisions (id TEXT PRIMARY KEY, record_id TEXT NOT NULL, version INTEGER NOT NULL, action TEXT NOT NULL, snapshot TEXT NOT NULL, at TEXT NOT NULL, UNIQUE(record_id,version));
      CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, record_id TEXT, rating TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, snapshot TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS domains (id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE, combinable INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, action TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL, detail TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS trace_events (
        id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, run_id TEXT NOT NULL,
        agent TEXT NOT NULL, channel TEXT NOT NULL, event_type TEXT NOT NULL,
        outcome TEXT NOT NULL, record_ids TEXT NOT NULL, record_versions TEXT NOT NULL DEFAULT '{}', metadata TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS trace_by_time ON trace_events(occurred_at DESC);
      CREATE INDEX IF NOT EXISTS trace_by_run ON trace_events(run_id, occurred_at);
    `);
    if(!(this.db.prepare("SELECT name FROM pragma_table_info('domains')").all() as {name:string}[]).some(c=>c.name==="combinable"))this.db.exec("ALTER TABLE domains ADD COLUMN combinable INTEGER NOT NULL DEFAULT 0");
    for(const id of DOMAINS)if(!this.db.prepare("SELECT 1 FROM meta WHERE key=?").get("deleted-domain:"+id))this.db.prepare("INSERT OR IGNORE INTO domains(id,name) VALUES(?,?)").run(id,id);
    if(!this.db.prepare("SELECT value FROM meta WHERE key='capability_names_v1'").get())this.transaction(()=>{
      const names:Record<string,string>={general:"General",thinking:"Thinking",architecture:"Architecture",diagrams:"Diagrams",writing:"Writing",coding:"Coding",technology:"Technology selection",reviews:"Review",communication:"Communication",design:"UI/UX Design",tools:"MCP tools"};
      for(const [id,name] of Object.entries(names))this.db.prepare("UPDATE OR IGNORE domains SET name=? WHERE id=? AND name=?").run(name,id,id);
      for(const [id,name] of [["drawio","Draw.io"],["mermaid","Mermaid"]])this.db.prepare("INSERT OR IGNORE INTO domains(id,name) VALUES(?,?)").run(id,name);
      this.db.prepare("INSERT INTO meta(key,value) VALUES('capability_names_v1','1')").run();
    });
    if(!this.db.prepare("SELECT 1 FROM meta WHERE key='style_keys_v1'").get())this.transaction(()=>{
      const used=new Set<string>();
      const rows=this.db.prepare("SELECT snapshot FROM records ORDER BY json_extract(snapshot,'$.projectId') IS NOT NULL, rowid").all() as {snapshot:string}[];
      for(const row of rows){
        const record=this.parse(row.snapshot),base=record.keyId||slug(record.title)||"style";
        // Preserve conflicting legacy content with a distinct, stable key rather than merging it silently.
        let key=base;
        while(used.has((record.projectId||"global")+":"+key)||used.has("global:"+key))key=base.slice(0,100)+"-"+record.id;
        used.add((record.projectId||"global")+":"+key);
        this.db.prepare("UPDATE records SET snapshot=? WHERE id=?").run(JSON.stringify({...record,keyId:key}),record.id);
      }
      this.db.prepare("INSERT INTO meta(key,value) VALUES('style_keys_v1','1')").run();
    });
    try { chmodSync(filePath, 0o600); } catch { /* permission may be managed by filesystem */ }
    if(!this.db.prepare("SELECT 1 FROM meta WHERE key='discovery_metadata_v1'").get())this.transaction(()=>{
      for(const row of this.db.prepare("SELECT snapshot FROM records").all() as {snapshot:string}[]){
        const record=this.parse(row.snapshot);
        const metadata=discoveryMetadata(record);
        this.write({...record,...metadata,version:record.version+1,updatedAt:new Date().toISOString()},"update");
      }
      this.db.prepare("INSERT INTO meta(key,value) VALUES('discovery_metadata_v1','1')").run();
    });
  }
  domains():Array<{id:string;name:string;combinable:boolean}> {return (this.db.prepare("SELECT id,name,combinable FROM domains ORDER BY name COLLATE NOCASE").all() as Array<{id:string;name:string;combinable:number}>).map(d=>({id:d.id,name:d.name,combinable:!!d.combinable}));}
  // Projects pick one style per kind and capability, except in combinable capabilities where styles stack.
  selectionSlot(record:Pick<BrainRecord,"id"|"kind"|"domain">):string {const row=this.db.prepare("SELECT combinable FROM domains WHERE id=?").get(record.domain) as {combinable:number}|undefined;return record.kind+":"+record.domain+(row?.combinable?":"+record.id:"");}
  hasDomain(id:unknown):id is Domain {return validDomain(id)&&!!this.db.prepare("SELECT 1 FROM domains WHERE id=?").get(id);}
  saveDomain(name:unknown,id?:string,expectedName?:unknown,combinable?:unknown) {
    if(combinable!==undefined&&typeof combinable!=="boolean")throw new BrainError("Combinable must be true or false");
    if(typeof name!=="string"||!name.trim()||name.trim().length>60)throw new BrainError("Domain name must have 1-60 characters");
    const label=name.trim();const key=id||slug(label);
    if(!validDomain(key)||key==="all")throw new BrainError("Use a domain name starting with a letter");
    return this.transaction(()=>{
      const existing=this.domains().find(d=>d.id===key);
      if(id&&!existing)throw new BrainError("Domain not found","NOT_FOUND",404);
      if(id&&existing?.name!==expectedName)throw new BrainError("Domain changed. Refresh and try again.","CONFLICT",409);
      if((!id&&existing)||this.domains().some(d=>d.id!==id&&d.name.toLowerCase()===label.toLowerCase()))throw new BrainError("Domain already exists","CONFLICT",409);
      this.db.prepare("INSERT INTO domains(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name").run(key,label);
      if(combinable!==undefined){
        this.db.prepare("UPDATE domains SET combinable=? WHERE id=?").run(combinable?1:0,key);
        // Turning combining off must not leave a project with two styles in one capability.
        if(!combinable)for(const p of this.projects())this.scopedRecords(p.id);
      }
      this.audit(id?"rename-domain":"create-domain",key,label);
      return this.domains().find(d=>d.id===key)!;
    });
  }
  close() { this.db.close(); }
  private parse(snapshot: string) { return JSON.parse(snapshot) as BrainRecord; }
  get(id: string): BrainRecord | null {
    const row = this.db.prepare("SELECT snapshot FROM records WHERE id = ?").get(id) as {snapshot: string} | undefined;
    return row ? this.parse(row.snapshot) : null;
  }
  privatizeLegacyProjectStyles(projectId:string){
    return this.transaction(()=>{
      this.project(projectId);
      const all=(this.db.prepare("SELECT snapshot FROM records WHERE json_extract(snapshot,'$.projectId') IS NULL").all() as {snapshot:string}[]).map(r=>this.parse(r.snapshot));
      const tags=new Set(["personal-brain-project-design","personal-brain-project-coding","personal-brain-project-technology"]);
      const candidates=new Map(all.filter(r=>r.tags.some(tag=>tags.has(tag))).map(r=>[r.id,r]));
      // Preserve genuine shared consumers; only move records owned exclusively by this project.
      const otherIds=new Set(this.projects().filter(p=>p.id!==projectId).flatMap(p=>this.scopedRecords(p.id).map(r=>r.id)));
      let changed=true;
      while(changed){changed=false;for(const id of candidates.keys())if(otherIds.has(id)||all.some(r=>!candidates.has(r.id)&&(r.requiredIds||[]).includes(id))){candidates.delete(id);changed=true;}}
      for(const record of candidates.values())this.write({...record,projectId,version:record.version+1,updatedAt:new Date().toISOString()},"update");
      for(const record of candidates.values())this.validateRequired(this.get(record.id)!);
      const selected=new Set(this.scopedRecords(projectId).map(r=>r.id));
      const locals=this.list({projectId,limit:300}).filter(r=>r.projectId===projectId);
      for(const record of locals){
        if(selected.has(record.id)||!record.tags.some(tag=>tags.has(tag)))continue;
        const active=locals.find(r=>selected.has(r.id)&&r.title===record.title&&r.domain===record.domain&&r.kind===record.kind);
        const first=this.db.prepare("SELECT snapshot FROM revisions WHERE record_id=? AND version=1").get(record.id) as {snapshot:string}|undefined;
        if(active&&first&&!this.parse(first.snapshot).projectId)this.update(record.id,{title:record.title.slice(0,135)+" (legacy copy)"},record.version);
      }
      return candidates.size;
    });
  }
  list(filter: { projectId?:string; kind?: Kind; domain?: Domain; status?: string; query?: string; limit?: number } = {}): BrainRecord[] {
    let sql = "SELECT snapshot FROM records WHERE 1=1"; const args: string[] = [];
    if(filter.projectId)this.project(filter.projectId);
    sql += " AND (json_extract(snapshot,'$.projectId') IS NULL"+(filter.projectId?" OR json_extract(snapshot,'$.projectId')=?":"")+")";
    if(filter.projectId)args.push(filter.projectId);
    if (filter.kind) { sql += " AND kind=?"; args.push(filter.kind); }
    if (filter.domain) { sql += " AND domain=?"; args.push(filter.domain); }
    if (filter.status) { sql += " AND status=?"; args.push(filter.status); }
    const rows = this.db.prepare(sql).all(...args) as {snapshot:string}[];
    const query = String(filter.query || "");
    const list = rows.map(r => this.parse(r.snapshot)).map(r => ({r,score:rankRecord(r,query)}));
    list.sort((a,b) => (query ? b.score - a.score : b.r.priority - a.r.priority) || b.r.priority - a.r.priority || b.r.updatedAt.localeCompare(a.r.updatedAt));
    return list.filter(v => !query || v.score > 0).slice(0, Math.min(300, Math.max(1, filter.limit ?? 100))).map(v => v.r);
  }
  capabilityStats(){
    const records=(this.db.prepare("SELECT snapshot FROM records WHERE status!='archived' AND json_extract(snapshot,'$.projectId') IS NULL").all() as {snapshot:string}[]).map(r=>this.parse(r.snapshot));
    const usage=new Map<string,Set<string>>();
    for(const p of this.projects()){
      const seen=new Set<string>();const visit=(id:string)=>{if(seen.has(id))return;seen.add(id);const r=this.get(id);if(!r||r.status!=="active"||(r.projectId&&r.projectId!==p.id))return;
        if(!r.projectId){if(!usage.has(r.domain))usage.set(r.domain,new Set());usage.get(r.domain)!.add(p.id);}
        for(const child of r.requiredIds||[])visit(child);
      };p.assignments.forEach(a=>visit(a.recordId));
    }
    return this.domains().map(d=>{const rows=records.filter(r=>r.domain===d.id);return {...d,styles:rows.filter(r=>r.kind==="preference").length,skills:rows.filter(r=>r.kind==="skill").length+rows.reduce((n,r)=>n+(r.externalSkills?.length||0),0),examples:rows.filter(r=>r.kind==="example").length+rows.reduce((n,r)=>n+(r.examples?.length||0),0),rules:rows.filter(r=>r.kind==="review").length+rows.reduce((n,r)=>n+(r.reviewCriteria?.length||0)+r.checks.length,0),projects:usage.get(d.id)?.size||0};});
  }
  projectDefaultStyleIds():string[]{
    const row=this.db.prepare("SELECT value FROM meta WHERE key='new_project_style_defaults_v1'").get() as {value:string}|undefined;
    const ids:string[]=row?JSON.parse(row.value):[];const slots=new Set<string>();
    return ids.filter(id=>{const r=this.get(id);if(!r||r.projectId||r.status!=="active")return false;const slot=this.selectionSlot(r);if(slots.has(slot))return false;slots.add(slot);return true;});
  }
  summary() {
    const all = this.list({limit:300});
    const counts = Object.fromEntries(["preference","skill","example","review","tool"].map(k => [k, all.filter(r => r.kind === k && r.status === "active").length]));
    return { counts, projectDefaultStyleIds:this.projectDefaultStyleIds(), domains: this.domains().map(d=>d.id), domainRegistry:this.capabilityStats(), total: all.length, revisions: (this.db.prepare("SELECT count(*) AS n FROM revisions").get() as {n:number}).n,
      feedback: (this.db.prepare("SELECT count(*) AS n FROM feedback").get() as {n:number}).n };
  }
  transaction<T>(cb: () => T): T {
    this.db.exec("SAVEPOINT brain_write");
    try { const result = cb(); this.db.exec("RELEASE brain_write"); return result; }
    catch (e) { this.db.exec("ROLLBACK TO brain_write; RELEASE brain_write"); throw e; }
  }
  deletionPreview(kind:string,id:string){
    if(!["record","domain","project","reset"].includes(kind))throw new BrainError("Invalid removal type");
    const all=(this.db.prepare("SELECT snapshot FROM records").all() as {snapshot:string}[]).map(r=>this.parse(r.snapshot));
    let title=id;
    if(kind==="record"){const r=this.get(id);if(!r)throw new BrainError("Record not found","NOT_FOUND",404);title=r.title;}
    if(kind==="domain"){const d=this.domains().find(d=>d.id===id);if(!d)throw new BrainError("Capability not found","NOT_FOUND",404);title=d.name;}
    if(kind==="project"||kind==="reset")title=this.project(id).name;
    const records=all.filter(r=>kind==="record"?r.id===id:kind==="domain"?r.domain===id:r.projectId===id);
    const ids=new Set(records.map(r=>r.id));
    const links=all.filter(r=>!ids.has(r.id)&&((r.requiredIds||[]).some(x=>ids.has(x))||!!r.sourceStyleId&&ids.has(r.sourceStyleId)));
    const projects=this.projects().filter(p=>p.id===id&&(kind==="project"||kind==="reset")||p.assignments.some(a=>ids.has(a.recordId)));
    let restored:Array<{recordId:string;override:null}>=[];
    if(kind==="reset"){
      const baseline=this.db.prepare("SELECT value FROM meta WHERE key=?").get("project-style-baseline:"+id) as {value:string}|undefined;
      restored=(baseline?JSON.parse(baseline.value):this.project(id).assignments).filter((a:{recordId:string})=>{const r=this.get(a.recordId);return r&&!r.projectId&&r.status==="active";}).map((a:{recordId:string})=>({recordId:a.recordId,override:null}));
    }
    const fingerprint=createHmac("sha256","deletion-preview").update(JSON.stringify({kind,id,all:all.map(r=>[r.id,r.version]),projects:this.projects(),domains:this.domains(),restored})).digest("hex");
    return {kind,id,title,records:records.map(r=>({id:r.id,title:r.title})),linkedRecords:links.map(r=>({id:r.id,title:r.title})),projects:projects.map(p=>({id:p.id,name:p.name})),restored:restored.map(a=>({...a,title:this.get(a.recordId)!.title})),fingerprint};
  }
  deleteWithPreview(kind:string,id:string,fingerprint:string){
    return this.transaction(()=>{
      const preview=this.deletionPreview(kind,id);
      if(fingerprint!==preview.fingerprint)throw new BrainError("Data changed. Review a fresh deletion preview.","CONFLICT",409);
      const ids=new Set(preview.records.map(r=>r.id));
      for(const linked of preview.linkedRecords){const r=this.get(linked.id)!;this.write({...r,requiredIds:(r.requiredIds||[]).filter(x=>!ids.has(x)),version:r.version+1,updatedAt:new Date().toISOString()},"update");}
      for(const p of this.projects()){
        if(kind==="project"&&p.id===id){this.db.prepare("DELETE FROM projects WHERE id=?").run(id);continue;}
        const assignments=kind==="reset"&&p.id===id?preview.restored.map(({recordId})=>({recordId,override:null})):p.assignments.filter(a=>!ids.has(a.recordId));
        if(JSON.stringify(assignments)!==JSON.stringify(p.assignments))this.db.prepare("UPDATE projects SET snapshot=? WHERE id=?").run(JSON.stringify({...p,assignments,version:p.version+1,updatedAt:new Date().toISOString()}),p.id);
      }
      for(const recordId of ids){
        const removed=this.get(recordId);
        if(removed?.projectId&&removed.tags.includes("auto-project-discovery")&&kind!=="project")this.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)").run("discovery-paused:"+removed.projectId,"1");
        for(const table of ["revisions","feedback"])this.db.prepare(`DELETE FROM ${table} WHERE record_id=?`).run(recordId);
        this.db.prepare("DELETE FROM records WHERE id=?").run(recordId);
        this.db.prepare("DELETE FROM audit WHERE target=?").run(recordId);
        this.db.prepare("DELETE FROM trace_events WHERE EXISTS (SELECT 1 FROM json_each(trace_events.record_ids) WHERE value=?)").run(recordId);
      }
      for(const row of this.db.prepare("SELECT snapshot FROM records WHERE json_extract(snapshot,'$.sourceStyleId') IS NOT NULL").all() as {snapshot:string}[]){
        const record=this.parse(row.snapshot);
        if(ids.has(record.sourceStyleId!))this.write({...record,sourceStyleId:undefined,version:record.version+1,updatedAt:new Date().toISOString()},"update");
      }
      const defaults=this.db.prepare("SELECT value FROM meta WHERE key='new_project_style_defaults_v1'").get() as {value:string}|undefined;
      for(const row of this.db.prepare("SELECT key,value FROM meta WHERE key LIKE 'fusion:%' OR key LIKE 'instruction-set:%'").all() as {key:string;value:string}[]){
        const snapshot=JSON.parse(row.value);
        const projectAffected=(kind==="project"||kind==="reset")&&(snapshot.projectId===id||snapshot.projectIds?.includes(id)||snapshot.sources?.some((r:any)=>r.contextProjectId===id||r.projectId===id));
        const recordAffected=[...(snapshot.resolvedIds||snapshot.recordIds||[]),...(snapshot.sources||[]).map((r:any)=>r.recordId||r.id),...(snapshot.targets||[]).map((r:any)=>r.id)].some((recordId:string)=>ids.has(recordId));
        if(projectAffected||recordAffected)this.db.prepare("DELETE FROM meta WHERE key=?").run(row.key);
      }
      if(defaults)this.db.prepare("UPDATE meta SET value=? WHERE key='new_project_style_defaults_v1'").run(JSON.stringify(JSON.parse(defaults.value).filter((x:string)=>!ids.has(x))));
      for(const row of this.db.prepare("SELECT key,value FROM meta WHERE key LIKE 'project-style-baseline:%'").all() as {key:string;value:string}[])this.db.prepare("UPDATE meta SET value=? WHERE key=?").run(JSON.stringify(JSON.parse(row.value).filter((a:{recordId:string})=>!ids.has(a.recordId))),row.key);
      if(kind==="domain"){this.db.prepare("DELETE FROM domains WHERE id=?").run(id);this.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)").run("deleted-domain:"+id,"1");}
      if(kind==="project"){
        for(const prefix of ["repository:","project-style-baseline:","discovery-paused:"])this.db.prepare("DELETE FROM meta WHERE key=?").run(prefix+id);
        this.db.prepare("DELETE FROM trace_events WHERE json_extract(metadata,'$.projectId')=?").run(id);
      }
      if(kind==="reset"){
        this.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)").run("discovery-paused:"+id,"1");this.scopedRecords(id);
      }
      return preview;
    });
  }
  projectRecordByTag(projectId:string,tag:string):BrainRecord|undefined {
    const row=this.db.prepare("SELECT snapshot FROM records WHERE json_extract(snapshot,'$.projectId')=? AND EXISTS (SELECT 1 FROM json_each(records.snapshot,'$.tags') WHERE value=?) LIMIT 1").get(projectId,tag) as {snapshot:string}|undefined;
    return row?this.parse(row.snapshot):undefined;
  }
  create(raw: unknown, uniqueProjectTag?:string): BrainRecord {
    const input = checkInput(raw); if(input.projectId)this.project(input.projectId); if(!this.hasDomain(input.domain))throw new BrainError("Register this domain before using it"); const now = new Date().toISOString();
    const rec: BrainRecord = { ...input, id: randomUUID(), version: 1, createdAt: now, updatedAt: now };
    return this.transaction(() => {
      if(uniqueProjectTag){
        if(!input.projectId||!input.tags.includes(uniqueProjectTag))throw new BrainError("Unique discovery tags require a project-private record");
        const existing=this.projectRecordByTag(input.projectId,uniqueProjectTag);
        if(existing)return existing;
      }
      if(input.sourceStyleId)throw new BrainError("Use project personalization to link a global style");
      if(input.projectId){
        const existing=this.styleByKey(input.keyId!,input.projectId);
        if(existing){
          if(existing.kind!==input.kind||existing.domain!==input.domain)throw new BrainError("Style key belongs to a different capability or type","CONFLICT",409);
          const localRow=this.db.prepare("SELECT snapshot FROM records WHERE json_extract(snapshot,'$.keyId')=? AND json_extract(snapshot,'$.projectId')=?").get(input.keyId!,input.projectId) as {snapshot:string}|undefined;
          const local=localRow?this.parse(localRow.snapshot):undefined;
          if(local)return this.update(local.id,{...input,sourceStyleId:local.sourceStyleId},local.version);
          const project=this.project(input.projectId);
          if(!this.scopedRecords(project.id).some(r=>r.id===existing.id))this.saveProject({...project,assignments:[...project.assignments,{recordId:existing.id,override:null}]},project.id,project.version);
          return this.personalizeRecord(project.id,existing.id,input,existing.version,this.project(project.id).version);
        }
      }
      this.validateRequired(rec);this.write(rec,"create");return rec;
    });
  }
  update(id: string, raw: unknown, expectedVersion: number): BrainRecord {
    return this.transaction(() => {
      const prev = this.get(id);
      if (!prev) throw new BrainError("Record not found", "NOT_FOUND", 404);
      if (prev.version !== expectedVersion) throw new BrainError("Version conflict. Refresh and try again.", "CONFLICT", 409);
      const input = checkInput({...prev,...raw as object}); if(input.keyId!==prev.keyId||input.sourceStyleId!==prev.sourceStyleId)throw new BrainError("Style identity cannot be changed"); if(input.projectId!==prev.projectId)throw new BrainError("Record scope cannot be changed"); if(!this.hasDomain(input.domain))throw new BrainError("Register this domain before using it"); const rec: BrainRecord = {...prev,...input,version:prev.version+1,updatedAt:new Date().toISOString()};
      this.validateRequired(rec);this.write(rec,"update"); return rec;
    });
  }
  restore(id: string, targetVersion: number, expectedVersion: number): BrainRecord {
    return this.transaction(() => {
      const prev = this.get(id);
      if (!prev) throw new BrainError("Record not found", "NOT_FOUND", 404);
      if (prev.version !== expectedVersion) throw new BrainError("Version conflict", "CONFLICT", 409);
      const row = this.db.prepare("SELECT snapshot FROM revisions WHERE record_id=? AND version=?").get(id,targetVersion) as {snapshot:string}|undefined;
      if (!row) throw new BrainError("Revision not found", "NOT_FOUND", 404);
      const historical = this.parse(row.snapshot); const rec: BrainRecord = {...prev, ...checkInput(historical), keyId:prev.keyId, sourceStyleId:prev.sourceStyleId, projectId:prev.projectId, version: prev.version+1, updatedAt:new Date().toISOString()};
      this.validateRequired(rec);this.write(rec,"restore"); return rec;
    });
  }
  private styleByKey(keyId:string,projectId?:string):BrainRecord|undefined {
    const rows=this.db.prepare("SELECT snapshot FROM records WHERE json_extract(snapshot,'$.keyId')=? AND (json_extract(snapshot,'$.projectId') IS NULL OR json_extract(snapshot,'$.projectId')=?) ORDER BY json_extract(snapshot,'$.projectId') IS NOT NULL").all(keyId,projectId||"") as {snapshot:string}[];
    return rows.map(row=>this.parse(row.snapshot))[0];
  }
  private write(rec: BrainRecord,action: Revision["action"]) {
    rec.keyId ||= slug(rec.title)||"style";
    const matches=(this.db.prepare("SELECT snapshot FROM records WHERE json_extract(snapshot,'$.keyId')=? AND id!=?").all(rec.keyId,rec.id) as {snapshot:string}[]).map(row=>this.parse(row.snapshot));
    if(matches.some(r=>r.projectId===rec.projectId||(!r.projectId&&rec.sourceStyleId!==r.id)||(!rec.projectId&&r.sourceStyleId!==rec.id)))throw new BrainError("Style key already exists. Reuse the global style or update the project style.","CONFLICT",409);
    if(rec.sourceStyleId){const source=this.get(rec.sourceStyleId);if(!rec.projectId||!source||source.projectId||source.keyId!==rec.keyId)throw new BrainError("Invalid global style personalization link");}
    const snapshot = JSON.stringify(rec);
    this.db.prepare(`INSERT INTO records(id,snapshot,kind,domain,status,version,updated_at) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET snapshot=excluded.snapshot,kind=excluded.kind,domain=excluded.domain,status=excluded.status,version=excluded.version,updated_at=excluded.updated_at`).run(
      rec.id,snapshot,rec.kind,rec.domain,rec.status,rec.version,rec.updatedAt);
    this.db.prepare("INSERT INTO revisions(id,record_id,version,action,snapshot,at) VALUES(?,?,?,?,?,?)")
      .run(randomUUID(),rec.id,rec.version,action,snapshot,rec.updatedAt);
    this.audit(action,rec.id,`v${rec.version}`);
  }
  history(id:string): Revision[] {
    return (this.db.prepare("SELECT id,record_id,version,action,snapshot,at FROM revisions WHERE record_id=? ORDER BY version DESC").all(id) as Array<{id:string,record_id:string,version:number,action:Revision["action"],snapshot:string,at:string}>).map(r=>({id:r.id,recordId:r.record_id,version:r.version,action:r.action,snapshot:this.parse(r.snapshot),at:r.at}));
  }
  addFeedback(input:{ recordId?:string|null; rating:string; note:string }): Feedback {
    if (!["accepted","rejected","correction"].includes(input.rating)) throw new BrainError("Invalid rating");
    if (!input.note || input.note.length > 10000) throw new BrainError("Feedback note required, max 10000 characters");
    if (input.recordId && !this.get(input.recordId)) throw new BrainError("Referenced record not found", "NOT_FOUND",404);
    const f:Feedback = {id:randomUUID(),recordId:input.recordId||null,rating:input.rating as Feedback["rating"],note:input.note,createdAt:new Date().toISOString()};
    this.db.prepare("INSERT INTO feedback(id,record_id,rating,note,created_at) VALUES(?,?,?,?,?)").run(f.id,f.recordId,f.rating,f.note,f.createdAt);
    this.audit("feedback",f.recordId||"general",f.rating); return f;
  }
  listFeedback(): Feedback[] { return (this.db.prepare("SELECT id,record_id AS recordId,rating,note,created_at AS createdAt FROM feedback ORDER BY created_at DESC LIMIT 200").all() as Feedback[]); }
  private audit(action:string,target:string,detail:string) { this.db.prepare("INSERT INTO audit(id,action,target,created_at,detail) VALUES(?,?,?,?,?)").run(randomUUID(),action,target,new Date().toISOString(),detail); }
  auditLog() { return this.db.prepare("SELECT action,target,created_at AS createdAt,detail FROM audit ORDER BY created_at DESC LIMIT 100").all(); }
  /** Stable private digest for correlating repeated prompts without storing their text. */
  fingerprint(value:string) {
    let row=this.db.prepare("SELECT value FROM meta WHERE key='trace_hmac_secret'").get() as {value:string}|undefined;
    if(!row) {
      this.db.prepare("INSERT OR IGNORE INTO meta(key,value) VALUES ('trace_hmac_secret',?)").run(randomBytes(32).toString("hex"));
      row=this.db.prepare("SELECT value FROM meta WHERE key='trace_hmac_secret'").get() as {value:string};
    }
    return createHmac("sha256",Buffer.from(row.value,"hex")).update(value).digest("hex").slice(0,16);
  }
  /** Telemetry stores metadata only; never store full prompts, generated content or tool parameters. */
  trace(event: {
    agent: string; channel: string; eventType: string; outcome?: string;
    runId?: string | null; recordIds?: string[]; recordVersions?: Record<string,number>; metadata?: Record<string, unknown>; demo?: boolean;
  }) {
    const safe = (value:unknown, limit=160) => String(value ?? "").slice(0, limit);
    const allowed = ["claude", "codex", "opencode", "chatgpt", "unknown", "web", "test"];
    const agent = allowed.includes(event.agent) ? event.agent : "unknown";
    const runId = safe(event.runId || `${agent}:${event.channel}:unlinked`, 180);
    // Whitelist telemetry keys; explicit compliance submissions also contain bounded review evidence.
    const safeMetadata: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(event.metadata || {})) {
      if (!/^(client|domain|count|recordCount|contextChars|promptChars|promptHash|matchedDomains|resultCount|checkCount|passed|step|note|tool|version|sessionLinked|projectId|origin|tested|complianceReport)$/i.test(key)) continue;
      if (["string", "number", "boolean"].includes(typeof value) || value === null) {
        safeMetadata[key] = typeof value === "string" ? safe(value, key==="complianceReport"?100000:160) : value as number | boolean | null;
      }
    }
    const item = {
      id: randomUUID(), occurredAt: new Date().toISOString(), runId,
      agent, channel: safe(event.channel, 50), eventType: safe(event.eventType, 80),
      outcome: safe(event.outcome || "observed", 24),
      recordIds: (event.recordIds || []).filter(x=>/^[a-f0-9-]{36}$/i.test(x)).slice(0,40),
      recordVersions:Object.fromEntries(Object.entries(event.recordVersions||{}).filter(([id,v])=>/^[a-f0-9-]{36}$/i.test(id)&&Number.isInteger(v)&&v>0).slice(0,40)),
      metadata: safeMetadata, demo: !!event.demo
    };
    this.db.prepare(`INSERT INTO trace_events(id,occurred_at,run_id,agent,channel,event_type,outcome,record_ids,record_versions,metadata,demo) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(item.id,item.occurredAt,item.runId,item.agent,item.channel,item.eventType,item.outcome,JSON.stringify(item.recordIds),JSON.stringify(item.recordVersions),JSON.stringify(item.metadata),item.demo?1:0);
    return item;
  }
  listTrace(filter:{projectId?:string;agent?:string;channel?:string;runId?:string;recordId?:string;includeDemo?:boolean;limit?:number}={}) {
    const filters:string[]=[]; const args:(string|number)[]=[];
    if(!filter.includeDemo){filters.push("demo = 0");}
    if(filter.projectId&&filter.projectId!=="all"){
      if(filter.projectId==="unscoped")filters.push("json_extract(metadata,'$.projectId') IS NULL");
      else {this.project(filter.projectId);filters.push("json_extract(metadata,'$.projectId')=?");args.push(filter.projectId);}
    }
    if(filter.agent && filter.agent!=="all"){filters.push("agent=?");args.push(filter.agent);}
    if(filter.channel && filter.channel!=="all"){filters.push("channel=?");args.push(filter.channel);}
    if(filter.runId){filters.push("run_id=?");args.push(filter.runId);}
    if(filter.recordId){filters.push("instr(record_ids,?) > 0");args.push(JSON.stringify(filter.recordId).slice(1,-1));}
    args.push(Math.min(500,Math.max(1,Number(filter.limit)||150)));
    const where=filters.length?" WHERE "+filters.join(" AND "):"";
    const rows=this.db.prepare(`SELECT id,occurred_at AS occurredAt,run_id AS runId,agent,channel,event_type AS eventType,outcome,record_ids AS recordIds,record_versions AS recordVersions,metadata,demo FROM trace_events${where} ORDER BY occurred_at DESC,rowid DESC LIMIT ?`).all(...args) as Array<{recordIds:string;recordVersions:string;metadata:string;demo:number}>;
    return rows.map(r=>({...r,recordIds:JSON.parse(r.recordIds) as string[],recordVersions:JSON.parse(r.recordVersions) as Record<string,number>,metadata:JSON.parse(r.metadata) as Record<string,unknown>,demo:!!r.demo}));
  }
  projectActivity(projectId:string) {
    this.project(projectId);
    const rows=this.db.prepare(`SELECT agent,run_id AS threadId,MAX(occurred_at) AS lastSeen,COUNT(*) AS calls,COALESCE(SUM(CASE WHEN channel='hook' THEN CAST(json_extract(metadata,'$.contextChars') AS INTEGER) ELSE 0 END),0) AS contextChars
      FROM trace_events WHERE demo=0 AND outcome IN ('success','emitted')
      AND json_extract(metadata,'$.projectId')=? AND json_extract(metadata,'$.sessionLinked')=1
      GROUP BY agent,run_id ORDER BY lastSeen DESC`).all(projectId) as Array<{agent:string;threadId:string;lastSeen:string;calls:number;contextChars:number}>;
    const cutoff=Date.now()-15*60*1000;
    const sessions=rows.map(r=>({...r,estimatedContextTokens:Math.ceil(r.contextChars/4),active:Date.parse(r.lastSeen)>=cutoff}));
    const unlinked=(this.db.prepare(`SELECT COUNT(*) AS n FROM trace_events WHERE demo=0 AND outcome IN ('success','emitted')
      AND json_extract(metadata,'$.projectId')=? AND COALESCE(json_extract(metadata,'$.sessionLinked'),0)!=1`).get(projectId) as {n:number}).n;
    const reviews=this.db.prepare("SELECT occurred_at AS at, metadata FROM trace_events WHERE demo=0 AND event_type='compliance.review' AND json_extract(metadata,'$.projectId')=? ORDER BY occurred_at DESC,rowid DESC LIMIT 20").all(projectId) as Array<{at:string;metadata:string}>;
    return {complianceReviews:reviews.map(r=>({at:r.at,...JSON.parse(JSON.parse(r.metadata).complianceReport)})),linked:sessions.length,active:sessions.filter(r=>r.active).length,unlinkedCalls:unlinked,sessions:sessions.slice(0,100),activityWindowMinutes:15};
  }
  deliveryHealth() {
    const rows=this.db.prepare(`SELECT agent,event_type AS eventType,MAX(occurred_at) AS lastSeen,COUNT(*) AS count
      FROM trace_events WHERE demo=0 AND outcome IN ('success','emitted')
      AND event_type IN ('mcp.initialize','mcp.brain_get','hook.session.context','hook.prompt.context')
      GROUP BY agent,event_type`).all() as Array<{agent:string;eventType:string;lastSeen:string;count:number}>;
    const stages={handshake:'mcp.initialize',retrieval:'mcp.brain_get',sessionHook:'hook.session.context',promptHook:'hook.prompt.context'};
    return {note:'Historical observations, not a live connection check or proof of instruction compliance. Unknown means no successful event was recorded.',
      agents:['claude','codex','opencode','chatgpt','unknown'].map(agent=>({agent,stages:Object.fromEntries(Object.entries(stages).map(([name,event])=>{
        const row=rows.find(r=>r.agent===agent&&r.eventType===event);
        return [name,{status:row?'observed':'unknown',count:row?.count||0,lastSeen:row?.lastSeen||null}];
      }))}))};
  }
  traceStats(projectId?:string) {
    let scope=""; const args:string[]=[];
    if(projectId&&projectId!=="all"){
      if(projectId==="unscoped")scope=" AND json_extract(metadata,'$.projectId') IS NULL";
      else {this.project(projectId);scope=" AND json_extract(metadata,'$.projectId')=?";args.push(projectId);}
    }
    const rows=this.db.prepare(`SELECT event_type AS name,COUNT(*) AS count FROM trace_events WHERE demo=0${scope} GROUP BY event_type ORDER BY count DESC`).all(...args) as {name:string,count:number}[];
    const get=(name:string)=>rows.find(r=>r.name===name)?.count||0;
    const context=this.db.prepare(`SELECT COALESCE(SUM(CAST(json_extract(metadata,'$.contextChars') AS INTEGER)),0) AS chars FROM trace_events WHERE demo=0 AND channel='hook' AND outcome='emitted'${scope}`).get(...args) as {chars:number};
    return {estimatedContextTokens:Math.ceil(context.chars/4),tokenUsageNote:"Rough estimate: emitted hook characters / 4. Not model input/output usage, cached tokens or billing. Model usage is unavailable without host reports.",events:rows.reduce((n,r)=>n+r.count,0),byEvent:rows,
      startup: get("hook.session.context"),promptMatches:get("hook.prompt.context"),
      discovery:get("mcp.brain_discover"),retrieval:get("mcp.brain_get"),
      reviews:get("mcp.brain_review"),feedback:get("mcp.brain_feedback"),
      note:"Observed calls and delivered instructions are not proof the agent followed them. Artifact quality must be evaluated separately."};
  }
  seedTraceDemo() {
    if((this.db.prepare("SELECT COUNT(*) AS n FROM trace_events WHERE demo=1").get() as {n:number}).n) return 0;
    const diagram = this.list({kind:"skill",status:"active"}).find(r=>r.domain==="diagrams");
    const style = this.list({kind:"preference",status:"active"}).find(r=>r.domain==="diagrams");
    const writing = this.list({kind:"skill",status:"active"}).find(r=>r.domain==="writing");
    const runs=[
      {agent:"claude",runId:"demo-claude-drawing",stages:[
        ["hook","hook.session.context","delivered",[],"Global working style loaded"],
        ["hook","hook.prompt.context","delivered",[diagram?.id,style?.id],"Drawing instructions matched"],
        ["mcp","mcp.brain_discover","success",[diagram?.id,style?.id],"Skill catalog searched"],
        ["mcp","mcp.brain_get","success",[diagram?.id],"Full drawing skill retrieved"],
        ["mcp","mcp.brain_review","success",[diagram?.id],"Example review submitted"]
      ]},
      {agent:"codex",runId:"demo-codex-writing",stages:[
        ["hook","hook.session.context","delivered",[],"Global working style loaded"],
        ["hook","hook.prompt.context","delivered",[writing?.id],"Writing procedure matched"],
        ["mcp","mcp.brain_discover","success",[writing?.id],"Document skills searched"],
        ["mcp","mcp.brain_get","success",[writing?.id],"Writing procedure retrieved"]
      ]}
    ] as const;
    let count=0;
    for(const run of runs) for(const [channel,eventType,outcome,ids,note] of run.stages) {
      this.trace({agent:run.agent,runId:run.runId,channel,eventType,outcome,recordIds:ids.filter((x):x is string=>!!x),recordVersions:Object.fromEntries(ids.filter((x):x is string=>!!x).map(id=>[id,this.get(id)?.version||1])),metadata:{note,origin:"demonstration"},demo:true});count++;
    }
    return count;
  }
  clearTraceDemo() {return this.db.prepare("DELETE FROM trace_events WHERE demo=1").run().changes;}
  private validateRequired(record:BrainRecord) {
    const visiting=new Set<string>();const done=new Set<string>();
    const visit=(r:BrainRecord)=>{
      if(done.has(r.id))return;
      if(visiting.has(r.id))throw new BrainError("Required links cannot contain a cycle");
      visiting.add(r.id);
      for(const id of r.requiredIds||[]){
        const linked=id===record.id?record:this.get(id);
        if(!linked||linked.status!=="active")throw new BrainError("Required linked record must exist and be active: "+id);
        if(linked.projectId&&linked.projectId!==record.projectId)throw new BrainError("Dependency belongs to another project");
        visit(linked);
      }
      visiting.delete(r.id);done.add(r.id);
    };
    visit(record);
  }
  requiredRecords(roots:BrainRecord[],projectId?:string):BrainRecord[] {
    const effective=new Map(this.scopedRecords(projectId).map(r=>[r.id,r]));
    const result:BrainRecord[]=[];const done=new Set<string>();const visiting=new Set<string>();
    const visit=(record:BrainRecord)=>{
      if(visiting.has(record.id))throw new BrainError("Required-link cycle");
      if(done.has(record.id))return;
      visiting.add(record.id);
      for(const id of record.requiredIds||[]){
        const linked=effective.get(id);
        if(!linked)throw new BrainError("Required linked style is inactive or replaced by project scope: "+id);
        visit(linked);
      }
      visiting.delete(record.id);done.add(record.id);result.push(record);
    };
    roots.forEach(visit);return result;
  }
  projects():Project[] {
    return (this.db.prepare("SELECT snapshot FROM projects ORDER BY rowid DESC").all() as {snapshot:string}[]).map(r=>JSON.parse(r.snapshot));
  }
  project(id:string):Project {
    const row=this.db.prepare("SELECT snapshot FROM projects WHERE id=?").get(id) as {snapshot:string}|undefined;
    if(!row)throw new BrainError("Project not found","NOT_FOUND",404);
    return JSON.parse(row.snapshot);
  }
  saveProject(raw:unknown,id?:string,expectedVersion?:number):Project {
    if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new BrainError("Invalid project");
    const x=raw as Record<string,unknown>;
    if(typeof x.name!=="string"||!x.name.trim()||x.name.length>150)throw new BrainError("Project name must have 1–150 characters");
    if(typeof x.description!=="string"||x.description.length>1200)throw new BrainError("Description must have at most 1200 characters");
    if(!Array.isArray(x.assignments)||x.assignments.length>300)throw new BrainError("Invalid assignments");
    return this.transaction(()=>{
      const previous=id?this.project(id):null;
      if(previous&&previous.version!==expectedVersion)throw new BrainError("Project changed. Reload before saving.","CONFLICT",409);
      const slots=new Set<string>();
      const assignments:ProjectAssignment[]=(x.assignments as unknown[]).map((value:unknown)=>{
        if(!value||typeof value!=="object")throw new BrainError("Invalid assignment");
        const a=value as Record<string,unknown>;
        if(typeof a.recordId!=="string")throw new BrainError("Invalid record ID");
        const record=this.get(a.recordId);
        if(!record||record.status!=="active"||record.kind==="tool")throw new BrainError("Select an active library record");
        if(record.projectId&&record.projectId!==id)throw new BrainError("Style belongs to another project");
        const slot=this.selectionSlot(record);
        if(slots.has(slot))throw new BrainError("Conflicting selections: choose one "+record.kind+" for "+record.domain);
        slots.add(slot);
        if(a.override!==null&&(typeof a.override!=="string"||!a.override.trim()||a.override.length>100000))throw new BrainError("Override must be non-empty text or null");
        return {recordId:record.id,override:a.override as string|null};
      });
      const project:Project={id:previous?.id||randomUUID(),name:(x.name as string).trim(),description:x.description as string,assignments,version:(previous?.version||0)+1,updatedAt:new Date().toISOString()};
      this.db.prepare("INSERT INTO projects(id,snapshot) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET snapshot=excluded.snapshot").run(project.id,JSON.stringify(project));
      return project;
    });
  }
  installRequiredLinks(updates:Map<string,string[]>,marker:string){
    this.transaction(()=>{
      for(const [id,requiredIds] of updates){
        const record=this.get(id);if(!record)throw new BrainError("Record not found");
        if(JSON.stringify(record.requiredIds||[])===JSON.stringify(requiredIds))continue;
        const next={...record,...checkInput({...record,requiredIds}),version:record.version+1,updatedAt:new Date().toISOString()};
        this.validateRequired(next);this.write(next,"update");
      }
      // Roll back the entire audit if any project's selected slots would conflict.
      for(const project of this.projects())this.scopedRecords(project.id);
      this.db.prepare("INSERT INTO meta(key,value) VALUES(?,?)").run(marker,"done");
    });
  }
  publishProjectRecord(projectId:string,recordId:string,expectedVersion:number) {
    return this.transaction(()=>{
      this.project(projectId);
      const source=this.get(recordId);
      if(!source||source.projectId!==projectId)throw new BrainError("Private project record not found","NOT_FOUND",404);
      if(source.version!==expectedVersion)throw new BrainError("Version conflict. Reload before publishing.","CONFLICT",409);
      const copies=new Map<string,BrainRecord>(),visiting=new Set<string>();
      const publish=(record:BrainRecord):BrainRecord=>{
        if(!record.projectId)return record;
        if(record.projectId!==projectId)throw new BrainError("Dependency belongs to another project");
        const existing=this.styleByKey(record.keyId!);
        if(existing)return existing;
        if(copies.has(record.id))return copies.get(record.id)!;
        if(visiting.has(record.id))throw new BrainError("Required links cannot contain a cycle");
        visiting.add(record.id);
        const requiredIds=(record.requiredIds||[]).map(id=>{
          const linked=this.get(id);
          if(!linked||linked.status!=="active")throw new BrainError("Required dependency is unavailable");
          return publish(linked).id;
        });
        const now=new Date().toISOString();
        const shared:BrainRecord={...checkInput({...record,projectId:undefined,sourceStyleId:undefined,requiredIds}),id:randomUUID(),version:1,createdAt:now,updatedAt:now};
        const locals=this.db.prepare("SELECT snapshot FROM records WHERE json_extract(snapshot,'$.keyId')=?").all(record.keyId!) as {snapshot:string}[];
        for(const row of locals){const local=this.parse(row.snapshot);if(local.kind!==shared.kind||local.domain!==shared.domain)throw new BrainError("Private styles with this key have different capabilities or types. Resolve the key conflict before publishing.","CONFLICT",409);this.db.prepare("UPDATE records SET snapshot=? WHERE id=?").run(JSON.stringify({...local,sourceStyleId:shared.id}),local.id);}
        this.validateRequired(shared);this.write(shared,"create");
        for(const row of locals){const local=this.parse(row.snapshot);this.write({...local,sourceStyleId:shared.id,version:local.version+1,updatedAt:now},"update");}
        copies.set(record.id,shared);visiting.delete(record.id);return shared;
      };
      const record=publish(source);
      return {record,published:[...copies.values()]};
    });
  }
  createProjectStyle(projectId:string,raw:unknown,expectedProjectVersion:number,select=true){
    return this.transaction(()=>{
      const project=this.project(projectId);
      if(project.version!==expectedProjectVersion)throw new BrainError("Project changed. Reload before saving.","CONFLICT",409);
      if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new BrainError("Style object required");
      const input=raw as Record<string,unknown>;
      if(input.projectId!==undefined||input.kind!==undefined||input.backend!==undefined||input.status!==undefined)throw new BrainError("Scope, type and status are managed by project style creation");
      const key=typeof input.keyId==="string"?input.keyId:slug(String(input.title||""));
      const existing=this.styleByKey(key,projectId);
      const localRow=this.db.prepare("SELECT snapshot FROM records WHERE json_extract(snapshot,'$.keyId')=? AND json_extract(snapshot,'$.projectId')=?").get(key,projectId) as {snapshot:string}|undefined;
      const baseline=localRow?this.parse(localRow.snapshot):existing;
      const record=this.create({tags:[],priority:90,requiredIds:[],checks:[],...baseline,...input,sourceStyleId:undefined,projectId,kind:"preference",status:"active",backend:null});
      const current=this.project(projectId);
      if(select&&!current.assignments.some(a=>a.recordId===record.id))this.saveProject({...current,assignments:[...current.assignments,{recordId:record.id,override:null}]},projectId,current.version);
      return {record,projectVersion:this.project(projectId).version,selected:this.project(projectId).assignments.some(a=>a.recordId===record.id),scope:"project"};
    });
  }
  personalizeRecord(projectId:string,recordId:string,raw:unknown,expectedVersion:number,expectedProjectVersion:number) {
    return this.transaction(()=>{
      const project=this.project(projectId);
      if(project.version!==expectedProjectVersion)throw new BrainError("Project changed. Reload before saving.","CONFLICT",409);
      const effective=this.scopedRecords(projectId);
      const source=effective.find(r=>r.id===recordId);
      if(!source)throw new BrainError("Record is not selected in this project","NOT_FOUND",404);
      if(source.version!==expectedVersion)throw new BrainError("Version conflict. Reload before saving.","CONFLICT",409);
      const input=checkInput({...source,...raw as object,projectId,keyId:source.keyId,sourceStyleId:source.projectId?source.sourceStyleId:source.id});
      if(input.kind!==source.kind||input.domain!==source.domain||input.status!=="active")throw new BrainError("Project edits must keep the capability, type and active status. Manage selections in Configure project.");
      if(JSON.stringify(input)===JSON.stringify(checkInput({...source,projectId})))return source;
      this.db.prepare("INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)").run("project-style-baseline:"+projectId,JSON.stringify(project.assignments.filter(a=>!this.get(a.recordId)?.projectId).map(a=>({...a,override:null}))));
      const replacements=new Map<string,BrainRecord>();
      const now=new Date().toISOString();
      const copy=(record:BrainRecord,changes:object)=>{
        const row=this.db.prepare("SELECT snapshot FROM records WHERE json_extract(snapshot,'$.keyId')=? AND json_extract(snapshot,'$.projectId')=?").get(record.keyId!,projectId) as {snapshot:string}|undefined;
        const previous=row?this.parse(row.snapshot):record;
        const local=previous.projectId===projectId;
        const next:BrainRecord={...record,...changes,projectId,sourceStyleId:local?previous.sourceStyleId:record.id,id:local?previous.id:randomUUID(),version:local?previous.version+1:1,createdAt:local?previous.createdAt:now,updatedAt:now};
        this.validateRequired(next);this.write(next,local?"update":"create");replacements.set(record.id,next);return next;
      };
      const edited=copy(source,input);
      // Copy only ancestors whose exact required IDs must follow the private version.
      const visited=new Set<string>();
      const rewire=(record:BrainRecord):BrainRecord=>{
        if(replacements.has(record.id))return replacements.get(record.id)!;
        if(visited.has(record.id))return record;
        visited.add(record.id);
        const requiredIds=(record.requiredIds||[]).map(id=>{const child=effective.find(r=>r.id===id);return child?rewire(child).id:id;});
        return requiredIds.some((id,i)=>id!==record.requiredIds?.[i])?copy(record,{requiredIds}):record;
      };
      effective.forEach(rewire);
      const assignments=project.assignments.map(a=>replacements.has(a.recordId)?{recordId:replacements.get(a.recordId)!.id,override:null}:a);
      const updated={...project,assignments,version:project.version+1,updatedAt:now};
      this.db.prepare("UPDATE projects SET snapshot=? WHERE id=?").run(JSON.stringify(updated),projectId);
      this.scopedRecords(projectId);
      return edited;
    });
  }
  scopedRecords(projectId:string|undefined=process.env.PB_PROJECT_ID):Array<BrainRecord & {source:string}> {
    const all=(this.db.prepare("SELECT snapshot FROM records WHERE status='active'").all() as {snapshot:string}[]).map(r=>this.parse(r.snapshot)).sort((a,b)=>b.priority-a.priority);
    if(!projectId)return all.filter(r=>!r.projectId).map(r=>({...r,source:"Global default"}));
    const project=this.project(projectId);
    const selected=project.assignments.map(a=>{
      const record=this.get(a.recordId);
      if(!record||record.status!=="active"||(record.projectId&&record.projectId!==projectId))throw new BrainError("Project selection is unavailable: "+a.recordId+". Update the project configuration.");
      return {...record,content:a.override??record.content,source:a.override!==null?"Project override":"Project selection"};
    });
    const slots=new Set<string>();
    for(const record of selected){
      const slot=this.selectionSlot(record);
      if(slots.has(slot))throw new BrainError("Project selections now conflict in "+slot+". Update the project configuration.");
      slots.add(slot);
    }
    const effective=new Map(selected.map(r=>[r.id,r]));
    const visiting=new Set<string>(),done=new Set<string>();
    const include=(record:BrainRecord)=>{
      if(visiting.has(record.id))throw new BrainError("Required-link cycle");
      if(done.has(record.id))return;
      visiting.add(record.id);
      for(const id of record.requiredIds||[]){
        let linked=effective.get(id);
        if(!linked){
          const shared=all.find(r=>r.id===id&&(!r.projectId||r.projectId===projectId));
          if(!shared)throw new BrainError("Required linked style is inactive or unavailable: "+id);
          const slot=this.selectionSlot(shared);
          if(slots.has(slot))throw new BrainError("Required linked style conflicts with project selection: "+id);
          linked={...shared,source:"Required dependency"};effective.set(id,linked);slots.add(slot);
        }
        include(linked);
      }
      visiting.delete(record.id);done.add(record.id);
    };
    selected.forEach(include);
    return [...effective.values()];
  }
  bootstrapWithRecords(maxChars=3500,projectId?:string) {
    const items = this.scopedRecords(projectId).filter(r=>r.kind==="preference").slice(0,35);
    const included:BrainRecord[]=[];
    let out = "PERSONAL BRAIN STYLE BASELINE\nIndex only; full instructions are not loaded. For substantive tasks use brain_discover, then brain_get for matching records and required links. Read their referenced external skills before applying them. Reuse an already loaded record only when its ID, version and project scope match.\n";
    for (const item of items) {
      const line = `\n[${item.domain}] ${item.title} | id ${item.id} | version ${item.version}\n${(item.useWhen||item.summary).slice(0,140)} | keywords: ${item.tags.slice(0,8).join(", ")}\n`;
      if (out.length + line.length > maxChars) break;
      out += line;included.push(item);
    }
    if(included.length<items.length)out+=`\nMore styles available through brain_discover.\n`;
    return {text:out,records:included};
  }
  bootstrap(maxChars=3500,projectId?:string) { return this.bootstrapWithRecords(maxChars,projectId).text; }
  discover(task:string,kinds:Kind[]=["skill","preference","tool","review","example"],limit=12,projectId?:string) {
    return this.scopedRecords(projectId).map(r=>({r,score:rankRecord(r,task)})).filter(({r,score})=>score>0&&kinds.includes(r.kind)).sort((a,b)=>b.score-a.score||b.r.priority-a.r.priority).slice(0,Math.max(1,Math.min(30,limit))).map(({r})=>({id:r.id,keyId:r.keyId,kind:r.kind,domain:r.domain,title:r.title,summary:r.summary,useWhen:r.useWhen||"",tags:r.tags,requiredIds:r.requiredIds||[],version:r.version,priority:r.priority,invokable:r.kind==="tool" && !!r.backend?.enabled}));
  }
  evaluate(content:string,domain:Domain="general",projectId?:string) {
    const rules = this.scopedRecords(projectId).filter(r=>r.kind==="review"||r.kind==="preference").filter(r=>r.domain==="general" || r.domain===domain);
    const findings:{ruleId:string,check:string,passed:boolean,detail:string}[]=[];
    let manual=0;
    const manualReviews:Array<{recordId:string;title:string;criteria:string[];status:string}>=[];
    for(const rule of rules) {
      const criteria=rule.reviewCriteria?.length?rule.reviewCriteria:rule.kind==="review"?[rule.content]:[];
      if(criteria.length){manual++;manualReviews.push({recordId:rule.id,title:rule.title,criteria,status:"pending"});}
      if(!rule.checks.length)continue;
      for(const check of rule.checks) {
        const v=String(check.value);
        let passed = false;
        if(check.type==="contains") passed=content.toLowerCase().includes(v.toLowerCase());
        if(check.type==="not_contains") passed=!content.toLowerCase().includes(v.toLowerCase());
        if(check.type==="min_length") passed=content.length>=Number(v);
        if(check.type==="max_length") passed=content.length<=Number(v);
        findings.push({ruleId:rule.id,check:check.label||`${check.type} ${v}`,passed,detail:passed?"Check passed":"Check failed"});
      }
    }
    return { passed:findings.every(x=>x.passed), automated:findings.length, manualReviewRules:manual, manualReviews, findings, compliance:manual?"manual-review-required":findings.length?"automated-checks-only":"not-evaluated",
      note:"Text checks are deterministic. Visual layout and architectural correctness still require separate validation." };
  }
}

import {BrainDB} from "../core/database.ts";

// One-time audited links; later user edits remain authoritative.
export function installStyleDependencies(db:BrainDB){
 const key="audited_style_dependencies_v1";
 if(db.db.prepare("SELECT value FROM meta WHERE key=?").get(key))return;
 const qc="personal-quality-control-qc",writing="personal-document-writing",ba="personal-business-analysis-ba",thinking="personal-architecture-thinking";
 const links:Record<string,string[]>={
  [thinking]:[qc],
  "personal-architecture-technology":[thinking,qc],
  "personal-architecture-cloud-agnostic":[thinking,qc],
  "personal-architecture-design-patterns":[thinking,ba,qc],
  "personal-architecture-drawing":[thinking,"personal-architecture-technology",writing,qc],
  [writing]:[qc],
  [ba]:[writing,qc],
  "starter-implementation":[ba,qc],
  "starter-ux":[ba,qc],
  "personal-brain-project-design":[ba,qc],
  "personal-brain-project-coding":["personal-brain-project-technology",ba,qc],
  "personal-brain-project-technology":[thinking,qc],
  "personal-sky-blue-design-system":[qc]
 };
 const records=db.list({limit:300});
 const find=(tag:string)=>records.find(r=>r.kind==="preference"&&(r.tags.includes(tag)||r.tags.includes(tag.replace(/-(ba|qc)$/, ""))));
 const updates=new Map<string,string[]>();
 for(const [tag,dependencies] of Object.entries(links)){
  const record=find(tag);if(!record)continue;
  const targets=dependencies.map(find);
  if(targets.some(r=>!r||r.status!=="active"))throw new Error("Missing active style dependency for "+record.title);
  updates.set(record.id,[...new Set([...(record.requiredIds||[]),...targets.map(r=>r!.id)])]);
 }
 db.installRequiredLinks(updates,key);
}

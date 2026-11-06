import {createHash} from 'node:crypto';
import {BrainDB} from '../core/database.ts';
import {BrainError,type BrainRecord} from '../core/models.ts';
import {catalogBaseline,catalogBaselineLinks} from './catalog-baseline.ts';
import {globalStyleCatalog} from './global-style-catalog.ts';

const fingerprint=(r:Partial<BrainRecord>)=>createHash('sha256').update(JSON.stringify({content:r.content,principles:r.principles||[],reviewCriteria:r.reviewCriteria||[],externalSkills:r.externalSkills||[],requirements:r.requirements||[],checks:r.checks||[]})).digest('hex');
export function catalogUpgradePreview(db:BrainDB){
 const rows=db.list({limit:300}).filter(r=>!r.projectId);
 return rows.flatMap(current=>{
  const proposed=globalStyleCatalog.find(r=>r.keyId===current.keyId);if(!proposed||current.content===proposed.content)return [];
  const originalLinks=catalogBaselineLinks[current.keyId!]||[];
  const links=(current.requiredIds||[]).map(id=>db.get(id)?.keyId).sort();
  const unchanged=fingerprint(current)===catalogBaseline[current.keyId!]&&JSON.stringify(links)===JSON.stringify([...originalLinks].sort())&&!current.supportingLinks?.length&&!current.skillBindings?.length&&!current.preferences?.length;
  return [{id:current.id,version:current.version,title:current.title,eligible:unchanged,reason:unchanged?'Known release content; review before applying':'Personal or unknown content: preserve and compare manually',before:JSON.stringify({content:current.content,requiredIds:current.requiredIds,externalSkills:current.externalSkills,supportingLinks:current.supportingLinks,skillBindings:current.skillBindings,preferences:current.preferences},null,2),after:JSON.stringify({content:proposed.content,requiredKeys:proposed.requiredIds,externalSkills:proposed.externalSkills,supportingLinks:proposed.supportingLinks,skillBindings:proposed.skillBindings,preferences:proposed.preferences},null,2)}];
 });
}
export function applyCatalogUpgrade(db:BrainDB,id:string,expectedVersion:number){
 return db.transaction(()=>{
  const preview=catalogUpgradePreview(db).find(r=>r.id===id);
  if(!preview?.eligible||preview.version!==expectedVersion)throw new BrainError('Catalog candidate changed or contains personal edits; refresh the preview','CONFLICT',409);
  const current=db.get(id)!,source=globalStyleCatalog.find(r=>r.keyId===current.keyId)!;
  const lookup=(key:string)=>{const row=db.list({limit:300}).find(r=>!r.projectId&&r.keyId===key&&r.status==='active');if(!row)throw new BrainError('Required catalog style missing: '+key);return row.id;};
  // Explicit update only: private copies, assignments and deleted records are never replaced.
  return db.update(id,{content:source.content,skillBindings:source.skillBindings,externalSkills:source.externalSkills,preferences:source.preferences,supportingLinks:source.supportingLinks?.map(l=>({...l,recordId:lookup(l.recordId)})),requiredIds:source.requiredIds?.map(lookup)},expectedVersion);
 });
}

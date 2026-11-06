import {installProjectDefaults} from '../projects/project-defaults.ts';
import {BrainDB} from '../core/database.ts';
import {globalStyleCatalog,catalogDomains} from './global-style-catalog.ts';

export const globalCatalogMarker='global_style_catalog_v1';

// Only an unused database receives the release catalog; never overwrite personal edits.
export function seedGlobalStyles(db:BrainDB):number {
 return db.transaction(()=>{
  if(db.db.prepare('SELECT 1 FROM meta WHERE key=?').get(globalCatalogMarker)||
    db.db.prepare('SELECT 1 FROM records LIMIT 1').get()||
    db.db.prepare('SELECT 1 FROM revisions LIMIT 1').get()||
    db.db.prepare('SELECT 1 FROM projects LIMIT 1').get())return 0;
  for(const domain of catalogDomains)db.db.prepare('INSERT INTO domains(id,name,combinable) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,combinable=excluded.combinable').run(domain.id,domain.name,'combinable' in domain&&domain.combinable?1:0);
  // Legacy built-in capabilities outside the catalog stay deleted on a fresh library.
  for(const {id} of db.domains())if(!catalogDomains.some(d=>d.id===id)){db.db.prepare('DELETE FROM domains WHERE id=?').run(id);db.db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run('deleted-domain:'+id,'1');}
  const imported=new Map<string,string>(),visiting=new Set<string>();
  const add=(id:string):string=>{
   if(imported.has(id))return imported.get(id)!;
   if(visiting.has(id))throw new Error('Cyclic global style catalog');
   const source=globalStyleCatalog.find(r=>r.id===id);
   if(!source||source.projectId||source.backend)throw new Error('Invalid global style catalog');
   visiting.add(id);
   const record=db.create({...source,requiredIds:(source.requiredIds||[]).map(add),supportingLinks:source.supportingLinks?.map(link=>({...link,recordId:add(link.recordId)}))});
   imported.set(id,record.id);visiting.delete(id);return record.id;
  };
  for(const record of globalStyleCatalog)add(record.id);
  installProjectDefaults(db);
  db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run(globalCatalogMarker,'1');
  return imported.size;
 });
}

// Catalog styles released after a library was seeded. Each batch runs once, so a user's later deletion sticks.
const catalogAdditions:Record<string,string[]>={global_style_catalog_writing_formats_v1:['doc-markdown','doc-html','doc-word']};

export function installCatalogAdditions(db:BrainDB):number {
 return db.transaction(()=>{
  let added=0;
  const globalId=(key:string)=>(db.db.prepare("SELECT id FROM records WHERE json_extract(snapshot,'$.keyId')=? AND json_extract(snapshot,'$.projectId') IS NULL").get(key) as {id:string}|undefined)?.id;
  for(const [marker,ids] of Object.entries(catalogAdditions)){
   if(db.db.prepare('SELECT 1 FROM meta WHERE key=?').get(marker))continue;
   for(const id of ids){
    const source=globalStyleCatalog.find(r=>r.id===id)!,required=(source.requiredIds||[]).map(globalId);
    if(globalId(id)||!db.hasDomain(source.domain)||required.some(r=>!r))continue;
    db.create({...source,requiredIds:required as string[]});added++;
   }
   db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run(marker,'1');
  }
  return added;
 });
}

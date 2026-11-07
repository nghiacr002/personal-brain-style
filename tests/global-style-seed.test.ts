import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {seedGlobalStyles,installCatalogAdditions} from '../src/styles/global-style-seed.ts';
import {globalStyleCatalog,catalogDomains} from '../src/styles/global-style-catalog.ts';
import {createBrainHttpServer} from '../src/server/http.ts';

test('fresh startup installs the complete global catalog and remaps dependencies without private data',()=>{
 const root=mkdtempSync(join(tmpdir(),'brain-seed-')),db=new BrainDB(join(root,'brain.sqlite'));
 try{
  createBrainHttpServer(db).close();
  const records=db.list({limit:300});
  assert.equal(records.length,globalStyleCatalog.length);
  assert.equal(records.filter(r=>r.standardLanguage).length,7);
  assert.equal(records.filter(r=>r.keyId==='development').length,1);
  assert.deepEqual(db.domains().map(d=>d.id).sort(),catalogDomains.map(d=>d.id).sort());
  for(const r of records.filter(r=>!r.compatibility)){assert.ok(r.summary&&r.useWhen&&r.principles.length&&r.reviewCriteria.length&&r.examples.length&&r.requirements.length,r.title);assert.ok((r.skillBindings||[]).every(s=>!s.name.includes(':')),r.title);}
  assert.deepEqual(db.projects(),[]);
  for(const source of globalStyleCatalog){
   const record=records.find(r=>r.title===source.title)!;
   assert.equal(record.content,source.content);assert.ok(!record.projectId&&!record.backend);
   assert.deepEqual(record.requiredIds.map(id=>db.get(id)!.title),source.requiredIds!.map(id=>globalStyleCatalog.find(r=>r.id===id)!.title));
  }
  // Required links never collide with a selection slot, so a project can select every catalog style.
  const all=db.saveProject({name:'All',description:'',assignments:records.filter(r=>r.kind!=='tool').map(r=>({recordId:r.id,override:null}))});
  assert.equal(db.scopedRecords(all.id).length,records.length);
  db.deleteWithPreview('project',all.id,db.deletionPreview('project',all.id).fingerprint);
  const ui=records.find(r=>r.keyId==='ui-ux')!;
  const coding = records.find(record => record.keyId === 'development')!;
  const development = records.find(record => record.keyId === 'development')!;
  assert.deepEqual(development.requiredIds, []);
  assert.deepEqual(records.find(record=>record.keyId==='coding-style')!.requiredIds,[development.id]);
  assert.equal(coding.kind, 'preference');
  assert.ok(!coding.projectId);
  for (const rule of [
    'not fewer physical lines',
    'one statement per line',
    'compressed legacy code is not a formatting convention',
    'flag the gap and propose setup',
    'enforced in repository CI',
    'Keep broad formatting cleanup separate',
    'Avoid hard-coded links and parameters wherever practical',
    'validate configuration',
    'Use named constants for true invariants',
  ]) {
    assert.ok(coding.content.includes(rule), rule);
    assert.ok(coding.principles.some(principle => principle.includes(rule)), rule);
  }
  db.update(coding.id, {content: 'My personal readability rules'}, coding.version);
  assert.equal(seedGlobalStyles(db), 0);
  assert.equal(db.get(coding.id)!.content, 'My personal readability rules');
  assert.ok(ui.skillBindings.some(s=>s.name==='ui-ux-pro-max'));
  assert.ok(ui.skillBindings.some(s=>s.name==='design-taste-frontend'));
  assert.match(ui.content,/PREFERRED OUTCOMES/);
  assert.doesNotMatch(ui.content,/references\/app-screens.md/);
  db.update(ui.id,{...ui,content:'My edit'},ui.version);
  createBrainHttpServer(db).close();
  assert.equal(seedGlobalStyles(db),0);assert.equal(db.get(ui.id)!.content,'My edit');
 }finally{db.close();rmSync(root,{recursive:true,force:true});}
});

test('seeding leaves an existing library untouched',()=>{
 const root=mkdtempSync(join(tmpdir(),'brain-seed-')),db=new BrainDB(join(root,'brain.sqlite'));
 try{
  const record=db.create({...globalStyleCatalog.find(r=>!r.requiredIds?.length)!,domain:"coding",requiredIds:[]});
  assert.equal(seedGlobalStyles(db),0);assert.equal(db.list().length,1);assert.equal(db.get(record.id)!.version,1);
 }finally{db.close();rmSync(root,{recursive:true,force:true});}
});

test('existing libraries receive later catalog additions once, linked to their writing style',()=>{
 const root=mkdtempSync(join(tmpdir(),'brain-seed-')),db=new BrainDB(join(root,'brain.sqlite'));
 try{
  seedGlobalStyles(db);
  const keys=['doc-markdown','doc-html','doc-word'];
  for(const r of db.list({limit:300}).filter(r=>keys.includes(r.keyId!)))db.db.prepare('DELETE FROM records WHERE id=?').run(r.id);
  db.db.prepare("DELETE FROM meta WHERE key='global_style_catalog_writing_formats_v1'").run();
  assert.equal(installCatalogAdditions(db),3);
  const writing=db.list({limit:300}).find(r=>r.keyId==='writing')!;
  for(const key of keys)assert.deepEqual(db.list({limit:300}).find(r=>r.keyId===key)!.requiredIds,[writing.id]);
  for(const r of db.list({limit:300}).filter(r=>keys.includes(r.keyId!)))db.db.prepare('DELETE FROM records WHERE id=?').run(r.id);
  assert.equal(installCatalogAdditions(db),0);
 }finally{db.close();rmSync(root,{recursive:true,force:true});}
});

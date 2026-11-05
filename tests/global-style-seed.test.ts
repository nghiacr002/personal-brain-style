import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {seedGlobalStyles} from '../src/styles/global-style-seed.ts';
import {globalStyleCatalog} from '../src/styles/global-style-catalog.ts';
import {createBrainHttpServer} from '../src/server/http.ts';

test('fresh startup installs the complete global catalog and remaps dependencies without private data',()=>{
 const root=mkdtempSync(join(tmpdir(),'brain-seed-')),db=new BrainDB(join(root,'brain.sqlite'));
 try{
  createBrainHttpServer(db).close();
  const records=db.list({limit:300});
  assert.equal(records.length,globalStyleCatalog.length);
  assert.equal(records.filter(r=>r.kind==='preference').length,18);
  assert.deepEqual(db.projects(),[]);
  for(const source of globalStyleCatalog){
   const record=records.find(r=>r.title===source.title)!;
   assert.equal(record.content,source.content);assert.ok(!record.projectId&&!record.backend);
   assert.deepEqual(record.requiredIds.map(id=>db.get(id)!.title),source.requiredIds!.map(id=>globalStyleCatalog.find(r=>r.id===id)!.title));
  }
  const ui=records.find(r=>r.domain==='design')!;
  assert.match(ui.content,/USEFUL UI CONTENT/);
  assert.ok(ui.externalSkills.includes("ui-ux-pro-max"));
  assert.ok(ui.externalSkills.includes("design-taste-frontend"));
  assert.match(ui.content,/COMBINED UI\/UX SKILLS/);
  assert.match(ui.content,/references\/app-screens.md/);
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

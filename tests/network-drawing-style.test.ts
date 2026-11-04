import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
import {installNetworkDrawingStyle} from '../src/styles/network-drawing-style.ts';

test('network drawing is selected once for all existing projects without replacing selections',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pb-network-')),db=new BrainDB(join(dir,'brain.sqlite'));
 try{
  const old=db.create({kind:'preference',domain:'general',title:'Existing',summary:'',content:'Keep this',tags:[],priority:90,status:'active',checks:[],backend:null});
  const a=db.saveProject({name:'A',description:'',assignments:[{recordId:old.id,override:'Keep override'}]});
  const b=db.saveProject({name:'B',description:'',assignments:[]});
  assert.equal(installNetworkDrawingStyle(db),2);
  const style=db.list().find(r=>r.domain==='network-architecture')!;
  assert.equal(style.status,'active');assert.equal(style.projectId,undefined);
  assert.deepEqual(style.externalSkills,['drawio-skill']);
  assert.ok(style.examples!.length);assert.ok(style.reviewCriteria!.length);
  assert.equal(style.requirements![0].type,'artifact');
  assert.deepEqual(db.project(a.id).assignments[0],a.assignments[0]);
  for(const p of [a,b])assert.ok(db.scopedRecords(p.id).some(r=>r.id===style.id));
  const current=db.project(b.id);
  db.saveProject({...current,assignments:[]},b.id,current.version);
  assert.equal(installNetworkDrawingStyle(db),0);
  assert.deepEqual(db.project(b.id).assignments,[]);
  assert.equal(db.get(old.id)!.content,'Keep this');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

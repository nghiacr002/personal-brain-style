import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/core/database.ts';
const base={kind:'preference',keyId:'coding-conventions',domain:'coding',title:'Coding conventions',summary:'Rules',content:'Global rules',tags:[],priority:90,status:'active',checks:[],backend:null};
function fixture(){const dir=mkdtempSync(join(tmpdir(),'pb-keys-'));const db=new BrainDB(join(dir,'brain.sqlite'));return {db,dir,cleanup(){db.close();rmSync(dir,{recursive:true,force:true});}};}
test('stable keys reuse globals, update personalization and isolate project writes',()=>{
 const {db,cleanup}=fixture();try{
 const global=db.create(base),p=db.saveProject({name:'One',description:'',assignments:[]}),q=db.saveProject({name:'Two',description:'',assignments:[]});
 const {kind,status,backend,checks,priority,...style}=base;
 const first=db.createProjectStyle(p.id,{...style,content:'Local rules'},p.version);
 assert.equal(first.record.keyId,global.keyId);assert.equal(first.record.sourceStyleId,global.id);
 assert.equal(db.get(global.id)!.content,'Global rules');assert.equal(first.selected,true);
 const next=db.createProjectStyle(p.id,{...style,title:'Renamed',content:'Updated'},first.projectVersion);
 assert.equal(next.record.id,first.record.id);assert.equal(next.record.content,'Updated');
 const other=db.createProjectStyle(q.id,{...style,content:'Other rules'},q.version);
 assert.notEqual(other.record.id,next.record.id);assert.equal(db.get(next.record.id)!.content,'Updated');
 assert.throws(()=>db.create(base),/key already exists/);
 assert.throws(()=>db.update(global.id,{keyId:'changed'},global.version),/identity/);
 assert.throws(()=>db.create({...base,keyId:'Not A Slug'}),/lowercase slug/);
 assert.equal(db.publishProjectRecord(p.id,next.record.id,next.record.version).record.id,global.id);
 assert.equal(db.list().length,1);
 const preview=db.deletionPreview('record',global.id);db.deleteWithPreview('record',global.id,preview.fingerprint);
 const retained=db.get(next.record.id)!;assert.equal(retained.sourceStyleId,undefined);
 assert.equal(db.update(retained.id,{content:'Still editable'},retained.version).content,'Still editable');
 }finally{cleanup();}
});
test('two private keys can match until publishing establishes one global identity',()=>{
 const {db,cleanup}=fixture();try{
 const p=db.saveProject({name:'One',description:'',assignments:[]}),q=db.saveProject({name:'Two',description:'',assignments:[]});
 const a=db.create({...base,projectId:p.id}),b=db.create({...base,projectId:q.id,content:'Other content'});
 assert.notEqual(a.id,b.id);
 const updated=db.create({...base,projectId:p.id,content:'Updated'});assert.equal(updated.id,a.id);
 assert.throws(()=>db.create(base),/key already exists/);
 const published=db.publishProjectRecord(p.id,a.id,updated.version).record;
 assert.equal(db.get(a.id)!.sourceStyleId,published.id);assert.equal(db.get(b.id)!.sourceStyleId,published.id);
 assert.equal(db.get(b.id)!.content,'Other content');
 assert.equal(db.publishProjectRecord(q.id,b.id,db.get(b.id)!.version).record.id,published.id);
 assert.equal(db.list().length,1);
 }finally{cleanup();}
});
test('legacy key migration preserves content, assignments and stable keys after restart',()=>{
 const {db,dir,cleanup}=fixture();try{
 const a=db.create(base),b=db.create({...base,keyId:'different-key'});
 for(const r of [a,b]){const {keyId,...old}=r;db.db.prepare('UPDATE records SET snapshot=? WHERE id=?').run(JSON.stringify(old),r.id);}
 db.db.prepare("DELETE FROM meta WHERE key='style_keys_v1'").run();
 const migrated=new BrainDB(join(dir,'brain.sqlite'));
 assert.notEqual(migrated.get(a.id)!.keyId,migrated.get(b.id)!.keyId);
 assert.equal(migrated.get(b.id)!.content,b.content);const key=migrated.get(b.id)!.keyId;migrated.close();
 const reopened=new BrainDB(join(dir,'brain.sqlite'));assert.equal(reopened.get(b.id)!.keyId,key);reopened.close();
 }finally{cleanup();}
});

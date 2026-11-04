import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BrainDB} from '../src/database.ts';
import {upgradeWorkspaceDesign,upgradeWorkspacePalette} from '../src/design-review-style.ts';
import {createBrainHttpServer} from '../src/http.ts';

test('design amendment preserves private styles, selections and later edits',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pb-design-audit-')),db=new BrainDB(join(dir,'brain.sqlite'));
 try{
  const r=db.create({kind:'preference',domain:'design',title:'UX',summary:'',content:'Existing custom instructions',tags:['starter-ux'],priority:90,status:'active',checks:[],backend:null});
  const p=db.saveProject({name:'Private',description:'',assignments:[{recordId:r.id,override:null}]});
  const privateStyle=db.personalizeRecord(p.id,r.id,{content:'Private conventions'},r.version,p.version);
  assert.equal(upgradeWorkspaceDesign(db),1);assert.equal(upgradeWorkspaceDesign(db),0);
  assert.ok(db.get(r.id)!.content.startsWith(r.content));assert.equal(db.get(privateStyle.id)!.content,'Private conventions');
  assert.equal(db.project(p.id).assignments[0].recordId,privateStyle.id);
  upgradeWorkspacePalette(db);const amended=db.get(r.id)!;
  assert.match(amended.content,/12px layout gap/);upgradeWorkspacePalette(db);assert.equal(db.get(r.id)!.version,amended.version);
  assert.equal(db.get(privateStyle.id)!.content,'Private conventions');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('API accepts its own browser origin and rejects other local ports',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pb-origin-')),db=new BrainDB(join(dir,'brain.sqlite')),server=createBrainHttpServer(db);
 const request=(origin:string)=>new Promise<number>(resolve=>{let status=0;server.emit('request',{url:'/api/projects',method:'GET',headers:{host:'127.0.0.1:4177',origin}},{setHeader(){},writeHead(n:number){status=n;},end(){resolve(status);}});});
 try{assert.equal(await request('http://127.0.0.1:4177'),200);assert.equal(await request('http://127.0.0.1:9999'),403);assert.equal(await request('https://example.com'),403);}
 finally{server.close();db.close();rmSync(dir,{recursive:true,force:true});}
});

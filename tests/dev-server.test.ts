import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {BrainDB} from "../src/database.ts";
import {createBrainHttpServer} from "../src/http.ts";

test("live reload is exposed only by the development server",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-dev-"));const db=new BrainDB(join(dir,"brain.sqlite"));const previous=process.env.PB_DEV_RELOAD;
 const request=(server:ReturnType<typeof createBrainHttpServer>,url:string)=>new Promise<{status:number,body:string}>(resolve=>{let status=0;server.emit("request",{url,method:"GET",headers:{}},{setHeader(){},writeHead(code:number){status=code;},end(body:string|Buffer){resolve({status,body:String(body)});}});});
 try{
  process.env.PB_DEV_RELOAD="1";const dev=createBrainHttpServer(db);
  assert.match((await request(dev,"/")).body,/src="\/live-reload.js"/);
  assert.equal((await request(dev,"/api/dev-version")).status,200);
  assert.equal((await request(dev,"/live-reload.js")).status,200);dev.close();
  delete process.env.PB_DEV_RELOAD;const stable=createBrainHttpServer(db);
  assert.doesNotMatch((await request(stable,"/")).body,/live-reload.js/);
  assert.equal((await request(stable,"/api/dev-version")).status,404);stable.close();
 }finally{if(previous===undefined)delete process.env.PB_DEV_RELOAD;else process.env.PB_DEV_RELOAD=previous;db.close();rmSync(dir,{recursive:true,force:true});}
});

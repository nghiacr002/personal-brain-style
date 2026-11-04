import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {BrainDB} from "../src/core/database.ts";
import {installWritingStyle} from "../src/styles/writing-style.ts";
test("shared writing style applies once to both intended projects",()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-writing-"));const db=new BrainDB(join(dir,"brain.sqlite"));
 try{
  assert.equal(installWritingStyle(db),0);
  const ids=["696366e9-d012-4288-8a46-376b49873137","b3937377-32ad-43a8-9adc-c21d06a9b4a4"];
  for(const id of ids)db.db.prepare("INSERT INTO projects(id,snapshot) VALUES(?,?)").run(id,JSON.stringify({id,name:id,description:"",assignments:[],version:1,updatedAt:new Date().toISOString()}));
  const other=db.saveProject({name:"Other",description:"",assignments:[]});
  assert.equal(installWritingStyle(db),1);
  const style=db.list({domain:"writing"})[0];assert.equal(style.status,"active");assert.equal(style.priority,90);
  assert.ok(style.examples?.length);assert.ok(style.reviewCriteria?.length);assert.ok(style.externalSkills?.length);
  for(const id of ids)assert.equal(db.scopedRecords(id)[0].id,style.id);
  assert.equal(db.scopedRecords(other.id).length,0);
  assert.equal(installWritingStyle(db),0);assert.equal(db.list({domain:"writing"}).length,1);
  assert.equal(db.project(ids[0]).version,2);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

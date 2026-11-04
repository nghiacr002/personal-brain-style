import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {BrainDB} from "../src/core/database.ts";
import {splitDesignStyle} from "../src/styles/split-design-style.ts";
test("split keeps UX identity and assigns independent visual style to the same project",()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-split-"));const db=new BrainDB(join(dir,"brain.sqlite"));
 try{
  const ux=db.create({kind:"preference",domain:"design",title:"Old design",summary:"UI",content:"My workflow rules",tags:["personal-brain-project-design"],priority:90,status:"active",checks:[],backend:null,reviewCriteria:["Preserve my review"]});
  const p=db.saveProject({name:"Personal Brain",description:"",assignments:[{recordId:ux.id,override:null}]});
  const other=db.saveProject({name:"Other",description:"",assignments:[]});
  assert.equal(splitDesignStyle(db),1);assert.equal(splitDesignStyle(db),0);
  const current=db.get(ux.id)!;assert.equal(current.title,"UI/UX preferences");assert.equal(current.version,2);assert.deepEqual(current.reviewCriteria,["Preserve my review"]);
  const resolved=db.scopedRecords(p.id);assert.equal(resolved.length,2);assert.ok(resolved.some(r=>r.domain==="design-system"));
  assert.equal(current.requiredIds!.length,0);assert.equal(db.scopedRecords(other.id).length,0);
  assert.equal(db.project(p.id).version,2);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {BrainDB} from "../src/core/database.ts";
import {installBaQcStyles} from "../src/styles/ba-qc-styles.ts";
test("capability counts include contracts and distinct projects without private content",()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-count-"));const db=new BrainDB(join(dir,"brain.sqlite"));
 try{
  assert.equal(installBaQcStyles(db),2);assert.equal(installBaQcStyles(db),0);
  const r=db.list({domain:"quality-control"})[0];const p=db.saveProject({name:"QC",description:"",assignments:[{recordId:r.id,override:null}]});
  db.create({...r,keyId:"private-qc",title:"Private QC",projectId:p.id});
  const counts=db.capabilityStats().find(d=>d.id==="quality-control")!;
  assert.equal(counts.styles,1);assert.equal(counts.examples,1);assert.equal(counts.rules,5);assert.equal(counts.projects,1);
  assert.equal(db.capabilityStats().find(d=>d.id==="business-analysis")!.projects,0);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

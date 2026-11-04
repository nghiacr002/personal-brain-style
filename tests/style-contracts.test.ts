import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {BrainDB} from "../src/database.ts";
import {installArchitectureStyles} from "../src/architecture-styles.ts";
import {installStyleContracts,installStyleExamples} from "../src/style-contracts.ts";
import {callTool} from "../src/mcp.ts";
test("style contracts migrate once, stay project scoped and reach agent review",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-contract-"));const db=new BrainDB(join(dir,"brain.sqlite"));
 try{
  installArchitectureStyles(db);const before=db.list({limit:300});assert.equal(installStyleContracts(db),5);
  const drawing=db.list({limit:300}).find(r=>r.tags.includes("personal-architecture-drawing"))!;
  assert.deepEqual(drawing.externalSkills,["drawio-skill"]);assert.ok(drawing.reviewCriteria!.length>0);
  assert.equal(drawing.content,before.find(r=>r.id===drawing.id)!.content);assert.equal(drawing.version,2);
  assert.equal(installStyleContracts(db),0);
  assert.equal(installStyleExamples(db),5);
  assert.equal(installStyleExamples(db),0);
  assert.ok(db.get(drawing.id)!.examples!.length);
  const p=db.saveProject({name:"Draw",description:"",assignments:[{recordId:drawing.id,override:null}]});
  const result=await callTool(db,"brain_get",{id:drawing.id,projectId:p.id});assert.match(result.content[0].text,/reviewCriteria/);
  const review=db.evaluate("artifact","architecture",p.id);assert.equal(review.compliance,"manual-review-required");assert.equal(review.manualReviews[0].recordId,drawing.id);
  const empty=db.saveProject({name:"Empty",description:"",assignments:[]});assert.equal(db.evaluate("artifact","architecture",empty.id).manualReviews.length,0);
  assert.throws(()=>db.update(drawing.id,{...drawing,externalSkills:[42]},db.get(drawing.id)!.version),/externalSkills/);
  const current=db.get(drawing.id)!;
  const {principles,externalSkills,reviewCriteria,...legacy}=current;
  assert.deepEqual(db.update(drawing.id,legacy,current.version).reviewCriteria,reviewCriteria);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

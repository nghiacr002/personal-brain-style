import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrainDB } from "../src/database.ts";
import { seed, seedStyles, archiveSamples } from "../src/seed.ts";
import type { RecordInput } from "../src/models.ts";

const fixture = ():RecordInput=>({kind:"preference",domain:"diagrams",title:"Personal diagram convention",summary:"Short description",content:"Prefer orthogonal routing",tags:["diagram","drawio"],priority:90,status:"active",checks:[],backend:null});
function withDb<T>(cb:(db:BrainDB)=>T):T{const dir=mkdtempSync(join(tmpdir(),"pb-test-"));const db=new BrainDB(join(dir,"brain.sqlite"));try{return cb(db);}finally{db.close();rmSync(dir,{recursive:true,force:true});}}

test("persistent SQLite store survives reopening",()=>{
  const dir=mkdtempSync(join(tmpdir(),"pb-persist-")); const file=join(dir,"brain.sqlite");
  try{const db=new BrainDB(file);const r=db.create(fixture());db.close();const db2=new BrainDB(file);assert.equal(db2.get(r.id)?.content,"Prefer orthogonal routing");db2.close();}finally{rmSync(dir,{recursive:true,force:true});}
});
test("version history and rollback preserve all snapshots",()=>withDb(db=>{
  const r=db.create(fixture()); const next=db.update(r.id,{...fixture(),content:"Use pastel color groups"},1);
  assert.equal(next.version,2);
  assert.throws(()=>db.update(r.id,fixture(),1),{code:"CONFLICT"});
  const restored=db.restore(r.id,1,2);
  assert.equal(restored.version,3);assert.equal(restored.content,"Prefer orthogonal routing");
  assert.deepEqual(db.history(r.id).map(h=>h.version),[3,2,1]);
}));
test("invalid records and tool metadata are rejected",()=>withDb(db=>{
  assert.throws(()=>db.create({...fixture(),kind:"project-memory"}));
  assert.throws(()=>db.create({...fixture(),backend:{command:"sh",args:[],toolName:"bad",enabled:true},kind:"tool",title:""}));
  assert.throws(()=>db.create({...fixture(),checks:[{type:"eval",value:"x"}]}));
}));
test("global-only memory: discovery returns relevant skills without project store",()=>withDb(db=>{
  seed(db);const hits=db.discover("drawio architecture diagrams",undefined,10);
  assert.ok(hits.some(h=>h.title.includes("editable system diagram")));
  assert.ok(hits.every(h=>["skill","preference","tool","review","example"].includes(h.kind)));
  assert.ok(!Object.keys(db.summary()).includes("projects"));
  assert.equal(db.discover("xylophonetextthatdoesnotmatch",undefined,10).length,0);
}));
test("feedback records corrections without changing active rules",()=>withDb(db=>{
  const r=db.create(fixture()); const fb=db.addFeedback({recordId:r.id,rating:"correction",note:"Less line crossing"});
  assert.equal(fb.rating,"correction"); assert.equal(db.get(r.id)?.version,1);
  assert.equal(db.listFeedback().length,1);
}));
test("review checks produce pass/fail and manual counts",()=>withDb(db=>{
  seed(db);
  assert.equal(db.evaluate("The document contains TBD","writing").passed,false);
  assert.equal(db.evaluate("All sections complete","writing").passed,true);
  assert.ok(db.evaluate("diagram sample","diagrams").manualReviewRules>=1);
}));
test("seed operation is idempotent",()=>withDb(db=>{
  assert.ok(seed(db)>0);assert.equal(seed(db),0);
}));

test("style recipes are complete drafts, preserve edits and become discoverable when activated",()=>withDb(db=>{
  seed(db);
  const recipes=db.list({kind:"preference",limit:300}).filter(r=>r.tags.includes("style-recipe"));
  assert.equal(recipes.length,11);
  for(const recipe of recipes){
    assert.equal(recipe.status,"draft");
    for(const heading of ["# Instructions","# Example prompt","# Worked output","# Acceptance check"])assert.ok(recipe.content.includes(heading));
    assert.ok(!db.discover(recipe.title,undefined,100).some(r=>r.id===recipe.id));
  }
  const recipe=recipes.find(r=>r.title==="Constraint-led technology selection")!;
  db.update(recipe.id,{...recipe,status:"active",content:recipe.content+"\nMy custom constraint."},recipe.version);
  assert.equal(seed(db),0);
  assert.ok(db.get(recipe.id)!.content.endsWith("My custom constraint."));
  assert.ok(db.discover("technology selection",undefined,100).some(r=>r.id===recipe.id));
}));

test("automatic sample import adds only draft styles and includes requested domains",()=>withDb(db=>{
  assert.equal(seedStyles(db),11);
  assert.equal(db.list({limit:300}).length,11);
  for(const domain of ["writing","design","coding","architecture","thinking","diagrams","reviews"]){
    assert.ok(db.list({domain,kind:"preference"}).some(r=>r.tags.includes("style-recipe")));
  }
  assert.equal(seedStyles(db),0);
  assert.equal(db.list({status:"active"}).length,0);
}));


test("sample cleanup archives unedited bundled records and preserves personal work",()=>withDb(db=>{
  seed(db);db.seedTraceDemo();
  const own=db.create({...fixture(),title:"My personal rule"});
  const edited=db.list({kind:"preference"})[0];
  db.update(edited.id,{...edited,content:"My changed instructions"},edited.version);
  archiveSamples(db);
  const visible=db.list({limit:300}).filter(r=>r.status!=="archived");
  assert.deepEqual(new Set(visible.map(r=>r.id)),new Set([own.id,edited.id]));
  assert.equal(db.listTrace({includeDemo:true}).length,0);
  const archived=db.list({status:"archived",limit:300})[0];
  assert.equal(db.history(archived.id).length,2);
  db.restore(archived.id,1,archived.version);
  archiveSamples(db);
  assert.notEqual(db.get(archived.id)?.status,"archived");
}));

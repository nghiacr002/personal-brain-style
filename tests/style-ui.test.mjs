import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

test('trace filters encode project scope in API requests and navigation URLs',()=>{
 const context=vm.createContext({URLSearchParams,document:{addEventListener(){},getElementById(){return {addEventListener(){}};},querySelectorAll(){return [];}},setTimeout,clearTimeout,console});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),context);
 vm.runInContext('active="trace";traceProject="project-a";traceAgent="codex";traceChannel="mcp";traceRecord="style-a";traceDemo=true',context);
 const query=new URLSearchParams(vm.runInContext('traceQuery()',context));
 assert.equal(query.get('projectId'),'project-a');assert.equal(query.get('agent'),'codex');assert.equal(query.get('recordId'),'style-a');
 const route=vm.runInContext('currentRoute()',context);
 assert.match(route,/projectId=project-a/);assert.match(route,/channel=mcp/);assert.match(route,/demo=1/);
});

test("capability search filters immediately, keeps focus and escapes compliance evidence",()=>{
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',value:'',listeners:{},addEventListener(event,fn){this.listeners[event]=fn;},focus(){this.focused=true;}});return elements.get(id);};
 const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout,clearTimeout,console});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),context);
 vm.runInContext('summary={domainRegistry:[{id:"coding",name:"Coding"},{id:"writing",name:"Writing"}]};active="domains";domainsScreen()',context);
 element('capabilitySearch').value='Cod';element('capabilitySearch').listeners.input();
 assert.match(element('main').innerHTML,/<strong>Coding<\/strong>/);assert.doesNotMatch(element('main').innerHTML,/<strong>Writing<\/strong>/);assert.equal(element('capabilitySearch').focused,true);
 assert.doesNotMatch(element('main').innerHTML,/>Search<\/button>/);
 const html=vm.runInContext('complianceReviewPanel([{task:"<script>bad</script>",at:"2026-11-03",status:"not_verified",note:"File presence only",scope:"Selected styles",results:[],pendingTextChecks:2}])',context);
 assert.match(html,/&lt;script&gt;/);assert.match(html,/2 text checks not verified/);assert.doesNotMatch(html,/<script>/);
});

test("graph details open on selection and close with Escape without reserving an empty panel",()=>{
 const events={},elements=new Map();let focused=false;
 const node={dataset:{graphNode:"s"},setAttribute(){},classList:{toggle(){}},focus(){focused=true;}};
 const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:"",hidden:true,addEventListener(){}});return elements.get(id);};
 const context=vm.createContext({document:{getElementById:element,addEventListener(name,fn){events[name]=fn;},querySelectorAll(q){return q==="[data-graph-node]"?[node]:[];}},setTimeout,clearTimeout,console});
 vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
 const html=vm.runInContext('items=[{id:"s",title:"Style",summary:"Summary",domain:"coding",status:"active",requiredIds:[]}];dependencyMap(items)',context);
 assert.match(html,/<aside id="graphDetails"[^>]* hidden>/);assert.doesNotMatch(html,/Select a style to inspect its details/);
 vm.runInContext('highlightDependencyNode("s")',context);assert.equal(element("graphDetails").hidden,false);assert.match(element("graphDetails").innerHTML,/Close node details/);
 events.keydown({key:"Escape",target:{closest(){return null;}},preventDefault(){}});
 assert.equal(element("graphDetails").hidden,true);assert.equal(focused,true);assert.equal(vm.runInContext('selectedGraphNode',context),"");
});

test("My Styles renders recipes safely and filters through the existing library",()=>{
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id))elements.set(id,{innerHTML:"",textContent:"",value:"",style:{},listeners:{},addEventListener(event,callback){this.listeners[event]=callback;}});
    return elements.get(id);
  };
  const context=vm.createContext({
    document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];},querySelector(selector){return element(selector);}},
    sessionStorage:{getItem(){return "";},setItem(){}},setTimeout,clearTimeout,console
  });
  vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
  vm.runInContext(`items=[
    {id:"recipe",kind:"preference",domain:"diagrams",title:"Sky drawing",summary:"Editable drawings",content:"<script>unsafe</script>",tags:["style-recipe"],version:1,status:"draft"},
    {id:"writing",kind:"preference",domain:"writing",title:"Clear writing",summary:"Direct prose",content:"Write clearly",tags:[],version:1,status:"active"}
  ]; active="preference"; records("preference");`,context);
  const html=element("main").innerHTML;
  assert.match(html,/>Library</);
  assert.doesNotMatch(html,/Import samples/);
  assert.doesNotMatch(html,/style-intro|Your sample style library/);
  assert.match(html,/New Style/);
  assert.match(html,/Read instructions/);
  assert.match(html,/&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<script>unsafe/);
  assert.match(html,/draft/);
  element("searchBox").value="writing";
  element("searchBox").listeners.input();
  assert.match(element(".record-list").innerHTML,/Clear writing/);
  assert.doesNotMatch(element(".record-list").innerHTML,/Sky drawing/);
  assert.match(element(".results-count").textContent,/1 records/);
  vm.runInContext('domain="diagrams";search="";records("preference");',context);
  assert.match(element("main").innerHTML,/Sky drawing/);
  assert.doesNotMatch(element("main").innerHTML,/Clear writing/);
  vm.runInContext('items=Array.from({length:19},(_,i)=>({...items[0],id:String(i),title:"Record "+i}));domain="all";page=1;records("preference");',context);
  assert.equal((element("main").innerHTML.match(/data-edit=/g)||[]).length,8);
  assert.match(element("main").innerHTML,/Page 1 of 3/);
  vm.runInContext('page=3;records("preference");',context);
  assert.equal((element("main").innerHTML.match(/data-edit=/g)||[]).length,3);
  element("searchBox").value="Record 18";
  element("searchBox").listeners.input();
  assert.equal((element(".record-list").innerHTML.match(/data-edit=/g)||[]).length,1);
  assert.equal(vm.runInContext('page',context),1);
  for(const [view,expected,absent] of [["discover","discoveryTask","reviewText"],["baseline","bootstrapResults","discoveryTask"],["review_simulator","reviewText","bootstrapResults"]]){
    vm.runInContext('active='+JSON.stringify(view)+';discover()',context);
    assert.ok(element("main").innerHTML.includes(expected));
    assert.ok(!element("main").innerHTML.includes(absent));
  }

});


test("served UI uses stylesheet classes allowed by the existing security policy",()=>{
  const code=readFileSync(new URL("../public/app.js",import.meta.url),"utf8");
  const css=readFileSync(new URL("../public/style.css",import.meta.url),"utf8");
  const server=readFileSync(new URL("../src/server/http.ts",import.meta.url),"utf8");
  assert.doesNotMatch(code,/style="/);
  assert.doesNotMatch(code,/<[^>]*class="[^"]*"[^>]*class="/);
  assert.match(code,/Startup index/);
  assert.match(code,/baseline-action/);
  assert.match(css,/\.discovery-stack\{display:grid;gap:24px\}/);
  assert.match(css,/\.baseline-action\{[^}]*margin:16px 0/);
  assert.match(server,/style-src 'self';/);
});

test("local app opens without credentials and reports server failures with Retry",async()=>{
  const elements=new Map(),requests=[];
  const element=id=>{
    if(!elements.has(id))elements.set(id,{innerHTML:"",textContent:"",style:{},addEventListener(){}});
    return elements.get(id);
  };
  let available=true;
  const context=vm.createContext({
    document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},
    setTimeout,clearTimeout,console,Error,
    fetch:async(url,options)=>{
      requests.push(options);
      if(!available)throw new Error("Server stopped");
      return {ok:true,json:async()=>url.startsWith("/api/items")?[{id:"thinking",kind:"preference",domain:"thinking",title:"Evidence-led thinking",summary:"Compare evidence",content:"Worked example",tags:["style-recipe"],version:1,status:"draft"}]:{counts:{preference:0,skill:0,review:0},revisions:0}};
    }
  });
  vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
  await vm.runInContext('active="preference";refresh()',context);
  assert.match(element("main").innerHTML,/Evidence-led thinking/);
  assert.ok(requests.every(r=>!r.headers.Authorization));
  assert.doesNotMatch(element("main").innerHTML,/Access token|connectionForm/);
  available=false;
  await vm.runInContext('refresh()',context);
  assert.match(element("main").innerHTML,/Server stopped/);
  assert.match(element("main").innerHTML,/data-action="retry"/);
});

test("project configuration saves assignments and displays effective source",async()=>{
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id))elements.set(id,{innerHTML:"",textContent:"",value:"",style:{},addEventListener(){}});
    return elements.get(id);
  };
  const record={id:"r1",kind:"preference",domain:"design",title:"Sky UI",summary:"Design",content:"Blue",tags:[],status:"active",version:1};
  let saved;
  const context=vm.createContext({
    document:{getElementById:element,addEventListener(){},querySelectorAll(selector){return selector==='input[name="assignment"]:checked'?[{value:"r1"}]:[];}},
    setTimeout,clearTimeout,console,Error,
    fetch:async(url,options)=>{
      if(url==="/api/projects"&&options.method==="POST"){const body=JSON.parse(options.body);saved={...body,id:"p1",version:1};return {ok:true,json:async()=>saved};}
      return {ok:true,json:async()=>url==="/api/projects/p1"?saved:url.endsWith("/resolved")?[{...record,content:"Navy",source:"Project override"}]:url.startsWith("/api/items")?[record]:url==="/api/projects"?[]:{counts:{preference:1},revisions:1}};
    }
  });
  vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
  await vm.runInContext("refresh()",context);
  vm.runInContext("projectEditing=true;projectForm()",context);
  assert.match(element("main").innerHTML,/Sky UI/);
  vm.runInContext('summary.projectDefaultStyleIds=["r1"];projectForm()',context);
  assert.match(element("main").innerHTML,/value="r1" checked/);
  vm.runInContext('selectedProject={id:"existing",name:"Existing",description:"",assignments:[]};projectForm()',context);
  assert.doesNotMatch(element("main").innerHTML,/value="r1" checked/);
  vm.runInContext('selectedProject=null;projectForm()',context);
  element("projectName").value="Portal";
  element("projectDescription").value="Customer portal";
  element("override-r1").value="Navy";
  await vm.runInContext("saveProject({preventDefault(){}})",context);
  assert.deepEqual(saved.assignments,[{recordId:"r1",override:"Navy"}]);
  assert.match(element("main").innerHTML,/Project override/);
  assert.match(element("main").innerHTML,/Project styles/);
  assert.doesNotMatch(element("main").innerHTML,/id="repositoryFolder"|Agent conversations ·/);
  assert.doesNotMatch(element("main").innerHTML,/>Personalized styles<\/a>/);
  assert.match(element("main").innerHTML,/New personalized style/);
  await vm.runInContext('projectTab="personal";projectScreen()',context);
  assert.match(element("main").innerHTML,/No project-only styles yet/);
  assert.match(element("main").innerHTML,/href="#\/projects\/p1" aria-current="page">Styles/);
  assert.doesNotMatch(element("main").innerHTML,/<strong>Sky UI/);

});

test("dependency map includes transitive context, labels arrows, escapes titles and opens dependency editing",async()=>{
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id))elements.set(id,{innerHTML:"",textContent:"",value:"",style:{},addEventListener(){},focus(){this.focused=true;},showModal(){this.open=true;}});
    return elements.get(id);
  };
  const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout,clearTimeout,console});
  vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
  vm.runInContext(`items=[
    {id:"drawing",kind:"preference",domain:"architecture",title:"Drawing <unsafe>",summary:"",content:"",tags:[],status:"active",version:1,requiredIds:["tech","thinking"],checks:[]},
    {id:"tech",kind:"preference",domain:"technology",title:"Technology",summary:"",content:"",tags:[],status:"active",version:1,requiredIds:["thinking"],checks:[]},
    {id:"thinking",kind:"preference",domain:"thinking",title:"Thinking",summary:"",content:"",tags:[],status:"active",version:1,requiredIds:[],checks:[]}
  ];active="preference";domain="architecture";libraryMode="map";records("preference");`,context);
  const html=element("main").innerHTML;
  assert.match(html,/Dependency map/);assert.match(html,/3 styles shown/);
  assert.equal((html.match(/class="dependency-edge"/g)||[]).length,3);
  assert.equal((html.match(/<foreignObject/g)||[]).length,3);
  assert.match(html,/Drawing &lt;unsafe&gt;/);assert.doesNotMatch(html,/<unsafe>/);
  assert.match(html,/dependency-context/);
  await vm.runInContext('delegated({target:{closest(){return {dataset:{dependencies:"drawing"}}}}})',context);
  assert.equal(element("editor").open,true);assert.equal(element("editRequired").focused,true);
  assert.match(element("editRequired").innerHTML,/value="tech" checked/);
  vm.runInContext('items[0].requiredIds=["gone"];openEditor(items[0]);',context);
  assert.match(element("editRequired").innerHTML,/value="gone" checked/);
  assert.match(vm.runInContext('dependencyMap([items[0]])',context),/Unavailable dependency/);
  vm.runInContext('items[0].requiredIds=["tech"];items[1].requiredIds=["drawing"];',context);
  assert.ok(vm.runInContext('dependencyMap([items[0]])',context).includes("2 styles shown"));
});

test("project selection separates chosen records, keeps override drafts, and prevents slot conflicts",()=>{
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:"",textContent:"",hidden:false,style:{},addEventListener(){},appendChild(row){row.parentElement=this;}});return elements.get(id);};
  const makeRow=(slot,checked,value="")=>{
    const checkbox={checked,disabled:false},textarea={value,disabled:false},details={hidden:false},badge={textContent:""};
    return {dataset:{slot},parentElement:null,classList:{toggle(){}},checkbox,textarea,details,badge,querySelector(q){return q.startsWith("input")?checkbox:q==="textarea"?textarea:q===".project-override"?details:badge;}};
  };
  const chosen=makeRow("preference:technology",true,"Azure only"),alternative=makeRow("preference:technology",false),global=makeRow("preference:thinking",false);
  const rows=[chosen,alternative,global];
  const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(q){return q==="[data-assignment-row]"?rows:[];}},setTimeout,clearTimeout,console});
  vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
  vm.runInContext('syncProjectSelection()',context);
  assert.equal(chosen.parentElement,element("selectedAssignments"));
  assert.equal(chosen.badge.textContent,"Project override");
  assert.equal(alternative.checkbox.disabled,true);
  assert.equal(alternative.badge.textContent,"Another record selected");
  assert.equal(global.badge.textContent,"Not selected");
  assert.equal(global.details.hidden,true);assert.equal(global.textarea.disabled,true);
  assert.match(element("projectSelectionSummary").textContent,/1 selected · 1 overrides/);
  chosen.checkbox.checked=false;vm.runInContext('syncProjectSelection()',context);
  assert.equal(alternative.checkbox.disabled,false);assert.equal(chosen.textarea.value,"Azure only");
  assert.equal(element("noAssignments").hidden,false);
  chosen.checkbox.checked=true;vm.runInContext('syncProjectSelection()',context);
  assert.equal(chosen.textarea.disabled,false);assert.equal(chosen.details.hidden,false);
});

test("dependency checkbox values are saved through the record API",async()=>{
  const elements=new Map();let payload;
  const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:"",textContent:"",value:"",style:{},classList:{add(){},remove(){}},addEventListener(){},close(){}});return elements.get(id);};
  const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(q){return q.includes('requiredStyle')?[{value:"thinking"},{value:"technology"}]:[];}},setTimeout(){},clearTimeout(){},console,fetch:async(url,options)=>{if(options.method==="POST"){payload=JSON.parse(options.body);return {ok:true,json:async()=>payload};}return {ok:true,json:async()=>url.startsWith("/api/items")?[]:{counts:{preference:0},revisions:0}};}});
  vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
  element("editKind").value="preference";element("editDomain").value="architecture";element("editTitle").value="Drawing";element("editPriority").value="90";element("editStatus").value="active";
  element("editUseWhen").value="Drawing service boundaries";element("editTags").value="diagram, boundaries";
  await vm.runInContext('active="preference";saveEditor({preventDefault(){}})',context);
  assert.deepEqual(payload.requiredIds,["thinking","technology"]);
  assert.equal(payload.useWhen,"Drawing service boundaries");assert.deepEqual(payload.tags,["diagram","boundaries"]);
  const html=readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
  assert.match(html,/<fieldset class="full dependency-picker">/);
  assert.doesNotMatch(html,/Command\/Ctrl|select id="editRequired"/);
});

test("map renders directed links and project guide supplies explicit agent scope",()=>{
  const element=()=>({innerHTML:"",style:{},addEventListener(){}});
  const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout,clearTimeout,console});
  vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
  const html=vm.runInContext(`items=[
    {id:"drawing",title:"Drawing",domain:"architecture",status:"active",requiredIds:["tech","thinking"]},
    {id:"patterns",title:"Architecture design patterns — microservices, DDD and modular design",domain:"architecture",status:"draft",requiredIds:["thinking"]},
    {id:"tech",title:"Azure",domain:"technology",status:"active",requiredIds:["thinking"]},
    {id:"thinking",title:"Thinking",domain:"thinking",status:"active",requiredIds:[]}
  ];dependencyMap(items)`,context);
  const bypass=html.match(/<path class="dependency-edge"[^>]* d="([^"]+)"[^>]*><title>Drawing requires Thinking/);
  assert.ok(bypass);assert.match(bypass[1],/ L /);
  const boxes=[...html.matchAll(/<foreignObject[^>]* x="([\d.]+)" y="([\d.]+)" width="144" height="144"/g)];
  assert.equal(boxes.length,4);assert.ok(boxes.every(b=>Number(b[2])>=0));
  assert.match(html,/graph-orb/);
  assert.match(html,/not execution order/);
  const guide=vm.runInContext('projectAgentGuide("project-123")',context);
  for(const text of ["Link repository","Test connection","personal-brain hooks install both","codex mcp get personal-brain","claude mcp get personal-brain","brain_bootstrap","requiredLinked","Trace Explorer","does not switch agent sessions"]){assert.ok(guide.includes(text),text);}
  assert.match(guide,/project-123/);
  assert.match(guide,/<details><summary>Preview prompt/);
  assert.doesNotMatch(guide,/<details open>/);
  for(const text of ["Copy onboarding prompt","brain_discover_project","brain_update_project_style","sourceFiles","expectedProjectVersion","conflicts: []","Linking alone does not analyze","global versions stay unchanged"]){assert.ok(guide.includes(text),text);}

});

test("URL navigation restores views, library filters and project configuration",async()=>{
  const elements=new Map(),history=[],events={};
  const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:"",textContent:"",style:{},addEventListener(){},classList:{add(){},remove(){},toggle(){}}});return elements.get(id);};
  const project={id:"696366e9-d012-4288-8a46-376b49873137",name:"IoT Platform",description:"",assignments:[],version:1};
  const window={location:{hash:"#/overview"},history:{pushState(_s,_t,url){history.push(url);window.location.hash=url;},replaceState(_s,_t,url){window.location.hash=url;}},addEventListener(name,fn){events[name]=fn;}};
  const context=vm.createContext({window,URLSearchParams,document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout,clearTimeout,console,fetch:async url=>({ok:true,json:async()=>url.startsWith("/api/items")?[]:url==="/api/projects"?[]:url.endsWith("/resolved")?[]:url.startsWith("/api/projects/")?project:{counts:{preference:0,skill:0,review:0},revisions:0}})});
  vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
  await vm.runInContext('loadRoute()',context);
  assert.match(element("main").innerHTML,/>Overview</);
  await vm.runInContext('delegated({target:{closest(){return {dataset:{view:"discover"}}}}})',context);
  assert.equal(window.location.hash,"#/discover");assert.equal(history.at(-1),"#/discover");
  window.location.hash="#/overview";await vm.runInContext('loadRoute()',context);
  assert.match(element("main").innerHTML,/>Overview</);assert.equal(history.length,1);
  assert.equal(typeof events.hashchange,"function");
  window.location.hash="#/library?type=skill&q=cloud&domain=architecture&mode=map";
  await vm.runInContext('loadRoute()',context);
  assert.equal(vm.runInContext('active',context),"skill");assert.equal(vm.runInContext('search',context),"cloud");assert.equal(vm.runInContext('libraryMode',context),"map");
  window.location.hash="#/projects/"+project.id+"/configure";await vm.runInContext('loadRoute()',context);
  assert.match(element("main").innerHTML,/Configure project/);assert.match(element("main").innerHTML,/IoT Platform/);
  await vm.runInContext('delegated({target:{closest(){return {dataset:{action:"project-cancel"}}}}})',context);
  assert.equal(window.location.hash,"#/projects/"+project.id);
  window.location.hash="#/projects/"+project.id+"?tab=setup";await vm.runInContext('loadRoute()',context);
  assert.match(element("main").innerHTML,/id="repositoryFolder"/);
  assert.doesNotMatch(element("main").innerHTML,/No styles selected/);
  assert.equal(vm.runInContext('currentRoute()',context),window.location.hash);
  window.location.hash="#/projects/"+project.id+"?tab=personal";await vm.runInContext('loadRoute()',context);
  assert.match(element("main").innerHTML,/New personalized style/);
  assert.equal(vm.runInContext('currentRoute()',context),window.location.hash);
  window.location.hash="#/projects/"+project.id+"?tab=map";await vm.runInContext('loadRoute()',context);
  assert.match(element("main").innerHTML,/No matching styles/);
  window.location.hash="#/projects?q=portal";await vm.runInContext('loadRoute()',context);
  assert.equal(vm.runInContext('search',context),"portal");
  assert.equal(vm.runInContext('currentRoute()',context),"#/projects?q=portal");
  window.location.hash="#/unknown";await vm.runInContext('loadRoute()',context);
  assert.equal(window.location.hash,"#/overview");
  window.location.hash="";await vm.runInContext("loadRoute()",context);
  assert.equal(window.location.hash,"#/overview");
});

test("graph node selection highlights only incident arrows without opening the editor",async()=>{
  const element=()=>({innerHTML:"",style:{},addEventListener(){},showModal(){throw new Error("Graph must not open editor");}});
  const edge=(from,to)=>({dataset:{from,to},classes:new Set(),classList:{toggle(name,on){on?this.owner.classes.add(name):this.owner.classes.delete(name);}},parentElement:{appendChild(){}}});
  const edges=[edge("drawing","thinking"),edge("tech","thinking"),edge("drawing","tech")];edges.forEach(e=>e.classList.owner=e);
  const nodes=["drawing","thinking","tech","unrelated"].map(id=>({dataset:{graphNode:id},classes:new Set(),classList:{toggle(name,on){on?this.owner.classes.add(name):this.owner.classes.delete(name);}},setAttribute(key,value){this[key]=value;}}));nodes.forEach(n=>n.classList.owner=n);
  const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(q){return q===".dependency-edge"?edges:q==="[data-graph-node]"?nodes:[];}},setTimeout,clearTimeout,console});
  vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
  await vm.runInContext('delegated({target:{closest(){return {dataset:{graphNode:"tech"}}}}})',context);
  assert.ok(edges[0].classes.has("is-muted"));assert.ok(edges[1].classes.has("is-highlighted"));assert.ok(edges[2].classes.has("is-highlighted"));
  assert.equal(nodes[2]["aria-pressed"],"true");assert.ok(nodes[0].classes.has("is-linked"));assert.ok(nodes[3].classes.has("is-muted"));
  await vm.runInContext('delegated({target:{closest(){return {dataset:{graphNode:"tech"}}}}})',context);
  assert.ok(edges.every(e=>e.classes.size===0));assert.ok(nodes.every(n=>n["aria-pressed"]==="false"));
});

test("project rows navigate to details and render conversation counts",async()=>{
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:"",style:{},addEventListener(){}});return elements.get(id);};
 const p={id:"696366e9-d012-4288-8a46-376b49873137",name:"IoT",description:"",assignments:[],updatedAt:new Date().toISOString(),activity:{linked:3,active:1,unlinkedCalls:2,sessions:[]}};
 const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout,clearTimeout,console,fetch:async url=>({ok:true,json:async()=>url.startsWith("/api/items")?[]:url==="/api/projects"?[p]:url.endsWith("/activity")?p.activity:url.endsWith("/resolved")?[]:p})});
 vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
 await vm.runInContext('projectScreen()',context);
 assert.match(element("main").innerHTML,/1 recently active/);assert.match(element("main").innerHTML,/3 linked/);
 assert.match(element("main").innerHTML,/href="#\/projects\/696366e9/);
 await vm.runInContext(`delegated({target:{closest(selector){return selector==='[data-project-row]'?{dataset:{projectRow:'${p.id}'}}:null;}}})`,context);
 assert.match(element("main").innerHTML,/Configure project/);
 assert.match(element("main").innerHTML,/No styles selected/);
 await vm.runInContext('projectTab="activity";projectScreen()',context);
 assert.match(element("main").innerHTML,/1 recently active \/ 3 linked/);
 assert.match(element("main").innerHTML,/2 calls without a conversation ID/);
});

test("repository action retries network interruption but preserves validation errors",async()=>{
 const element=()=>({textContent:"",style:{},addEventListener(){}});let calls=0,mode="recover";
 const context=vm.createContext({TypeError,Error,document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout(fn){fn();},clearTimeout(){},console,fetch:async(url)=>{
  if(!url.endsWith("/repository"))return {ok:true,json:async()=>[]};
  calls++;
  if(mode==="offline"||(mode==="recover"&&calls===1))throw new TypeError("NetworkError");
  if(mode==="invalid")return {ok:false,status:409,json:async()=>({message:"Already linked to another project"})};
  return {ok:true,json:async()=>({file:"/repo/.personal-brain.json",matches:true})};
 }});
 vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
 assert.equal((await vm.runInContext('repositoryRequest("p","/repo","link")',context)).matches,true);assert.equal(calls,2);
 calls=0;mode="invalid";await assert.rejects(vm.runInContext('repositoryRequest("p","/repo","link")',context),/Already linked/);assert.equal(calls,1);
 calls=0;mode="offline";await assert.rejects(vm.runInContext('repositoryRequest("p","/repo","test")',context),/npm start/);assert.equal(calls,4);
});


test("project dashboard searches and paginates collections without mixing detail sections",async()=>{
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:"",textContent:"",value:"",style:{},listeners:{},addEventListener(event,fn){this.listeners[event]=fn;}});return elements.get(id);};
  const projects=Array.from({length:19},(_,i)=>({id:"p"+i,name:"Project "+i,description:"Project "+i,assignments:[],updatedAt:"2026-11-03"}));
  projects[18].description="<script>unsafe</script>";
  const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout,clearTimeout,console,fetch:async()=>({ok:true,json:async()=>projects})});
  vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
  await vm.runInContext('active="projects";projectScreen()',context);
  assert.equal((element("main").innerHTML.match(/data-project-row=/g)||[]).length,8);
  assert.match(element("main").innerHTML,/Page 1 of 3/);
  assert.doesNotMatch(element("main").innerHTML,/<p>Project 0<\/p>/);
  await vm.runInContext('page=3;projectScreen()',context);
  assert.equal((element("main").innerHTML.match(/data-project-row=/g)||[]).length,3);
  assert.match(element("main").innerHTML,/&lt;script&gt;unsafe/);
  element("projectSearch").value="project 18";element("projectSearch").listeners.input();
  assert.equal(vm.runInContext('page',context),1);
  assert.match(element("projectCount").textContent,/1 of 19/);
  assert.equal((element("projectList").innerHTML.match(/data-project-row=/g)||[]).length,1);
  element("projectSearch").value="missing";element("projectSearch").listeners.input();
  assert.match(element("projectList").innerHTML,/No matching projects/);
  assert.equal(element("projectPagination").innerHTML,"");
  context.activity={active:1,linked:19,unlinkedCalls:0,sessions:projects.map(p=>({agent:"codex",threadId:p.id,active:false,calls:1,lastSeen:p.updatedAt}))};
  const activityHtml=vm.runInContext('page=2;projectActivityPanel(activity,"")',context);
  assert.match(activityHtml,/Page 2 of 3/);
  assert.doesNotMatch(activityHtml,/<p>p0<\/p>/);
  assert.match(activityHtml,/<p>p8<\/p>/);
  assert.match(vm.runInContext('projectActivityPanel(null,"Offline")',context),/Activity unavailable/);
});


test("domain names populate filters and management safely",async()=>{
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:"",style:{},addEventListener(){}});return elements.get(id);};
 const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout,clearTimeout,console});
 vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
 await new Promise(resolve=>setImmediate(resolve));
 vm.runInContext('summary={domainRegistry:[{id:"data",name:"Data <engineering>"}]};active="domains";domainsScreen()',context);
 assert.match(element("main").innerHTML,/data-edit-domain="data"/);
 assert.doesNotMatch(element("main").innerHTML,/id="domainRename"/);
 vm.runInContext('domainEditing="data";domainDrafts.set("data","Draft name");newDomainDraft="New category";domainsScreen()',context);
 assert.match(element("main").innerHTML,/form="domainRename"/);
 assert.match(element("main").innerHTML,/value="Draft name"/);
 assert.doesNotMatch(element("main").innerHTML,/id="domainCreate"/);
 assert.match(element("main").innerHTML,/data-action="capability-add"/);
 await vm.runInContext('delegated({target:{closest(){return {dataset:{cancelDomain:"data"}}}}})',context);
 assert.equal(vm.runInContext('domainDrafts.size',context),0);
 assert.doesNotMatch(element("main").innerHTML,/id="domainRename"/);

 assert.match(element("main").innerHTML,/Data &lt;engineering&gt;/);
 assert.match(vm.runInContext('domainOptions("data")',context),/value="data" selected/);
 vm.runInContext('search="missing";domainsScreen()',context);
 assert.doesNotMatch(element("main").innerHTML,/data-edit-domain="data"/);
 vm.runInContext('search="engineering";domainsScreen()',context);
 assert.match(element("main").innerHTML,/data-edit-domain="data"/);
 vm.runInContext('search=""',context);
 vm.runInContext('active="preference";records("preference")',context);
 assert.match(element("main").innerHTML,/Data &lt;engineering&gt;/);
 const html=readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
 assert.ok(html.indexOf('data-view="overview"')<html.indexOf('data-view="projects"'));
});

test("style graph and project instructions include owned external skills and reviews",()=>{
 const element=()=>({innerHTML:"",style:{},addEventListener(){}});
 const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout,clearTimeout,console});
 vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
 const html=vm.runInContext('graphShowContents=true;items=[{id:"s",title:"Drawing",domain:"architecture",status:"active",requiredIds:[],principles:["Editable"],externalSkills:["drawio-skill"],reviewCriteria:["Inspect <arrows>"]}];dependencyMap(items)',context);
 assert.match(html,/1 styles shown/);assert.match(html,/Inspect &lt;arrows&gt;/);
 const detail=vm.runInContext('styleContract(items[0])',context);assert.match(detail,/drawio-skill/);assert.match(detail,/Inspect &lt;arrows&gt;/);
 assert.equal((html.match(/class="dependency-edge"/g)||[]).length,2);
 assert.equal(vm.runInContext('items[0].requiredIds.length',context),0);
 assert.match(vm.runInContext('styleContract(items[0])',context),/Review criteria/);
});


test("graph shows every owned skill, review and example with distinct types",()=>{
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:"",style:{},addEventListener(){}});return elements.get(id);};
 const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout,clearTimeout,console});
 vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
 const html=vm.runInContext('graphShowContents=true;graph3d=true;items=Array.from({length:5},(_,i)=>({id:"s"+i,kind:"preference",title:"Style "+i,domain:"coding",status:"active",requiredIds:[],externalSkills:["codebase-memory"],reviewCriteria:["Review <code>","Second rule"],examples:["Example"]}));dependencyMap(items)',context);
 assert.equal((html.match(/<foreignObject/g)||[]).length,25);
 assert.equal((html.match(/class="dependency-edge"/g)||[]).length,20);
 for(const type of ["preference","skill","review","example","tool"])assert.ok(html.includes("graph-type-"+type));
 assert.match(html,/Node type legend/);assert.doesNotMatch(html,/Collapse contents|Expand contents/);
 vm.runInContext('highlightDependencyNode("s0:review:0")',context);
 assert.match(element("graphDetails").innerHTML,/Review &lt;code&gt;/);assert.match(element("graphDetails").innerHTML,/data-edit="s0"/);
 assert.equal(vm.runInContext('items[0].requiredIds.length',context),0);
 const point=vm.runInContext('projectGraphPoint({x:100,y:50,z:90})',context);
 vm.runInContext('graphYaw=1',context);const rotated=vm.runInContext('projectGraphPoint({x:100,y:50,z:90})',context);
 assert.notEqual(point.x,rotated.x);assert.notEqual(point.scale,rotated.scale);
 vm.runInContext('graph3d=false',context);assert.equal(vm.runInContext('projectGraphPoint({x:100,y:50,z:90}).scale',context),1);
});


test("editing a selected shared style uses the project copy endpoint",async()=>{
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:"",textContent:"",value:"",style:{},addEventListener(){},showModal(){},close(){}});return elements.get(id);};
 const calls=[];const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout,clearTimeout,console});
 vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
 await new Promise(resolve=>setImmediate(resolve));
 context.capture=(path,options)=>{calls.push({path,body:JSON.parse(options.body)});return Promise.resolve({});};
 vm.runInContext('api=capture;refresh=async()=>{};active="projects";projectTab="styles";selectedProject={id:"p",version:3,assignments:[{recordId:"s",override:"Project instructions"}]};items=[{id:"s",version:2,kind:"preference",domain:"writing",title:"Writing",summary:"Summary",content:"Global",tags:[],checks:[],status:"active"}];openEditor(items[0])',context);
 assert.match(element("editorTitle").textContent,/global style stays unchanged/);
 assert.equal(element("editContent").value,"Project instructions");
 await vm.runInContext('saveEditor({preventDefault(){}})',context);
 assert.equal(calls[0].path,"/api/projects/p/items/s");assert.equal(calls[0].body.expectedProjectVersion,3);assert.equal(calls[0].body.expectedVersion,2);
 assert.equal(calls[0].body.record.content,"Project instructions");
});


test("private records expose publishing only in projects and cancellation does not write",async()=>{
 const element=()=>({innerHTML:"",style:{},addEventListener(){}});
 let writes=0;const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout,clearTimeout,console,confirm:()=>false});
 vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
 await new Promise(resolve=>setImmediate(resolve));
 context.capture=()=>{writes++;};
 const html=vm.runInContext('api=capture;active="projects";selectedProject={id:"p"};items=[{id:"s",projectId:"p",title:"Private",domain:"writing",kind:"preference",status:"active",version:1}];recordTable(items)',context);
 assert.match(html,/data-publish="s"/);
 await vm.runInContext('delegated({target:{closest(){return {dataset:{publish:"s"}}}}})',context);
 assert.equal(writes,0);
 assert.doesNotMatch(vm.runInContext('active="preference";recordTable(items)',context),/data-publish/);
});


test("graph viewport zoom, fit and pan change only the viewBox",()=>{
 const events={};const svg={dataset:{size:"800"},view:"0 0 800 800",getAttribute(){return this.view;},setAttribute(key,value){assert.equal(key,"viewBox");this.view=value;},getBoundingClientRect(){return {width:800,height:800};},setPointerCapture(){}};
 const element=id=>id==="dependencyGraph"?svg:{innerHTML:"",style:{},addEventListener(){}};
 const context=vm.createContext({document:{getElementById:element,addEventListener(name,fn){events[name]=fn;},querySelectorAll(){return [];}},setTimeout,clearTimeout,console});
 vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
 vm.runInContext('graph3d=false;zoomGraph("in")',context);assert.equal(svg.view,"80 80 640 640");
 vm.runInContext('zoomGraph("fit")',context);assert.equal(svg.view,"0 0 800 800");
 let prevented=false;
 events.pointerdown({preventDefault(){prevented=true;},target:{closest:q=>q==="#dependencyGraph"?svg:null},button:0,clientX:10,clientY:10,pointerId:1});
 assert.equal(prevented,true);
 events.pointermove({clientX:30,clientY:40});assert.equal(svg.view,"-20 -30 800 800");
 events.pointerup();events.pointermove({clientX:90,clientY:90});assert.equal(svg.view,"-20 -30 800 800");
 vm.runInContext('zoomGraph("fit")',context);assert.equal(svg.view,"0 0 800 800");
});


test("navigation keeps setup and traces visible and shows only discovery and startup preview under diagnostics",()=>{
 const html=readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
 const advanced=html.match(/<details id="advancedNav"[\s\S]*?<\/details>/)?.[0];assert.ok(advanced);
 for(const view of ["discover","baseline"])assert.ok(advanced.includes(`data-view="${view}"`));
 for(const view of ["review_simulator","tool","feedback","history"])assert.ok(!html.includes(`class="nav-item" data-view="${view}"`),`${view} is hidden from navigation`);
 assert.ok(!advanced.includes('data-view="activation"'));assert.ok(!advanced.includes('data-view="trace"'));
 assert.match(html,/Agent setup/);
});


test("3D orbit and dragging update layout without mutating saved records",()=>{
 const events={};const svg={dataset:{size:"1000"},view:"0 0 1000 1000",getAttribute(){return this.view;},setAttribute(){},getBoundingClientRect(){return {width:1000,height:1000};},setPointerCapture(){}};
 const element=id=>id==="dependencyGraph"?svg:{innerHTML:"",style:{},addEventListener(){}};
 const context=vm.createContext({document:{getElementById:element,addEventListener(name,fn){events[name]=fn;},querySelectorAll(){return [];}},setTimeout,clearTimeout,console});
 vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
 vm.runInContext('items=[{id:"s",kind:"preference",title:"Style",domain:"coding",requiredIds:[]}];dependencyMap(items);graph3d=true',context);
 events.pointerdown({preventDefault(){},target:{closest:q=>q==="#dependencyGraph"?svg:null},button:0,clientX:0,clientY:0});
 events.pointermove({clientX:40,clientY:20,pointerId:1});assert.equal(vm.runInContext('graphYaw',context),.32);events.pointerup();
 const before=vm.runInContext('JSON.stringify(graphPoints.get("s"))',context);
 events.pointerdown({preventDefault(){},target:{closest:q=>q==="#dependencyGraph"?svg:{dataset:{graphNode:"s"},focus(){}}},button:0,clientX:0,clientY:0});
 events.pointermove({clientX:40,clientY:20,pointerId:1});events.pointerup();
 assert.notEqual(vm.runInContext('JSON.stringify(graphPoints.get("s"))',context),before);
 assert.equal(vm.runInContext('items[0].requiredIds.length',context),0);
});


test("project discovery paginates and filters inventory immediately and escapes missing skill warnings",async()=>{
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:"",textContent:"",value:"",open:false,listeners:{},addEventListener(event,fn){this.listeners[event]=fn;},showModal(){this.open=true;}});return elements.get(id);};
 const report={references:[{recordId:"style",title:"Development",reference:"review-skill",status:"ambiguous",skills:[{name:"review-skill",scope:"global",agent:"codex",file:"/skills/review"}]}],folder:"/repo",skills:Array.from({length:25},(_,i)=>({id:String(i),name:"Skill "+i,scope:i===24?"project":"global",agent:"shared",file:"/skills/"+i})),issues:[{message:"Missing <unsafe>"}],selectedStyles:[],files:["<script>unsafe</script>"],totalFiles:1,truncated:false,projectVersion:1,workflow:"",limitations:"Review conflicts"};
 const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout,clearTimeout,console,fetch:async()=>({ok:true,json:async()=>report})});
 vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
 await vm.runInContext('selectedProject={id:"project"};showProjectDiscovery()',context);
 assert.match(element("projectDiscoveryContent").innerHTML,/Style → required skill/);
 assert.match(element("projectDiscoveryContent").innerHTML,/Multiple different copies/);
 assert.match(element("projectDiscoveryContent").innerHTML,/not automatically linked/);
 assert.doesNotMatch(element("projectDiscoveryContent").innerHTML,/<details open>/);
 assert.equal(element("discoveryDialog").open,true);assert.match(element("projectDiscoveryContent").innerHTML,/Missing &lt;unsafe&gt;/);assert.doesNotMatch(element("projectDiscoveryContent").innerHTML,/<script>/);
 assert.equal((element("installedSkillRows").innerHTML.match(/<tr>/g)||[]).length,20);assert.match(element("installedSkillCount").textContent,/Page 1 of 2/);
 element("installedSkillNext").listeners.click();assert.equal((element("installedSkillRows").innerHTML.match(/<tr>/g)||[]).length,5);
 element("installedSkillSearch").value="project";element("installedSkillSearch").listeners.input();assert.match(element("installedSkillRows").innerHTML,/Skill 24/);assert.equal((element("installedSkillRows").innerHTML.match(/<tr>/g)||[]).length,1);assert.equal(element("installedSkillNext").disabled,true);
 element("installedSkillSearch").value="absent";element("installedSkillSearch").listeners.input();assert.equal(element("installedSkillEmpty").hidden,false);
 const html=vm.runInContext('recordTable([{id:"s",title:"Style",summary:"",content:"",domain:"coding",status:"active",version:1,skillWarnings:["<missing>: missing"]}])',context);assert.match(html,/1 missing skill/);assert.match(html,/&lt;missing&gt;/);
});


test("onboarding prompt copies the project scope and handles unavailable clipboard",async()=>{
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:"",textContent:"",style:{},addEventListener(){},classList:{add(){},remove(){}}});return elements.get(id);};
  let copied="";
  const navigator={clipboard:{async writeText(text){copied=text;}}};
  const context=vm.createContext({navigator,document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout(){},clearTimeout,console});
  vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
  await vm.runInContext('delegated({target:{closest(){return {dataset:{copyOnboarding:"project-123"}}}}})',context);
  assert.match(copied,/projectId "project-123"/);
  assert.match(copied,/leave affected styles unchanged when conflicts remain/);
  assert.match(copied,/Do not change global styles/);
  navigator.clipboard.writeText=async()=>{throw new Error("denied");};
  await vm.runInContext('delegated({target:{closest(){return {dataset:{copyOnboarding:"project-123"}}}}})',context);
  assert.ok([...elements.values()].some(e=>e.textContent.includes("Select and copy the visible onboarding prompt")));
});


test("project style icon actions retain labels and private scope actions",()=>{
  const context=vm.createContext({document:{getElementById(){return {addEventListener(){}};},addEventListener(){}},console});
  vm.runInContext(readFileSync(new URL("../public/app.js",import.meta.url),"utf8"),context);
  const shared=vm.runInContext('projectStyleActions({id:"shared"})',context);
  assert.match(shared,/aria-label="Edit for project"/);
  assert.match(shared,/title="History"/);
  assert.doesNotMatch(shared,/data-publish|data-remove-kind/);
  const own=vm.runInContext('projectStyleActions({id:"private",projectId:"p1"})',context);
  assert.equal((own.match(/class="action-tooltip"/g)||[]).length,4);
  assert.match(own,/data-publish="private"/);
  assert.match(own,/aria-label="Delete private style"/);
  assert.match(own,/aria-hidden="true"/);
});

test("unsaved project changes ask before leaving and keep the draft when declined",()=>{
 const answers=[];let asked=0;
 const context=vm.createContext({URLSearchParams,confirm(){asked++;return answers.shift();},document:{addEventListener(){},getElementById(){return {addEventListener(){}};},querySelectorAll(){return [];}},setTimeout,clearTimeout,console});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),context);
 assert.equal(vm.runInContext('projectFormDirty=false;confirmLeaveProject()',context),true);assert.equal(asked,0);
 answers.push(false);assert.equal(vm.runInContext('projectFormDirty=true;confirmLeaveProject()',context),false);assert.equal(vm.runInContext('projectFormDirty',context),true);
 answers.push(true);assert.equal(vm.runInContext('confirmLeaveProject()',context),true);assert.equal(vm.runInContext('projectFormDirty',context),false);assert.equal(asked,2);
});

test("every info icon has its own help entry titled like the label beside it",()=>{
 const context=vm.createContext({URLSearchParams,document:{addEventListener(){},getElementById(){return {addEventListener(){}};},querySelectorAll(){return [];}},setTimeout,clearTimeout,console});
 const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 vm.runInContext(js,context);
 const help=new Set(vm.runInContext('Object.keys(HELP)',context));
 const keys=new Set([...js.matchAll(/infoButton\("([a-z_]+)"\)/g),...html.matchAll(/data-info="([a-z_]+)"/g)].map(m=>m[1]));
 for(const k of keys)assert.ok(help.has(k),`no help entry for info icon "${k}"`);
 const kpi=["trace_startup","trace_prompt","trace_tokens","trace_discovery","trace_loads","trace_reviews"];
 assert.equal(new Set(kpi.map(k=>vm.runInContext(`HELP.${k}.what`,context))).size,kpi.length,'each trace metric explains something different');
 assert.equal(vm.runInContext('helpTitle("trace_startup")',context),'Startup injections');
});

test('Fusion polling preserves the form while running and stops after leaving the page',async()=>{
 const elements=new Map(),timers=[];let status='running',requests=0;
 const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',addEventListener(){},querySelectorAll(){return [];}});return elements.get(id);};
 const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},console,fetch:async url=>{requests++;return {ok:true,json:async()=>url==='/api/projects'?[{id:'p',name:'Project'}]:url==='/api/fusion'?[{id:'run',agent:'codex',status,createdAt:'2026-11-04'}]:{id:'run',status,proposals:[]}};}});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),context);
 vm.runInContext('updateUrl=()=>{};active="fusion";fusionCurrent="run";fusionProjects=[];fusionAgent="claude";',context);
 await vm.runInContext('fusionScreen()',context);
 assert.match(element('main').innerHTML,/value="claude" selected/);
 const html=element('main').innerHTML;
 await timers.shift()();assert.equal(element('main').innerHTML,html);
 status='ready';await timers.shift()();assert.match(element('main').innerHTML,/No reusable changes proposed/);
 status='running';await vm.runInContext('fusionScreen()',context);
 vm.runInContext('active="projects"',context);const before=requests;
 await timers.shift()();assert.equal(requests,before);
});

test('skill issue details contain only unresolved requirements for the clicked style',async()=>{
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',open:false,showModal(){this.open=true;},addEventListener(){}});return elements.get(id);};
 const data={references:[{recordId:'a',title:'Style A',reference:'missing-tool',status:'missing',skills:[]},{recordId:'a',title:'Style A',reference:'ambiguous-tool',status:'ambiguous',skills:[]},{recordId:'a',title:'Style A',reference:'working-tool',status:'available',skills:[]},{recordId:'b',title:'Style B',reference:'other-tool',status:'missing',skills:[]}],selectedStyles:[{id:'a'}],issues:[]};
 const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout,clearTimeout,console,fetch:async()=>({ok:true,json:async()=>data})});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),context);
 vm.runInContext('selectedProject={id:"p"}',context);await vm.runInContext('showProjectDiscovery("a")',context);
 const html=element('projectDiscoveryContent').innerHTML;
 assert.match(html,/Missing/);assert.match(html,/missing-tool/);assert.match(html,/ambiguous-tool/);assert.doesNotMatch(html,/working-tool|other-tool|All detected installations/);
 assert.equal(element('projectDiscoveryTitle').textContent,'Resolve required skills');
 assert.equal(vm.runInContext('skillIssueLabel(["a: missing","b: ambiguous"])',context),'1 missing skill · 1 skill has conflicting copies');
});

test('Fusion renders history as rows and shows one proposal with grouped decision actions',async()=>{
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',addEventListener(){},querySelectorAll(){return [];}});return elements.get(id);};
 const proposal=id=>({targetId:id,title:'Proposal '+id,rationale:'Reusable method',content:'New',conflicts:[],sourceIds:[],principles:[],examples:[],externalSkills:[],reviewCriteria:[]});
 const job={status:'ready',proposals:[proposal('a'),proposal('b')],targets:[{id:'a',version:1,content:'Old'},{id:'b',version:1,content:'Old'}],sources:[],applied:[],rejected:[]};
 const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout,clearTimeout,console,fetch:async url=>({ok:true,json:async()=>url==='/api/projects'?[]:url==='/api/fusion'?[{id:'run',agent:'codex',status:'ready',createdAt:'2026-11-04'}]:job})});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),context);vm.runInContext('updateUrl=()=>{};active="fusion";fusionCurrent="run";fusionSelected="b"',context);
 await vm.runInContext('fusionScreen()',context);const html=element('main').innerHTML;
 assert.match(html,/Analysis history/);assert.match(html,/aria-label="Proposals"/);assert.match(html,/data-fusion-apply="b"/);assert.doesNotMatch(html,/data-fusion-apply="a"/);assert.match(html,/<footer class="fusion-decision">/);
});

test('Library drops cached private records before rendering counts, search or dependency map',()=>{
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',addEventListener(){}});return elements.get(id);};
 const context=vm.createContext({document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];}},setTimeout,clearTimeout,console});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),context);
 vm.runInContext('updateUrl=()=>{};active="preference";items=[{id:"shared",title:"Shared style",kind:"preference",domain:"coding",tags:[],content:"",summary:"",status:"active",version:1},{id:"private",projectId:"p",title:"Private secret style",kind:"preference",domain:"coding",tags:[],content:"",summary:"",status:"active",version:1}];records("preference")',context);
 assert.match(element('main').innerHTML,/Shared style/);assert.doesNotMatch(element('main').innerHTML,/Private secret style/);assert.equal(vm.runInContext('items.length',context),1);
});

test('Library skill warnings explain the cause and a supported resolution',()=>{
 const context=vm.createContext({document:{addEventListener(){},getElementById(){return {addEventListener(){}};},querySelectorAll(){return [];}},setTimeout,clearTimeout,console});
 vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),context);
 const html=vm.runInContext('skillWarningExplanation("review: ambiguous")',context);
 assert.match(html,/different instructions/);assert.match(html,/\.agents\/skills/);assert.match(html,/refresh this page/);
 const missing=vm.runInContext('skillWarningExplanation("review: missing")',context);
 assert.match(missing,/No matching installed skill/);assert.match(missing,/Install the required skill/);
});

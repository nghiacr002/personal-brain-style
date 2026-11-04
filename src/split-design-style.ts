import {BrainDB} from "./database.ts";

export function splitDesignStyle(db:BrainDB){
  const key="split_design_style_v1";
  if(db.db.prepare("SELECT value FROM meta WHERE key=?").get(key))return 0;
  const ux=db.list({kind:"preference",limit:300}).find(r=>r.tags.includes("personal-brain-project-design"));
  if(!ux)return 0;
  if(!db.hasDomain("design-system"))db.saveDomain("Design system");
  let visual=db.list({kind:"preference",limit:300}).find(r=>r.tags.includes("personal-sky-blue-design-system"));
  if(!visual)visual=db.create({
    kind:"preference",domain:"design-system",title:"Sky-blue color scheme & design system",
    summary:"Reusable sky-blue visual tokens for colors, typography, spacing and component states.",
    content:"Apply when this visual style is selected. Use a calm sky-blue system: pale blue page backgrounds, white surfaces, dark readable text and blue primary actions. Define reusable semantic tokens rather than separate colors for each component. Suggested starting palette: page #F0F9FF; surface #FFFFFF; soft accent #E0F2FE; primary #0369A1; primary hover #075985; text #0F172A; secondary text #475569. Verify contrast for actual text, borders, focus and disabled states rather than assuming these combinations are accessible.\n\nKeep typography, spacing, borders and component states consistent. Reuse the application's existing font and component tokens; use a coherent spacing scale such as 4, 8, 12, 16, 24 and 32 pixels. Use restrained borders and shadows, consistent corner radii and visible focus indicators. Avoid promotional gradients, decorative clutter and oversized empty surfaces. Maintain hierarchy through type size, weight and spacing.\n\nUse semantic success, warning and error colors with text or icons, never color alone. Define default, hover, focus, active, disabled, loading and error states. Ensure tables, dialogs, inputs and buttons share the same tokens. This is a visual design system, not software architecture or a replacement for the separately selected UI/UX workflow style. Diagram-specific drawing instructions retain their own requirements, including square boxes when requested.",
    principles:["Use shared semantic tokens for a calm sky-blue visual identity.","Keep type, spacing, borders and component states consistent.","Verify contrast and communicate state with more than color."],
    externalSkills:["design-system"],
    reviewCriteria:["Check that page, surface, text and action colors use shared semantic tokens.","Measure contrast for actual foreground/background pairs and inspect keyboard focus visibility.","Verify consistent typography, spacing and states across tables, dialogs, buttons and inputs.","Inspect narrow and wide layouts for clipping and visual imbalance; report any unperformed visual checks.","Ensure status messages use text or icons in addition to color."],
    examples:["A capability list uses a pale sky-blue page, white table and dialog surfaces, dark labels and one blue Add action. Rename and Cancel use secondary styling. Inputs share border and focus tokens. Error messages include explanatory text; verify actual contrast and rendered states."],
    tags:["personal-sky-blue-design-system","design-system","sky-blue","visual-style"],requiredIds:[],priority:ux.priority,status:"active",checks:[],backend:null
  });
  const content=ux.content.replace("Use a calm sky-blue visual system: pale blue backgrounds, white surfaces, dark readable text and blue primary actions. ","")
    .replace("Keep typography, spacing and alignment consistent; avoid oversized cards, empty gaps and promotional banners.","Keep information hierarchy and alignment clear; avoid oversized cards, empty gaps and promotional banners.");
  db.update(ux.id,{...ux,title:"UI/UX preferences",summary:"Task-centered composition, progressive disclosure, accessible interactions and workflow review.",content:content+"\n\nVisual colors and design tokens belong to the separately selected design-system style. These UI/UX preferences do not require a particular color scheme.",principles:(ux.principles||[]).map(p=>p.replace("One purpose per screen; compact sky-blue interfaces.","One purpose per screen; compact task-centered interfaces."))},ux.version);
  for(const project of db.projects().filter(p=>p.assignments.some(a=>a.recordId===ux.id))){
    if(project.assignments.some(a=>{const r=db.get(a.recordId);return r?.kind==="preference"&&r.domain==="design-system";}))continue;
    db.saveProject({...project,assignments:[...project.assignments,{recordId:visual.id,override:null}]},project.id,project.version);
  }
  db.db.prepare("INSERT INTO meta(key,value) VALUES(?,?)").run(key,"1");return 1;
}

// Regenerates docs/STYLE-CATALOG.md from the release catalog so the document cannot drift from the seed.
// Usage: node scripts/run.mjs scripts/catalog-doc.mjs
import {writeFileSync} from "node:fs";
import {globalStyleCatalog as records,catalogDomains as domains} from "../src/styles/global-style-catalog.ts";
const title=new Map(records.map(r=>[r.id,r.title]));
const requiredBy=new Map();for(const r of records)for(const id of r.requiredIds||[])(requiredBy.get(id)||requiredBy.set(id,[]).get(id)).push(r.title);
const cell=v=>String(v).replaceAll("|","\\|");
let out=`# Style catalog\n\nGenerated from \`src/styles/global-style-catalog.ts\` by \`scripts/catalog-doc.mjs\`; do not edit by hand. A fresh library is seeded with these ${records.length} records in ${domains.length} capabilities. Existing libraries are never overwritten.\n\n`;
out+=`## How the catalog fits together\n\n- **Capabilities** group styles. Every capability here is *combinable*: a project can select several of its styles. Switch a capability to *Pick one* in Capabilities → Rename when its styles are alternatives.\n- **Required styles** always load with the style that requires them, transitively. A style lists only direct requirements (at most 12). Format styles such as Draw.io and Mermaid are selected per project, never required.\n- **Skills** are referenced by installed name with a \"(when …)\" condition. Each style's SKILLS section says when to read a skill, the order, what it must not override and the fallback when it is missing. Nothing requires installing a skill.\n- Each style's text uses the same sections: SCOPE, INPUTS, METHOD, DELIVERABLES, SKILLS, REQUIRED STYLES, VERIFICATION, REFERENCES.\n\n`;
out+=`| Capability | Styles |\n| --- | --- |\n`+domains.map(d=>`| ${cell(d.name)} | ${records.filter(r=>r.domain===d.id).length} |`).join("\n")+"\n";
for(const d of domains){
 const rows=records.filter(r=>r.domain===d.id);if(!rows.length)continue;
 out+=`\n## ${d.name}\n\n| Style | Use when | Requires | Required by | Skills |\n| --- | --- | --- | --- | --- |\n`;
 for(const r of rows)out+=`| **${cell(r.title)}**${r.kind==="review"?" (review)":""} | ${cell(r.useWhen||r.summary)} | ${cell((r.requiredIds||[]).map(id=>title.get(id)).join("; ")||"—")} | ${cell((requiredBy.get(r.id)||[]).join("; ")||"—")} | ${cell((r.externalSkills||[]).map(s=>s.replace(/\s*\(.*$/,"")).join(", ")||"—")} |\n`;
}
writeFileSync(new URL("../docs/STYLE-CATALOG.md",import.meta.url),out);
console.log(`docs/STYLE-CATALOG.md: ${records.length} records, ${domains.length} capabilities`);

import {BrainDB} from '../core/database.ts';

export const designReviewPrompt = `RESTRAINED WORKSPACE DESIGN — v1
Before choosing components, state the user's primary task, frequent actions and expected data volume. Sketch the complete screen hierarchy: navigation, title/action, contextual toolbar, working content and feedback. Delete a control only after checking its callers, routes and recovery workflow.
For data-heavy workspaces use a quiet neutral canvas, readable white surfaces and a single selected accent. Reserve color for actions, selection and meaningful status; do not tint every panel. Typography and alignment establish hierarchy before decoration. Reuse the existing system font. Use 24–28px page titles, 14–16px body text, tabular numbers, a 4/8px spacing scale, 24–32px desktop gutters and 16px mobile gutters. Keep tables fluid and prose near 65–75 characters per line.
Reject repeated marketing eyebrows, slogans, ornamental sparkles, gradient banners, oversized metric cards, decorative shadows and blank side panels. Counts belong beside the relevant list or in a compact summary strip. A border, background or spacing should separate a group; do not stack all three without a reason. Avoid animation or font/library changes whose only purpose is to look less AI-generated.
Keep one primary action per screen. Put search, filters and view controls together; local filtering is immediate and preserves focus. Keep explicit labels on primary actions and ambiguous controls. Repeated row actions may use consistent icons with accessible names and hover/focus tooltips, 36px desktop targets and 8px gaps; use 44px touch targets. Infrequent diagnostics belong under clearly named secondary navigation, not in the primary task path. Do not remove capabilities merely because their implementation is old.
Use progressive disclosure for details, installation evidence and setup help. Show what a result means and what the user can do next. An installed skill is not proof it was read; an agent-reported pass is not independently verified. Graphs start with styles and allow details on demand; never force all review text into the initial canvas.
Before accepting a design, inspect a real rendered screen at desktop and narrow widths with long labels, empty data and errors. Exercise keyboard focus, search, pagination, refresh/back navigation, dialogs and unsaved edits. Record evidence and unperformed checks. Do not claim visual acceptance from a build or unit tests alone.
References: https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines ; https://www.nngroup.com/articles/progressive-disclosure/
This interaction guidance does not impose a palette on other projects. A separately selected visual style controls colors.`;

// Amend shared templates once. Private copies in other projects retain their own decisions.
export const visualReviewPrompt = `WORKSPACE VISUAL AMENDMENT — v1
For data-heavy applications this amendment supersedes the earlier blanket pale-blue page recommendation: use a near-neutral #F7F9FB canvas and #FFFFFF surfaces; reserve #0369A1 and #E0F2FE for primary actions, focused controls and selected items. Use #0C2840 text, #4B6578 secondary text and #DCE3E8 dividers. Avoid promotional gradients and shadows on ordinary cards. Use 6px control and 8px panel radii, 26px page headings, 14–16px body text, compact tables and 8/16/24px spacing. Keep fluid data areas; constrain prose instead of the whole screen. Verify actual contrast and narrow-screen behavior. Do not apply this palette to a project that has not selected this visual style.`;

export function upgradeWorkspaceDesign(db:BrainDB){
  let changed=0;
  for(const r of db.list({kind:'preference',limit:300}).filter(r=>r.tags.some(t=>['starter-ux','personal-brain-project-design','personal-sky-blue-design-system'].includes(t)))){
    if(r.tags.includes('personal-sky-blue-design-system')){
      if(!r.content.includes('WORKSPACE VISUAL AMENDMENT — v1')){db.update(r.id,{...r,content:r.content+'\n\n'+visualReviewPrompt},r.version);changed++;}
      continue;
    }
    if(r.content.includes('RESTRAINED WORKSPACE DESIGN — v1'))continue;
    db.update(r.id,{...r,content:r.content+'\n\n'+designReviewPrompt,
      reviewCriteria:[...(r.reviewCriteria||[]),'Reject decorative dashboard chrome, oversized statistics and competing actions; verify real workflow evidence at desktop and narrow widths.'],
      examples:[...(r.examples||[]),'Project list: a short title and one New project action, an immediate search field, a compact table with readable names and contextual icon actions. Show counts beside the list. Keep setup help inside the project.']},r.version);
    changed++;
  }
  return changed;
}

export function upgradeWorkspaceNavigation(db:BrainDB){
 const marker='WORKSPACE NAVIGATION AND CONSOLIDATION — v1';
 const rows=db.db.prepare("SELECT snapshot FROM records WHERE kind='preference' AND domain='design' AND (json_extract(snapshot,'$.projectId') IS NULL OR json_extract(snapshot,'$.projectId')='b3937377-32ad-43a8-9adc-c21d06a9b4a4')").all() as {snapshot:string}[];
 for(const row of rows){const r=JSON.parse(row.snapshot);if(r.content.includes(marker))continue;
 db.update(r.id,{content:r.content+'\n\n'+marker+'\nUse short, concrete navigation names such as Capabilities. Keep a consistent small SVG icon beside each visible menu label; do not use icons alone for primary navigation. Put project scope before agent/detail filters in activity and diagnostic screens, preserve filters in URLs where navigation depends on them, and keep displayed counts explicit about their scope. Use compact summary strips, fluid data tables and progressive disclosure for evidence explanations and synthetic demos. Keep configuration, history and diagnostics accessible without competing with primary workspace tasks.\nFor agent-assisted consolidation, show selected inputs, destination and data sent before starting. Present current versus proposed instructions, source versions, conflicts and rationale. Publish as an explicit new version only after review; reject stale evidence and unresolved conflicts. Never silently rewrite project-private records or infer that frequent retrieval proves a style worked.\nReferences: https://www.nngroup.com/articles/icon-usability/ ; https://www.nngroup.com/articles/progressive-disclosure/ ; https://www.carbondesignsystem.com/building-blocks/core/patterns/filtering',reviewCriteria:[...(r.reviewCriteria||[]),'Verify labeled navigation icons, project-scoped filters and counts, and inspect current/proposed style changes before publication.']},r.version);
 }
}

export function upgradeWorkspacePalette(db:BrainDB){
 const marker='THREE-COLOR WORKSPACE PALETTE — v1';
 const rows=db.db.prepare("SELECT snapshot FROM records WHERE kind='preference' AND domain IN ('design','design-system') AND (json_extract(snapshot,'$.projectId') IS NULL OR json_extract(snapshot,'$.projectId')='b3937377-32ad-43a8-9adc-c21d06a9b4a4')").all() as {snapshot:string}[];
 for(const row of rows){const r=JSON.parse(row.snapshot);if(r.content.includes(marker))continue;
 const visual=r.domain==='design-system';
 const guidance=visual?'When this visual style is selected, use three purposeful accents on neutral #F7F9FB and white surfaces: blue #0369A1 / #E0F2FE for primary workspace actions and selection; teal #0F766E / #F0FDFA for agent workflows, Fusion and their navigation; amber #92400E / #FFFBEB for diagnostics and attention states. Teal button hover is #115E59. Keep danger red and success status separate from workflow category colors. This supersedes any single-accent restriction. Apply shared semantic CSS tokens; never tint every panel or distribute colors arbitrarily. Measure text contrast (at least 4.5:1 for ordinary text) and use labels/icons with every color meaning. Do not apply this palette to projects that have not selected this visual style.':'Support multiple role-based accents defined by the selected visual system; this supersedes the earlier single-accent restriction without imposing this project palette on other projects. Keep sidebar section headings consistently uppercase, including DIAGNOSTICS. Inline field labels and controls require an explicit 12px layout gap, not literal spaces; allow wrapping at narrow widths.';
 db.update(r.id,{content:r.content+'\n\n'+marker+'\n'+guidance+'\nReference: https://www.carbondesignsystem.com/building-blocks/foundations/color/overview',reviewCriteria:[...(r.reviewCriteria||[]),'Verify consistent section heading case, label/control gaps, semantic color roles and measured contrast; report unperformed rendered checks.']},r.version);
 }
}

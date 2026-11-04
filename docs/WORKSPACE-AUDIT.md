# Workspace audit — 3 November 2026

The design direction is a restrained working interface: neutral surfaces, a single blue action accent, compact data tables, contextual controls and progressive disclosure. The intended task is managing project instructions, not browsing a product landing page.

## Research and decisions

- [Carbon data table guidance](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) places search, filters and table-level actions in a toolbar. Applied here through compact tables and contextual actions.
- [Nielsen Norman Group on progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) recommends keeping frequent tasks visible and revealing advanced features on request. Applied here by retaining diagnostics under Advanced tools and removing the overview's promotional discovery banner.

These sources inform interaction decisions; they do not prescribe this app's specific colors or dimensions. The project retains its blue identity with a neutral canvas, smaller headings, less elevation and less decorative chrome.

## Findings addressed

| Finding | Change |
|---|---|
| Repeated marketing labels and a discovery banner competed with workspace tasks | Removed the page eyebrow and overview banner; Overview leads to projects |
| Large metric cards and heavy blue surfaces dominated the data | Compact summary strip, neutral surfaces, restrained radius and shadows |
| Capability search required submission | Immediate filtering, focus retained, query reflected in URL |
| Old card/create-form CSS survived after conversion to tables/dialogs | Removed unused component rules; retained active routes and data |
| API accepted browser requests from any localhost port | Require the request's exact host and port in Origin |
| MCP advertised requirement updates but rejected the field | Added requirements to the runtime allowlist |
| Artifact review evaluated absent text and unrelated same-domain rules | Check only reviewed records; missing text remains Not verified |
| Artifact existence could be confused with full compliance | Distinguish file-presence checks, agent claims and pending manual criteria |
| Review evidence could overwhelm trace metadata display | Full reports appear in project activity; trace metadata omits the report blob |
| Reusable prompts did not explicitly reject decorative dashboard patterns | Versioned shared UX/visual amendments plus Personal Brain's private UX update |

## Scope and limits

Reviewed the UI shell, overview, capability filtering, shared controls, record editor, project activity, MCP review/update paths, artifact-path boundaries and API Origin handling. Ran the existing project test suite and added regression tests for new behavior. The graph index was stale; source reads supplied current evidence.

This is a bounded audit, not proof that every technical gap is eliminated. No stored records, revisions or projects were deleted. Existing private styles in other projects retain their conventions. Shared amendments are appended once and preserve previous content and revisions; new projects receive the updated shared UX starter through the existing defaults.

Remaining verification: actual desktop/narrow browser rendering and interaction after the final CSS changes. Browser automation reported unavailable windows. Two socket-based tests are blocked by sandbox `listen EPERM`; in-process HTTP handler tests cover the changed Origin behavior. No independent security assessment or large-volume graph benchmark was performed.

The custom graph layout remains quadratic in node count. The default styles-only view limits clutter; a worker/layout-library migration should follow measured large-dataset performance, not a cosmetic rewrite.

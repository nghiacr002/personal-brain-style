import {BrainDB} from '../core/database.ts';
import type {RecordInput} from '../core/models.ts';

// Apply the requested setup only to the user's existing Personal Brain project.
export function installPersonalBrainStyles(db: BrainDB) {
  const project = db.projects().find((p) => p.id === 'b3937377-32ad-43a8-9adc-c21d06a9b4a4');
  if (
    !project ||
    db.db.prepare("SELECT value FROM meta WHERE key='personal_brain_project_styles_v1'").get()
  ) {
    return 0;
  }
  const definitions: Array<Pick<RecordInput, 'domain' | 'title' | 'summary' | 'content'>> = [
    {
      domain: 'design',
      title: 'Personal Brain — clear sky-blue UI/UX',
      summary:
        'Compact, accessible interfaces with clear project scope, selections and dependency relationships.',
      content: `Apply to the Personal Brain application. Use a calm sky-blue visual system: pale blue backgrounds, white surfaces, dark readable text and blue primary actions. Keep typography, spacing and alignment consistent; avoid oversized cards, empty gaps and promotional banners. Use compact paginated tables for record collections.

Give each screen one primary purpose. Group navigation by workspace, tools and activity. Keep navigation in the URL so refresh, bookmarks and Back/Forward preserve the current view. Use clear empty, loading, error and success states. A project row and its accessible title link should open details.

Use explicit checkboxes for multiple selections. Separate selected records from available records, label shared instructions versus project overrides, and reveal customization only when relevant. Explain that a project uses only its selected records and required dependencies; global defaults apply only without a project scope. Never silently discard existing selections or unsaved edits.

Show dependency relationships as nodes with labeled arrow semantics. Route arrows around nodes, avoid overlapping edges where practical, and size nodes to their labels. Selecting a node highlights its incoming/outgoing arrows only; editing remains an explicit action. Put small information icons inline with their labels, with useful accessible names.

Use semantic HTML, associated labels, keyboard navigation, visible focus and readable contrast. Do not use color alone to communicate state. Check narrow and wide screens, long titles, many records and empty data. Label observed agent activity honestly: recent calls are not proof of a running conversation. Provide concise, copyable agent setup instructions with the actual project ID.

Acceptance example: selecting a style moves it to Selected, retains its override draft, identifies required dependencies and updates the save summary. Refreshing a saved project URL returns to that project. Verify these behaviors and report any browser checks not performed.`,
    },
    {
      domain: 'coding',
      title: 'Personal Brain — maintainable verified TypeScript',
      summary:
        'Small complete changes that preserve data, project isolation and consistent behavior across UI, HTTP, MCP and hooks.',
      content: `Apply to the Personal Brain codebase. Read the affected implementation and callers before editing. Reuse existing helpers and platform capabilities; add no dependency or abstraction without a concrete benefit. Keep changes small but complete across models, SQLite persistence, HTTP API, MCP tools, hooks, frontend, tests and documentation as applicable.

Use explicit TypeScript types and validate untrusted inputs at API/storage boundaries. Preserve optimistic concurrency, record revisions, project assignments and required links. Reject missing/inactive dependencies, cycles and conflicting selections with actionable errors. Keep project resolution centralized: selected records plus transitive required dependencies, no implicit global fallback for a named project.

Use SQLite transactions for related mutations and versioned, idempotent migrations that preserve personal edits. Never overwrite or reseed user data merely to make a screen look populated. Escape rendered user content, retain loopback/origin restrictions and the content security policy, and avoid logging prompts, secrets or conversation contents.

Use accessible semantic controls and existing event handling. Preserve URL state and protect unsaved form input during development reloads. Keep agent telemetry based on observed events and stable host identifiers; never invent thread IDs or infer compliance from retrieval counts.

Verify changed behavior with focused tests: project isolation, dependency closure, version conflicts, persistence, safe rendering and navigation where affected. Run npm run build:ui and relevant tests using the supported Node runtime. Report test failures and environment-blocked checks accurately. Confirm generated public/app.js matches web/app.ts; do not hand-edit the compiled bundle.

Example: a project-scope change must be checked through HTTP resolution, MCP retrieval and automatic hooks, including an empty project and an unrelated global style. A passing rendering-string test does not replace a browser layout inspection.`,
    },
    {
      domain: 'technology',
      title: 'Personal Brain — local-first technology selection',
      summary:
        'Prefer the existing Node.js, TypeScript, SQLite and native browser stack; justify added infrastructure.',
      content: `Apply to Personal Brain. Default to its current local-first architecture: supported Node.js runtime, TypeScript, node:sqlite/SQLite storage, Node HTTP server, plain TypeScript browser UI compiled with tsc, CSS and MCP stdio integration for agents. Keep the application usable on the user's computer without a cloud deployment or a local login/access-token gate.

Use standard runtime/browser capabilities before introducing frameworks or services. Keep SQLite as the source of truth with transactions, safe schema evolution, backups and preserved revisions. Use ordinary HTTP JSON for app operations and the existing MCP/hook interfaces for agent access. Reuse hash URL routing and the development watcher rather than adding a router or build framework for minor changes.

Choose new technology only against a concrete limitation. Compare fit, maintenance, installation burden, security, operational complexity, data portability and total cost. Document the decision and rejected simpler option. Do not introduce Azure, GCP, Kubernetes, a remote database, vector store or an agent framework unless a stated requirement warrants it; cloud selection is not this project's default.

Keep loopback binding, origin validation, input limits and the existing content security policy. Avoid exposing this local service on a network without revisiting access controls. Store only the metadata necessary for project-linked activity; distinguish session identities from MCP process IDs.

Use npm start for frontend rebuilds, backend watching and browser refresh; use npm run start:stable for a non-watching server. Check package.json and runtime compatibility before changing Node requirements. Verify current official documentation before adopting a new dependency or changing an integration contract.

Example: for dependency highlighting, start with SVG and browser event handling. Adopt a graph library only if measured layout/interaction requirements exceed the current approach, and state its bundle, accessibility and maintenance costs.`,
    },
  ];
  let created = 0;
  const assignments = [...project.assignments];
  for (const definition of definitions) {
    const tag = 'personal-brain-project-' + definition.domain;
    let record = db.list({limit: 300}).find((r) => r.tags.includes(tag));
    if (!record) {
      record = db.create({
        ...definition,
        kind: 'preference',
        status: 'active',
        priority: 90,
        tags: [tag, 'personal-brain', 'project-style'],
        requiredIds: [],
        checks: [],
        backend: null,
      });
      created++;
    }
    if (
      !assignments.some((a) => {
        const r = db.get(a.recordId);
        return r?.kind === 'preference' && r.domain === definition.domain;
      })
    ) {
      assignments.push({recordId: record.id, override: null});
    }
  }
  db.saveProject({...project, assignments}, project.id, project.version);
  db.db.prepare("INSERT INTO meta(key,value) VALUES('personal_brain_project_styles_v1','1')").run();
  return created;
}

export function upgradeDesignComposition(db: BrainDB) {
  const key = 'design_composition_rules_v1';
  if (db.db.prepare('SELECT value FROM meta WHERE key=?').get(key)) {
    return 0;
  }
  const style = db
    .list({kind: 'preference', limit: 300})
    .find((r) => r.tags.includes('personal-brain-project-design'));
  if (!style) {
    return 0;
  }
  const principles = [
    'Design around user tasks, not individual features.',
    'Never translate each feature into a separate permanent form or visual section by default.',
    'Identify one primary action for each page.',
    'Combine closely related controls into one contextual toolbar when appropriate.',
    'Place infrequent actions inside dialogs, drawers, or contextual menus.',
    'Prefer progressive disclosure over displaying all available controls simultaneously.',
    'Search and filtering should be immediate when no server-side submission is required.',
    'Avoid unnecessary buttons, duplicated headings, redundant inputs, and excessive whitespace.',
    'Optimize layout based on actual data volume.',
    "Every UI element must have a clear purpose within the user's current workflow.",
  ];
  const preparation = [
    "Identify the page's primary user task.",
    'Group actions by workflow and frequency.',
    'Define the information hierarchy.',
    'Design the complete screen before components.',
    'Review whether adjacent controls form a natural interaction.',
    'Remove redundant or competing UI elements.',
  ];
  const rejection = [
    'Reject a design when two related features appear as disconnected forms.',
    'Reject a design when several actions compete for primary attention.',
    'Reject a design when infrequent operations occupy permanent screen space.',
    'Reject a design when the layout appears generated feature-by-feature instead of designed as a complete experience.',
    'Reject a design when functional correctness is achieved but the workflow is awkward or unnecessarily complex.',
  ];
  const content =
    style.content +
    '\n\nUX COMPOSITION AND INTERACTION RULES\n' +
    principles.map((p, i) => `${i + 1}. ${p}`).join('\n') +
    '\n\nBEFORE IMPLEMENTATION\n' +
    preparation.map((p) => '- ' + p).join('\n') +
    '\n\nREJECTION CRITERIA\n' +
    rejection.map((p) => '- ' + p).join('\n');
  db.update(
    style.id,
    {
      ...style,
      content,
      principles: [...new Set([...(style.principles || []), ...principles])],
      reviewCriteria: [
        ...new Set([
          ...(style.reviewCriteria || []),
          'Before implementation: ' + preparation.join(' '),
          ...rejection,
        ]),
      ],
      examples: [
        ...(style.examples || []),
        'Capability management: the primary task is finding and managing existing capabilities. Use immediate search with the list; place Add capability type beside Back to library and open creation in a dialog. Keep Rename contextual to its row. Avoid a permanent create form, a redundant Search button, or duplicated list headings. Review the entire workflow, including keyboard use and draft preservation, before accepting the design.',
      ],
    },
    style.version,
  );
  db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run(key, '1');
  return 1;
}

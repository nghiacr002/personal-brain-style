import {BrainDB} from '../core/database.ts';
import type {RecordInput} from '../core/models.ts';

export const visualDrawingPrompt = `VISUAL ARCHITECTURE COMPOSITION — v1
Communicate architecture through structure, not paragraph-filled boxes. Keep necessary text: a concise service/entity name, a short responsibility where useful, and meaningful edge labels. Longer explanatory prose belongs in notes or linked documentation. The legend explains notation only; it is not a deployment guide.
Before drawing, translate each architectural fact into its appropriate visual form: services and actors into nodes; ownership, system, trust and network membership into separately labelled containers; interactions into directed connectors; known properties into short badges or labels. Use conventional notation for ER keys/cardinality and sequence alternatives. Do not convert every sentence into another box: show only facts relevant to the view's question. Never invent relationships to make the picture look complete.
Replace text-only platform-services inventories with actual service nodes and relevant connections in a focused supporting-services view. For example, show Key Vault, App Configuration, Application Insights and Log Analytics separately when present in the evidence; connect the actual consumers and telemetry destinations only when verified. Do not substitute a paragraph saying dependency arrows are omitted for a requested dependency view.
Show deployment and network detail in a dedicated view when it would crowd the application flow. Distinguish resource-group ownership from VNet/subnet boundaries. Place managed services according to verified deployment semantics; represent private endpoints and their connections explicitly instead of implying that every PaaS service runs inside a subnet. Keep unverified network and identity claims in clearly marked notes.
Choose one main reading direction and align related nodes. Keep concise labels outside connector intersections. Split application flow, deployment/network, identity and operations into linked pages only when needed. Draw.io pages/layers or Mermaid subgraphs must clarify the reader's task, not hide mandatory content: every requested exported view must remain understandable with its title, scope and legend. Use native editable shapes/connectors and verified icons; do not replace the architecture with a flattened image. Preserve the selected project's palette and do not infer a cloud provider from drawing preferences.
Review at the intended reading size. Reject walls of text masquerading as services, mixed abstraction levels, unlabeled arrows, invented connections, ambiguous containers, and legends containing implementation essays. Check that important facts moved out of prose remain represented accurately. Distinguish source/semantic checks from actual rendered visual inspection.
References: https://c4model.com/diagrams/notation ; https://c4model.com/diagrams ; https://www.drawio.com/docs/manual/layers/how-layers-work/`;

export function upgradeVisualDrawing(db: BrainDB) {
  const tags = [
    'shared-drawing-standard',
    'shared-drawing-drawio',
    'shared-drawing-mermaid',
    'personal-architecture-drawing',
  ];
  const records = db.db
    .prepare(
      "SELECT snapshot FROM records WHERE json_extract(snapshot,'$.projectId') IS NULL AND kind='preference'",
    )
    .all() as {snapshot: string}[];
  let changed = 0;
  for (const row of records) {
    const r = JSON.parse(row.snapshot);
    if (
      !r.tags.some((tag: string) => tags.includes(tag)) ||
      r.content.includes('VISUAL ARCHITECTURE COMPOSITION — v1')
    ) {
      continue;
    }
    db.update(
      r.id,
      {
        content: r.content + '\n\n' + visualDrawingPrompt,
        principles: [
          ...(r.principles || []),
          'Visualize architectural facts as nodes, boundaries and relationships; reserve prose for notes and keep labels concise.',
        ],
        examples: [
          ...(r.examples || []),
          'Replace a platform-services paragraph with verified configuration, secrets and telemetry nodes in a supporting-services view. Move detailed subnet/private-endpoint topology to a deployment page; retain short service and protocol labels in the main flow.',
        ],
        reviewCriteria: [
          ...(r.reviewCriteria || []),
          'Reject paragraph-filled architecture boxes and text inventories used instead of requested relationships; verify that the visual model preserves the source facts and distinguishes ownership from network boundaries.',
        ],
      },
      r.version,
    );
    changed++;
  }
  return changed;
}

export function installDrawingStyles(db: BrainDB) {
  const marker = 'shared_drawing_formats_v1';
  if (db.db.prepare('SELECT 1 FROM meta WHERE key=?').get(marker)) {
    return 0;
  }
  let created = 0;
  for (const [id, name] of [
    ['diagrams', 'Diagrams'],
    ['drawio', 'Draw.io'],
    ['mermaid', 'Mermaid'],
  ]) {
    if (!db.hasDomain(id)) {
      db.saveDomain(name);
    }
  }
  const base = {
    kind: 'preference' as const,
    status: 'active' as const,
    priority: 90,
    checks: [],
    backend: null,
  };
  const ensure = (input: RecordInput) => {
    const existing = db.db
      .prepare(
        "SELECT snapshot FROM records WHERE json_extract(snapshot,'$.projectId') IS NULL AND EXISTS (SELECT 1 FROM json_each(records.snapshot,'$.tags') WHERE value=?)",
      )
      .get(input.tags[0]) as {snapshot: string} | undefined;
    if (existing) {
      return JSON.parse(existing.snapshot);
    }
    const record = db.create(input);
    created++;
    return record;
  };
  const common = ensure({
    ...base,
    domain: 'diagrams',
    title: 'Drawing — clear architecture, flows and data models',
    summary:
      'Consistent, readable architecture, process, sequence and ER diagrams with editable sources and evidence-based review.',
    useWhen:
      'Creating or revising architecture diagrams, flowcharts, sequence diagrams, ERDs, data models, UML or deployment views in draw.io or Mermaid.',
    tags: [
      'shared-drawing-standard',
      'drawing',
      'diagram',
      'architecture',
      'flowchart',
      'sequence',
      'erd',
      'entity relationship',
      'data model',
      'uml',
      'deployment',
    ],
    content:
      "Choose the diagram type from the reader's task: architecture for boundaries and responsibilities; flowchart for decisions and process; sequence for ordered interactions; ERD for entities and relationships; class or state views when those semantics matter. State scope and abstraction level. Use separate linked views for context, containers, deployment and data rather than one crowded drawing. Preserve supplied facts and label assumptions.\n\nUse clear square-corner boxes, concise labels, deliberate alignment and spacing. Use labelled directional arrows for actual flows and relations; minimize crossings and do not route through nodes. Include a legend explaining colors, line styles, symbols and arrow meanings. Use a small consistent palette with readable contrast; never use color alone. Preserve conventional semantic shapes where required, such as decision diamonds and ER cardinality notation.\n\nArchitecture: distinguish system, network and trust boundaries; label significant protocols and synchronous/asynchronous interactions when known. Use the project's selected technologies; drawing rules do not mandate Azure. Show official Azure, GCP or other cloud icons only for actual selected services and only from available verified icon libraries. Generic labelled boxes are the fallback.\n\nERD: distinguish conceptual, logical and physical models. Show entity names, primary/foreign keys when known, cardinality and optionality. Include attributes and types appropriate to the chosen level. Represent many-to-many relationships with an associative entity in a physical schema. Never invent constraints or infer one-to-one cardinality without evidence. Sequence: identify participants, ordered messages, responses and important alternative/error paths.\n\nDeliver editable source in the requested format. Review the diagram against source requirements and inspect a rendered view when tooling is available. Report syntax checks, rendering and semantic review separately; never claim a render or correctness check that was not performed.",
    principles: [
      'Choose a diagram by the question it answers.',
      'Keep views focused and preserve semantic notation.',
      'Use square boxes, labelled arrows, consistent colors and a legend.',
      'Deliver editable source and report verification evidence.',
    ],
    externalSkills: [],
    requiredIds: [],
    examples: [
      'Architecture: Client → API → Database, with each arrow labelled by the known interaction, a clear application boundary and a legend. Add deployment and trust-boundary detail in a separate view when the reader needs it.',
      'ERD: CUSTOMER has zero or many ORDER records; each ORDER belongs to exactly one CUSTOMER. Show CUSTOMER.id as PK and ORDER.customer_id as FK only if the schema confirms those constraints.',
      'Sequence: Client sends a request to API; API validates it, queries storage and responds. Include the invalid-request branch if it is relevant to the task.',
    ],
    reviewCriteria: [
      "Confirm the view answers the reader's question at one clear abstraction level.",
      'Trace entities, services and interactions to requirements or source; label assumptions.',
      'Inspect labels, spacing, crossings, legend and contrast at the intended reading size.',
      'Verify arrow direction and meaning; verify ERD cardinality, optionality and keys against the schema.',
      'Confirm editable source is supplied and distinguish static checks from actual rendering and semantic verification.',
    ],
  });
  ensure({
    ...base,
    domain: 'drawio',
    title: 'Draw.io — editable architecture, flow and ER diagrams',
    summary:
      'Native .drawio diagrams with square boxes, labelled connectors, cloud icons and a clear legend.',
    useWhen:
      'A task requests draw.io, diagrams.net, editable XML, precise diagram layout, cloud architecture icons, flowcharts, UML or ERDs.',
    tags: [
      'shared-drawing-drawio',
      'drawio',
      'draw.io',
      'diagrams.net',
      'architecture',
      'diagram',
      'erd',
      'flowchart',
      'sequence',
      'cloud',
      'azure',
      'gcp',
    ],
    content:
      "Read the shared drawing standard and the drawio-skill instructions before authoring. Deliver native editable .drawio XML, not a screenshot-only result. Use stable cell IDs, actual shapes and editable connectors. Use rounded=0 for ordinary boxes and containers; retain standard decision and ER notation. Prefer orthogonal connectors with explicit endpoints, arrowheads and labels; keep routes away from text and avoid overlaps.\n\nUse verified draw.io shape libraries for official Azure, GCP and other cloud icons appropriate to the selected platform. Inspect the available icon definitions rather than guessing shape identifiers. Keep a visible legend and consistent color meanings. A cloud icon preference is not a technology-selection requirement.\n\nUse separate pages for large architecture, sequence and ER views. For ERDs, use readable entity tables with key markers, attribute types where known and clear crow's-foot cardinality/optionality. Preserve existing IDs, links and annotations during edits.\n\nCheck XML structure and connector references. Open or render with available draw.io tools and inspect clipping, arrows, legend and text readability. If rendering is unavailable, deliver the editable source and explicitly mark visual verification pending. Supply SVG/PNG/PDF only when requested; retain the .drawio source alongside exports.",
    principles: [
      'Native editable XML is the primary artifact.',
      'Use verified cloud icons and square-corner boxes.',
      'Review actual connector routes and label placement.',
    ],
    externalSkills: ['drawio-skill'],
    requiredIds: [common.id],
    examples: [
      'Create system.drawio with Context, Deployment and Data model pages. The deployment page uses verified Azure or GCP icons only where those services are in the requirements; all pages include a legend.',
      "For a physical order schema, create CUSTOMER and ORDER entity tables with PK/FK markers and a labelled crow's-foot relationship, then verify the relationship against the supplied schema.",
    ],
    reviewCriteria: [
      'Verify the file opens as editable native draw.io shapes and connectors.',
      'Check ordinary boxes use square corners and every connector references the intended nodes.',
      'Check official icon identifiers exist and match the actual provider/service.',
      'Inspect every page and requested export for clipping, crossings, missing legends and readable text.',
    ],
  });
  ensure({
    ...base,
    domain: 'mermaid',
    title: 'Mermaid — architecture, sequence, flow and ER diagrams as code',
    summary:
      'Portable, version-controlled Mermaid source with clear semantics, concise labels and explicit validation evidence.',
    useWhen:
      'A task requests Mermaid, .mmd, Markdown diagrams, flowcharts, sequence diagrams, ERDs, class/state diagrams or a diagram maintained in Git.',
    tags: [
      'shared-drawing-mermaid',
      'mermaid',
      'mmd',
      'markdown',
      'diagram',
      'architecture',
      'flowchart',
      'sequence',
      'erd',
      'erDiagram',
      'classDiagram',
      'stateDiagram',
    ],
    content:
      "Read the shared drawing standard and the Mermaid diagram skill before authoring. Deliver editable .mmd source or a mermaid fenced block in the requested document. Choose flowchart for portable architecture and process views, sequenceDiagram for interactions, erDiagram for entities/relationships, and class/state diagrams only when their semantics fit. Use stable ASCII IDs and concise quoted labels where appropriate. Preserve surrounding Markdown and unrelated diagram blocks when editing.\n\nUse rectangular flowchart nodes for ordinary components, labelled links, small logical subgraphs for boundaries and a compact legend in the diagram or adjacent text. Apply a consistent accessible palette only with syntax supported by the target renderer. Keep conventional ER and sequence notation rather than forcing every diagram into boxes and arrows.\n\nERDs must show cardinality and optionality deliberately; include PK/FK/UK and attribute types only when supported by the target renderer and justified by the schema. Sequence diagrams should show participants, message direction and relevant alternatives/errors. Split dense diagrams into focused views.\n\nPrefer portable syntax. Do not assume cloud-icon packs, external resources, HTML labels or unsafe directives are available. If official cloud icons or exact geometry are required, use the draw.io style when the user allows that format; otherwise use labelled components and explain the limitation.\n\nRun the available skill's static checks, and render with the actual target host/runtime when available. Static lint and structural previews do not prove host rendering or semantic correctness. Report the checks performed and any unverified rendering; do not install tools merely to claim validation without authorization.",
    principles: [
      'Keep source portable, editable and easy to review in Git.',
      'Use the diagram family that matches the semantics.',
      'Separate static lint, rendering and semantic review.',
    ],
    externalSkills: ['mermaid-diagrams:mermaid-diagrams'],
    requiredIds: [common.id],
    examples: [
      'Architecture flow: use flowchart LR with Client -->|HTTPS request| API and API -->|Query| Database. Use rectangular component nodes and an adjacent legend explaining that arrows represent request/data flow.',
      'Order ERD: use erDiagram with CUSTOMER ||--o{ ORDER : places. Show CUSTOMER.id as PK and ORDER.customer_id as FK when confirmed by the schema. Explain that each order has one customer and a customer may have zero or many orders.',
    ],
    reviewCriteria: [
      'Check the source uses the correct diagram family and stable, unambiguous IDs.',
      'Verify labels, relationships, cardinality and optionality against requirements.',
      'Validate syntax with available tools and inspect the target renderer when possible.',
      'Confirm unrelated Markdown is preserved and no unsupported icons or unsafe external resources were introduced.',
    ],
  });
  db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run(marker, '1');
  return created;
}

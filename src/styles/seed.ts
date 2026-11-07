import {BrainDB} from '../core/database.ts';
import type {RecordInput} from '../core/models.ts';

const seedRecords: RecordInput[] = [
  {
    kind: 'preference',
    domain: 'general',
    title: 'Work in concise technical English',
    summary: 'Clear terminology, short sentences, explicit assumptions.',
    content:
      'Use clear and consistent technical English. Prefer simple sentences and direct instructions. Mark assumptions, risks, and decisions. Apply ASD-STE100 principles when applicable.',
    tags: ['writing', 'english', 'clarity'],
    status: 'active',
    priority: 95,
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'thinking',
    title: 'Evidence-led architecture reasoning',
    summary: 'Compare options and make trade-offs explicit.',
    content:
      'Separate facts, assumptions, options, risks, and decisions. Compare alternatives against scope, cost, security, operations, and complexity. Do not invent missing evidence. Produce an actionable recommendation.',
    tags: ['thinking', 'decision', 'tradeoffs'],
    status: 'active',
    priority: 95,
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'architecture',
    title: 'Design for extension and operations',
    summary: 'Explicit boundaries, security-first, reusable components.',
    content:
      'Use clear service boundaries. Prefer API-first and event-driven patterns where justified. Design for security, observability, operational simplicity, extensibility, and cloud independence when required. Separate the control plane from the data plane.',
    tags: ['architecture', 'security', 'api', 'operations'],
    status: 'active',
    priority: 94,
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'diagrams',
    title: 'Editable draw.io architecture style',
    summary: 'White canvas, pastel groups, orthogonal arrows and compact labels.',
    content:
      'For final architecture diagrams, prefer editable .drawio XML. Use a white canvas, compact rounded rectangles, subtle pastel fills, thin borders, orthogonal connectors, spaced layers, and short labels. Group by architecture responsibility. Avoid crossing lines and overlapping shapes. Validate XML and inspect a rendered preview when supported.',
    tags: ['drawio', 'mermaid', 'diagram', 'layout'],
    status: 'active',
    priority: 100,
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'diagrams',
    title: 'Use sequence diagrams for transactions',
    summary: 'Sequence diagrams for API, authentication, and event flows.',
    content:
      'For transactional or API message flows, use Mermaid sequenceDiagram. For component topology use an architecture diagram. Keep labels short and avoid parser-sensitive characters. If the viewer does not support Mermaid, provide editable draw.io instead.',
    tags: ['mermaid', 'sequence', 'integration'],
    status: 'active',
    priority: 95,
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'writing',
    title: 'Requirements must be testable',
    summary: 'Write acceptance criteria and business data requirements.',
    content:
      'Write BRDs and specifications with scope, actors, use cases, functional requirements, nonfunctional requirements, business data, traceability, assumptions, and testable acceptance criteria. Avoid unsupported claims and vague words.',
    tags: ['brd', 'srs', 'requirements', 'acceptance'],
    status: 'active',
    priority: 94,
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'reviews',
    title: 'Review against explicit evidence',
    summary: 'Do not claim unverified tests passed.',
    content:
      'Distinguish inspected, tested, inferred, and unverified results. Review correctness, completeness, consistency, security, maintainability, and presentation quality. Include concrete findings and remediation priority. Never claim a visual layout check was executed unless an actual renderer or inspector was used.',
    tags: ['review', 'validation', 'qa'],
    status: 'active',
    priority: 95,
    checks: [],
    backend: null,
  },
  {
    kind: 'skill',
    domain: 'diagrams',
    title: 'Create an editable system diagram',
    summary: 'Discover drawing tools, apply visual rules, generate and validate editable diagrams.',
    content:
      '# Procedure\n1. Retrieve the diagram preferences and a relevant approved example.\n2. Select diagram type: sequence for message flows, architecture blocks for topology.\n3. Discover an available drawing tool from the Brain tool catalog.\n4. Generate an editable artifact; use draw.io XML when possible.\n5. Validate XML or Mermaid syntax. If a renderer is available, visually inspect alignment, group spacing, and connector crossings.\n6. Revise defects, then deliver the editable file and limitations.',
    tags: ['drawio', 'architecture', 'excalidraw', 'mermaid'],
    status: 'active',
    priority: 98,
    checks: [],
    backend: null,
  },
  {
    kind: 'skill',
    domain: 'architecture',
    title: 'Architecture decision workflow',
    summary: 'Plan architecture, compare alternatives, identify boundaries, verify.',
    content:
      '# Procedure\n1. State the business objective and constraints.\n2. Identify interfaces, systems, trust boundaries and requirements.\n3. Produce 2-3 credible architecture options.\n4. Compare availability, performance, cost, security, operability, maintainability and migration.\n5. Record decisions, assumptions and risks.\n6. Verify that diagrams and explanations agree.\n7. Provide an implementation-neutral architecture baseline.',
    tags: ['architecture', 'adr', 'design', 'decision'],
    status: 'active',
    priority: 96,
    checks: [],
    backend: null,
  },
  {
    kind: 'skill',
    domain: 'writing',
    title: 'Write a complete BRD',
    summary: 'Generate structured business requirements with acceptance criteria.',
    content:
      '# Procedure\n1. Identify audience, scope, outcomes and actors.\n2. Define business scenarios and process boundaries.\n3. Specify numbered requirements and data entities.\n4. Add testable acceptance criteria for each use case.\n5. Add security, reliability, observability and operational requirements.\n6. Check internal consistency, assumptions and unresolved questions.\n7. Deliver a structured and reviewable document.',
    tags: ['brd', 'requirements', 'document'],
    status: 'active',
    priority: 92,
    checks: [],
    backend: null,
  },
  {
    kind: 'skill',
    domain: 'reviews',
    title: 'Independent design review',
    summary: 'Evaluate a proposed artifact before acceptance.',
    content:
      '# Procedure\n1. Identify original requirements and acceptance conditions.\n2. Check functional correctness, omissions, dependencies and security.\n3. Run deterministic validators available for the artifact.\n4. Flag subjective findings as observations, not automated test results.\n5. Classify each issue with impact and recommended correction.\n6. Revalidate after a revision.\n7. Report only what was actually verified.',
    tags: ['review', 'qa', 'architecture'],
    status: 'active',
    priority: 94,
    checks: [],
    backend: null,
  },
  {
    kind: 'review',
    domain: 'diagrams',
    title: 'Diagram review checklist',
    summary: 'Manual checks for diagram layout and editability.',
    content:
      'Verify labels are short, layers are grouped, arrows are orthogonal, diagram is editable, and there are no crossing connectors or overlapping boxes. Requires rendering for visual evidence.',
    tags: ['diagram', 'review', 'visual'],
    status: 'active',
    priority: 85,
    checks: [],
    backend: null,
  },
  {
    kind: 'review',
    domain: 'writing',
    title: 'Avoid unclear placeholder words',
    summary: 'Simple automated checks for incomplete writing.',
    content: 'Check that final documents do not include unfilled markers such as TBD or FIXME.',
    tags: ['writing', 'quality'],
    status: 'active',
    priority: 70,
    checks: [
      {type: 'not_contains', value: 'TBD', label: 'No TBD placeholders'},
      {type: 'not_contains', value: 'FIXME', label: 'No FIXME placeholders'},
    ],
    backend: null,
  },
  {
    kind: 'example',
    domain: 'diagrams',
    title: 'Reference architecture description',
    summary: 'Example of clear, layered architecture communication.',
    content:
      'Architecture is organized as Experience, Integration, Application, Core Services, Foundation and Operations. Each layer owns a clear responsibility. Interfaces are explicit and all external trust boundaries are marked. This is an illustration, not project-specific technology selection.',
    tags: ['example', 'architecture', 'layers'],
    status: 'active',
    priority: 65,
    checks: [],
    backend: null,
  },
  {
    kind: 'tool',
    domain: 'tools',
    title: 'draw.io MCP integration',
    summary:
      'Catalog entry for editable architecture drawings. Configure the command and tool name to enable invocation.',
    content:
      'Use this capability when a task needs an editable .drawio artifact. Add the official or approved draw.io MCP server command in the UI. This sample is discovery-only until configured and explicitly enabled.',
    tags: ['drawio', 'mcp', 'diagram'],
    status: 'active',
    priority: 88,
    checks: [],
    backend: null,
  },
];

// Comprehensive global style catalog. All entries are cross-project methods, never project facts.
const completeExamples: RecordInput[] = [
  {
    kind: 'preference',
    domain: 'general',
    title: 'Distinguish facts and assumptions',
    summary: 'Separate verified evidence from inferred claims.',
    content:
      'Mark facts, assumptions, estimates and open questions. When information is time-sensitive, verify before making a firm claim. Never fabricate test results, star counts, prices, file paths, or source citations.',
    tags: ['truth', 'evidence', 'verification'],
    priority: 97,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'general',
    title: 'Prefer complete and actionable deliverables',
    summary: 'Supply the output the user can use.',
    content:
      'When creating a technical artifact, include the usable deliverable, not only a description of how to build it. State what is implemented, verified, or still incomplete. Avoid unnecessary clarification when a reasonable default is available.',
    tags: ['deliverables', 'complete', 'usable'],
    priority: 91,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'thinking',
    title: 'Challenge architecture assumptions',
    summary: 'Find hidden dependencies and failure modes.',
    content:
      'Identify the objective, constraints, stakeholders, assumptions, alternative solutions, and failure scenarios. Challenge overengineering, duplicated runtime layers, vendor lock-in, and unsupported complexity.',
    tags: ['tradeoff', 'critical thinking', 'assumptions'],
    priority: 92,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'thinking',
    title: 'Prefer reuse before new development',
    summary: 'Assess established open source before custom work.',
    content:
      'Before proposing to build new infrastructure, assess existing maintained open-source solutions, licenses, adoption, version stability, integration surface, and customization effort. Distinguish available capabilities from proposed custom additions.',
    tags: ['open-source', 'reuse', 'evaluation'],
    priority: 92,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'architecture',
    title: 'Separate control plane and data plane',
    summary: 'Keep policy management distinct from high-volume execution.',
    content:
      'Separate management and control-plane responsibilities from transactional, device or event data paths where applicable. Describe identity, policy, telemetry, storage, and failure boundaries distinctly.',
    tags: ['security', 'control plane', 'data plane'],
    priority: 90,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'architecture',
    title: 'Use explicit trust boundaries',
    summary: 'Every integration has a security and failure boundary.',
    content:
      'Identify untrusted inputs, authentication, authorization, least privilege, secrets, observability and recovery. Explain which service owns each decision and where a request can fail.',
    tags: ['security', 'trust', 'integration'],
    priority: 91,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'architecture',
    title: 'Avoid unnecessary agent harness nesting',
    summary: 'Prefer native CLI agents with a thin control plane.',
    content:
      'Do not add a second agent loop when Claude Code or Codex already provides execution, tools and sessions. A separate coordinator is justified only for explicit cross-agent workflows. Keep knowledge and skills portable.',
    tags: ['agent', 'cli', 'orchestration'],
    priority: 94,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'diagrams',
    title: 'Define Mermaid nodes before edges',
    summary: 'Keep Mermaid syntax conservative and predictable.',
    content:
      'Use short lowercase node identifiers and short labels. Declare nodes before links, isolate subgraphs, and connect nodes only at the end. Prefer sequenceDiagram for transactional flows. Avoid unsupported code-fence IDs and parser-sensitive labels.',
    tags: ['mermaid', 'flowchart', 'syntax'],
    priority: 94,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'diagrams',
    title: 'Never claim a diagram rendered without evidence',
    summary: 'Syntax checks are not visual inspection.',
    content:
      'Check a diagram using the actual renderer or editable editor when available. Record XML validation, syntax validation and screenshot/visual inspection as separate evidence. If rendering was not performed, state that it remains unverified.',
    tags: ['diagram', 'verification', 'visual'],
    priority: 92,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'writing',
    title: 'Use simplified technical English',
    summary: 'Use ASD-STE100 style for technical explanations.',
    content:
      'Prefer one idea per sentence. Use consistent technical terms, active voice and clear instructions. Avoid vague modifiers. Define terms before using abbreviations. Use longer prose only when it adds necessary information.',
    tags: ['asdst e100', 'technical english', 'clarity'],
    priority: 91,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'writing',
    title: 'Write measurable acceptance criteria',
    summary: 'Tie requirements to observable outcomes.',
    content:
      'For each significant business requirement, define actor, trigger, precondition, expected system behavior, negative path and measurable acceptance result. Distinguish requirements from implementation design.',
    tags: ['brd', 'acceptance', 'traceability'],
    priority: 92,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'communication',
    title: 'Use compact professional responses',
    summary: 'Start with the answer and support it with evidence.',
    content:
      'Respond directly and professionally. Use short, meaningful headings and compact paragraphs. Put decisions and next actions near the end. Do not use patronizing or superficial emphatic phrases.',
    tags: ['email', 'reply', 'communication'],
    priority: 88,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'design',
    title: 'Prefer modern reusable UI',
    summary: 'Avoid traditional dense admin layout patterns.',
    content:
      'Use clear hierarchy, generous whitespace, purposeful cards, restrained colors, responsive design and consistent interactive patterns. Provide working interactions rather than decorative buttons; prefer reusable components.',
    tags: ['ui', 'ux', 'dashboard', 'prototype'],
    priority: 94,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'reviews',
    title: 'Separate manual and automated validation',
    summary: 'Never treat a heuristic as confirmed evidence.',
    content:
      'Label each finding as automated test, inspected artifact, informed opinion or not verified. Report coverage and limitations. Re-run checks after making changes; do not infer success from the absence of tool errors.',
    tags: ['review', 'qa', 'honesty'],
    priority: 95,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'skill',
    domain: 'thinking',
    title: 'Structured technical decision',
    summary: 'Make a decision record with measurable trade-offs.',
    content:
      '# Procedure\n1. State the decision and constraints.\n2. Enumerate credible options, including reuse.\n3. Compare security, operations, implementation effort, maintainability and portability.\n4. Mark assumptions and unknowns.\n5. Select an option with explicit rationale.\n6. Identify validation tests and rollback strategy.',
    tags: ['adr', 'tradeoffs', 'decision'],
    priority: 92,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'skill',
    domain: 'diagrams',
    title: 'Mermaid sequence diagram method',
    summary: 'Generate safe transactional flow diagrams.',
    content:
      '# Procedure\n1. Identify actors, services, messages and response paths.\n2. Use sequenceDiagram for request, authentication, event, and workflow sequences.\n3. Keep participant aliases short and messages concise.\n4. Add alt and opt blocks only when needed.\n5. Validate syntax with Mermaid before stating it renders.\n6. Offer draw.io editable alternative if a viewer cannot render.',
    tags: ['mermaid', 'api', 'sequence'],
    priority: 91,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'skill',
    domain: 'diagrams',
    title: 'draw.io editable diagram workflow',
    summary: 'Create and inspect native draw.io XML artifacts.',
    content:
      '# Procedure\n1. Select the diagram audience and scope.\n2. Define component inventory and boundaries.\n3. Choose left-to-right layers, compact rounded boxes, light pastel fills, thin borders and white background.\n4. Route orthogonal connectors around nodes.\n5. Export native .drawio.\n6. Validate XML and inspect the rendered preview when possible.\n7. Correct overlapping nodes, labels or crossing connectors.\n8. Deliver editable file and evidence.',
    tags: ['drawio', 'diagram', 'editable', 'architecture'],
    priority: 99,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'skill',
    domain: 'diagrams',
    title: 'Excalidraw workshop sketch',
    summary: 'Use sketches for idea exploration and workshops.',
    content:
      '# Procedure\n1. Identify the idea to communicate.\n2. Limit each visual region to a few related concepts.\n3. Use restrained colors and short labels.\n4. Connect concepts without crossings where possible.\n5. Export native Excalidraw data when requested.\n6. Distinguish brainstorming output from approved architecture.',
    tags: ['excalidraw', 'workshop', 'sketch'],
    priority: 89,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'skill',
    domain: 'writing',
    title: 'Write an SRS specification',
    summary: 'Produce testable technical specifications.',
    content:
      '# Procedure\n1. Define system boundaries and actors.\n2. Decompose features into numbered functional requirements.\n3. Specify data entities, interface contracts and validation rules.\n4. Record nonfunctional targets with measurable units.\n5. Add exception handling, security and observability.\n6. Trace each requirement to acceptance tests.\n7. Check terminology, internal consistency and omissions.',
    tags: ['srs', 'requirements', 'specification'],
    priority: 90,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'skill',
    domain: 'writing',
    title: 'Create an architecture design document',
    summary: 'Turn decisions into traceable technical design.',
    content:
      '# Procedure\n1. State purpose and constraints.\n2. List actors, interfaces and systems.\n3. Explain logical and deployment architectures.\n4. Define sequence flows, data ownership and failure handling.\n5. Capture security, scalability and operational considerations.\n6. Document decisions, open risks and assumptions.\n7. Verify text and diagrams agree.',
    tags: ['architecture', 'design document', 'adr'],
    priority: 94,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'skill',
    domain: 'writing',
    title: 'Technical presentation review',
    summary: 'Make slide content clear and presentable.',
    content:
      '# Procedure\n1. Identify audience and presentation goal.\n2. Structure the narrative by decision and evidence.\n3. Limit each slide to one core message.\n4. Use readable font sizes, consistent labels, and grounded graphics.\n5. Check slide order, factual support, and presenter notes when required.\n6. Inspect final rendered slides for clipping and alignment.',
    tags: ['slides', 'presentation', 'review'],
    priority: 85,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'skill',
    domain: 'reviews',
    title: 'Evidence-based artifact review',
    summary: 'Check artifact completeness and report confidence.',
    content:
      '# Procedure\n1. Recover acceptance criteria.\n2. Check completeness and requirements coverage.\n3. Run actual parsers/tests and preserve results.\n4. Separate automated failures from subjective observations.\n5. Verify security and permissions where relevant.\n6. Fix and re-run impacted tests.\n7. Describe what could not be checked.',
    tags: ['validation', 'quality', 'evidence'],
    priority: 96,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'skill',
    domain: 'design',
    title: 'Interactive HTML prototype',
    summary: 'Produce reusable, functional and modern prototypes.',
    content:
      '# Procedure\n1. Define user jobs and information hierarchy.\n2. Choose reusable components and interaction patterns.\n3. Build responsive layouts and meaningful states.\n4. Connect inputs and buttons to real behavior.\n5. Check keyboard access and empty/error/loading states.\n6. Render the UI and review it at desktop and mobile widths.\n7. Deliver source and preview instructions.',
    tags: ['ui', 'typescript', 'html', 'prototype'],
    priority: 92,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'skill',
    domain: 'communication',
    title: 'Write a clear professional email',
    summary: 'Compose concise correspondence with actionable requests.',
    content:
      '# Procedure\n1. Identify recipient, goal and required response.\n2. State purpose in the first paragraph.\n3. Provide necessary context and precise request.\n4. Define deadline only if known.\n5. Check spelling, tone and facts.\n6. Keep any sensitive information out unless necessary.',
    tags: ['email', 'writing', 'communication'],
    priority: 86,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'skill',
    domain: 'reviews',
    title: 'Compare open-source options',
    summary: 'Evaluate source, license, maturity and effort.',
    content:
      '# Procedure\n1. Define mandatory product requirements.\n2. Identify candidate repositories.\n3. Verify latest stars, releases, license and maintenance where possible.\n4. Check working features, extension interfaces and deployment.\n5. Compare implementation effort and support risks.\n6. Test selected critical integrations.\n7. Recommend one option and explain unresolved risks.',
    tags: ['opensource', 'software evaluation', 'comparison'],
    priority: 92,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'example',
    domain: 'diagrams',
    title: 'Example diagram design brief',
    summary: 'A clear brief for editable architecture drawings.',
    content:
      'Create a left-to-right architecture diagram with four bounded layers, white canvas, pastel fills, concise component names and orthogonal connectors. Produce editable draw.io XML, then separately report XML parse and visual-inspection status.',
    tags: ['approved example', 'drawio', 'brief'],
    priority: 70,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'example',
    domain: 'diagrams',
    title: 'Example transactional flow outline',
    summary: 'Compact sequence of a request and asynchronous completion.',
    content:
      'Actors: Client, API, Worker, Database. Steps: Client submits request; API validates and acknowledges; Worker processes; Database persists result; API reports status. Use a sequence diagram with short message labels.',
    tags: ['approved example', 'sequence', 'api'],
    priority: 68,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'example',
    domain: 'thinking',
    title: 'Example architecture decision format',
    summary: 'Short evidence-led recommendation structure.',
    content:
      'Decision: Choose a message broker. Options: A and B. Constraints: ordering, latency, operations and support. Evidence: measured throughput and documented guarantees. Recommendation: one option with risks, triggers for re-evaluation and a rollback plan.',
    tags: ['approved example', 'adr', 'decision'],
    priority: 65,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'example',
    domain: 'writing',
    title: 'Example BRD use case structure',
    summary: 'Numbered use case with testable acceptance criteria.',
    content:
      'Use case: UC-01 Manage access policy. Actor: Authorized administrator. Preconditions: Valid identity and role. Main flow: Create policy, validate rules, save, audit. Exception: Unauthorized user is rejected. Acceptance: Policy can be retrieved with version and audit evidence.',
    tags: ['approved example', 'brd', 'acceptance'],
    priority: 68,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'example',
    domain: 'reviews',
    title: 'Example verified review wording',
    summary: 'Report results without claiming unperformed validation.',
    content:
      'Validated: TypeScript compilation and automated unit tests. Inspected: generated draw.io XML is well-formed. Not verified: visual connector crossings because no preview renderer was used. Open risk: project filesystem isolation requires OS-level enforcement.',
    tags: ['approved example', 'evidence', 'quality'],
    priority: 70,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'example',
    domain: 'design',
    title: 'Example modern application UI guidance',
    summary: 'Reusable interface pattern for a functional dashboard.',
    content:
      'Use a light visual surface, restrained accent color, compact sidebar, one primary content area, clear status labels, accessible info icons, and predictable forms. Every action has visible feedback, errors are recoverable, and pages work at phone widths.',
    tags: ['approved example', 'ui', 'dashboard'],
    priority: 70,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'review',
    domain: 'architecture',
    title: 'Architecture review rubric',
    summary: 'Manual check of service boundaries, security and operating model.',
    content:
      'Review system boundaries, runtime duplication, control and data planes, authorization, failure handling, observability, integration contracts and operational burden. State risks and unknowns with severity. This rubric requires human or agent judgment.',
    tags: ['architecture', 'security', 'rubric'],
    priority: 85,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'review',
    domain: 'diagrams',
    title: 'Diagram output placeholder check',
    summary: 'Reject unresolved diagram placeholders.',
    content:
      'Checks unresolved placeholders in diagram source. Layout quality needs a renderer and visual inspection.',
    tags: ['diagram', 'validator'],
    priority: 75,
    status: 'active',
    checks: [
      {type: 'not_contains', value: 'FIXME', label: 'No unresolved FIXME in diagram'},
      {type: 'not_contains', value: 'TODO', label: 'No TODO in deliverable'},
    ],
    backend: null,
  },
  {
    kind: 'review',
    domain: 'writing',
    title: 'Writing review criteria',
    summary: 'Check clarity and business requirement coverage.',
    content:
      'Review headings, coherent structure, unambiguous terms, actor/trigger relationships, acceptance criteria, missing data requirements and unsupported assertions. This is a manual rubric in addition to placeholder checks.',
    tags: ['writing', 'brd', 'rubric'],
    priority: 84,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'review',
    domain: 'design',
    title: 'UI prototype manual review',
    summary: 'Check accessibility, functional interaction and consistency.',
    content:
      'Verify that every visible button and form works; check keyboard navigation, labels, feedback, responsive layouts, empty states and visual hierarchy. This requires real browser or screenshot testing.',
    tags: ['ui', 'qa', 'ux'],
    priority: 86,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'review',
    domain: 'general',
    title: 'No unsupported completion claims',
    summary: 'Prefer evidence for completion and test statements.',
    content:
      'Inspect claims of success against actual execution logs and files. Report whether work was attempted, generated, tested, or externally verified. This cannot be reliably determined with simple text checks alone.',
    tags: ['honesty', 'verification', 'quality'],
    priority: 92,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'tool',
    domain: 'tools',
    title: 'Excalidraw MCP catalog',
    summary: 'Discovery-only entry for an approved Excalidraw server.',
    content:
      'Use for informal sketches, workshop notes and iterative visual brainstorming. The tool is not callable until a trusted MCP command and tool name are configured and enabled in the catalog.',
    tags: ['excalidraw', 'mcp', 'sketch'],
    priority: 76,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'tool',
    domain: 'tools',
    title: 'Mermaid validator catalog',
    summary: 'Discovery-only entry for Mermaid syntax validation.',
    content:
      'Use a real Mermaid parser or CLI to validate generated Mermaid. Rendering cannot be inferred from syntax success. This is a catalog record until an approved backend is configured.',
    tags: ['mermaid', 'validator', 'mcp'],
    priority: 79,
    status: 'active',
    checks: [],
    backend: null,
  },
  {
    kind: 'tool',
    domain: 'tools',
    title: 'Document artifact tool catalog',
    summary: 'Discovery-only entry for document production tooling.',
    content:
      'Use when generating editable documents or checking layout. This catalog entry does not provide a document tool until an administrator configures an approved executable and validates it.',
    tags: ['document', 'pdf', 'docx', 'mcp'],
    priority: 75,
    status: 'active',
    checks: [],
    backend: null,
  },
];

const styleRecipes: RecordInput[] = [
  {
    kind: 'preference',
    domain: 'diagrams',
    title: 'Sky blue architecture drawing',
    summary: 'Draw editable, layered diagrams with clear boundaries.',
    content:
      '# When to use\nDraw editable, layered diagrams with clear boundaries.\n\n# Instructions\nFor system topology use editable draw.io. Use a white canvas, sky blue groups, dark labels, consistent rounded rectangles and orthogonal connectors. Group by responsibility, label protocols and mark trust boundaries. Include a legend. Validate XML and inspect a rendered preview when tooling is available; disclose missing visual verification.\n\n# Example prompt\nDraw the Personal Brain component topology.\n\n# Worked output\nCanvas: white. Local user boundary contains Browser → HTTP API → Style Repository → SQLite WAL. Browser to API: authenticated HTTP on loopback. CLI boundary contains Claude and Codex → Hooks / MCP stdio → Style Repository. External boundary contains Optional Tool Proxy → approved MCP process, disabled by default. Sky blue containers identify responsibilities; dark arrows show request direction. Legend: solid arrow = request; container = process or trust boundary.\n\n# Acceptance check\nConfirm the output follows the instructions, label assumptions, and report only checks actually performed.',
    tags: ['style-recipe', 'drawing', 'drawio', 'topology', 'sky', 'blue'],
    priority: 75,
    status: 'draft',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'diagrams',
    title: 'Transaction sequence drawing',
    summary: 'Explain interactions in chronological order.',
    content:
      '# When to use\nExplain interactions in chronological order.\n\n# Instructions\nUse Mermaid sequenceDiagram for request flows. Name participants by responsibility. Show authentication, success and a meaningful failure path. Keep topology out of the transaction view. Supply editable source and validate syntax when a parser is available.\n\n# Example prompt\nShow how a style edit is saved.\n\n# Worked output\nsequenceDiagram\n    actor User\n    participant UI as Browser\n    participant API as Local API\n    participant DB as SQLite\n    User->>UI: Save edited style\n    UI->>API: PUT record with token and expectedVersion\n    API->>DB: Validate and update atomically\n    alt Current version matches\n        DB-->>API: New version and revision\n        API-->>UI: 200 saved record\n    else Stale version\n        API-->>UI: 409 conflict\n        UI-->>User: Error; retain unsaved fields\n    end\n\n# Acceptance check\nConfirm the output follows the instructions, label assumptions, and report only checks actually performed.',
    tags: ['style-recipe', 'drawing', 'mermaid', 'sequence', 'transaction'],
    priority: 75,
    status: 'draft',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'writing',
    title: 'Concise technical writing',
    summary: 'Lead with the result and support it with concrete evidence.',
    content:
      '# When to use\nLead with the result and support it with concrete evidence.\n\n# Instructions\nState the outcome first. Use simple verbs, short paragraphs and consistent terminology. Explain the user impact, verification and remaining limits. Remove filler, unverified claims and unfinished placeholders.\n\n# Example prompt\nWrite a release note for versioned styles.\n\n# Worked output\nMy Style keeps your working rules in one versioned library. Edit a rule and save to create a new revision. Claude and Codex can retrieve the current active instructions on subsequent tasks. Older revisions remain available for restore. Verification: persistence and stale-update tests pass only when actually run. Limit: retrieving a rule does not prove an agent followed it.\n\n# Acceptance check\nConfirm the output follows the instructions, label assumptions, and report only checks actually performed.',
    tags: ['style-recipe', 'writing', 'technical', 'clarity', 'release'],
    priority: 75,
    status: 'draft',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'writing',
    title: 'Testable requirements writing',
    summary: 'Turn an intention into verifiable acceptance criteria.',
    content:
      '# When to use\nTurn an intention into verifiable acceptance criteria.\n\n# Instructions\nDefine the actor, goal, scope and numbered requirements. For each requirement give observable acceptance criteria and failure behavior. Separate confirmed constraints from assumptions. Do not invent business targets.\n\n# Example prompt\nSpecify safe editing of a working style.\n\n# Worked output\nActor: local user. Goal: revise a style without losing history. R1: Save creates a new immutable revision snapshot. Acceptance: given v1, saving changed content produces v2 and preserves v1 in history. R2: stale edits fail. Acceptance: given another save already produced v2, submitting expectedVersion=1 returns HTTP 409 and keeps v2 unchanged. R3: preserve unsaved text on failure. Acceptance: the editor remains open with entered content and an error. Out of scope: collaborative cloud editing.\n\n# Acceptance check\nConfirm the output follows the instructions, label assumptions, and report only checks actually performed.',
    tags: ['style-recipe', 'writing', 'requirements', 'acceptance', 'brd'],
    priority: 75,
    status: 'draft',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'thinking',
    title: 'Evidence-led thinking',
    summary: 'Separate what is known from what needs testing.',
    content:
      '# When to use\nSeparate what is known from what needs testing.\n\n# Instructions\nWrite facts, assumptions, options, decision and verification. Challenge the need for new components. Compare at least two credible options. Describe evidence that would change the decision; label estimates.\n\n# Example prompt\nShould a local style studio use a remote database?\n\n# Worked output\nFacts: the product serves one local user and stores versioned records in SQLite. Assumption: cloud sharing is unnecessary. Options: retain SQLite; add a hosted database. Decision: retain SQLite because the stated use case needs local persistence and revisions, and a hosted service adds credentials, network failures and operations. Verify: restart persistence, atomic updates and backup restore. Revisit when multi-device synchronization becomes an explicit requirement.\n\n# Acceptance check\nConfirm the output follows the instructions, label assumptions, and report only checks actually performed.',
    tags: ['style-recipe', 'thinking', 'evidence', 'decision', 'tradeoffs'],
    priority: 75,
    status: 'draft',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'architecture',
    title: 'Boundaries-first architecture',
    summary: 'Describe ownership, interfaces and failure boundaries before implementation.',
    content:
      '# When to use\nDescribe ownership, interfaces and failure boundaries before implementation.\n\n# Instructions\nBegin with scope and constraints. Define components, data ownership, interfaces and trust boundaries. Explain authentication, failure behavior, observability and recovery. Keep diagram and prose consistent. Avoid adding a service without a concrete need.\n\n# Example prompt\nExplain the Personal Brain architecture.\n\n# Worked output\nScope: portable global working methods for local Claude and Codex sessions. Browser owns presentation; loopback HTTP API validates token, origin and input. BrainDB owns records, revision transactions and trace metadata in SQLite WAL. Hooks emit concise task context; MCP supports discovery and retrieval over stdio. The optional external tool proxy executes only configured, enabled backends when its process gate is enabled. Failures: stale saves return 409; invalid credentials reject requests; unsupported tools stay unavailable. Recovery: restore a revision as a new version or restore a consistent database backup. Evidence: traces prove emission or retrieval, not compliance.\n\n# Acceptance check\nConfirm the output follows the instructions, label assumptions, and report only checks actually performed.',
    tags: ['style-recipe', 'architecture', 'boundaries', 'security', 'operations'],
    priority: 75,
    status: 'draft',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'architecture',
    title: 'Trade-off architecture decisions',
    summary: 'Record a decision together with alternatives and revisit triggers.',
    content:
      '# When to use\nRecord a decision together with alternatives and revisit triggers.\n\n# Instructions\nUse an ADR with context, constraints, alternatives, decision, consequences and verification. Prefer the smallest solution that meets requirements. Include a trigger for revisiting the decision.\n\n# Example prompt\nRecord the storage decision for a local style tool.\n\n# Worked output\nADR: local transactional storage. Context: one user needs durable styles, revision history and concurrent process access. Alternatives: JSON files, SQLite, hosted SQL. Decision: use SQLite WAL with atomic record and revision writes. Consequences: no database service is needed; backups must be consistent; writes remain serialized. JSON makes concurrent updates and revision atomicity harder. Hosted SQL adds network and credentials without a requested collaboration feature. Verify: persistence, rollback history and stale version rejection. Revisit: supported multi-user remote writes.\n\n# Acceptance check\nConfirm the output follows the instructions, label assumptions, and report only checks actually performed.',
    tags: ['style-recipe', 'architecture', 'adr', 'alternatives', 'tradeoffs'],
    priority: 75,
    status: 'draft',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'architecture',
    title: 'Constraint-led technology selection',
    summary: 'Choose technology using requirements and a small evidence matrix.',
    content:
      "# When to use\nChoose technology using requirements and a small evidence matrix.\n\n# Instructions\nState hard constraints before comparing candidates. Check compatibility, license, maintenance, security, deployment effort and total cost from current primary sources before a real selection. Separate verified capabilities from assumptions. Recommend one candidate with rejection reasons and a small proof of concept.\n\n# Example prompt\nCompare storage options for a single-user local application.\n\n# Worked output\nIllustrative matrix, not a current vendor assessment:\nCandidate | Local/offline | Transactions | Operations\nJSON files | Yes | Custom locking needed | Simple files\nSQLite | Yes | Built-in | Embedded library\nHosted SQL | Network-dependent | Built-in | Remote service\nRecommendation: SQLite for this constrained example. Reject JSON when atomic versioned updates are required. Reject hosted SQL while offline operation is mandatory. Proof of concept: two processes attempt updates against one version; one succeeds and one receives a conflict. Before adoption, verify the chosen runtime's SQLite support and license from official sources.\n\n# Acceptance check\nConfirm the output follows the instructions, label assumptions, and report only checks actually performed.",
    tags: ['style-recipe', 'technology', 'selection', 'evaluation', 'stack', 'comparison'],
    priority: 75,
    status: 'draft',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'design',
    title: 'Accessible sky blue interface',
    summary: 'Build calm interfaces with readable contrast and clear actions.',
    content:
      '# When to use\nBuild calm interfaces with readable contrast and clear actions.\n\n# Instructions\nUse pale sky backgrounds, white surfaces, dark blue text and a deeper blue for primary controls. Keep one main action per section, visible labels, keyboard focus and responsive layouts. Never convey state using color alone. Honor reduced motion. Check contrast and narrow layouts.\n\n# Example prompt\nDefine a style-library screen.\n\n# Worked output\nScreen: My Style. Intro explains that recipes begin as drafts. Primary action: New Style. Secondary action: Load style recipes. Search and domain filter have accessible labels. Cards show domain, title, summary, readable instructions, Edit, History and textual status. Palette: canvas #f0f7fc; surface #ffffff; text #0c2840; primary #0369a1 with white text. Desktop uses two columns; phone uses one. Save errors retain form content. Keyboard users can skip navigation and see focus indicators.\n\n# Acceptance check\nConfirm the output follows the instructions, label assumptions, and report only checks actually performed.',
    tags: ['style-recipe', 'design', 'ux', 'ui', 'accessibility', 'sky', 'blue'],
    priority: 75,
    status: 'draft',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'reviews',
    title: 'Evidence-based review',
    summary: 'Report actionable defects and distinguish tests from observations.',
    content:
      '# When to use\nReport actionable defects and distinguish tests from observations.\n\n# Instructions\nReview against explicit acceptance criteria. Put correctness, security and data-loss risks first. Each finding includes severity, evidence, impact and correction. Name executed checks and their results. Separate visual observations from automated results. Never claim an unrun test passed.\n\n# Example prompt\nReview a stale-save implementation.\n\n# Worked output\nFinding: High — update handler overwrites the record without comparing expectedVersion. Evidence: a second client can submit v1 after v2 exists. Impact: lost changes. Correction: reject stale updates with 409 and atomically write the current record and revision. Verification: create v1, save v2, submit stale v1 and assert v2 content and history remain intact. Visual review: confirm the editor stays open and shows the conflict. If the UI was not opened, report that check as unverified.\n\n# Acceptance check\nConfirm the output follows the instructions, label assumptions, and report only checks actually performed.',
    tags: ['style-recipe', 'review', 'qa', 'validation', 'evidence'],
    priority: 75,
    status: 'draft',
    checks: [],
    backend: null,
  },
  {
    kind: 'preference',
    domain: 'coding',
    title: 'Minimal verified coding',
    summary: 'Make the smallest complete change and verify the behavior that matters.',
    content:
      '# When to use\nImplementing a feature or fixing a bug in an existing application.\n\n# Instructions\nRead the relevant code and callers first. Reuse existing components and dependencies. Fix the root cause once, preserve error handling and validation, and avoid unrelated refactors. Add a focused behavioral test for nontrivial logic. Run the relevant build and tests and report actual results.\n\n# Example prompt\nFix missing spacing without weakening the application security policy.\n\n# Worked output\nCause: inline margin styles are rejected by style-src self. Change: move the section gap and button margins into named stylesheet classes; apply those classes to the existing markup. Preserve the current security header. Check: assert generated markup has no inline style attributes, verify the named rules exist in the served stylesheet, and inspect desktop and phone layouts if a browser is available. Report any blocked checks.\n\n# Acceptance check\nNo relaxed security policy, no lost functionality, and no claims about tests or visual checks that were not run.',
    tags: ['style-recipe', 'coding', 'implementation', 'testing', 'minimal'],
    priority: 75,
    status: 'draft',
    checks: [],
    backend: null,
  },
];

// Explicit sample imports re-register legacy capabilities a fresh catalog library does not ship.
const ensureDomain = (db: BrainDB, id: string) => {
  if (!db.hasDomain(id)) {
    db.saveDomain(id[0].toUpperCase() + id.slice(1).replace(/-/g, ' '));
  }
};

export function seed(db: BrainDB) {
  const present = new Set(db.list({limit: 300}).map((r) => r.title));
  let created = 0;
  for (const r of [...seedRecords, ...completeExamples]) {
    if (!present.has(r.title)) {
      ensureDomain(db, r.domain);
      db.create(r);
      created++;
    }
  }
  return created + seedStyles(db);
}

export function seedStyles(db: BrainDB) {
  const present = new Set(db.list({limit: 300}).map((r) => r.title));
  let created = 0;
  for (const record of styleRecipes) {
    if (!present.has(record.title)) {
      ensureDomain(db, record.domain);
      db.create(record);
      created++;
    }
  }
  return created;
}

// One-time cleanup of bundled samples; personal edits and revision history survive.
export function archiveSamples(db: BrainDB) {
  if (db.db.prepare("SELECT value FROM meta WHERE key='samples_archived_v1'").get()) {
    return;
  }
  const samples = [...seedRecords, ...completeExamples, ...styleRecipes];
  const rows = db.db.prepare('SELECT id FROM records').all() as {id: string}[];
  for (const {id} of rows) {
    const record = db.get(id)!;
    if (
      record.status !== 'archived' &&
      record.version === 1 &&
      samples.some(
        (s) => s.kind === record.kind && s.title === record.title && s.content === record.content,
      )
    ) {
      db.update(id, {...record, status: 'archived'}, record.version);
    }
  }
  db.clearTraceDemo();
  db.db.prepare("INSERT INTO meta(key,value) VALUES('samples_archived_v1','1')").run();
}

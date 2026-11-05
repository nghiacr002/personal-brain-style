// Release snapshot of the global library only. No projects, credentials or activity.
import type {RecordInput} from "../core/models.ts";
export const globalStyleCatalog: Array<RecordInput & {id:string}> = [
  {
    "kind": "preference",
    "domain": "thinking",
    "keyId": "architecture-thinking-security-and-operations",
    "title": "Architecture thinking — security and operations",
    "summary": "Design security and operational ownership into every architecture decision.",
    "content": "Apply when planning architecture. First establish workload goals, users, data sensitivity, constraints and assumptions. Design for security and design for operation from the start. Record decisions and verification evidence; never imply a control or recovery process was tested unless it was.\n\nSecurity: map entry points, identities, data flows and trust boundaries. Threat-model likely abuse and failure paths. Use Zero Trust: verify each access, least privilege and assume compromise. Prefer workload identities over stored credentials; define authorization, secret rotation, encryption, audit trails and network exposure. State responsibility and residual risk for each boundary.\n\nOperations: assign a service owner and support path. Define measurable availability and latency objectives, logs/metrics/traces, actionable alerts, dashboards and incident runbooks. Design infrastructure as code, repeatable deployments, release checks and rollback. Specify backup/restore, recovery time and recovery point objectives, failure handling, capacity, patching and cost visibility. Plan recovery exercises and identify untested assumptions.\n\nDeliver: assumptions; security and operations decisions; risks with owners; acceptance checks. Give conclusions and tradeoffs, not hidden chain-of-thought. Example: a customer API uses workload identity for data access, restricted database networking, correlated request traces, a latency alert owned by the API team, and a documented rollback plus restore exercise. Set numeric objectives from workload requirements, not invented defaults.\n\nReferences:\nhttps://learn.microsoft.com/en-us/azure/well-architected/security/principles\nhttps://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/principles",
    "tags": [
      "personal-architecture-thinking",
      "architecture",
      "personal-style",
      "planning",
      "security",
      "operations",
      "threat model",
      "tradeoffs",
      "recovery"
    ],
    "priority": 90,
    "status": "active",
    "requiredIds": [
      "8c1ecc2b-4dea-4e4b-ac32-171d37d99b36",
      "5cbd3ef7-393b-429d-860b-625c7bebbce3"
    ],
    "checks": [],
    "backend": null,
    "id": "550e35c5-998d-4ea0-b48d-a3f8d1341d92",
    "principles": [
      "Design security and operations into every boundary.",
      "Record evidence, owners and unverified assumptions."
    ],
    "externalSkills": [
      "archify"
    ],
    "reviewCriteria": [
      "Identify trust boundaries, data sensitivity, identity, least privilege and residual risks.",
      "Assign owners, observable objectives, alerts and incident response paths.",
      "Specify rollback, backup/restore, recovery objectives and failure tests; distinguish plans from completed tests."
    ],
    "examples": [
      "For an order API, identify the client-to-API and API-to-database trust boundaries. Use workload identity and least privilege. Assign an API owner, define latency and availability targets from workload requirements, and specify alerts, rollback and restore exercises. Mark planned exercises as untested."
    ],
    "useWhen": "Use when planning decisions, security boundaries, operational ownership and tradeoffs.",
    "requirements": []
  },
  {
    "kind": "preference",
    "domain": "technology",
    "keyId": "architecture-technology-selection-azure-first",
    "title": "Architecture technology selection — Azure first",
    "summary": "Choose Azure services for new selections against workload constraints; existing accepted stacks take precedence over the default.",
    "content": "Azure is my default cloud platform for new technology selections. Use the required-linked security and operations thinking style before choosing services. Prefer the simplest managed Azure service that meets requirements; do not default to Kubernetes or add multiple clouds without a concrete need.\n\nCompare viable Azure options using a small decision table: requirement, candidate, fit, limitation, security/operations burden, cost assumption and decision. Check current official documentation for region availability, capabilities, quotas, service lifecycle and pricing before committing. Record unknowns and alternatives in a short architecture decision record.\n\nConsider Microsoft Entra ID and managed identities for authentication, Key Vault where secrets are necessary, and Azure Monitor/Application Insights for observability where appropriate. Choose compute, database, messaging and network services from workload needs. Distinguish authentication from authorization; select private connectivity where the threat model warrants it. Evaluate resilience, backups, recovery and support ownership alongside functionality.\n\nUse GCP or another cloud only for an explicit requirement or existing integration. Explain that boundary and the extra identity, network and operations burden. GCP icons being available does not make GCP a deployment requirement.\n\nEXISTING STACKS AND LOCAL-FIRST PROJECTS\nFor an existing system, its accepted architecture decisions and current stack take precedence over this default. Do not propose migrating, re-platforming or redrawing an existing system as Azure without a stated requirement; when a change is warranted, compare it against the existing stack and record the concrete limitation it solves. A project that is explicitly local-first or self-hosted keeps that model unless a requirement changes it. Do not add cloud services, remote databases or new infrastructure merely to match this preference.\n\nExample: compare App Service, Container Apps and AKS for an HTTP API. Recommend the least complex option satisfying deployment/runtime/network constraints; retain AKS only when Kubernetes-specific control is required. Document cost and region checks as pending until actually verified.\n\nReferences:\nhttps://learn.microsoft.com/en-us/azure/well-architected/pillars\nhttps://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/compute-decision-tree",
    "tags": [
      "personal-architecture-technology",
      "architecture",
      "personal-style",
      "technology",
      "stack",
      "cloud",
      "azure",
      "selection",
      "compare",
      "platform"
    ],
    "priority": 90,
    "status": "active",
    "requiredIds": [
      "76ce7005-0e47-43a8-b3a3-eadb70240dcc",
      "8c1ecc2b-4dea-4e4b-ac32-171d37d99b36",
      "550e35c5-998d-4ea0-b48d-a3f8d1341d92",
      "5cbd3ef7-393b-429d-860b-625c7bebbce3"
    ],
    "checks": [],
    "backend": null,
    "id": "5cb84cbf-b87e-4173-b055-90a2b748c44d",
    "principles": [
      "Azure first for new selections; choose the simplest service meeting workload constraints.",
      "Evaluate security, operations and cost together.",
      "Existing accepted stacks and local-first projects take precedence over the default."
    ],
    "externalSkills": [
      "archify"
    ],
    "reviewCriteria": [
      "Compare viable Azure options against requirements and justify the selected service.",
      "Verify region, lifecycle, quotas and pricing using current official evidence.",
      "Document identity, network, recovery, ownership and cost assumptions; justify any other cloud.",
      "Confirm no existing accepted stack or local-first decision is overridden without a stated requirement and recorded comparison."
    ],
    "examples": [
      "For a small Azure HTTP API, compare App Service, Container Apps and AKS against runtime, networking, scaling and ownership constraints. Select the simplest qualifying option. Document region and pricing evidence; leave unsupported cost estimates explicitly unverified.",
      "For an existing self-hosted platform with an accepted stack decision, keep that stack; propose an Azure service only against a stated requirement and record the rejected simpler option."
    ],
    "useWhen": "Use when selecting technologies or comparing services against workload constraints.",
    "requirements": []
  },
  {
    "kind": "preference",
    "domain": "architecture",
    "keyId": "architecture-drawing-clear-cloud-flow-diagrams",
    "title": "Architecture drawing — clear cloud flow diagrams",
    "summary": "Editable draw.io flow diagrams with square boxes, labeled arrows, legends and official cloud icons; existing systems are drawn as built, not re-platformed by preference.",
    "content": "Required-linked: apply Azure technology selection and security/operations thinking before drawing. Deliver an editable .drawio diagram as the primary artifact. Draw architecture as a clear flow diagram: square boxes, no border radius (rounded=0), directional arrows, explicit boundaries and a legend. Use official Azure, GCP and cloud icon libraries only for the providers/services actually present.\n\nLayout: choose left-to-right or top-to-bottom flow and keep it consistent. Align boxes to a grid; use consistent sizes and spacing. Put a service name and responsibility in each box. Group services by ownership, network or trust boundary without mixing those meanings. Keep nodes and arrow labels clear of overlaps. Use orthogonal connectors with visible arrowheads; label protocol or payload and distinguish request, event and control flows. Number steps when order matters. Use separate pages for detailed flows rather than crowding one canvas.\n\nColor style: white canvas, sky-blue service fill #E0F2FE, blue border/arrows #0369A1, dark text #0F172A. Use pale neutral fill #F1F5F9 for external systems; label security boundaries and use dashed outlines. Reserve amber #FEF3C7 for labeled risks or pending decisions. The legend explains all fills, boundaries, icons and line styles; never rely on color alone. Boxes and containers have square corners; preserve official icon geometry and colors.\n\nIcon dataset: use draw.io built-in cloud libraries or official provider SVG collections. Azure: https://learn.microsoft.com/en-us/azure/architecture/icons/ ; GCP: https://cloud.google.com/icons ; draw.io Azure library: https://www.drawio.com/docs/diagram-types/azure-diagrams/ . Keep a source manifest with provider, service, source URL and retrieved library version/date. Label generic cloud/internet shapes clearly. Do not invent stencil IDs, distort provider icons or use a product icon for an unrelated service. Embed imported SVG assets where supported so the file does not depend on local paths.\n\nDelivery checks: valid draw.io XML with editable nodes, labels and connectors; open/render the file when tooling allows; inspect arrow direction, overlaps, legend, boundary semantics and icon rendering. Supply PNG/SVG only as optional previews. Report any rendering or validation not performed.\n\nExample flow: Client → Azure API hosting → Azure database, with separate identity and telemetry connections. Label HTTPS and data access, show the data trust boundary, and include a legend for request arrows, telemetry and boundary lines. Select actual Azure services using the linked technology style; include GCP only when a real external integration requires it.\n\nEXISTING-SYSTEM PRECEDENCE — v1\nThe Azure-first linked preference is a default for new technology selection, not a mandate to migrate or redraw an existing system as Azure. For an existing system, its accepted architecture decisions and their explicit amendments govern the depicted stack and boundaries. Retain this style's editable draw.io format, square boxes, palette, legend and verified-icon rules. Depict non-cloud or self-hosted components (application services, databases, message brokers, identity providers, caches) as generic labelled boxes where no verified provider icon applies. Keep the development deployment distinct from proposed production high availability. Label policy authority and public contract or extension boundaries where the architecture defines them.\n\nVISUAL ARCHITECTURE COMPOSITION — v1\nCommunicate architecture through structure, not paragraph-filled boxes. Keep necessary text: a concise service/entity name, a short responsibility where useful, and meaningful edge labels. Longer explanatory prose belongs in notes or linked documentation. The legend explains notation only; it is not a deployment guide.\nBefore drawing, translate each architectural fact into its appropriate visual form: services and actors into nodes; ownership, system, trust and network membership into separately labelled containers; interactions into directed connectors; known properties into short badges or labels. Use conventional notation for ER keys/cardinality and sequence alternatives. Do not convert every sentence into another box: show only facts relevant to the view's question. Never invent relationships to make the picture look complete.\nReplace text-only platform-services inventories with actual service nodes and relevant connections in a focused supporting-services view. For example, show Key Vault, App Configuration, Application Insights and Log Analytics separately when present in the evidence; connect the actual consumers and telemetry destinations only when verified. Do not substitute a paragraph saying dependency arrows are omitted for a requested dependency view.\nShow deployment and network detail in a dedicated view when it would crowd the application flow. Distinguish resource-group ownership from VNet/subnet boundaries. Place managed services according to verified deployment semantics; represent private endpoints and their connections explicitly instead of implying that every PaaS service runs inside a subnet. Keep unverified network and identity claims in clearly marked notes.\nChoose one main reading direction and align related nodes. Keep concise labels outside connector intersections. Split application flow, deployment/network, identity and operations into linked pages only when needed. Draw.io pages/layers or Mermaid subgraphs must clarify the reader's task, not hide mandatory content: every requested exported view must remain understandable with its title, scope and legend. Use native editable shapes/connectors and verified icons; do not replace the architecture with a flattened image. Preserve the selected project's palette and do not infer a cloud provider from drawing preferences.\nReview at the intended reading size. Reject walls of text masquerading as services, mixed abstraction levels, unlabeled arrows, invented connections, ambiguous containers, and legends containing implementation essays. Check that important facts moved out of prose remain represented accurately. Distinguish source/semantic checks from actual rendered visual inspection.\nReferences: https://c4model.com/diagrams/notation ; https://c4model.com/diagrams ; https://www.drawio.com/docs/manual/layers/how-layers-work/",
    "tags": [
      "personal-architecture-drawing",
      "architecture",
      "personal-style",
      "microservices",
      "ddd",
      "system design",
      "integration"
    ],
    "priority": 90,
    "status": "active",
    "requiredIds": [
      "550e35c5-998d-4ea0-b48d-a3f8d1341d92",
      "5cb84cbf-b87e-4173-b055-90a2b748c44d",
      "44455f35-9972-4629-8920-b6622c39d8f9",
      "8c1ecc2b-4dea-4e4b-ac32-171d37d99b36",
      "5cbd3ef7-393b-429d-860b-625c7bebbce3"
    ],
    "checks": [],
    "backend": null,
    "id": "dd8b82ee-d28b-4763-9ab2-bf65709d5c9f",
    "principles": [
      "Editable draw.io flow diagrams with square boxes and labeled arrows.",
      "Sky-blue palette, explicit boundaries, legend and authentic cloud icons.",
      "Visualize architectural facts as nodes, boundaries and relationships; reserve prose for notes and keep labels concise.",
      "Draw existing systems as built; the Azure default applies to new selections."
    ],
    "externalSkills": [
      "drawio-skill"
    ],
    "reviewCriteria": [
      "Parse the .drawio XML and verify editable nodes/connectors and rounded=0 for boxes.",
      "Open or render the diagram; inspect routing, arrow direction, labels, spacing and overlaps.",
      "Verify the legend explains colors, boundaries and line styles; confirm Azure/GCP icons match actual services and include sources.",
      "Check the drawing follows required thinking and technology styles; report any visual checks not performed.",
      "Reject paragraph-filled architecture boxes and text inventories used instead of requested relationships; verify that the visual model preserves the source facts and distinguishes ownership from network boundaries.",
      "Do not introduce Azure services solely from the linked default; verify the actual stack, ownership and deployment status against accepted decisions."
    ],
    "examples": [
      "Draw Client → API → Database as editable square boxes in a .drawio file. Label HTTPS and data-access arrows, show a separate identity flow and trust boundary, use sky-blue service fills and add a legend. Use official icons for selected services. Render and inspect overlaps; report if rendering was unavailable.",
      "Replace a platform-services paragraph with verified configuration, secrets and telemetry nodes in a supporting-services view. Move detailed subnet/private-endpoint topology to a deployment page; retain short service and protocol labels in the main flow.",
      "For an existing self-hosted system, draw its application services, database and message broker as labelled square boxes in the same palette; do not substitute Azure services, and label the development server separately from the proposed production topology."
    ],
    "useWhen": "Use when designing system boundaries, service interactions and architecture patterns.",
    "requirements": []
  },
  {
    "kind": "preference",
    "domain": "technology",
    "keyId": "architecture-technology-selection-cloud-agnostic",
    "title": "Architecture technology selection — Cloud Agnostic",
    "summary": "Select technologies by workload fit, portability and total operational cost, without a preferred cloud.",
    "content": "Use this as an alternative to Azure First for the selected project. Start with workload capabilities, constraints, data residency, team skills, security and operational objectives. Compare relevant Azure, AWS, GCP, private-cloud or on-premises options without assuming one provider wins. Cloud agnostic does not require multi-cloud deployment or identical services everywhere.\n\nDescribe logical capabilities before mapping provider products. Evaluate open standards, supported runtimes, data formats, API contracts, identity federation, export/restore paths, infrastructure automation and observability. Separate business logic from provider integrations where it makes migration practical. Do not force Kubernetes, lowest-common-denominator abstractions or self-hosting merely to claim portability.\n\nUse a decision table: requirement, viable options, capability fit, security/operations burden, portability limits, total cost and recommendation. Include egress, migration, staffing and support costs. Check current official provider documentation for region, quotas, lifecycle and pricing; mark unverified claims. Record an exit plan and justify any deliberate managed-service dependency.\n\nApply security and operations thinking throughout. Example: compare managed PostgreSQL on eligible providers against operating PostgreSQL yourself. Assess extensions, backups, restore/export tests, identity, networking, availability and ownership before choosing. A single managed provider may be the best cloud-agnostic decision.\n\nProject usage: activate this style and select it in the technology slot instead of Azure First. If the drawing style still requires Azure First, edit its required links (or create a separate drawing style) to require this style; dependencies use exact record IDs.\n\nReference: https://learn.microsoft.com/en-us/azure/architecture/patterns/",
    "tags": [
      "personal-architecture-cloud-agnostic",
      "architecture",
      "personal-style",
      "technology",
      "stack",
      "cloud",
      "azure",
      "selection",
      "compare",
      "platform"
    ],
    "priority": 90,
    "status": "draft",
    "requiredIds": [
      "550e35c5-998d-4ea0-b48d-a3f8d1341d92",
      "8c1ecc2b-4dea-4e4b-ac32-171d37d99b36",
      "5cbd3ef7-393b-429d-860b-625c7bebbce3"
    ],
    "checks": [],
    "backend": null,
    "id": "86ad2513-1b4f-48b6-8c06-dc510ad751cd",
    "principles": [
      "Choose by workload fit without assuming a preferred provider.",
      "Portability is a tradeoff, not a requirement for multi-cloud."
    ],
    "externalSkills": [
      "archify"
    ],
    "reviewCriteria": [
      "Compare logical capabilities and viable providers against the same constraints.",
      "Assess exit/export paths, managed-service dependencies, egress, staffing and migration costs.",
      "Verify security and recovery ownership; justify abstractions and avoid unsupported portability claims."
    ],
    "examples": [
      "Compare managed PostgreSQL offerings against data residency, required extensions, recovery, export paths and operating cost. Choose one provider when it meets the requirements; document the exit plan rather than adding multi-cloud infrastructure without a need."
    ],
    "useWhen": "Use when selecting technologies or comparing services against workload constraints.",
    "requirements": []
  },
  {
    "kind": "preference",
    "domain": "architecture",
    "keyId": "architecture-design-patterns-microservices-ddd-and-modular-d",
    "title": "Architecture design patterns — microservices, DDD and modular design",
    "summary": "Choose architecture patterns from domain boundaries, scale, team ownership and operational needs.",
    "content": "Choose patterns to solve concrete problems. Start with a modular monolith when one deployment meets the workload needs. Adopt microservices only when independent deployment, scaling, isolation or team ownership justifies distributed-system costs. Record why the simplest viable alternative is insufficient.\n\nUse strategic domain-driven design (DDD): establish a shared domain vocabulary, business capabilities, subdomains, bounded contexts, owners and context relationships. A bounded context is a model boundary, not automatically one service. Apply tactical entities, value objects, aggregates and domain events where the domain complexity warrants them. Define aggregate invariants and transaction boundaries; avoid splitting services by database table or technical layer.\n\nChoose layered or hexagonal architecture to isolate domain logic from infrastructure. Consider event-driven integration for decoupling and asynchronous work, with explicit delivery, ordering and consistency assumptions. Use CQRS only when read/write needs differ enough to justify separate models; event sourcing is a separate decision with replay, evolution and privacy costs.\n\nFor distributed workflows, evaluate saga compensation, transactional outbox, idempotent consumers and deduplication. For failures, define timeouts, bounded retries with backoff, circuit breakers and bulkheads where appropriate. Retries must respect idempotency and avoid overload. Consider an anti-corruption layer at legacy boundaries and a strangler migration for incremental replacement.\n\nApply security and operations thinking to every boundary: authorization, data ownership, traces, failure modes, deployment/rollback, recovery and support ownership. Deliver a context map, chosen pattern/problem/tradeoff table, rejected alternatives and measurable validation criteria. Use the separately selected drawing style for visual output.\n\nExample: separate Ordering, Payments and Fulfilment models in a modular application first. Extract Payments only when its isolation or independent release requirements justify it. An order-accepted event may use an outbox and idempotent consumer; define duplicate handling, payment failure compensation and trace correlation. Do not claim exactly-once processing without demonstrated guarantees.\n\nReferences:\nhttps://learn.microsoft.com/en-us/azure/architecture/microservices/model/domain-analysis\nhttps://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design\nhttps://learn.microsoft.com/en-us/azure/architecture/patterns/",
    "tags": [
      "personal-architecture-design-patterns",
      "architecture",
      "personal-style",
      "microservices",
      "ddd",
      "system design",
      "integration"
    ],
    "priority": 90,
    "status": "draft",
    "requiredIds": [
      "550e35c5-998d-4ea0-b48d-a3f8d1341d92",
      "5f1b2a1c-b375-4cef-87a0-fce441bcdbd4",
      "8c1ecc2b-4dea-4e4b-ac32-171d37d99b36",
      "5cbd3ef7-393b-429d-860b-625c7bebbce3"
    ],
    "checks": [],
    "backend": null,
    "id": "015a689a-b4b1-4be4-b6d6-8718e155c3e0",
    "principles": [
      "Prefer the simplest viable architecture.",
      "Use domain boundaries and ownership to justify distribution."
    ],
    "externalSkills": [
      "archify"
    ],
    "reviewCriteria": [
      "State the problem solved by each pattern and the rejected simpler alternative.",
      "Validate bounded contexts, ownership, aggregate invariants and transaction boundaries.",
      "For distributed flows, verify idempotency, retries, compensation, outbox and failure recovery assumptions.",
      "Review observability, deployment/rollback and measurable acceptance criteria."
    ],
    "examples": [
      "Keep Ordering, Payments and Fulfilment as bounded modules first. Extract Payments only when isolation or independent deployment justifies it. For order events, specify an outbox, idempotent consumers, duplicate handling, compensation and trace correlation; test failures rather than claiming exactly-once delivery."
    ],
    "useWhen": "Use when designing system boundaries, service interactions and architecture patterns.",
    "requirements": []
  },
  {
    "kind": "preference",
    "domain": "writing",
    "keyId": "document-writing-clear-structured-and-evidence-based",
    "title": "Document writing — clear, structured and evidence-based",
    "summary": "Write concise technical documents with explicit decisions, traceable evidence, decision precedence and honest separation of historical from current verification.",
    "content": "Apply when writing or revising project documentation. Start by identifying the audience, purpose, scope and decision or action the reader needs. Lead with the conclusion or recommendation. Use plain technical English, short connected paragraphs, consistent terminology and active voice. Define acronyms on first use.\n\nUse only sections needed for the document: purpose and scope; requirements and constraints; proposed approach; decisions and alternatives; risks and assumptions; implementation or operating steps; verification and next actions. Use tables for comparisons, numbered steps for procedures, and diagrams when relationships are clearer visually. Apply any project-selected architecture and drawing styles to diagrams. Do not invent project facts, metrics, owners, dates or verification results.\n\nDistinguish facts, assumptions, proposals and open questions. Cite the source and date for externally verified claims when relevant. Make requirements observable and testable. Record decisions with their rationale, alternatives and consequences. End with concrete next actions and unresolved questions when they exist. Preserve supplied facts and the meaning of existing text during edits.\n\nUse Markdown for repository documents unless another format is requested. For editable office documents, use the documents skill and inspect the rendered output when available. Required external skills are not automatically installed: locate and read their instructions before applicable work; disclose missing tools. Review the final document against the criteria below and report unperformed checks honestly.\n\nDECISION PRECEDENCE AND HISTORICAL EVIDENCE — v1\nWhen a project records decisions (architecture decision records, decision logs, specifications with amendments), identify the binding baseline and every explicit amendment or supersession before writing. Cite section or decision identifiers. Preserve historical decisions together with their supersession; do not silently treat superseded sections or older README prose as current, and do not silently rewrite them. Distinguish original requirements, implemented departures, proposed changes, design targets and dated measured results. Record a necessary departure as a new decision when documentation changes are authorized.\nDo not carry old test counts, past environment results or earlier load measurements forward as new verification. A dated report with unmet gates remains unmet until new evidence exists. Accepting a target in a decision does not prove that the target was achieved.\nPreserve the existing format of a document when editing it (for example, an existing HTML design document); the Markdown default applies to new prose. Use the project's designated sources for boundaries, delivery contracts and domain detail rather than whichever document is nearest.\nFor operating procedures, state the working directory, environment or deployment profile, ordered steps, affected target and validation evidence. Check later decisions and the selected profile before copying historical deployment statements. Respect the agent's permitted execution scope; describe steps owned by others as such.\nFor multilingual product copy, reuse authored wording and the project's defined register, address form and punctuation for each language; preserve machine identifiers and option keys untranslated. Do not invent governance approvals, retention periods or service objectives. Keep real tokens, recipient details, answers and personal data out of examples and reports.",
    "tags": [
      "personal-document-writing",
      "writing",
      "documentation",
      "technical-english",
      "project-style",
      "document",
      "readme",
      "specification",
      "guide",
      "report"
    ],
    "examples": [
      "Decision note — Add capability search. Purpose: help users locate a capability in the local registry. Decision: filter registered names with the existing browser UI and preserve the query in the URL. Rationale: reuse the current local stack without adding a search service. Acceptance: matching names are shown; no matches produces a clear empty state; refreshing preserves the query. Verification: record the actual tests run and leave browser layout inspection pending if it was not performed.",
      "Describe a field as optional in the current schema, citing the migration and the decision that changed it, and explain the resulting alternative flow; do not restate the original baseline's required-field rule as current.",
      "Runbook step: name the working directory, selected profile, numbered script and affected target, then record the validation output actually observed. Do not reuse last month's environment results as today's evidence."
    ],
    "principles": [
      "Write for the reader's decision or task; lead with the main point.",
      "Prefer plain, concise technical English and consistent terminology.",
      "Separate evidence from assumptions and make requirements testable.",
      "Preserve project facts and explicitly report verification limits.",
      "Document the current amended behavior and distinguish historical evidence from checks performed now."
    ],
    "externalSkills": [
      "documents:documents (when creating or editing an office document)"
    ],
    "reviewCriteria": [
      "Confirm the audience, purpose, scope and main recommendation are clear.",
      "Check terminology, acronyms, heading order and sentence clarity; remove repetition.",
      "Trace factual claims to supplied evidence or cited sources; label assumptions and open questions.",
      "Verify requirements and acceptance criteria describe observable results.",
      "Check decisions explain alternatives, consequences and unresolved risks.",
      "Validate links, tables and code examples; render office documents and inspect pagination/layout when possible.",
      "Confirm diagrams follow the project's selected drawing style and distinguish completed checks from pending reviews.",
      "Verify decision and amendment precedence, retained document format, profile and working directory, multilingual terminology, and whether each reported check was actually run now rather than carried forward."
    ],
    "priority": 90,
    "status": "active",
    "requiredIds": [
      "8c1ecc2b-4dea-4e4b-ac32-171d37d99b36"
    ],
    "checks": [],
    "backend": null,
    "id": "44455f35-9972-4629-8920-b6622c39d8f9",
    "useWhen": "Use when writing or editing technical documents, specifications, guides and README files.",
    "requirements": []
  },
  {
    "kind": "preference",
    "domain": "design-system",
    "keyId": "sky-blue-color-scheme-design-system",
    "title": "Sky-blue color scheme & design system",
    "summary": "Reusable sky-blue visual tokens for colors, typography, spacing and component states.",
    "content": "Apply when this visual style is selected. Use a calm sky-blue system: pale blue page backgrounds, white surfaces, dark readable text and blue primary actions. Define reusable semantic tokens rather than separate colors for each component. Suggested starting palette: page #F0F9FF; surface #FFFFFF; soft accent #E0F2FE; primary #0369A1; primary hover #075985; text #0F172A; secondary text #475569. Verify contrast for actual text, borders, focus and disabled states rather than assuming these combinations are accessible.\n\nKeep typography, spacing, borders and component states consistent. Reuse the application's existing font and component tokens; use a coherent spacing scale such as 4, 8, 12, 16, 24 and 32 pixels. Use restrained borders and shadows, consistent corner radii and visible focus indicators. Avoid promotional gradients, decorative clutter and oversized empty surfaces. Maintain hierarchy through type size, weight and spacing.\n\nUse semantic success, warning and error colors with text or icons, never color alone. Define default, hover, focus, active, disabled, loading and error states. Ensure tables, dialogs, inputs and buttons share the same tokens. This is a visual design system, not software architecture or a replacement for the separately selected UI/UX workflow style. Diagram-specific drawing instructions retain their own requirements, including square boxes when requested.\n\nWORKSPACE VISUAL AMENDMENT — v1\nFor data-heavy applications this amendment supersedes the earlier blanket pale-blue page recommendation: use a near-neutral #F7F9FB canvas and #FFFFFF surfaces; reserve #0369A1 and #E0F2FE for primary actions, focused controls and selected items. Use #0C2840 text, #4B6578 secondary text and #DCE3E8 dividers. Avoid promotional gradients and shadows on ordinary cards. Use 6px control and 8px panel radii, 26px page headings, 14–16px body text, compact tables and 8/16/24px spacing. Keep fluid data areas; constrain prose instead of the whole screen. Verify actual contrast and narrow-screen behavior. Do not apply this palette to a project that has not selected this visual style.\n\nTHREE-COLOR WORKSPACE PALETTE — v1\nWhen this visual style is selected, use three purposeful accents on neutral #F7F9FB and white surfaces: blue #0369A1 / #E0F2FE for primary workspace actions and selection; teal #0F766E / #F0FDFA for agent workflows, Fusion and their navigation; amber #92400E / #FFFBEB for diagnostics and attention states. Teal button hover is #115E59. Keep danger red and success status separate from workflow category colors. This supersedes any single-accent restriction. Apply shared semantic CSS tokens; never tint every panel or distribute colors arbitrarily. Measure text contrast (at least 4.5:1 for ordinary text) and use labels/icons with every color meaning. Do not apply this palette to projects that have not selected this visual style.\nReference: https://www.carbondesignsystem.com/building-blocks/foundations/color/overview",
    "tags": [
      "personal-sky-blue-design-system",
      "design-system",
      "sky-blue",
      "visual-style",
      "color",
      "palette",
      "typography",
      "spacing",
      "tokens",
      "theme"
    ],
    "examples": [
      "A capability list uses a pale sky-blue page, white table and dialog surfaces, dark labels and one blue Add action. Rename and Cancel use secondary styling. Inputs share border and focus tokens. Error messages include explanatory text; verify actual contrast and rendered states."
    ],
    "principles": [
      "Use shared semantic tokens for a calm sky-blue visual identity.",
      "Keep type, spacing, borders and component states consistent.",
      "Verify contrast and communicate state with more than color."
    ],
    "externalSkills": [
      "design-system"
    ],
    "reviewCriteria": [
      "Check that page, surface, text and action colors use shared semantic tokens.",
      "Measure contrast for actual foreground/background pairs and inspect keyboard focus visibility.",
      "Verify consistent typography, spacing and states across tables, dialogs, buttons and inputs.",
      "Inspect narrow and wide layouts for clipping and visual imbalance; report any unperformed visual checks.",
      "Ensure status messages use text or icons in addition to color.",
      "Verify consistent section heading case, label/control gaps, semantic color roles and measured contrast; report unperformed rendered checks."
    ],
    "priority": 90,
    "status": "active",
    "requiredIds": [
      "8c1ecc2b-4dea-4e4b-ac32-171d37d99b36"
    ],
    "checks": [],
    "backend": null,
    "id": "ab8c2a7f-788a-4f34-b892-dbf8abaf5e2b",
    "useWhen": "Use when choosing visual tokens, colors, typography and component states.",
    "requirements": []
  },
  {
    "kind": "preference",
    "domain": "business-analysis-ba",
    "keyId": "business-analysis-clear-requirements-and-traceability",
    "title": "Business analysis — clear requirements and traceability",
    "summary": "Turn stakeholder needs into scoped, testable requirements traced through amendments, implementation and tests, without treating implementation or accepted targets as approval or proof.",
    "content": "Start with the business problem, stakeholders, current workflow, desired outcomes and constraints. Separate needs from proposed solutions. Identify actors, main and exception flows, business rules, data definitions and nonfunctional requirements. Document assumptions and unresolved decisions without inventing stakeholder approval. Write measurable acceptance criteria and trace each requirement to its source and validation method. Record scope exclusions and change impacts. Use the project's writing and drawing styles when producing documents and diagrams.\n\nAMENDMENT-TO-TEST TRACEABILITY — v1\nTrace each requirement from the baseline specification through its explicit amendments to the relevant implementation and a behavioral test. Distinguish the original baseline scope from features enabled later. Implementation is not proof of stakeholder or client approval; keep approval caveats attached to the features they apply to. Treat privacy wording, governance approvals and other items still marked open as unresolved, not approved requirements. Preserve documented scope exclusions unless an explicit amendment changes them.\nModel actors and externally managed responsibilities separately. Describe each access or entry channel separately rather than assuming every user follows the same path or has the same contact data. Cover authorization and tenant/role isolation, the boundary between automated proposals and human approval, privacy of completed or sensitive records, non-enumerating responses where account existence must not leak, and failure/recovery paths. Use scenario-level acceptance criteria for allowed and unknown users, rate or resend limits, session resume, consent, required inputs, edits and completion where relevant.\nFor scale and resilience requirements, accepting a target is not evidence that it is met. Cite dated measured results and keep unmet or unexplained gates open.",
    "tags": [
      "personal-business-analysis-ba",
      "business-analysis-ba",
      "ba",
      "requirements",
      "acceptance",
      "stakeholder",
      "user story",
      "traceability"
    ],
    "examples": [
      "Need: find a capability quickly. Requirement: typing a name filters the registered capability list immediately. Acceptance: matching names appear; clearing the query restores the list; an unmatched query shows a clear empty state. Source: stakeholder request. Pending: confirm whether matching must include aliases.",
      "Given an allowed user without a registered contact address, requesting a code-based sign-in returns a specific refusal and queues no message; a separately issued link establishes a session without the code. Cite the existing behavioral test; keep the per-deployment approval of the link channel as an open caveat.",
      "Scale requirement: cite the accepted throughput and loss-accounting targets, then the dated load report. Where the report shows an unexplained loss or exceeded resource target, mark the gate open rather than satisfied."
    ],
    "principles": [
      "Understand the business need before choosing a solution.",
      "Keep requirements observable, traceable and agreed with stakeholders.",
      "Separate facts, assumptions and unresolved decisions.",
      "Trace current behavior through explicit amendments, source contracts and observable acceptance checks; implementation is not approval."
    ],
    "externalSkills": [],
    "reviewCriteria": [
      "Confirm actors, business outcomes, scope and exclusions are explicit.",
      "Check normal, exception and boundary flows plus relevant nonfunctional requirements.",
      "Verify every requirement has a source and testable acceptance criteria.",
      "Identify ambiguity, contradictions, dependencies and pending approvals.",
      "Check the distinction between original specification, amendments, implementation and pending approvals; cover isolation, approval separation, non-enumeration, optional data and sensitive-state privacy.",
      "Distinguish scale/resilience targets from measured results and keep unmet gates open."
    ],
    "priority": 90,
    "status": "active",
    "requiredIds": [
      "44455f35-9972-4629-8920-b6622c39d8f9",
      "8c1ecc2b-4dea-4e4b-ac32-171d37d99b36",
      "5cbd3ef7-393b-429d-860b-625c7bebbce3"
    ],
    "checks": [],
    "backend": null,
    "id": "5f1b2a1c-b375-4cef-87a0-fce441bcdbd4",
    "useWhen": "Use when analyzing requirements, user needs, acceptance criteria and traceability.",
    "requirements": []
  },
  {
    "kind": "preference",
    "domain": "quality-control-qc",
    "keyId": "quality-control-evidence-based-verification",
    "title": "Quality control — evidence-based verification",
    "summary": "Verify behavior against requirements, report each completion gate separately, and distinguish tested, pending, out-of-scope and historical outcomes.",
    "content": "Read the requirements, acceptance criteria and selected style review rules before testing. Build a risk-based test plan covering normal, boundary, failure and regression paths. Include accessibility and visual inspection when relevant. Record environment, inputs, steps, expected and actual results, and evidence. Report defects with impact, reproducibility and severity rationale. Retest fixes and identify coverage gaps. Never claim a passing automated test proves visual quality, security or complete compliance. Keep checks not performed explicitly pending and use project-private fixtures where required.\n\nMANDATORY DEVELOPMENT AND REVIEW WORKFLOW\nBefore implementation: retrieve the current project-selected styles and required dependencies. Read the full instructions of the relevant implementation skills and the review skill. Identify the backend/UI scope, affected callers, acceptance criteria and required checks. A skill name or retrieved style is not evidence that its instructions were followed.\nDuring implementation: apply the selected rules and skills continuously. Review meaningful changes as they are made, checking validation, data preservation, project isolation, accessibility, interaction and error handling as applicable. Revisit the plan when scope changes; do not postpone all review until the end.\nBefore completion: perform an explicit review of the final change using the applicable review skill and the selected styles' review criteria. For code review, use ponytail:ponytail-review when available. For UI, also use ui-ux-pro-max and the selected design-system skill, and inspect actual rendered behavior when tooling is available. Read the skills before applying them; never claim a skill was used solely because it is listed.\nBackend review: inspect affected callers and data boundaries, test validation and failure paths, verify persistence, migrations, scope isolation and compatibility where affected. UI review: verify the complete user workflow, immediate local search, contextual actions, keyboard/focus behavior, responsive layout, empty/error states and preservation of drafts. Run the relevant build and focused tests after changes.\nResolve material findings and rerun the affected checks after fixes. Record findings, fixes, commands or inspection evidence, and outstanding risks. If a required skill, test environment or visual validator is unavailable, state that limitation and mark the relevant review pending. Do not silently skip the review or report full verification from passing tests alone. A self-review is acceptable unless an independent reviewer is explicitly required; label it honestly.\nCompletion report: summarize what changed, which styles and review skills were applied, what was reviewed and tested, and which checks remain pending. Never invent review results, screenshots, approvals or test evidence.\n\nCOMPLETION GATES AND EXECUTION SCOPE — v1\nUse the project's documented definition of done. Report each required gate separately — for example a zero-warning build, the test suite and contract or schema validation — with the actual command and result. Do not assume CI passed; report CI only from its observed result. Use the project's isolated test fixtures for integration tests unless a documented whole-environment case applies.\nWhen some checks (such as full-stack deployment or end-to-end tests on a shared environment) are outside the agent's permitted execution scope, name them, identify who runs them and mark them pending.\nFor automated-agent or AI features, test that the agent can only perform its permitted role (for example propose-only) and that execute/approve paths are rejected where the project requires approval separation. An existing safety test is a useful example, not a substitute for tests of the affected policy code.\nEvaluate scale and resilience claims against stated targets and dated measured evidence; keep unmet or unexplained gates open. Do not reuse historical test counts or earlier environment results as current evidence.",
    "tags": [
      "personal-quality-control-qc",
      "quality-control-qc",
      "qc",
      "quality",
      "review",
      "test",
      "verification",
      "regression",
      "defect"
    ],
    "examples": [
      "Case: rename a capability to an existing name. Expected: reject the duplicate, preserve the original name and retain the draft with an inline error. Record the actual result and evidence. If browser access is unavailable, mark this interaction not tested rather than inferring success from storage tests.",
      "After adding an API and its form, review the API validation, persistence and scope isolation, then inspect the form's keyboard flow, errors and responsive layout using the applicable skills. Fix findings and rerun affected tests. If browser access is unavailable, report code-review evidence and passing tests while marking visual review pending.",
      "Completion report: build — 0 warnings (command shown); tests — 214 passed, 0 failed; contract validation — passed. End-to-end tests on the shared environment are run by the lead and remain pending."
    ],
    "principles": [
      "Test observable behavior against stated acceptance criteria.",
      "Prioritize risks and reproducible evidence.",
      "Separate pass, fail, blocked, not-tested and out-of-scope outcomes.",
      "Review during development and before completion using the applicable styles, rules and skills.",
      "Report each required gate separately with its actual command and result."
    ],
    "externalSkills": [
      "ponytail:ponytail-review (for backend or UI code review)"
    ],
    "reviewCriteria": [
      "Trace test cases to requirements and style review criteria.",
      "Cover invalid inputs, boundaries, failure recovery and data preservation.",
      "Provide reproducible defect steps, expected/actual results and evidence.",
      "Report exact tests run, remaining risks and checks not performed.",
      "Retest fixes and relevant regressions before closing defects.",
      "Confirm applicable styles, required dependencies and implementation/review skills were read before work.",
      "Review meaningful changes during development against the selected rules and acceptance criteria.",
      "Perform a final skill-guided review of backend and/or UI changes; report whether it was self-review or independent review.",
      "Resolve material findings, rerun affected checks, and provide concrete review and test evidence.",
      "Reject a fully verified completion claim when required review, skills or visual checks are missing; mark those checks pending.",
      "Report build warnings, tests and contract/schema validation separately; mark out-of-scope or other-owner checks pending and keep unmet scale/resilience gates open."
    ],
    "priority": 90,
    "status": "active",
    "requiredIds": [],
    "checks": [],
    "backend": null,
    "id": "8c1ecc2b-4dea-4e4b-ac32-171d37d99b36",
    "useWhen": "Use when verifying implementation, reviewing changes and reporting defects.",
    "requirements": []
  },
  {
    "kind": "preference",
    "domain": "coding",
    "keyId": "development-maintainable-verified-changes",
    "title": "Development — maintainable, verified changes",
    "summary": "Complete changes in the project's existing stack with compatible contracts, respected ownership and continuous review evidence.",
    "content": "Before implementation, read the affected code and callers, project requirements and selected styles. Use the existing stack and helpers. Identify input boundaries, failure paths and acceptance checks. Read relevant implementation and review skills before applying them. During development, review meaningful changes for correctness, data preservation, security boundaries and maintainability. Before completion, perform a final skill-guided review, run the relevant build and focused tests, resolve material findings and rerun affected checks. Report evidence and pending checks honestly. Do not assume TypeScript, a particular framework or a cloud provider.\n\nCONTRACTS, OWNERSHIP AND GENERATED CODE — v1\nChange public contracts (APIs, schemas, events, extension interfaces) backward-compatibly. Update contract definitions and examples before implementation, validate them, and follow the project's versioning rule for changed packages or manifests. Respect declared dependency directions between layers; extensions depend only on public contracts, not platform internals.\nPut operational values (limits, timeouts, debounce intervals) in configuration with safe defaults rather than literals. Use the project's preferred client and protocol abstractions; add no dependency, vendor SDK or abstraction without a concrete benefit.\nRespect declared ownership of files or folders by other agents or teams: report the needed change to the owner instead of editing it. Never hand-edit generated output; regenerate it from source and confirm it matches. Use transactions for related mutations and idempotent migrations that preserve user data; never reseed or overwrite user data to make a screen look populated. Prefer at least one runnable test for non-trivial logic.",
    "tags": [
      "starter-implementation",
      "project-starter",
      "code",
      "implement",
      "debug",
      "refactor",
      "backend",
      "api",
      "typescript"
    ],
    "examples": [
      "For a new API field, update validation, storage, callers and UI together. Test valid and invalid values plus persistence. Review the final change and report the exact checks performed.",
      "Adding an optional field to a public event: update the schema and example first, validate the contract, bump the changed manifest's patch version, then implement producer and consumer. A UI change in another agent's folder is reported to its owner, not edited."
    ],
    "principles": [
      "Reuse the existing project stack and keep changes small but complete.",
      "Preserve data and validate inputs at trust boundaries.",
      "Review during development and before completion.",
      "Keep public contracts compatible and respect declared ownership and generated-code boundaries."
    ],
    "externalSkills": [
      "codebase-memory (for structural code exploration)",
      "ponytail:ponytail-review (for final code review)"
    ],
    "reviewCriteria": [
      "Check affected callers, validation, failure paths and compatibility.",
      "Verify persistence, migrations and isolation where affected.",
      "Run relevant builds and focused behavior tests; resolve findings and repeat affected checks.",
      "State review evidence, remaining risks and unavailable checks.",
      "Verify contract compatibility and validation, version bumps, dependency direction, configuration defaults, ownership boundaries and that generated output matches its source."
    ],
    "priority": 90,
    "status": "active",
    "requiredIds": [
      "5f1b2a1c-b375-4cef-87a0-fce441bcdbd4",
      "8c1ecc2b-4dea-4e4b-ac32-171d37d99b36"
    ],
    "checks": [],
    "backend": null,
    "id": "efd46c42-c1c5-442e-a8de-ab34b4ca6a7c",
    "useWhen": "Use when implementing, debugging or refactoring code and backend APIs.",
    "requirements": []
  },
  {
    "kind": "preference",
    "domain": "design",
    "keyId": "ui-ux-task-centered-interaction",
    "title": "UI/UX — task-centered interaction",
    "summary": "Design complete workflows with progressive disclosure, accessible controls, reuse of existing UI systems, sensitive-flow safeguards and verified control alignment.",
    "content": "Apply when a task affects an interface. Identify the primary user task and one primary action before implementation. Group related actions by workflow and frequency. Design the complete screen before components. Keep frequent controls contextual; place infrequent creation/configuration actions in dialogs or menus. Use immediate local search without a redundant submit button. Avoid disconnected forms, competing primary actions, duplicated headings and excessive whitespace. Use accessible labels, visible focus, keyboard navigation and clear empty/error states. Preserve drafts. Review the rendered workflow on narrow and wide screens when possible; report unavailable visual checks. Select a separate visual design-system style when a color scheme is needed.\n\nRESTRAINED WORKSPACE DESIGN — v1\nBefore choosing components, state the user's primary task, frequent actions and expected data volume. Sketch the complete screen hierarchy: navigation, title/action, contextual toolbar, working content and feedback. Delete a control only after checking its callers, routes and recovery workflow.\nFor data-heavy workspaces use a quiet neutral canvas, readable white surfaces and a single selected accent. Reserve color for actions, selection and meaningful status; do not tint every panel. Typography and alignment establish hierarchy before decoration. Reuse the existing system font. Use 24–28px page titles, 14–16px body text, tabular numbers, a 4/8px spacing scale, 24–32px desktop gutters and 16px mobile gutters. Keep tables fluid and prose near 65–75 characters per line.\nReject repeated marketing eyebrows, slogans, ornamental sparkles, gradient banners, oversized metric cards, decorative shadows and blank side panels. Counts belong beside the relevant list or in a compact summary strip. A border, background or spacing should separate a group; do not stack all three without a reason. Avoid animation or font/library changes whose only purpose is to look less AI-generated.\nKeep one primary action per screen. Put search, filters and view controls together; local filtering is immediate and preserves focus. Keep explicit labels on primary actions and ambiguous controls. Repeated row actions may use consistent icons with accessible names and hover/focus tooltips, 36px desktop targets and 8px gaps; use 44px touch targets. Infrequent diagnostics belong under clearly named secondary navigation, not in the primary task path. Do not remove capabilities merely because their implementation is old.\nUse progressive disclosure for details, installation evidence and setup help. Show what a result means and what the user can do next. An installed skill is not proof it was read; an agent-reported pass is not independently verified. Graphs start with styles and allow details on demand; never force all review text into the initial canvas.\nBefore accepting a design, inspect a real rendered screen at desktop and narrow widths with long labels, empty data and errors. Exercise keyboard focus, search, pagination, refresh/back navigation, dialogs and unsaved edits. Record evidence and unperformed checks. Do not claim visual acceptance from a build or unit tests alone.\nReferences: https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines ; https://www.nngroup.com/articles/progressive-disclosure/\nThis interaction guidance does not impose a palette on other projects. A separately selected visual style controls colors.\n\nWORKSPACE NAVIGATION AND CONSOLIDATION — v1\nUse short, concrete navigation names such as Capabilities. Keep a consistent small SVG icon beside each visible menu label; do not use icons alone for primary navigation. Put project scope before agent/detail filters in activity and diagnostic screens, preserve filters in URLs where navigation depends on them, and keep displayed counts explicit about their scope. Use compact summary strips, fluid data tables and progressive disclosure for evidence explanations and synthetic demos. Keep configuration, history and diagnostics accessible without competing with primary workspace tasks.\nFor agent-assisted consolidation, show selected inputs, destination and data sent before starting. Present current versus proposed instructions, source versions, conflicts and rationale. Publish as an explicit new version only after review; reject stale evidence and unresolved conflicts. Never silently rewrite project-private records or infer that frequent retrieval proves a style worked.\nReferences: https://www.nngroup.com/articles/icon-usability/ ; https://www.nngroup.com/articles/progressive-disclosure/ ; https://www.carbondesignsystem.com/building-blocks/core/patterns/filtering\n\nTHREE-COLOR WORKSPACE PALETTE — v1\nSupport multiple role-based accents defined by the selected visual system; this supersedes the earlier single-accent restriction without imposing this project palette on other projects. Keep sidebar section headings consistently uppercase, including DIAGNOSTICS. Inline field labels and controls require an explicit 12px layout gap, not literal spaces; allow wrapping at narrow widths.\nReference: https://www.carbondesignsystem.com/building-blocks/foundations/color/overview\n\nEXISTING UI SYSTEMS AND SEARCH — v1\nPreserve an approved UX and reuse the project's existing component kit, design tokens, brand assets and font stacks; do not introduce a replacement component framework. Where the UI is composed from independently shipped parts, follow the host's mount, dictionary-registration and shared pagination contracts, and treat breaking shared-kit changes as host contract changes. Immediate filtering applies to already-loaded data; remote search may use a configurable debounce rather than fetching on every keystroke. Leave shell or folders owned by other agents to their owners and report needed integration.\n\nSENSITIVE, AUTHENTICATION AND MULTILINGUAL FLOWS — v1\nDesign the whole journey, including entry, sign-in, consent, progress, review/edit and completion. Keep authentication notices outside conversational or content frames. When a resend of a one-time code is refused, keep the existing challenge usable and show the server's retry interval. Resume saved progress through the server session, not browser-stored answers or tokens; keep link tokens in memory and mask sensitive values. Gate analytics on explicit consent, exclude content and identity, and keep it off in administrative views where required. Preserve drafts during recoverable interactions without promising that unsent text survives a reload. For multilingual and right-to-left interfaces, verify each language and direction, keyboard/focus, dark mode, reduced motion and 44px targets, using exact authored labels and the project's register for each language.\n\nBUTTON ALIGNMENT AND ACTION SPACING — v1\nStyle buttons and links used as buttons consistently with inline-flex, centered alignment, explicit line-height and balanced padding. Audit inherited minimum heights: compact 36px icon controls must explicitly override larger shared minimums. Use 8px gaps between row actions and 16px separation between filter toolbars and tables; never pack adjacent buttons together. Keep visible text on scope filters and primary actions where an icon alone is ambiguous, and confirm destructive actions. Verify computed styles and the rendered page at narrow and wide widths; unit tests do not verify spacing.\n\nFLUID WORKSPACE LAYOUT — v1\nUse the full available content width for workspaces, setup wizards, search toolbars and card grids, with consistent page gutters. Remove inherited fixed max-width constraints that leave an unused right-hand area. Constrain long prose for readability instead of constraining the entire form or working surface. Use responsive auto-fit card columns with usable minimum widths; collapse to a single column on narrow screens without horizontal overflow. Align search, selection controls, cards and footer actions. Verify wide and narrow layouts, long labels and expanded customizations; builds alone do not prove rendered correctness.\n\nFILTER SIZING AND AUDIT DISCLOSURE — v1\nDesign filter toolbars as a complete group. Size controls for expected values: keep short category, agent and channel selectors compact; give project names and style names more room; put long session IDs and similar identifiers in a wide field or separate row. Let search absorb remaining width without shrinking other controls below usable sizes. Use associated labels above multi-field filters, consistent control heights, 12–16px gaps and aligned baselines. Wrap to fewer columns before values become cramped; use full-width controls on small screens and never cause horizontal page overflow. Apply the same sizing rules across Library, Projects, capabilities, activity and diagnostics. Preserve filter state, keyboard focus and immediate local filtering.\nKeep historical audit reports secondary and collapsed when they are not the primary task. Explain what triggers a report, what inputs were checked, how to interpret its result and why a user would inspect it. Never present an old or agent-reported check as current verified project health.\n\nUSEFUL UI CONTENT — v1\nKeep interface text only when it helps the user choose, act, recover from an error or interpret the current result. Remove generic AI-written explanations, educational frameworks, repeated disclaimers, decorative slogans and descriptions that restate headings. Put necessary technical reference in contextual help or documentation instead of repeating it in every row or page. Use short concrete labels and action-specific guidance. Preserve essential consent, destructive-action consequences, scope, unsaved-state and error-recovery information where the decision occurs. Review every page for redundant content; do not remove user-authored style guidelines or actual audit evidence as part of interface cleanup.\n\nCOMBINED UI/UX SKILLS — v1\nUse ui-ux-pro-max together with design-taste-frontend (Taste Skill, https://github.com/Leonxlnx/taste-skill) for substantive interface design and review. Read both skills before work and record the chosen installation when copies conflict.\nStart with ui-ux-pro-max to define the user task, information hierarchy, interaction states, accessibility, responsive behavior and stack constraints. Use Taste Skill to develop coherent visual composition and inspect the rendered result. Produce one design that satisfies both; do not create competing palettes or layouts.\nClassify the work as a public-facing page or an app screen. For dashboards, settings, editors and other working interfaces, use an app-capable Taste Skill version (v2.1 or later), read references/app-screens.md and use its app workflow. Do not apply landing-page rules to application screens. If the installed copy excludes apps or lacks the referenced files, report the version limitation rather than claiming that workflow ran.\nExplicit user requirements, accessibility, established project components and selected design-system tokens take precedence over generated visual defaults. Preserve established palette and typography when choosing a direction; adapt composition to real content, not invented data or decorative sections. Use ui-ux-pro-max to validate Taste Skill's choices against usable controls, keyboard/focus behavior, contrast, motion preferences and error recovery.\nReview the implemented workflow with ui-ux-pro-max and perform Taste Skill's applicable browser inspection and screenshot fix loop at desktop and narrow widths. Record which checks ran and which remain pending. Missing tools or conflicting installations are not a passing review.\nFresh installation seeds these skill references and collaboration rules, not the external skill packages. Install the named skills separately; do not claim they are available merely because this style references them.",
    "tags": [
      "starter-ux",
      "project-starter",
      "ui",
      "ux",
      "layout",
      "form",
      "navigation",
      "accessibility",
      "dashboard"
    ],
    "examples": [
      "A capability list uses immediate search and row-level Rename. Add opens a dialog from the header. Saving reports success; errors preserve input. Inspect the full workflow before marking visual review complete.",
      "Project list: a short title and one New project action, an immediate search field, a compact table with readable names and contextual icon actions. Show counts beside the list. Keep setup help inside the project.",
      "A refused code resend keeps the existing challenge visible and shows the server's retry interval; verify each supported language and layout direction, keyboard access and the subsequent successful sign-in.",
      "A scope-filter link with a 44px minimum height and top-aligned text is incorrect. Center its contents with inline-flex and give compact filters explicit height/padding; a 36px icon action must override the shared 44px minimum."
    ],
    "principles": [
      "Design around tasks, not individual features.",
      "Use progressive disclosure and one primary action per screen.",
      "Require accessible, complete interactions and honest review evidence.",
      "Extend the existing component kit and tokens; keep sensitive state server-owned and consent explicit."
    ],
    "externalSkills": [
      "ui-ux-pro-max",
      "design-taste-frontend"
    ],
    "reviewCriteria": [
      "Reject disconnected controls, competing primary actions or permanent infrequent forms.",
      "Verify immediate search, pagination, empty states and draft preservation.",
      "Check keyboard/focus behavior, labels, contrast and narrow/wide layouts.",
      "Review the complete workflow; functional tests alone do not prove usability.",
      "Reject decorative dashboard chrome, oversized statistics and competing actions; verify real workflow evidence at desktop and narrow widths.",
      "Verify labeled navigation icons, project-scoped filters and counts, and inspect current/proposed style changes before publication.",
      "Verify consistent section heading case, label/control gaps, semantic color roles and measured contrast; report unperformed rendered checks.",
      "Check reuse of the existing component kit, tokens and host contracts; verify remote-search debounce is configurable and ownership boundaries are respected.",
      "Where applicable, check multilingual/RTL layouts, recovery and resume via server session, consent gating, sensitive-value masking and that unsent-draft persistence is not overpromised.",
      "Verify centered button content, overridden inherited min-heights, 8px action gaps and 16px toolbar/table spacing in the rendered UI.",
      "Verify fluid workspace width, consistent gutters, responsive card columns and absence of narrow-screen overflow; inspect inherited max-width rules.",
      "Verify filter widths against real long names and session IDs, compact short selectors, aligned labels, 12–16px gaps and responsive wrapping across every filter toolbar.",
      "Verify audit history states its trigger, purpose, inputs and result limits, and remains secondary to the primary task.",
      "For each visible paragraph, identify the user decision, action, recovery or result it supports; remove redundant UI prose while preserving user data and essential action-specific guidance.",
      "Verify ui-ux-pro-max and design-taste-frontend were used together with the correct page/app workflow, preserved project tokens, accessibility checks and actual rendered evidence; disclose missing or outdated installations."
    ],
    "priority": 90,
    "status": "active",
    "requiredIds": [
      "8c1ecc2b-4dea-4e4b-ac32-171d37d99b36",
      "5f1b2a1c-b375-4cef-87a0-fce441bcdbd4",
      "5cbd3ef7-393b-429d-860b-625c7bebbce3"
    ],
    "checks": [],
    "backend": null,
    "id": "c1d2818e-a511-4b1c-ab6f-9e9e2a79925f",
    "useWhen": "Use when creating or changing interfaces, forms, navigation and accessible user workflows.",
    "requirements": []
  },
  {
    "kind": "preference",
    "domain": "diagrams",
    "keyId": "drawing-clear-architecture-flows-and-data-models",
    "title": "Drawing — clear architecture, flows and data models",
    "summary": "Consistent, readable diagrams with editable sources, current-state evidence, labelled deployment profiles and evidence-based review.",
    "content": "Choose the diagram type from the reader's task: architecture for boundaries and responsibilities; flowchart for decisions and process; sequence for ordered interactions; ERD for entities and relationships; class or state views when those semantics matter. State scope and abstraction level. Use separate linked views for context, containers, deployment and data rather than one crowded drawing. Preserve supplied facts and label assumptions.\n\nUse clear square-corner boxes, concise labels, deliberate alignment and spacing. Use labelled directional arrows for actual flows and relations; minimize crossings and do not route through nodes. Include a legend explaining colors, line styles, symbols and arrow meanings. Use a small consistent palette with readable contrast; never use color alone. Preserve conventional semantic shapes where required, such as decision diamonds and ER cardinality notation.\n\nArchitecture: distinguish system, network and trust boundaries; label significant protocols and synchronous/asynchronous interactions when known. Use the project's selected technologies; drawing rules do not mandate Azure. Show official Azure, GCP or other cloud icons only for actual selected services and only from available verified icon libraries. Generic labelled boxes are the fallback.\n\nERD: distinguish conceptual, logical and physical models. Show entity names, primary/foreign keys when known, cardinality and optionality. Include attributes and types appropriate to the chosen level. Represent many-to-many relationships with an associative entity in a physical schema. Never invent constraints or infer one-to-one cardinality without evidence. Sequence: identify participants, ordered messages, responses and important alternative/error paths.\n\nDeliver editable source in the requested format. Review the diagram against source requirements and inspect a rendered view when tooling is available. Report syntax checks, rendering and semantic review separately; never claim a render or correctness check that was not performed.\n\nVISUAL ARCHITECTURE COMPOSITION — v1\nCommunicate architecture through structure, not paragraph-filled boxes. Keep necessary text: a concise service/entity name, a short responsibility where useful, and meaningful edge labels. Longer explanatory prose belongs in notes or linked documentation. The legend explains notation only; it is not a deployment guide.\nBefore drawing, translate each architectural fact into its appropriate visual form: services and actors into nodes; ownership, system, trust and network membership into separately labelled containers; interactions into directed connectors; known properties into short badges or labels. Use conventional notation for ER keys/cardinality and sequence alternatives. Do not convert every sentence into another box: show only facts relevant to the view's question. Never invent relationships to make the picture look complete.\nReplace text-only platform-services inventories with actual service nodes and relevant connections in a focused supporting-services view. For example, show Key Vault, App Configuration, Application Insights and Log Analytics separately when present in the evidence; connect the actual consumers and telemetry destinations only when verified. Do not substitute a paragraph saying dependency arrows are omitted for a requested dependency view.\nShow deployment and network detail in a dedicated view when it would crowd the application flow. Distinguish resource-group ownership from VNet/subnet boundaries. Place managed services according to verified deployment semantics; represent private endpoints and their connections explicitly instead of implying that every PaaS service runs inside a subnet. Keep unverified network and identity claims in clearly marked notes.\nChoose one main reading direction and align related nodes. Keep concise labels outside connector intersections. Split application flow, deployment/network, identity and operations into linked pages only when needed. Draw.io pages/layers or Mermaid subgraphs must clarify the reader's task, not hide mandatory content: every requested exported view must remain understandable with its title, scope and legend. Use native editable shapes/connectors and verified icons; do not replace the architecture with a flattened image. Preserve the selected project's palette and do not infer a cloud provider from drawing preferences.\nReview at the intended reading size. Reject walls of text masquerading as services, mixed abstraction levels, unlabeled arrows, invented connections, ambiguous containers, and legends containing implementation essays. Check that important facts moved out of prose remain represented accurately. Distinguish source/semantic checks from actual rendered visual inspection.\nReferences: https://c4model.com/diagrams/notation ; https://c4model.com/diagrams ; https://www.drawio.com/docs/manual/layers/how-layers-work/\n\nCURRENT-STATE EVIDENCE AND PROFILES — v1\nExisting repository diagrams are useful formats, not current authority. Before reusing one, reconcile its arrows, notes and storage claims with current code, contracts, migrations and decision amendments. Retain an existing focused structure (for example separate sequences per flow) rather than merging all flows into one.\nDraw physical ERDs from actual migrations and nullable contracts, not from an original baseline model. Show amended optionality explicitly.\nLabel each deployment view with its deployment profile or environment and evidence date. Never blend components from different profiles (for example a pilot stand-in and a client-hosted equivalent) into one asserted deployment. Distinguish single-node development from proposed production high availability. Historical components no longer in the baseline must not appear as current.\nShow ownership and authority explicitly: which component owns durable truth, which enforces policy, which is delivery-only, and which outputs are untrusted. Draw notifications after persistence when that is the actual order and label them as delivery hints, not the authoritative store. Label documented side channels (realtime or consented analytics connections) so that a general rule such as 'the client only calls the gateway' is not drawn as a false prohibition.\nLabel design targets and guarantees separately from observed deployment or test status. Keep real tokens, answers and personal identifiers out of diagrams.",
    "tags": [
      "shared-drawing-standard",
      "drawing",
      "diagram",
      "architecture",
      "flowchart",
      "sequence",
      "erd",
      "entity relationship",
      "data model",
      "uml",
      "deployment"
    ],
    "useWhen": "Creating or revising architecture diagrams, flowcharts, sequence diagrams, ERDs, data models, UML or deployment views in draw.io or Mermaid.",
    "examples": [
      "Architecture: Client → API → Database, with each arrow labelled by the known interaction, a clear application boundary and a legend. Add deployment and trust-boundary detail in a separate view when the reader needs it.",
      "ERD: CUSTOMER has zero or many ORDER records; each ORDER belongs to exactly one CUSTOMER. Show CUSTOMER.id as PK and ORDER.customer_id as FK only if the schema confirms those constraints.",
      "Sequence: Client sends a request to API; API validates it, queries storage and responds. Include the invalid-request branch if it is relevant to the task.",
      "Replace a platform-services paragraph with verified configuration, secrets and telemetry nodes in a supporting-services view. Move detailed subnet/private-endpoint topology to a deployment page; retain short service and protocol labels in the main flow.",
      "A consented analytics connection is drawn separately from Client → Gateway → Core → Database; a realtime update is labelled as a delivery hint after persistence, not the authoritative store.",
      "A deployment page titled with its profile and evidence date shows the actual edge, mail and model services for that profile only; the alternative profile is a separate page."
    ],
    "principles": [
      "Choose a diagram by the question it answers.",
      "Keep views focused and preserve semantic notation.",
      "Use square boxes, labelled arrows, consistent colors and a legend.",
      "Deliver editable source and report verification evidence.",
      "Visualize architectural facts as nodes, boundaries and relationships; reserve prose for notes and keep labels concise.",
      "Draw current, evidenced state; label profiles, targets and historical views explicitly."
    ],
    "externalSkills": [],
    "reviewCriteria": [
      "Confirm the view answers the reader's question at one clear abstraction level.",
      "Trace entities, services and interactions to requirements or source; label assumptions.",
      "Inspect labels, spacing, crossings, legend and contrast at the intended reading size.",
      "Verify arrow direction and meaning; verify ERD cardinality, optionality and keys against the schema.",
      "Confirm editable source is supplied and distinguish static checks from actual rendering and semantic verification.",
      "Reject paragraph-filled architecture boxes and text inventories used instead of requested relationships; verify that the visual model preserves the source facts and distinguishes ownership from network boundaries.",
      "Check reused diagrams against current code, migrations and amendments; verify ownership/authority, persistence-before-notification, labelled profile and date, and separation of design targets from verified runtime state."
    ],
    "priority": 90,
    "status": "active",
    "requiredIds": [],
    "checks": [],
    "backend": null,
    "id": "1ffa06e8-d8e2-42fa-a43b-b5ae21d9ac0d",
    "requirements": []
  },
  {
    "kind": "preference",
    "domain": "drawio",
    "keyId": "draw-io-editable-architecture-flow-and-er-diagrams",
    "title": "Draw.io — editable architecture, flow and ER diagrams",
    "summary": "Native .drawio diagrams with square boxes, labelled connectors, cloud icons and a clear legend.",
    "content": "Read the shared drawing standard and the drawio-skill instructions before authoring. Deliver native editable .drawio XML, not a screenshot-only result. Use stable cell IDs, actual shapes and editable connectors. Use rounded=0 for ordinary boxes and containers; retain standard decision and ER notation. Prefer orthogonal connectors with explicit endpoints, arrowheads and labels; keep routes away from text and avoid overlaps.\n\nUse verified draw.io shape libraries for official Azure, GCP and other cloud icons appropriate to the selected platform. Inspect the available icon definitions rather than guessing shape identifiers. Keep a visible legend and consistent color meanings. A cloud icon preference is not a technology-selection requirement.\n\nUse separate pages for large architecture, sequence and ER views. For ERDs, use readable entity tables with key markers, attribute types where known and clear crow's-foot cardinality/optionality. Preserve existing IDs, links and annotations during edits.\n\nCheck XML structure and connector references. Open or render with available draw.io tools and inspect clipping, arrows, legend and text readability. If rendering is unavailable, deliver the editable source and explicitly mark visual verification pending. Supply SVG/PNG/PDF only when requested; retain the .drawio source alongside exports.\n\nVISUAL ARCHITECTURE COMPOSITION — v1\nCommunicate architecture through structure, not paragraph-filled boxes. Keep necessary text: a concise service/entity name, a short responsibility where useful, and meaningful edge labels. Longer explanatory prose belongs in notes or linked documentation. The legend explains notation only; it is not a deployment guide.\nBefore drawing, translate each architectural fact into its appropriate visual form: services and actors into nodes; ownership, system, trust and network membership into separately labelled containers; interactions into directed connectors; known properties into short badges or labels. Use conventional notation for ER keys/cardinality and sequence alternatives. Do not convert every sentence into another box: show only facts relevant to the view's question. Never invent relationships to make the picture look complete.\nReplace text-only platform-services inventories with actual service nodes and relevant connections in a focused supporting-services view. For example, show Key Vault, App Configuration, Application Insights and Log Analytics separately when present in the evidence; connect the actual consumers and telemetry destinations only when verified. Do not substitute a paragraph saying dependency arrows are omitted for a requested dependency view.\nShow deployment and network detail in a dedicated view when it would crowd the application flow. Distinguish resource-group ownership from VNet/subnet boundaries. Place managed services according to verified deployment semantics; represent private endpoints and their connections explicitly instead of implying that every PaaS service runs inside a subnet. Keep unverified network and identity claims in clearly marked notes.\nChoose one main reading direction and align related nodes. Keep concise labels outside connector intersections. Split application flow, deployment/network, identity and operations into linked pages only when needed. Draw.io pages/layers or Mermaid subgraphs must clarify the reader's task, not hide mandatory content: every requested exported view must remain understandable with its title, scope and legend. Use native editable shapes/connectors and verified icons; do not replace the architecture with a flattened image. Preserve the selected project's palette and do not infer a cloud provider from drawing preferences.\nReview at the intended reading size. Reject walls of text masquerading as services, mixed abstraction levels, unlabeled arrows, invented connections, ambiguous containers, and legends containing implementation essays. Check that important facts moved out of prose remain represented accurately. Distinguish source/semantic checks from actual rendered visual inspection.\nReferences: https://c4model.com/diagrams/notation ; https://c4model.com/diagrams ; https://www.drawio.com/docs/manual/layers/how-layers-work/",
    "tags": [
      "shared-drawing-drawio",
      "drawio",
      "draw.io",
      "diagrams.net",
      "architecture",
      "diagram",
      "erd",
      "flowchart",
      "sequence",
      "cloud",
      "azure",
      "gcp"
    ],
    "useWhen": "A task requests draw.io, diagrams.net, editable XML, precise diagram layout, cloud architecture icons, flowcharts, UML or ERDs.",
    "examples": [
      "Create system.drawio with Context, Deployment and Data model pages. The deployment page uses verified Azure or GCP icons only where those services are in the requirements; all pages include a legend.",
      "For a physical order schema, create CUSTOMER and ORDER entity tables with PK/FK markers and a labelled crow's-foot relationship, then verify the relationship against the supplied schema.",
      "Replace a platform-services paragraph with verified configuration, secrets and telemetry nodes in a supporting-services view. Move detailed subnet/private-endpoint topology to a deployment page; retain short service and protocol labels in the main flow."
    ],
    "principles": [
      "Native editable XML is the primary artifact.",
      "Use verified cloud icons and square-corner boxes.",
      "Review actual connector routes and label placement.",
      "Visualize architectural facts as nodes, boundaries and relationships; reserve prose for notes and keep labels concise."
    ],
    "externalSkills": [
      "drawio-skill"
    ],
    "reviewCriteria": [
      "Verify the file opens as editable native draw.io shapes and connectors.",
      "Check ordinary boxes use square corners and every connector references the intended nodes.",
      "Check official icon identifiers exist and match the actual provider/service.",
      "Inspect every page and requested export for clipping, crossings, missing legends and readable text.",
      "Reject paragraph-filled architecture boxes and text inventories used instead of requested relationships; verify that the visual model preserves the source facts and distinguishes ownership from network boundaries."
    ],
    "priority": 90,
    "status": "active",
    "requiredIds": [
      "1ffa06e8-d8e2-42fa-a43b-b5ae21d9ac0d"
    ],
    "checks": [],
    "backend": null,
    "id": "e3bf54b1-7504-4562-a04b-f0060522fb90",
    "requirements": []
  },
  {
    "kind": "preference",
    "domain": "mermaid",
    "keyId": "mermaid-architecture-sequence-flow-and-er-diagrams-as-code",
    "title": "Mermaid — architecture, sequence, flow and ER diagrams as code",
    "summary": "Portable, version-controlled Mermaid source with clear semantics, concise labels and explicit validation evidence.",
    "content": "Read the shared drawing standard and the Mermaid diagram skill before authoring. Deliver editable .mmd source or a mermaid fenced block in the requested document. Choose flowchart for portable architecture and process views, sequenceDiagram for interactions, erDiagram for entities/relationships, and class/state diagrams only when their semantics fit. Use stable ASCII IDs and concise quoted labels where appropriate. Preserve surrounding Markdown and unrelated diagram blocks when editing.\n\nUse rectangular flowchart nodes for ordinary components, labelled links, small logical subgraphs for boundaries and a compact legend in the diagram or adjacent text. Apply a consistent accessible palette only with syntax supported by the target renderer. Keep conventional ER and sequence notation rather than forcing every diagram into boxes and arrows.\n\nERDs must show cardinality and optionality deliberately; include PK/FK/UK and attribute types only when supported by the target renderer and justified by the schema. Sequence diagrams should show participants, message direction and relevant alternatives/errors. Split dense diagrams into focused views.\n\nPrefer portable syntax. Do not assume cloud-icon packs, external resources, HTML labels or unsafe directives are available. If official cloud icons or exact geometry are required, use the draw.io style when the user allows that format; otherwise use labelled components and explain the limitation.\n\nRun the available skill's static checks, and render with the actual target host/runtime when available. Static lint and structural previews do not prove host rendering or semantic correctness. Report the checks performed and any unverified rendering; do not install tools merely to claim validation without authorization.\n\nVISUAL ARCHITECTURE COMPOSITION — v1\nCommunicate architecture through structure, not paragraph-filled boxes. Keep necessary text: a concise service/entity name, a short responsibility where useful, and meaningful edge labels. Longer explanatory prose belongs in notes or linked documentation. The legend explains notation only; it is not a deployment guide.\nBefore drawing, translate each architectural fact into its appropriate visual form: services and actors into nodes; ownership, system, trust and network membership into separately labelled containers; interactions into directed connectors; known properties into short badges or labels. Use conventional notation for ER keys/cardinality and sequence alternatives. Do not convert every sentence into another box: show only facts relevant to the view's question. Never invent relationships to make the picture look complete.\nReplace text-only platform-services inventories with actual service nodes and relevant connections in a focused supporting-services view. For example, show Key Vault, App Configuration, Application Insights and Log Analytics separately when present in the evidence; connect the actual consumers and telemetry destinations only when verified. Do not substitute a paragraph saying dependency arrows are omitted for a requested dependency view.\nShow deployment and network detail in a dedicated view when it would crowd the application flow. Distinguish resource-group ownership from VNet/subnet boundaries. Place managed services according to verified deployment semantics; represent private endpoints and their connections explicitly instead of implying that every PaaS service runs inside a subnet. Keep unverified network and identity claims in clearly marked notes.\nChoose one main reading direction and align related nodes. Keep concise labels outside connector intersections. Split application flow, deployment/network, identity and operations into linked pages only when needed. Draw.io pages/layers or Mermaid subgraphs must clarify the reader's task, not hide mandatory content: every requested exported view must remain understandable with its title, scope and legend. Use native editable shapes/connectors and verified icons; do not replace the architecture with a flattened image. Preserve the selected project's palette and do not infer a cloud provider from drawing preferences.\nReview at the intended reading size. Reject walls of text masquerading as services, mixed abstraction levels, unlabeled arrows, invented connections, ambiguous containers, and legends containing implementation essays. Check that important facts moved out of prose remain represented accurately. Distinguish source/semantic checks from actual rendered visual inspection.\nReferences: https://c4model.com/diagrams/notation ; https://c4model.com/diagrams ; https://www.drawio.com/docs/manual/layers/how-layers-work/",
    "tags": [
      "shared-drawing-mermaid",
      "mermaid",
      "mmd",
      "markdown",
      "diagram",
      "architecture",
      "flowchart",
      "sequence",
      "erd",
      "erDiagram",
      "classDiagram",
      "stateDiagram"
    ],
    "useWhen": "A task requests Mermaid, .mmd, Markdown diagrams, flowcharts, sequence diagrams, ERDs, class/state diagrams or a diagram maintained in Git.",
    "examples": [
      "Architecture flow: use flowchart LR with Client -->|HTTPS request| API and API -->|Query| Database. Use rectangular component nodes and an adjacent legend explaining that arrows represent request/data flow.",
      "Order ERD: use erDiagram with CUSTOMER ||--o{ ORDER : places. Show CUSTOMER.id as PK and ORDER.customer_id as FK when confirmed by the schema. Explain that each order has one customer and a customer may have zero or many orders.",
      "Replace a platform-services paragraph with verified configuration, secrets and telemetry nodes in a supporting-services view. Move detailed subnet/private-endpoint topology to a deployment page; retain short service and protocol labels in the main flow."
    ],
    "principles": [
      "Keep source portable, editable and easy to review in Git.",
      "Use the diagram family that matches the semantics.",
      "Separate static lint, rendering and semantic review.",
      "Visualize architectural facts as nodes, boundaries and relationships; reserve prose for notes and keep labels concise."
    ],
    "externalSkills": [
      "mermaid-diagrams:mermaid-diagrams"
    ],
    "reviewCriteria": [
      "Check the source uses the correct diagram family and stable, unambiguous IDs.",
      "Verify labels, relationships, cardinality and optionality against requirements.",
      "Validate syntax with available tools and inspect the target renderer when possible.",
      "Confirm unrelated Markdown is preserved and no unsupported icons or unsafe external resources were introduced.",
      "Reject paragraph-filled architecture boxes and text inventories used instead of requested relationships; verify that the visual model preserves the source facts and distinguishes ownership from network boundaries."
    ],
    "priority": 90,
    "status": "active",
    "requiredIds": [
      "1ffa06e8-d8e2-42fa-a43b-b5ae21d9ac0d"
    ],
    "checks": [],
    "backend": null,
    "id": "4d38602f-9309-4094-8427-11460382179e",
    "requirements": []
  },
  {
    "kind": "preference",
    "domain": "network-architecture",
    "keyId": "network-architecture-topology-boundaries-and-traffic-flows",
    "title": "Network architecture — topology, boundaries and traffic flows",
    "summary": "Editable network views with explicit environments, network boundaries, verified service icons and traceable traffic paths.",
    "content": "Apply only to network architecture tasks. Deliver native editable .drawio with real nodes and connectors unless the user explicitly requests another format. Read drawio-skill before authoring. Use verified provider icons with nearby service names; preserve official icon geometry. Use neutral icons for vendor-neutral components. This style does not select Azure, mandate hub-and-spoke, or impose an application UI palette.\n\nCompose the overview like the supplied reference: external users, sites and third parties at the edge; shared connectivity services together; environment or region groups arranged consistently; repeated workload blocks aligned with the same internal order. Use square containers, restrained category colors, short labels and a notation legend. Preserve logical grouping without copying the reference's tiny text, dense crossings, resource names, addresses or topology into unrelated projects.\n\nDeclare whether each view is logical topology, physical connectivity or deployment, and identify environment, region, scope and evidence date. Use an overview for cross-environment relationships and separate readable detail pages for each environment or complex traffic path. Do not combine physical links, application messages and policy rules under one unexplained arrow style. C4 deployment conventions and provider reference architectures guide the notation; do not claim certification against a universal diagram standard.\n\nDistinguish administrative ownership (tenant/account/subscription/resource group), network containment (VNet/VPC/subnet), availability zones and trust/security boundaries. These are different relationships: do not force them into a false nesting tree. Show actual CIDRs, VLANs and network identifiers only when known and appropriate to the detail level. Verify subnet containment and overlaps from configuration; label unknowns rather than guessing. Separate production and nonproduction clearly without implying isolation solely from their position or color.\n\nRepresent routers, gateways, firewalls, WAFs, load balancers, VPN/ExpressRoute or equivalent links, peering, DNS/resolvers, NAT/egress and private endpoints where relevant and evidenced. Trace north-south and east-west paths through their actual controls. Distinguish a private endpoint from outbound service network integration and from the managed service itself. Do not place PaaS inside a subnet merely because it has private access. For Azure, peering is not transitive; never imply spoke reachability or firewall inspection without the routing configuration to support it. Show DNS resolution and return paths in detail views when material to connectivity.\n\nLabel traffic edges with purpose plus protocol/port when verified. Define whether arrows indicate traffic initiation, message direction or bidirectional connectivity. Use distinct labelled notation for peering, private links, data paths and management/telemetry. Avoid crossing nodes and avoid giant all-to-all connector meshes. Give complex flows stable IDs linking to a compact source/destination/protocol/port/purpose/control/evidence matrix. The matrix supplements visible topology; it does not replace it. Unknown ports or allow rules stay pending. Do not imply that drawn connectivity is permitted, deployed or tested.\n\nShow shared security, identity and observability services as nodes in the appropriate view. Keep only concise labels and key properties on nodes; longer assumptions and explanations go in notes or linked documents. Include a legend for boundary types, symbols and edge meanings. Use pages/layers for detail, and ensure every requested exported page is understandable independently. For failover, redundant paths and security controls, distinguish verified current state from proposed design.\n\nBefore delivery validate native XML and connector references, compare topology and traffic rules with the supplied source, and inspect every rendered page at its intended reading size. Check icon rendering, labels, crossings, boundaries and legends. Report structural, semantic and visual verification separately; unavailable rendering or connectivity validation remains Not verified.\n\nReferences:\nhttps://c4model.com/diagrams/deployment\nhttps://c4model.com/diagrams/notation\nhttps://learn.microsoft.com/en-us/azure/architecture/networking/architecture/hub-spoke\nhttps://learn.microsoft.com/en-us/azure/architecture/icons/\n\nVISUAL ARCHITECTURE COMPOSITION — v1\nCommunicate architecture through structure, not paragraph-filled boxes. Keep necessary text: a concise service/entity name, a short responsibility where useful, and meaningful edge labels. Longer explanatory prose belongs in notes or linked documentation. The legend explains notation only; it is not a deployment guide.\nBefore drawing, translate each architectural fact into its appropriate visual form: services and actors into nodes; ownership, system, trust and network membership into separately labelled containers; interactions into directed connectors; known properties into short badges or labels. Use conventional notation for ER keys/cardinality and sequence alternatives. Do not convert every sentence into another box: show only facts relevant to the view's question. Never invent relationships to make the picture look complete.\nReplace text-only platform-services inventories with actual service nodes and relevant connections in a focused supporting-services view. For example, show Key Vault, App Configuration, Application Insights and Log Analytics separately when present in the evidence; connect the actual consumers and telemetry destinations only when verified. Do not substitute a paragraph saying dependency arrows are omitted for a requested dependency view.\nShow deployment and network detail in a dedicated view when it would crowd the application flow. Distinguish resource-group ownership from VNet/subnet boundaries. Place managed services according to verified deployment semantics; represent private endpoints and their connections explicitly instead of implying that every PaaS service runs inside a subnet. Keep unverified network and identity claims in clearly marked notes.\nChoose one main reading direction and align related nodes. Keep concise labels outside connector intersections. Split application flow, deployment/network, identity and operations into linked pages only when needed. Draw.io pages/layers or Mermaid subgraphs must clarify the reader's task, not hide mandatory content: every requested exported view must remain understandable with its title, scope and legend. Use native editable shapes/connectors and verified icons; do not replace the architecture with a flattened image. Preserve the selected project's palette and do not infer a cloud provider from drawing preferences.\nReview at the intended reading size. Reject walls of text masquerading as services, mixed abstraction levels, unlabeled arrows, invented connections, ambiguous containers, and legends containing implementation essays. Check that important facts moved out of prose remain represented accurately. Distinguish source/semantic checks from actual rendered visual inspection.\nReferences: https://c4model.com/diagrams/notation ; https://c4model.com/diagrams ; https://www.drawio.com/docs/manual/layers/how-layers-work/",
    "tags": [
      "shared-network-architecture-drawing",
      "network",
      "topology",
      "connectivity",
      "hub-spoke",
      "vnet",
      "vpc",
      "subnet",
      "firewall",
      "routing",
      "dns",
      "private endpoint",
      "hybrid",
      "drawio",
      "deployment"
    ],
    "useWhen": "Drawing or reviewing network architecture, topology, connectivity, hub-and-spoke, VNet/VPC, subnets, private endpoints, routing, firewall, DNS, hybrid or multi-environment deployment diagrams.",
    "requirements": [
      {
        "id": "req-network-source",
        "label": "Editable native network architecture diagram",
        "type": "artifact",
        "extension": ".drawio"
      }
    ],
    "examples": [
      "Hybrid overview: on-premises site → verified VPN/ExpressRoute gateway → connectivity hub, with separately labelled production and nonproduction spokes. Show actual peering and route-controlled traffic independently; do not infer spoke-to-spoke connectivity.",
      "Private service detail: workload → private endpoint → managed database, with a separate DNS-resolution path where verified. Show the endpoint subnet and outbound integration subnet separately; place the managed database according to its actual hosting semantics.",
      "Large estate: one overview plus Production and Nonproduction detail pages. Repeat the same ingress, application, endpoint and data layout for each workload. Flow F01 links to the traffic matrix with verified source, target, protocol, port, purpose and evidence."
    ],
    "principles": [
      "Separate ownership, network containment and trust boundaries.",
      "Show evidence-backed traffic paths, not assumed reachability.",
      "Use aligned environment/workload groups and readable overview/detail views.",
      "Preserve native editable diagrams and verify semantics as well as rendering."
    ],
    "externalSkills": [
      "drawio-skill"
    ],
    "reviewCriteria": [
      "Trace every network, CIDR, service and connection to supplied configuration or clearly label it proposed/unknown.",
      "Verify ownership boundaries differ from network and trust boundaries; check subnet containment and address overlaps.",
      "Verify ingress, egress, routing, DNS and return paths where applicable; reject assumed transitive peering or unproven isolation.",
      "Check private endpoints, service integration and managed-service placement accurately represent the platform.",
      "Check flow labels and traffic matrix agree; unknown ports, firewall rules and reachability remain unverified.",
      "Inspect every page at intended reading size for readable labels, aligned groups, crossings, legends and correct official icons.",
      "Verify editable .drawio delivery and report structural, semantic, rendered and connectivity checks separately."
    ],
    "priority": 90,
    "status": "active",
    "requiredIds": [],
    "checks": [],
    "backend": null,
    "id": "c24f4c07-e39d-4727-910a-652c63ffb57a"
  },
  {
    "kind": "review",
    "domain": "reviews",
    "keyId": "review-rule-correctness-security-and-data-preservation",
    "title": "Review rule — correctness, security and data preservation",
    "summary": "Review rule — correctness, security and data preservation",
    "content": "Trace changed behavior through callers and input/storage boundaries. Review normal, boundary and failure paths, authorization, project isolation, concurrency, migrations and recovery where applicable. Give each finding a concrete trigger, expected/actual behavior, evidence, impact and smallest complete correction. Prioritize security and data-loss defects. Retest fixes and relevant regressions; do not report speculative defects without a reproducible case or source evidence.",
    "tags": [
      "review-standard-correctness",
      "review",
      "verification",
      "compliance"
    ],
    "useWhen": "Apply these review criteria when reviewing changes, testing behavior and checking evidence.",
    "requirements": [],
    "examples": [],
    "principles": [],
    "externalSkills": [],
    "reviewCriteria": [],
    "priority": 95,
    "status": "active",
    "requiredIds": [],
    "checks": [],
    "backend": null,
    "id": "8feaf761-91dc-4df4-a402-60e0f6262dad"
  },
  {
    "kind": "review",
    "domain": "reviews",
    "keyId": "review-rule-workflows-and-artifact-compliance",
    "title": "Review rule — workflows and artifact compliance",
    "summary": "Review rule — workflows and artifact compliance",
    "content": "Reconcile the user request, project-selected styles, required dependencies and skills before accepting work. Check required formats and deliverables, not merely validator success. For UI, exercise keyboard/focus, dialogs, navigation, narrow/wide layouts and empty/error states in a real rendered interface. For diagrams, inspect editable source, actual rendered labels/connectors/boundaries and semantic accuracy. For documents, review factual evidence, audience, structure and requested format. Record checks unavailable in the environment as Not verified.",
    "tags": [
      "review-standard-artifacts",
      "review",
      "verification",
      "compliance"
    ],
    "useWhen": "Apply these review criteria when reviewing changes, testing behavior and checking evidence.",
    "requirements": [],
    "examples": [],
    "principles": [],
    "externalSkills": [],
    "reviewCriteria": [],
    "priority": 95,
    "status": "active",
    "requiredIds": [],
    "checks": [],
    "backend": null,
    "id": "a45de686-f3fe-4048-9d14-33cc970a41c8"
  },
  {
    "kind": "review",
    "domain": "reviews",
    "keyId": "review-rule-evidence-findings-and-final-verdict",
    "title": "Review rule — evidence, findings and final verdict",
    "summary": "Review rule — evidence, findings and final verdict",
    "content": "Report Pass, Fail or Not verified for each applicable acceptance criterion. Name the artifact or file, relevant record version, method, command or inspection evidence and actual result. Separate automated tests, rendered inspection, semantic judgment and agent assertions. An installed skill or retrieved style is not evidence of use. State whether the review is self-review or independent. Resolve material findings and rerun affected checks. Never declare complete compliance while mandatory outputs are missing or required checks remain unverified; report those limits explicitly. Use brain_review when available to record evidence, but its result does not independently prove overall correctness.",
    "tags": [
      "review-standard-evidence",
      "review",
      "verification",
      "compliance"
    ],
    "useWhen": "Apply these review criteria when reviewing changes, testing behavior and checking evidence.",
    "requirements": [],
    "examples": [],
    "principles": [],
    "externalSkills": [],
    "reviewCriteria": [],
    "priority": 95,
    "status": "active",
    "requiredIds": [],
    "checks": [],
    "backend": null,
    "id": "1cd374be-2285-43d7-8a61-06b300d1b4cc"
  },
  {
    "kind": "preference",
    "domain": "reviews",
    "keyId": "review-evidence-based-standards-and-compliance",
    "title": "Review — evidence-based standards and compliance",
    "summary": "Continuous and final review against current requirements, decision precedence, selected styles and verifiable evidence within the reviewer's permitted scope.",
    "content": "Before work, identify acceptance criteria and retrieve applicable project styles, required links and skills. Reconcile mandatory outputs and conflicting instructions; direct user requirements take precedence. Identify the binding project decisions and their explicit amendments; review against current decisions, not superseded text. Read the applicable implementation and review skills. During development, review meaningful changes against these criteria. Before completion, apply all required review rules, inspect connected code or artifact sources, run relevant checks, resolve material findings and retest. Use the smallest complete fix and preserve project data, scope and existing decisions. Treat historical results (earlier test counts, older reports, past environment runs) as history, not current evidence. Respect the reviewer's permitted execution scope and declared file ownership; name checks owned by others and mark them pending. Distinguish a self-review from an independent review. Report findings in severity order with evidence, impact and correction, then a clear verdict and unverified checks. This review style supplements implementation and QC styles; it does not change technology or visual defaults.",
    "tags": [
      "shared-review-standard",
      "review",
      "code review",
      "design review",
      "verification",
      "compliance",
      "acceptance",
      "quality",
      "audit"
    ],
    "useWhen": "Reviewing implementation, backend or UI changes, architecture, network diagrams, documents, skills or style updates; verifying deliverables before completion.",
    "requirements": [],
    "examples": [
      "Backend: submit a stale record version after a newer save. Verify rejection preserves current content and revision history; cite the actual test result.",
      "UI: inspect a modal with keyboard navigation, a long title and a narrow viewport. A successful build is not evidence of focus or layout correctness.",
      "Diagram: verify the requested editable .drawio exists, inspect its native connectors and render each requested page. XML validity alone does not prove correct routes, readable labels or architecture compliance.",
      "Documentation: a README states a test count and a passing environment run from an earlier release; the review flags it as historical and requires current evidence or an explicit date."
    ],
    "principles": [
      "Review during work and before completion.",
      "Verify outputs against selected styles, current decisions and user requirements.",
      "Report concrete findings and honest evidence; validator success and historical results are not full compliance."
    ],
    "externalSkills": [
      "ponytail:ponytail-review (for code changes)",
      "ui-ux-pro-max (for UI workflow and visual review)",
      "drawio-skill (for native Draw.io diagram review)"
    ],
    "reviewCriteria": [
      "Confirm the applicable styles, required links, skills and acceptance criteria were read.",
      "Apply the linked correctness, artifact and evidence rules; report concrete findings and corrective actions.",
      "Resolve material findings, rerun affected checks and state remaining Fail or Not verified results.",
      "Verify the review cites current decisions and amendments, excludes historical results as current evidence, and marks other-owner or out-of-scope checks pending."
    ],
    "priority": 95,
    "status": "active",
    "requiredIds": [
      "c6b15880-fabe-4725-9395-6cc5b8c11fb1",
      "5cbd3ef7-393b-429d-860b-625c7bebbce3"
    ],
    "checks": [],
    "backend": null,
    "id": "76ce7005-0e47-43a8-b3a3-eadb70240dcc"
  },
  {
    "kind": "review",
    "domain": "reviews",
    "keyId": "review-checklist-correctness-artifacts-and-evidence",
    "title": "Review checklist — correctness, artifacts and evidence",
    "summary": "Combined acceptance checklist for project-scoped review.",
    "content": "Review rule — correctness, security and data preservation\nTrace changed behavior through callers and input/storage boundaries. Review normal, boundary and failure paths, authorization, project isolation, concurrency, migrations and recovery where applicable. Give each finding a concrete trigger, expected/actual behavior, evidence, impact and smallest complete correction. Prioritize security and data-loss defects. Retest fixes and relevant regressions; do not report speculative defects without a reproducible case or source evidence.\n\nReview rule — workflows and artifact compliance\nReconcile the user request, project-selected styles, required dependencies and skills before accepting work. Check required formats and deliverables, not merely validator success. For UI, exercise keyboard/focus, dialogs, navigation, narrow/wide layouts and empty/error states in a real rendered interface. For diagrams, inspect editable source, actual rendered labels/connectors/boundaries and semantic accuracy. For documents, review factual evidence, audience, structure and requested format. Record checks unavailable in the environment as Not verified.\n\nReview rule — evidence, findings and final verdict\nReport Pass, Fail or Not verified for each applicable acceptance criterion. Name the artifact or file, relevant record version, method, command or inspection evidence and actual result. Separate automated tests, rendered inspection, semantic judgment and agent assertions. An installed skill or retrieved style is not evidence of use. State whether the review is self-review or independent. Resolve material findings and rerun affected checks. Never declare complete compliance while mandatory outputs are missing or required checks remain unverified; report those limits explicitly. Use brain_review when available to record evidence, but its result does not independently prove overall correctness.",
    "tags": [
      "shared-review-checklist",
      "review",
      "acceptance"
    ],
    "useWhen": "Apply these review criteria when reviewing changes, testing behavior and checking evidence.",
    "requirements": [],
    "examples": [],
    "principles": [],
    "externalSkills": [],
    "reviewCriteria": [],
    "priority": 95,
    "status": "active",
    "requiredIds": [],
    "checks": [],
    "backend": null,
    "id": "c6b15880-fabe-4725-9395-6cc5b8c11fb1"
  },
  {
    "kind": "preference",
    "domain": "research",
    "keyId": "research-primary-sources-evidence-and-decisions",
    "title": "Research — primary sources, evidence and decisions",
    "summary": "Answer a defined question using traceable evidence, compare alternatives and state uncertainty.",
    "content": "Define the question, audience, decision, constraints and success criteria first. Inspect relevant repository evidence and established decisions before external research. Prefer original specifications, official documentation, primary research and first-party design guidance. Browse for current or uncertain claims; record source URLs and relevant publication/version dates. Distinguish observations, sourced facts, inferences and proposals. Evaluate source relevance, recency, limitations and conflicting evidence; multiple pages repeating the same claim are not independent corroboration.\n\nCompare realistic alternatives against explicit criteria such as fit, usability, security, maintenance, cost and migration effort. Avoid adding technology or redesigning workflows merely because a reference looks attractive. Preserve explicit project decisions unless the user requests a change or new evidence warrants a clearly identified proposal. Summarize findings in plain language, cite claims near their evidence, explain tradeoffs and recommend the smallest suitable change. Record unresolved questions and what would change the decision. Never invent references, quotes, metrics or validation.\n\nUse a domain skill when applicable and available; report missing skills rather than claiming they ran. Architecture research must validate platform/version assumptions; BA research must trace requirements to stakeholders or supplied evidence; design research must translate patterns into the actual workflow and then validate the rendered result. Research informs a proposal, not proof that implementation or user testing succeeded. Keep secrets and project-private details out of external search queries. Apply this research process only when the task needs evidence gathering, not as mandatory browsing for every trivial edit.",
    "tags": [
      "shared-research-standard",
      "research",
      "evidence",
      "sources",
      "compare",
      "architecture",
      "business analysis",
      "standards",
      "design"
    ],
    "useWhen": "Researching architecture, business requirements, technology choices, design patterns, standards or uncertain/current facts before recommending a decision.",
    "requirements": [],
    "examples": [
      "Architecture: compare the existing hosting option and one plausible alternative against runtime, networking, operations and cost constraints. Cite official documentation and identify unverified assumptions.",
      "BA: map each requested outcome to a source, observable acceptance criterion and open question; do not invent stakeholder approval.",
      "UI: use documented table/filter patterns to improve a real task, then inspect keyboard interaction and narrow-screen behavior; a design reference is not usability-test evidence."
    ],
    "principles": [
      "Start with a decision and explicit criteria.",
      "Prefer primary evidence and preserve traceability.",
      "Distinguish facts, inference and uncertainty."
    ],
    "externalSkills": [],
    "reviewCriteria": [
      "Check each consequential claim has a relevant primary source or supplied evidence.",
      "Check dates, versions, contradictions and inference labels.",
      "Verify alternatives and recommendation use the stated decision criteria.",
      "List unresolved questions and distinguish research from implementation/testing evidence."
    ],
    "priority": 90,
    "status": "active",
    "requiredIds": [],
    "checks": [],
    "backend": null,
    "id": "5cbd3ef7-393b-429d-860b-625c7bebbce3"
  },
  {
    "kind": "preference",
    "domain": "development-structure",
    "keyId": "development-structure-frontend-and-backend-boundaries-for-ty",
    "title": "Development structure — frontend and backend boundaries for typescript",
    "summary": "Organize source by feature and responsibility, preserve framework conventions and verify build, runtime and package paths.",
    "content": "Inspect the existing tree, framework/version, entry points, build configuration, public package contracts, tests and architecture decisions before proposing a layout. Prefer a coherent existing convention. The examples below are adaptable patterns, not a universal standard. Produce a concise annotated tree, folder responsibilities, permitted import direction and verification steps. Create only folders needed by real code; do not add empty layers, framework dependencies or a monorepo merely to resemble a template.\n\nFRONTEND\nKeep routes and app composition in the framework's required locations. Group feature-owned views, components, state, API adapters and tests near their feature. Promote a component or utility into shared code only when multiple features need the same stable behavior. Keep design tokens and reusable UI primitives distinct from business features. Keep server-only code, credentials and database access out of browser dependency graphs. Distinguish public assets from imported assets and generated output. Respect framework-specific server/client and routing conventions; moving a route file can change the public URL. Use the framework's testing convention, with integration/end-to-end tests separate when needed.\n\nBACKEND\nKeep the process entry point small: configuration, composition, startup and shutdown. Group cohesive capabilities into modules. Transport handlers validate requests and call application behavior; persistence and external-service adapters handle I/O. Avoid business rules duplicated across HTTP, jobs, MCP and CLI handlers. A small service may use a few responsibility folders; introduce domain/application/infrastructure layers only when complexity warrants them. Share contracts through deliberate interfaces, not cross-feature imports of internal files. Keep dependency direction explicit and avoid cycles; extract an interface only when it solves a real boundary or testing need. Keep schema migrations, seed fixtures and runtime user data distinct; never bundle secrets or personal databases.\n\nFULL-STACK AND PACKAGING\nUse a single package when one deployable and its tooling suffice. Use apps/web, apps/api and packages/contracts only when separate build/deployment or genuine shared-package needs justify workspaces. Shared contracts must not import server implementations, database clients or secret configuration. Preserve public CLI paths, package exports, route paths and hook registrations during moves. Select module format and import extensions according to the installed runtime/build tools; do not change ESM/CommonJS semantics incidentally. Keep source, tests, scripts, docs and generated dist/build output identifiable. Root configuration belongs where the framework or tooling expects it. Ignore credentials, local data and build artifacts; publish only intended files. Document supported runtime and clean install/build/test commands.\n\nRESTRUCTURING EXISTING CODE\nMap every old path to its destination. Update imports, tests, aliases, runtime file URLs, static assets, scripts, fixtures, watchers, CI, containers and package entry points that reference those paths. Preserve behavior and user data; do not rename external contracts just to improve internal naming. Review the resulting dependency graph, run relevant tests and builds, and install/test the packed artifact from a temporary directory when publishing a package. Verify default hook/CLI commands and asset paths, not just TypeScript compilation. Report blocked checks separately.\n\nResearch basis (reviewed 2026-11-04): Angular supports feature grouping and colocating related files; Next.js defines routing conventions while allowing several organization strategies; NestJS describes cohesive modules and explicit exports; Node.js defines package entry points and export boundaries. The combined FE/BE examples here are a recommended synthesis, not an official cross-framework standard.\nhttps://angular.dev/style-guide\nhttps://nextjs.org/docs/app/getting-started/project-structure\nhttps://docs.nestjs.com/modules\nhttps://nodejs.org/api/packages.html",
    "tags": [
      "shared-development-structure",
      "project structure",
      "folder structure",
      "directory layout",
      "frontend",
      "backend",
      "FE",
      "BE",
      "full-stack",
      "scaffold",
      "refactor",
      "modules",
      "monorepo",
      "nodejs"
    ],
    "useWhen": "Creating a frontend, backend or full-stack project; planning source folders; onboarding a repository; moving modules or reviewing dependency boundaries.",
    "requirements": [],
    "examples": [
      "Frontend example (adapt to the framework): src/app/ for composition and routes; src/features/orders/ for order views, state, API adapters and colocated tests; src/shared/ui/ for reused primitives; src/shared/theme/ for tokens; public/ for public assets; tests/e2e/ for workflows. A Next.js app keeps its special page/layout files in app/ or src/app/; an Angular app follows its own feature conventions.",
      "Small backend example: src/main.ts composes the process; src/modules/orders/ owns routes, application behavior and persistence code; src/platform/ owns shared database/configuration adapters; migrations/ stores schema changes; tests/integration/ tests boundaries; scripts/ holds build/setup helpers; dist/ is generated. Split files or sublayers only as actual responsibilities grow.",
      "Full-stack workspace example, only with independent packages: apps/web/ and apps/api/ each own source, tests and package metadata; packages/contracts/ exposes browser-safe schemas/types through explicit exports. Web imports contracts, never API internals. Keep one workspace lockfile and documented per-app build/deploy commands.",
      "Existing Node CLI example: move HTTP handling into src/server/ and MCP/hooks into src/agents/, keep src/cli.ts stable, update paths derived from import.meta.url and compile nested sources. Install the tarball into a temporary directory and verify CLI, MCP, hook commands and static assets."
    ],
    "principles": [
      "Choose structure from framework conventions, cohesion and project size.",
      "Keep feature ownership and dependency direction explicit.",
      "Preserve public contracts and verify runtime paths after moves.",
      "Separate source, generated artifacts, secrets and runtime data."
    ],
    "externalSkills": [
      "codebase-memory (when tracing or restructuring an existing codebase)",
      "ponytail:ponytail-review (when reviewing code or module moves)"
    ],
    "reviewCriteria": [
      "Does the layout follow the installed framework and explicit repository decisions?",
      "Can each folder be explained by a real responsibility without empty speculative layers?",
      "Are feature boundaries and import direction clear, with no unintended cycles or browser imports of server-only code?",
      "Are source, public assets, generated output, migrations, fixtures and runtime data separated appropriately?",
      "Have all moved-path consumers, public entry points, build scripts and deployment configurations been checked?",
      "Do builds and relevant tests pass, and does the packed/deployed artifact resolve hooks, CLI commands and assets from outside the repository?",
      "Does the README document the tree, ownership and development commands, with unperformed checks reported honestly?"
    ],
    "priority": 90,
    "status": "active",
    "requiredIds": [
      "5cbd3ef7-393b-429d-860b-625c7bebbce3"
    ],
    "checks": [],
    "backend": null,
    "id": "d4cf8374-7f9c-4ccd-87a3-94cb63386544"
  }
];
export const catalogDomains = [
  {
    "id": "thinking",
    "name": "Thinking"
  },
  {
    "id": "architecture",
    "name": "Architecture"
  },
  {
    "id": "diagrams",
    "name": "Diagrams"
  },
  {
    "id": "writing",
    "name": "Writing"
  },
  {
    "id": "coding",
    "name": "Coding"
  },
  {
    "id": "technology",
    "name": "Technology selection"
  },
  {
    "id": "design",
    "name": "UI/UX Design"
  },
  {
    "id": "drawio",
    "name": "Draw.io"
  },
  {
    "id": "mermaid",
    "name": "Mermaid"
  },
  {
    "id": "design-system",
    "name": "Design system"
  },
  {
    "id": "business-analysis-ba",
    "name": "Business Analysis (BA)"
  },
  {
    "id": "quality-control-qc",
    "name": "Quality Control (QC)"
  },
  {
    "id": "network-architecture",
    "name": "Network architecture"
  },
  {
    "id": "reviews",
    "name": "Review"
  },
  {
    "id": "research",
    "name": "Research"
  },
  {
    "id": "development-structure",
    "name": "Development structure"
  }
];

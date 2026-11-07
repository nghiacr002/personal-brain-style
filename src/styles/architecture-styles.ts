import {BrainDB} from '../core/database.ts';
import type {RecordInput} from '../core/models.ts';

// User-requested personal records, separate from the removed sample library.
function installBaseArchitectureStyles(db: BrainDB) {
  if (db.db.prepare("SELECT value FROM meta WHERE key='architecture_styles_v1'").get()) {
    return 0;
  }
  const create = (
    input: Pick<RecordInput, 'domain' | 'title' | 'summary' | 'content'>,
    key: string,
    requiredIds: string[] = [],
  ) => {
    const existing = db.list({limit: 300}).find((r) => r.tags.includes(key));
    return (
      existing ||
      db.create({
        ...input,
        kind: 'preference',
        status: 'active',
        priority: 90,
        tags: [key, 'architecture', 'personal-style'],
        requiredIds,
        checks: [],
        backend: null,
      })
    );
  };
  const thinking = create(
    {
      domain: 'thinking',
      title: 'Architecture thinking — security and operations',
      summary: 'Design security and operational ownership into every architecture decision.',
      content: `Apply when planning architecture. First establish workload goals, users, data sensitivity, constraints and assumptions. Design for security and design for operation from the start. Record decisions and verification evidence; never imply a control or recovery process was tested unless it was.

Security: map entry points, identities, data flows and trust boundaries. Threat-model likely abuse and failure paths. Use Zero Trust: verify each access, least privilege and assume compromise. Prefer workload identities over stored credentials; define authorization, secret rotation, encryption, audit trails and network exposure. State responsibility and residual risk for each boundary.

Operations: assign a service owner and support path. Define measurable availability and latency objectives, logs/metrics/traces, actionable alerts, dashboards and incident runbooks. Design infrastructure as code, repeatable deployments, release checks and rollback. Specify backup/restore, recovery time and recovery point objectives, failure handling, capacity, patching and cost visibility. Plan recovery exercises and identify untested assumptions.

Deliver: assumptions; security and operations decisions; risks with owners; acceptance checks. Give conclusions and tradeoffs, not hidden chain-of-thought. Example: a customer API uses workload identity for data access, restricted database networking, correlated request traces, a latency alert owned by the API team, and a documented rollback plus restore exercise. Set numeric objectives from workload requirements, not invented defaults.

References:
https://learn.microsoft.com/en-us/azure/well-architected/security/principles
https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/principles`,
    },
    'personal-architecture-thinking',
  );
  const technology = create(
    {
      domain: 'technology',
      title: 'Architecture technology selection — Azure first',
      summary:
        'Choose Azure services against workload constraints, security and operational requirements.',
      content: `Azure is my default cloud platform. Use the required-linked security and operations thinking style before choosing services. Prefer the simplest managed Azure service that meets requirements; do not default to Kubernetes or add multiple clouds without a concrete need.

Compare viable Azure options using a small decision table: requirement, candidate, fit, limitation, security/operations burden, cost assumption and decision. Check current official documentation for region availability, capabilities, quotas, service lifecycle and pricing before committing. Record unknowns and alternatives in a short architecture decision record.

Consider Microsoft Entra ID and managed identities for authentication, Key Vault where secrets are necessary, and Azure Monitor/Application Insights for observability where appropriate. Choose compute, database, messaging and network services from workload needs. Distinguish authentication from authorization; select private connectivity where the threat model warrants it. Evaluate resilience, backups, recovery and support ownership alongside functionality.

Use GCP or another cloud only for an explicit requirement or existing integration. Explain that boundary and the extra identity, network and operations burden. GCP icons being available does not make GCP a deployment requirement.

Example: compare App Service, Container Apps and AKS for an HTTP API. Recommend the least complex option satisfying deployment/runtime/network constraints; retain AKS only when Kubernetes-specific control is required. Document cost and region checks as pending until actually verified.

References:
https://learn.microsoft.com/en-us/azure/well-architected/pillars
https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/compute-decision-tree`,
    },
    'personal-architecture-technology',
    [thinking.id],
  );
  create(
    {
      domain: 'architecture',
      title: 'Architecture drawing — clear cloud flow diagrams',
      summary:
        'Editable draw.io flow diagrams with square boxes, labeled arrows, legends and official cloud icons.',
      content: `Required-linked: apply Azure technology selection and security/operations thinking before drawing. Deliver an editable .drawio diagram as the primary artifact. Draw architecture as a clear flow diagram: square boxes, no border radius (rounded=0), directional arrows, explicit boundaries and a legend. Use official Azure, GCP and cloud icon libraries only for the providers/services actually present.

Layout: choose left-to-right or top-to-bottom flow and keep it consistent. Align boxes to a grid; use consistent sizes and spacing. Put a service name and responsibility in each box. Group services by ownership, network or trust boundary without mixing those meanings. Keep nodes and arrow labels clear of overlaps. Use orthogonal connectors with visible arrowheads; label protocol or payload and distinguish request, event and control flows. Number steps when order matters. Use separate pages for detailed flows rather than crowding one canvas.

Color style: white canvas, sky-blue service fill #E0F2FE, blue border/arrows #0369A1, dark text #0F172A. Use pale neutral fill #F1F5F9 for external systems; label security boundaries and use dashed outlines. Reserve amber #FEF3C7 for labeled risks or pending decisions. The legend explains all fills, boundaries, icons and line styles; never rely on color alone. Boxes and containers have square corners; preserve official icon geometry and colors.

Icon dataset: use draw.io built-in cloud libraries or official provider SVG collections. Azure: https://learn.microsoft.com/en-us/azure/architecture/icons/ ; GCP: https://cloud.google.com/icons ; draw.io Azure library: https://www.drawio.com/docs/diagram-types/azure-diagrams/ . Keep a source manifest with provider, service, source URL and retrieved library version/date. Label generic cloud/internet shapes clearly. Do not invent stencil IDs, distort provider icons or use a product icon for an unrelated service. Embed imported SVG assets where supported so the file does not depend on local paths.

Delivery checks: valid draw.io XML with editable nodes, labels and connectors; open/render the file when tooling allows; inspect arrow direction, overlaps, legend, boundary semantics and icon rendering. Supply PNG/SVG only as optional previews. Report any rendering or validation not performed.

Example flow: Client → Azure API hosting → Azure database, with separate identity and telemetry connections. Label HTTPS and data access, show the data trust boundary, and include a legend for request arrows, telemetry and boundary lines. Select actual Azure services using the linked technology style; include GCP only when a real external integration requires it.`,
    },
    'personal-architecture-drawing',
    [thinking.id, technology.id],
  );
  db.db.prepare("INSERT INTO meta(key,value) VALUES('architecture_styles_v1','1')").run();
  return 3;
}

function installArchitectureAlternatives(db: BrainDB) {
  if (db.db.prepare("SELECT value FROM meta WHERE key='architecture_styles_v2'").get()) {
    return 0;
  }
  const thinking = db
    .list({status: 'active', limit: 300})
    .find((r) => r.tags.includes('personal-architecture-thinking'));
  const definitions: Array<
    Pick<RecordInput, 'domain' | 'title' | 'summary' | 'content'> & {key: string}
  > = [
    {
      key: 'personal-architecture-cloud-agnostic',
      domain: 'technology',
      title: 'Architecture technology selection — Cloud Agnostic',
      summary:
        'Select technologies by workload fit, portability and total operational cost, without a preferred cloud.',
      content: `Use this as an alternative to Azure First for the selected project. Start with workload capabilities, constraints, data residency, team skills, security and operational objectives. Compare relevant Azure, AWS, GCP, private-cloud or on-premises options without assuming one provider wins. Cloud agnostic does not require multi-cloud deployment or identical services everywhere.

Describe logical capabilities before mapping provider products. Evaluate open standards, supported runtimes, data formats, API contracts, identity federation, export/restore paths, infrastructure automation and observability. Separate business logic from provider integrations where it makes migration practical. Do not force Kubernetes, lowest-common-denominator abstractions or self-hosting merely to claim portability.

Use a decision table: requirement, viable options, capability fit, security/operations burden, portability limits, total cost and recommendation. Include egress, migration, staffing and support costs. Check current official provider documentation for region, quotas, lifecycle and pricing; mark unverified claims. Record an exit plan and justify any deliberate managed-service dependency.

Apply security and operations thinking throughout. Example: compare managed PostgreSQL on eligible providers against operating PostgreSQL yourself. Assess extensions, backups, restore/export tests, identity, networking, availability and ownership before choosing. A single managed provider may be the best cloud-agnostic decision.

Project usage: activate this style and select it in the technology slot instead of Azure First. If the drawing style still requires Azure First, edit its required links (or create a separate drawing style) to require this style; dependencies use exact record IDs.

Reference: https://learn.microsoft.com/en-us/azure/architecture/patterns/`,
    },
    {
      key: 'personal-architecture-design-patterns',
      domain: 'architecture',
      title: 'Architecture design patterns — microservices, DDD and modular design',
      summary:
        'Choose architecture patterns from domain boundaries, scale, team ownership and operational needs.',
      content: `Choose patterns to solve concrete problems. Start with a modular monolith when one deployment meets the workload needs. Adopt microservices only when independent deployment, scaling, isolation or team ownership justifies distributed-system costs. Record why the simplest viable alternative is insufficient.

Use strategic domain-driven design (DDD): establish a shared domain vocabulary, business capabilities, subdomains, bounded contexts, owners and context relationships. A bounded context is a model boundary, not automatically one service. Apply tactical entities, value objects, aggregates and domain events where the domain complexity warrants them. Define aggregate invariants and transaction boundaries; avoid splitting services by database table or technical layer.

Choose layered or hexagonal architecture to isolate domain logic from infrastructure. Consider event-driven integration for decoupling and asynchronous work, with explicit delivery, ordering and consistency assumptions. Use CQRS only when read/write needs differ enough to justify separate models; event sourcing is a separate decision with replay, evolution and privacy costs.

For distributed workflows, evaluate saga compensation, transactional outbox, idempotent consumers and deduplication. For failures, define timeouts, bounded retries with backoff, circuit breakers and bulkheads where appropriate. Retries must respect idempotency and avoid overload. Consider an anti-corruption layer at legacy boundaries and a strangler migration for incremental replacement.

Apply security and operations thinking to every boundary: authorization, data ownership, traces, failure modes, deployment/rollback, recovery and support ownership. Deliver a context map, chosen pattern/problem/tradeoff table, rejected alternatives and measurable validation criteria. Use the separately selected drawing style for visual output.

Example: separate Ordering, Payments and Fulfilment models in a modular application first. Extract Payments only when its isolation or independent release requirements justify it. An order-accepted event may use an outbox and idempotent consumer; define duplicate handling, payment failure compensation and trace correlation. Do not claim exactly-once processing without demonstrated guarantees.

References:
https://learn.microsoft.com/en-us/azure/architecture/microservices/model/domain-analysis
https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design
https://learn.microsoft.com/en-us/azure/architecture/patterns/`,
    },
  ];
  let created = 0;
  for (const {key, ...input} of definitions) {
    if (db.list({limit: 300}).some((r) => r.tags.includes(key))) {
      continue;
    }
    db.create({
      ...input,
      kind: 'preference',
      status: 'draft',
      priority: 90,
      tags: [key, 'architecture', 'personal-style'],
      requiredIds: thinking ? [thinking.id] : [],
      checks: [],
      backend: null,
    });
    created++;
  }
  db.db.prepare("INSERT INTO meta(key,value) VALUES('architecture_styles_v2','1')").run();
  return created;
}

export function installArchitectureStyles(db: BrainDB) {
  return installBaseArchitectureStyles(db) + installArchitectureAlternatives(db);
}

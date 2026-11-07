# Style catalog

Generated from `src/styles/global-style-catalog.ts` by `scripts/catalog-doc.mjs`; do not edit by hand. A fresh library is seeded with these 62 records in 9 capabilities. Existing libraries are never overwritten.

## How the catalog fits together

- **Capabilities** group styles. Every capability here is *combinable*: a project can select several of its styles. Switch a capability to *Pick one* in Capabilities → Rename when its styles are alternatives.
- **Required styles** always load with the style that requires them, transitively. A style lists only direct requirements (at most 12). Format styles such as Draw.io and Mermaid are selected per project, never required.
- **Supporting guidance** loads only when explicit task activity and formats match. Unknown conditions remain unresolved.
- **Procedures** are external skill bindings with required/optional status, applicability and fallback. References do not install or execute skills.
- Preference bodies describe desired outcomes, deliverable expectations and acceptance. Document templates additionally retain template conventions.

| Capability | Styles |
| --- | --- |
| Foundations | 3 |
| Quality & review | 4 |
| Product & analysis | 2 |
| Architecture | 9 |
| Drawing | 3 |
| UI/UX design | 2 |
| Engineering standards | 21 |
| Delivery & operations | 3 |
| Writing documents | 15 |

## Foundations

| Style | Use when | Requires | Required by | Skills |
| --- | --- | --- | --- | --- |
| **Research — primary sources, evidence and decisions** | Use when a decision depends on facts outside the conversation, such as current API behaviour or limits, library or service comparisons, standards, or academic literature. | Quality control — evidence-based verification | — | semanticscholar-skill |
| **Engineering thinking — framing, trade-offs and decisions** | Use when choosing between designs, libraries, data models or approaches, scoping a change, writing an ADR, or assessing risk before an irreversible step. | — | — | understand-domain |
| **Technology research — evaluations, spikes and recommendations** | Use when choosing a library, framework, database, platform or vendor, comparing alternatives, running a spike or proof of concept, or reviewing whether a technology should change radar ring. | — | — | codebase-memory, semanticscholar-skill |

## Quality & review

| Style | Use when | Requires | Required by | Skills |
| --- | --- | --- | --- | --- |
| **Quality control — evidence-based verification** | Use when verifying a code change, document, diagram or release candidate, reporting build and test results, or closing a defect with evidence. | — | Research — primary sources, evidence and decisions; Document writing — clear, structured and evidence-based; Review — evidence-based standards and compliance | understand-diff, codebase-memory |
| **Review — evidence-based standards and compliance** | Use when reviewing a pull request, UI change, architecture or network diagram, specification or style update, or doing the final self-review before declaring work complete. | Quality control — evidence-based verification; Review checklist — correctness, workflows and evidence | — | understand-diff, codebase-memory, ui-ux-pro-max, drawio-skill |
| **Review checklist — correctness, workflows and evidence** (review) | Use when reviewing a pull request, migration, rendered UI, diagram or document delivery, or running the final self-check before approving work. | — | Review — evidence-based standards and compliance | understand-diff, codebase-memory |
| **Quality assurance — test strategy and acceptance** | Use when planning testing for a feature or release, writing test cases from acceptance criteria, scoping regression for a change, running exploratory or non-functional tests, or reporting defects. | — | — | understand-diff |

## Product & analysis

| Style | Use when | Requires | Required by | Skills |
| --- | --- | --- | --- | --- |
| **Product ownership — outcomes, backlog and acceptance** | Use when setting a product goal or metrics, writing or ordering a backlog, slicing a roadmap or MVP, defining ready and done, accepting an increment or deciding whether to release. | — | — | understand-domain |
| **Business analysis — requirements and traceability** | Use when eliciting or documenting requirements, modelling as-is and to-be processes, writing acceptance criteria, building a traceability matrix or assessing the impact of a change request. | — | — | understand-domain, creating-mermaid-diagrams, drawio-skill |

## Architecture

| Style | Use when | Requires | Required by | Skills |
| --- | --- | --- | --- | --- |
| **Solution architecture — end-to-end design and decisions** | Use when designing a new system or major change end to end, writing a solution architecture document, comparing solution options, or preparing ADRs, a transition roadmap and cost view. | — | — | archify, azure-enterprise-infra-planner, cost-estimation |
| **Software architecture — boundaries, patterns and quality attributes** | Use when defining module or service boundaries, deciding monolith vs. microservices, designing integration (sync, async, events), API contracts and versioning, or dependency rules and fitness functions. | — | — | codebase-memory, understand, understand-domain |
| **Cloud architecture — provider-neutral platform design** | Use when choosing hosting and managed services, designing landing zones or account structure, environments and IaC, setting RTO/RPO and zone/region resilience, or estimating and governing cloud cost. | — | — | codebase-memory |
| **Cloud architecture — Azure-first platform choices** | Use when selecting Azure services for a new workload, comparing App Service, Container Apps, Functions or AKS, planning an Azure landing zone, regions and quotas, or pricing an Azure design. | — | — | azure-prepare, azure-validate, azure-reliability, cost-estimation |
| **Network architecture — topology, boundaries and traffic flows** | Use when designing or reviewing network topology, hub-spoke, VNet/VPC and subnets, private endpoints, routing, firewalls, DNS, hybrid connectivity or multi-environment deployment diagrams. | — | — | drawio-skill, azure-enterprise-infra-planner, azure-resource-lookup |
| **Data architecture — models, ownership, lifecycle and flows** | Use when designing conceptual, logical or physical data models, choosing OLTP vs. analytics stores, planning migrations and schema evolution, CDC or event integration, retention, lineage, data contracts or PII handling. | — | — | creating-mermaid-diagrams, azure-postgres, azure-kusto, azure-storage |
| **Security architecture — threat models, identity and zero trust** | Use when threat modelling a system or feature, designing authentication and authorization, secrets and encryption, supply-chain controls, audit logging, or securing AI agents and tool use. | — | — | azure-compliance, entra-app-registration, entra-agent-id |
| **Integration architecture — APIs, events and contracts** | Use when designing or reviewing APIs, events, queues, webhooks, file or CDC feeds, partner integrations, sagas, gateways or contract versioning between systems. | — | — | creating-mermaid-diagrams, archify, azure-messaging |
| **Software design & code architecture — modules, patterns and structure** | Use when structuring a new service or app, adding a feature module, untangling cycles, choosing layered or hexagonal design, applying a pattern or refactoring code structure. | — | — | understand, understand-domain, codebase-memory |

## Drawing

| Style | Use when | Requires | Required by | Skills |
| --- | --- | --- | --- | --- |
| **Drawing — clear architecture, flows and data models** | Use when creating or revising C4 architecture, sequence, flow, state, ER, deployment or data-flow diagrams, or choosing which diagram format a deliverable should use. | — | Draw.io — editable architecture, flow and ER diagrams; Mermaid — architecture, sequence, flow and ER diagrams as code | archify, plantuml-skill, excalidraw |
| **Draw.io — editable architecture, flow and ER diagrams** | Use when a deliverable must be a draw.io or diagrams.net file, or needs vendor cloud icons, swimlanes, network topology, precise layout or editable PNG, SVG or PDF exports. | Drawing — clear architecture, flows and data models | — | drawio-skill |
| **Mermaid — architecture, sequence, flow and ER diagrams as code** | Use when a diagram must live in Markdown or Git as a .mmd file or mermaid block: flowcharts, sequence, ER, state, class or C4 context views reviewed as code. | Drawing — clear architecture, flows and data models | — | creating-mermaid-diagrams |

## UI/UX design

| Style | Use when | Requires | Required by | Skills |
| --- | --- | --- | --- | --- |
| **UI/UX — task-centered interaction** | Use when designing, building, redesigning or reviewing screens, forms, navigation, dashboards, filters, tables, dialogs, sign-in or consent flows. | — | — | ui-ux-pro-max, design-taste-frontend, redesign-existing-projects |
| **Design system — tokens, components and states** | Use when defining or changing colours, typography, spacing, radius, themes, dark mode or component states, or when a UI needs a palette and the project has not selected one. | — | — | ui-ux-pro-max, minimalist-ui |

## Engineering standards

| Style | Use when | Requires | Required by | Skills |
| --- | --- | --- | --- | --- |
| **Global Development Standard** | Use to implement a feature or API change, fix a bug, refactor code, validate inputs, handle failures and add regression tests in any programming language. | — | Frontend engineering standards — language-independent (compatibility); Backend engineering standards — language-independent (compatibility); Frontend standards — mobile apps (compatibility); Coding style — readable, consistent code (compatibility); Development — TypeScript; Development — C# / .NET; Development — Python; Development — Java; Development — Swift; Development — Kotlin; Development — Dart | — |
| **Frontend engineering standards — language-independent (compatibility)** | Use when building, reviewing or setting standards for any web or mobile frontend: new screens, forms, client data fetching, accessibility, performance or frontend security work. | Global Development Standard | — | — |
| **Backend engineering standards — language-independent (compatibility)** | Use when building, reviewing or setting standards for any backend service, API, worker or job: endpoints, migrations, messaging consumers, outbound calls, logging or service layout. | Global Development Standard | — | — |
| **Frontend standards — TypeScript web (compatibility)** | Use when creating or changing a TypeScript web app (React, Next.js, Vue, Angular, Svelte): tsconfig, lint setup, typed API clients, components, build, tests or dependencies. | Development — TypeScript | — | — |
| **Frontend standards — mobile apps (compatibility)** | Use when creating or changing an iOS, Android, React Native or Flutter app: screens, navigation, offline sync, permissions, push, secure storage, device tests or a store release. | Global Development Standard | — | — |
| **Backend standards — TypeScript / Node.js (compatibility)** | Use when creating or changing a Node.js backend in TypeScript (Express, Fastify, NestJS): routes, validation, database access, config, logging, telemetry, tests or dependencies. | Development — TypeScript | — | — |
| **Backend standards — .NET / C# (compatibility)** | Use when creating or changing an ASP.NET Core API or .NET worker: solution layout, endpoints, DI, options, EF Core, authentication, logging, health checks, tests or NuGet packages. | Development — C# / .NET | — | — |
| **Project structure — TypeScript web frontend** | Use when scaffolding a TypeScript web app, adding a feature folder, deciding where a component, hook, API call, test or env file goes, or restructuring a React, Vue, Angular or Svelte repo. | — | — | understand, codebase-memory |
| **Project structure — mobile apps** | Use when scaffolding a mobile app, adding a feature or screen, deciding where navigation, storage, assets, translations, flavors or tests live, or restructuring an iOS, Android, React Native or Flutter repo. | — | — | understand, codebase-memory |
| **Project structure — TypeScript / Node.js backend** | Use when scaffolding a Node.js service, adding a backend module or use case, deciding where routes, schemas, repositories, migrations, tests or env files go, or splitting a repo into workspaces. | — | — | understand, codebase-memory |
| **Project structure — .NET backend** | Use when creating a .NET solution, adding a feature slice or project, deciding where endpoints, handlers, EF Core configuration, migrations, tests or settings live, or splitting a solution into layers. | — | — | understand, codebase-memory |
| **Coding style — readable, consistent code (compatibility)** | Use when writing, renaming, refactoring or reviewing code in any language, setting up a formatter or linter, or settling a naming or comment question. | Global Development Standard | — | — |
| **Coding patterns — implementation patterns and anti-patterns** | Use when implementing error handling, input parsing, mapping, retries, idempotency, outbox, pagination, caching, async work or frontend state, or reviewing code for anti-patterns. | — | — | understand, codebase-memory |
| **Logging and tracing — structured logs, traces and metrics in code** | Use when adding or reviewing log statements, OpenTelemetry tracing or metrics, correlation ids, redaction, frontend error reporting or mobile crash reporting. | — | — | appinsights-instrumentation, azure-observability |
| **Development — TypeScript** | Use when writing or reviewing TypeScript code. Apply only framework/runtime sections matching the task. | Global Development Standard | Frontend standards — TypeScript web (compatibility); Backend standards — TypeScript / Node.js (compatibility) | — |
| **Development — C# / .NET** | Use when writing or reviewing C# / .NET code. Apply only framework/runtime sections matching the task. | Global Development Standard | Backend standards — .NET / C# (compatibility) | — |
| **Development — Python** | Use when writing or reviewing Python code. Apply only framework/runtime sections matching the task. | Global Development Standard | — | — |
| **Development — Java** | Use when writing or reviewing Java code. Apply only framework/runtime sections matching the task. | Global Development Standard | — | — |
| **Development — Swift** | Use when writing or reviewing Swift code. Apply only framework/runtime sections matching the task. | Global Development Standard | — | — |
| **Development — Kotlin** | Use when writing or reviewing Kotlin code. Apply only framework/runtime sections matching the task. | Global Development Standard | — | — |
| **Development — Dart** | Use when writing or reviewing Dart code. Apply only framework/runtime sections matching the task. | Global Development Standard | — | — |

## Delivery & operations

| Style | Use when | Requires | Required by | Skills |
| --- | --- | --- | --- | --- |
| **AI delivery lifecycle — plan, build, verify, ship and learn** | Use when an agent plans or delivers a feature end to end, or when building, evaluating or launching an LLM-based feature, assistant or agent. | — | — | codebase-memory, understand, full-output-enforcement, microsoft-foundry |
| **Technical leadership — plans, standards and delivery quality** | Use when breaking down a feature or epic into tasks, estimating, setting coding standards or review policy, managing tech debt or risks, delegating work to people or agents, or deciding release readiness. | — | — | understand, codebase-memory, understand-diff |
| **SRE & DevOps — reliability, delivery pipelines and operations** | Use when defining SLOs, building or changing CI/CD pipelines or IaC, planning a release strategy, setting up monitoring and alerts, responding to or reviewing an incident, or planning capacity and backups. | — | — | appinsights-instrumentation, azure-observability, azure-deploy, azure-diagnostics |

## Writing documents

| Style | Use when | Requires | Required by | Skills |
| --- | --- | --- | --- | --- |
| **Document writing — clear, structured and evidence-based** | Use when writing or revising a README, specification, design document, decision record, runbook, report, release note or product copy. | Quality control — evidence-based verification | Markdown — repository documents as reviewable text; HTML — self-contained, accessible web documents; Word — editable .docx documents with real structure; Product specification (PRD); Product roadmap; Business requirements document (BRD); Architecture decision record (ADR); Test plan and test cases; Runbook and operations guide; High-level design (HLD); Low-level design (LLD); API specification; Database design document; Integration specification | full-output-enforcement |
| **Markdown — repository documents as reviewable text** | Use when the deliverable is a .md file: README, specification, ADR, runbook, changelog or report kept in Git or rendered by a docs site or wiki. | Document writing — clear, structured and evidence-based | — | creating-mermaid-diagrams |
| **HTML — self-contained, accessible web documents** | Use when the deliverable is an .html document: a report, explainer, dashboard-style summary, published page or an existing HTML document being revised. | Document writing — clear, structured and evidence-based | — | frontend-design |
| **Word — editable .docx documents with real structure** | Use when the deliverable is a Word (.docx) file or template: a specification, proposal, report, contract-style document or form to send, sign, print or edit in Microsoft Word. | Document writing — clear, structured and evidence-based | — | docx |
| **Product specification (PRD)** | Use when writing or updating a PRD for a product, epic or feature, shaping a roadmap item for delivery, or checking whether a feature specification is ready to build. | Document writing — clear, structured and evidence-based | — | understand-domain, full-output-enforcement |
| **Product roadmap** | Use when creating or updating a product roadmap, preparing a roadmap review or planning increment, or explaining to stakeholders why an item moved or was dropped. | Document writing — clear, structured and evidence-based | — | creating-mermaid-diagrams, full-output-enforcement |
| **Business requirements document (BRD)** | Use when writing, baselining or changing a business requirements document, preparing requirements for sign-off, or running impact analysis for a change request against a BRD. | Document writing — clear, structured and evidence-based | — | creating-mermaid-diagrams, drawio-skill, full-output-enforcement |
| **Architecture decision record (ADR)** | Use when recording a significant technical or architectural decision, superseding or deprecating an earlier decision, setting up an ADR log in a repository, or backfilling decisions already made. | Document writing — clear, structured and evidence-based | — | full-output-enforcement |
| **Test plan and test cases** | Use when writing a test plan for a feature or release, documenting test cases from acceptance criteria, recording a test run or execution report, or summarising defects for a release decision. | Document writing — clear, structured and evidence-based | — | understand-diff, full-output-enforcement |
| **Runbook and operations guide** | Use when writing or updating a service runbook or operations guide, preparing a service for production readiness, linking alerts to procedures, or recording a procedure verified in a drill. | Document writing — clear, structured and evidence-based | — | azure-observability, azure-diagnostics |
| **High-level design (HLD)** | Use when writing or updating the high-level design of a system, preparing an architecture review pack or onboarding readers to a solution's structure. | Document writing — clear, structured and evidence-based | — | drawio-skill, creating-mermaid-diagrams, archify |
| **Low-level design (LLD)** | Use when designing a new module or component, documenting a significant change to its internals, or preparing a design review before implementation. | Document writing — clear, structured and evidence-based | — | codebase-memory, creating-mermaid-diagrams, plantuml-skill |
| **API specification** | Use when adding or changing an HTTP endpoint or event channel, publishing an API to consumers, or documenting an existing undocumented API. | Document writing — clear, structured and evidence-based | — | codebase-memory, full-output-enforcement |
| **Database design document** | Use when creating a database or schema, adding or altering tables, columns or indexes, planning a migration, or documenting an existing database. | Document writing — clear, structured and evidence-based | — | creating-mermaid-diagrams, azure-postgres |
| **Integration specification** | Use when agreeing a new integration with another team or partner, changing an existing interface, onboarding a partner, or preparing integration cut-over. | Document writing — clear, structured and evidence-based | — | creating-mermaid-diagrams, azure-messaging |

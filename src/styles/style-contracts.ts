import {BrainDB} from '../core/database.ts';

// Add the requested contracts once, preserving instructions, selections and later edits.
export function installStyleContracts(db: BrainDB) {
  const key = 'style_contracts_v1';
  if (db.db.prepare('SELECT value FROM meta WHERE key=?').get(key)) {
    return 0;
  }
  const contracts: Record<
    string,
    {principles: string[]; externalSkills: string[]; reviewCriteria: string[]}
  > = {
    'personal-brain-project-design': {
      principles: [
        'One purpose per screen; compact sky-blue interfaces.',
        'Accessible controls, explicit selections and persistent URL navigation.',
      ],
      externalSkills: ['ui-ux-pro-max'],
      reviewCriteria: [
        'Inspect wide and narrow layouts: no overflow, oversized gaps or overlapping controls.',
        'Verify keyboard access, focus, labels and readable contrast.',
        'Test URL refresh/back, pagination, empty/error states and preservation of unsaved edits.',
        'Verify project selections and required dependencies are distinct from global defaults.',
      ],
    },
    'personal-brain-project-coding': {
      principles: [
        'Small complete TypeScript changes using existing helpers.',
        'Preserve records, revisions, scope isolation and validation.',
      ],
      externalSkills: ['codebase-memory'],
      reviewCriteria: [
        'Trace affected callers and validate every changed input boundary.',
        'Run the UI build and focused behavior tests; report exact failures and unperformed checks.',
        'Verify updates preserve revisions, dependencies and project overrides.',
        'Confirm generated JavaScript matches TypeScript and no dependency was added without justification.',
      ],
    },
    'personal-brain-project-technology': {
      principles: [
        'Local-first Node.js, TypeScript, SQLite and native browser capabilities.',
        'New infrastructure requires a demonstrated need.',
      ],
      externalSkills: [],
      reviewCriteria: [
        'Compare the proposed technology with the existing stack and state the concrete limitation.',
        'Verify supported runtime compatibility, offline/local operation and migration impact.',
        'Review maintenance, data portability, access boundaries and total operational cost.',
      ],
    },
    'personal-architecture-thinking': {
      principles: [
        'Design security and operations into every boundary.',
        'Record evidence, owners and unverified assumptions.',
      ],
      externalSkills: ['archify'],
      reviewCriteria: [
        'Identify trust boundaries, data sensitivity, identity, least privilege and residual risks.',
        'Assign owners, observable objectives, alerts and incident response paths.',
        'Specify rollback, backup/restore, recovery objectives and failure tests; distinguish plans from completed tests.',
      ],
    },
    'personal-architecture-technology': {
      principles: [
        'Azure first; choose the simplest service meeting workload constraints.',
        'Evaluate security, operations and cost together.',
      ],
      externalSkills: ['archify'],
      reviewCriteria: [
        'Compare viable Azure options against requirements and justify the selected service.',
        'Verify region, lifecycle, quotas and pricing using current official evidence.',
        'Document identity, network, recovery, ownership and cost assumptions; justify any other cloud.',
      ],
    },
    'personal-architecture-drawing': {
      principles: [
        'Editable draw.io flow diagrams with square boxes and labeled arrows.',
        'Sky-blue palette, explicit boundaries, legend and authentic cloud icons.',
      ],
      externalSkills: ['drawio-skill'],
      reviewCriteria: [
        'Parse the .drawio XML and verify editable nodes/connectors and rounded=0 for boxes.',
        'Open or render the diagram; inspect routing, arrow direction, labels, spacing and overlaps.',
        'Verify the legend explains colors, boundaries and line styles; confirm Azure/GCP icons match actual services and include sources.',
        'Check the drawing follows required thinking and technology styles; report any visual checks not performed.',
      ],
    },
    'personal-architecture-cloud-agnostic': {
      principles: [
        'Choose by workload fit without assuming a preferred provider.',
        'Portability is a tradeoff, not a requirement for multi-cloud.',
      ],
      externalSkills: ['archify'],
      reviewCriteria: [
        'Compare logical capabilities and viable providers against the same constraints.',
        'Assess exit/export paths, managed-service dependencies, egress, staffing and migration costs.',
        'Verify security and recovery ownership; justify abstractions and avoid unsupported portability claims.',
      ],
    },
    'personal-architecture-design-patterns': {
      principles: [
        'Prefer the simplest viable architecture.',
        'Use domain boundaries and ownership to justify distribution.',
      ],
      externalSkills: ['archify'],
      reviewCriteria: [
        'State the problem solved by each pattern and the rejected simpler alternative.',
        'Validate bounded contexts, ownership, aggregate invariants and transaction boundaries.',
        'For distributed flows, verify idempotency, retries, compensation, outbox and failure recovery assumptions.',
        'Review observability, deployment/rollback and measurable acceptance criteria.',
      ],
    },
  };
  let changed = 0;
  for (const record of db.list({kind: 'preference', limit: 300})) {
    const contract = record.tags.map((tag) => contracts[tag]).find(Boolean);
    if (!contract) {
      continue;
    }
    db.update(
      record.id,
      {
        ...record,
        principles: record.principles?.length ? record.principles : contract.principles,
        externalSkills: record.externalSkills?.length
          ? record.externalSkills
          : contract.externalSkills,
        reviewCriteria: record.reviewCriteria?.length
          ? record.reviewCriteria
          : contract.reviewCriteria,
      },
      record.version,
    );
    changed++;
  }
  db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run(key, '1');
  return changed;
}

export function installStyleExamples(db: BrainDB) {
  const key = 'style_examples_v1';
  if (db.db.prepare('SELECT value FROM meta WHERE key=?').get(key)) {
    return 0;
  }
  const examples: Record<string, string> = {
    'personal-brain-project-design':
      'Capability management: show a compact table with Rename actions. Rename opens one labeled input with Save and Cancel. Preserve drafts across pagination; display validation errors beside the form. Verify keyboard operation and narrow-screen layout before reporting completion.',
    'personal-brain-project-coding':
      'Adding a capability: validate its name at the storage boundary, persist it in SQLite, return it through the existing API, and populate the browser selector from that registry. Test duplicate names, persistence and safe rendering; build the browser bundle from TypeScript.',
    'personal-brain-project-technology':
      'For a searchable capability list, use the existing SQLite registry, HTTP endpoint and native browser input. A new search service is unnecessary for a small local collection. Reconsider only after measuring a limitation against real data.',
    'personal-architecture-thinking':
      'For an order API, identify the client-to-API and API-to-database trust boundaries. Use workload identity and least privilege. Assign an API owner, define latency and availability targets from workload requirements, and specify alerts, rollback and restore exercises. Mark planned exercises as untested.',
    'personal-architecture-technology':
      'For a small Azure HTTP API, compare App Service, Container Apps and AKS against runtime, networking, scaling and ownership constraints. Select the simplest qualifying option. Document region and pricing evidence; leave unsupported cost estimates explicitly unverified.',
    'personal-architecture-drawing':
      'Draw Client → API → Database as editable square boxes in a .drawio file. Label HTTPS and data-access arrows, show a separate identity flow and trust boundary, use sky-blue service fills and add a legend. Use official icons for selected services. Render and inspect overlaps; report if rendering was unavailable.',
    'personal-architecture-cloud-agnostic':
      'Compare managed PostgreSQL offerings against data residency, required extensions, recovery, export paths and operating cost. Choose one provider when it meets the requirements; document the exit plan rather than adding multi-cloud infrastructure without a need.',
    'personal-architecture-design-patterns':
      'Keep Ordering, Payments and Fulfilment as bounded modules first. Extract Payments only when isolation or independent deployment justifies it. For order events, specify an outbox, idempotent consumers, duplicate handling, compensation and trace correlation; test failures rather than claiming exactly-once delivery.',
  };
  let changed = 0;
  for (const r of db.list({kind: 'preference', limit: 300})) {
    const example = r.tags.map((tag) => examples[tag]).find(Boolean);
    if (example && !r.examples?.length) {
      db.update(r.id, {...r, examples: [example]}, r.version);
      changed++;
    }
  }
  db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run(key, '1');
  return changed;
}

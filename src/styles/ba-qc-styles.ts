import {BrainDB} from '../core/database.ts';
export function installBaQcStyles(db: BrainDB) {
  const key = 'ba_qc_styles_v1';
  if (db.db.prepare('SELECT value FROM meta WHERE key=?').get(key)) {
    return 0;
  }
  for (const [id, name] of [
    ['business-analysis', 'Business Analysis (BA)'],
    ['quality-control', 'Quality Control (QC)'],
  ]) {
    if (!db.hasDomain(id) && !db.domains().some((d) => d.name === name)) {
      const created = db.saveDomain(id.replace(/-/g, ' '));
      db.saveDomain(name, created.id, created.name);
    }
  }
  const definitions = [
    {
      domain: 'business-analysis',
      title: 'Business analysis — clear requirements and traceability',
      summary: 'Turn stakeholder needs into scoped, testable requirements and explicit decisions.',
      content:
        "Start with the business problem, stakeholders, current workflow, desired outcomes and constraints. Separate needs from proposed solutions. Identify actors, main and exception flows, business rules, data definitions and nonfunctional requirements. Document assumptions and unresolved decisions without inventing stakeholder approval. Write measurable acceptance criteria and trace each requirement to its source and validation method. Record scope exclusions and change impacts. Use the project's writing and drawing styles when producing documents and diagrams.",
      principles: [
        'Understand the business need before choosing a solution.',
        'Keep requirements observable, traceable and agreed with stakeholders.',
        'Separate facts, assumptions and unresolved decisions.',
      ],
      reviewCriteria: [
        'Confirm actors, business outcomes, scope and exclusions are explicit.',
        'Check normal, exception and boundary flows plus relevant nonfunctional requirements.',
        'Verify every requirement has a source and testable acceptance criteria.',
        'Identify ambiguity, contradictions, dependencies and pending approvals.',
      ],
      examples: [
        'Need: find a capability quickly. Requirement: typing a name filters the registered capability list immediately. Acceptance: matching names appear; clearing the query restores the list; an unmatched query shows a clear empty state. Source: stakeholder request. Pending: confirm whether matching must include aliases.',
      ],
    },
    {
      domain: 'quality-control',
      title: 'Quality control — evidence-based verification',
      summary:
        'Verify behavior against requirements, report actionable defects and distinguish tested from untested outcomes.',
      content:
        'Read the requirements, acceptance criteria and selected style review rules before testing. Build a risk-based test plan covering normal, boundary, failure and regression paths. Include accessibility and visual inspection when relevant. Record environment, inputs, steps, expected and actual results, and evidence. Report defects with impact, reproducibility and severity rationale. Retest fixes and identify coverage gaps. Never claim a passing automated test proves visual quality, security or complete compliance. Keep checks not performed explicitly pending and use project-private fixtures where required.',
      principles: [
        'Test observable behavior against stated acceptance criteria.',
        'Prioritize risks and reproducible evidence.',
        'Separate pass, fail, blocked and not-tested outcomes.',
      ],
      reviewCriteria: [
        'Trace test cases to requirements and style review criteria.',
        'Cover invalid inputs, boundaries, failure recovery and data preservation.',
        'Provide reproducible defect steps, expected/actual results and evidence.',
        'Report exact tests run, remaining risks and checks not performed.',
        'Retest fixes and relevant regressions before closing defects.',
      ],
      examples: [
        'Case: rename a capability to an existing name. Expected: reject the duplicate, preserve the original name and retain the draft with an inline error. Record the actual result and evidence. If browser access is unavailable, mark this interaction not tested rather than inferring success from storage tests.',
      ],
    },
  ];
  let count = 0;
  for (const d of definitions) {
    d.domain =
      db
        .domains()
        .find(
          (c) =>
            c.name ===
            (d.domain === 'business-analysis' ? 'Business Analysis (BA)' : 'Quality Control (QC)'),
        )?.id || d.domain;
    const tag = 'personal-' + d.domain;
    if (db.list({limit: 300}).some((r) => r.tags.includes(tag))) {
      continue;
    }
    db.create({
      ...d,
      kind: 'preference',
      status: 'active',
      priority: 90,
      tags: [tag, d.domain],
      externalSkills: [],
      requiredIds: [],
      checks: [],
      backend: null,
    });
    count++;
  }
  db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run(key, '1');
  return count;
}

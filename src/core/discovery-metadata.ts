import type {RecordInput} from './models.ts';

const capabilities: Record<string, [string, string[]]> = {
  coding: [
    'implementing, debugging or refactoring code and backend APIs',
    ['code', 'implement', 'debug', 'refactor', 'backend', 'api', 'typescript'],
  ],
  design: [
    'creating or changing interfaces, forms, navigation and accessible user workflows',
    ['ui', 'ux', 'layout', 'form', 'navigation', 'accessibility', 'dashboard'],
  ],
  'design-system': [
    'choosing visual tokens, colors, typography and component states',
    ['color', 'palette', 'sky-blue', 'typography', 'spacing', 'tokens', 'theme'],
  ],
  architecture: [
    'designing system boundaries, service interactions and architecture patterns',
    ['architecture', 'microservices', 'ddd', 'system design', 'integration'],
  ],
  thinking: [
    'planning decisions, security boundaries, operational ownership and tradeoffs',
    ['planning', 'security', 'operations', 'threat model', 'tradeoffs', 'recovery'],
  ],
  technology: [
    'selecting technologies or comparing services against workload constraints',
    ['technology', 'stack', 'cloud', 'azure', 'selection', 'compare', 'platform'],
  ],
  writing: [
    'writing or editing technical documents, specifications, guides and README files',
    ['writing', 'document', 'documentation', 'readme', 'specification', 'guide', 'report'],
  ],
  diagrams: [
    'drawing system flows, diagrams and architecture views',
    ['diagram', 'drawing', 'flowchart', 'flow', 'legend', 'arrows'],
  ],
  drawio: ['creating editable draw.io diagrams', ['drawio', 'draw.io', 'diagram', 'flowchart']],
  mermaid: ['creating Mermaid diagrams', ['mermaid', 'diagram', 'sequence', 'flowchart']],
  reviews: [
    'reviewing changes, testing behavior and checking evidence',
    ['review', 'audit', 'verify', 'test', 'regression', 'quality'],
  ],
  'quality-control-qc': [
    'verifying implementation, reviewing changes and reporting defects',
    ['qc', 'quality', 'review', 'test', 'verification', 'regression', 'defect'],
  ],
  'business-analysis-ba': [
    'analyzing requirements, user needs, acceptance criteria and traceability',
    ['ba', 'requirements', 'acceptance', 'stakeholder', 'user story', 'traceability'],
  ],
  communication: [
    'preparing stakeholder messages, explanations and status updates',
    ['communication', 'message', 'status', 'explain', 'stakeholder'],
  ],
  tools: [
    'selecting or invoking registered agent tools',
    ['tool', 'mcp', 'integration', 'automation'],
  ],
};

const purposePrefixes: Partial<Record<RecordInput['kind'], string>> = {
  example: 'Consult this example when ',
  skill: 'Follow this procedure when ',
  review: 'Apply these review criteria when ',
};
// Suggested metadata only: never rewrite instructions or activate draft records.
export function discoveryMetadata(
  record: Pick<RecordInput, 'kind' | 'domain' | 'title' | 'summary' | 'tags' | 'useWhen'>,
) {
  const [when, keywords] = capabilities[record.domain] || [
    `working on ${record.title}`,
    [record.domain],
  ];
  const purpose = purposePrefixes[record.kind] ?? 'Use when ';
  return {
    useWhen: record.useWhen?.trim() || `${purpose}${when}.`,
    tags: [...new Set([...record.tags, ...keywords])].slice(0, 24),
  };
}

import type {RecordInput} from '../core/models.ts';
import {commonStandard, languageStandards} from './development-standards.ts';

type Entry = RecordInput & {id: string};
export const compatibilityTargets: Record<string, string> = {
  'coding-style': 'development',
  'eng-frontend': 'development',
  'eng-backend': 'development',
  'eng-frontend-mobile': 'development',
  'eng-frontend-typescript': 'coding-typescript',
  'eng-backend-typescript': 'coding-typescript',
  'eng-backend-dotnet': 'coding-csharp',
};
const templateKeys = new Set([
  'doc-adr', 'doc-brd', 'doc-prd', 'doc-roadmap', 'doc-lld', 'doc-database',
  'doc-integration', 'doc-api', 'doc-hld', 'doc-test', 'doc-runbook',
]);
const formatChoices: Record<string, string[]> = {
  drawio: ['drawio'], mermaid: ['mermaid'],
  'doc-markdown': ['markdown', 'md'], 'doc-html': ['html'], 'doc-word': ['docx', 'dotx', 'word'],
};

/** Release preferences; execution procedures remain in skills and repository tooling. */
export function consolidateCatalog(previous: Entry[]): Entry[] {
  const records = previous.map(original => {
    const record: Entry = structuredClone(original);
    if (record.keyId === 'development') {
      return structuredClone(commonStandard);
    }
    const replacement = compatibilityTargets[record.keyId!];
    if (replacement) {
      return {
        ...record, compatibility: true, title: `${record.title} (compatibility)`,
        summary: 'Existing selections remain valid; the required standard contains the current guidance.',
        content: `COMPATIBILITY REFERENCE\nThis record preserves existing IDs and selections. Follow the required ${replacement} standard. Choose the relevant language substyle and task context; do not activate every language or framework.`,
        principles: [], requirements: [], reviewCriteria: [], examples: [], checks: [],
        externalSkills: [], skillBindings: [], preferences: [], supportingLinks: [], requiredIds: [replacement],
      };
    }
    // Specialized references are selected for their own task, not inherited by ordinary coding.
    record.supportingLinks = [];
    record.requiredIds = templateKeys.has(record.keyId!) || formatChoices[record.keyId!]
      ? [record.keyId === 'drawio' || record.keyId === 'mermaid' ? 'drawing' : 'writing']
      : record.keyId === 'writing' || record.keyId === 'review-standard' || record.keyId === 'research'
        ? ['quality-control'] : [];
    if (record.keyId === 'review-standard') {
      record.requiredIds.push('review-checklist');
    }
    if (templateKeys.has(record.keyId!)) {
      record.kind = 'example';
    }
    if (formatChoices[record.keyId!]) {
      record.appliesWhen = {formats: formatChoices[record.keyId!]};
      record.preferences = [];
    }
    if (record.keyId === 'doc-word') {
      record.requirements = [{
        id: 'req-word-source', type: 'artifact', extensions: ['.docx', '.dotx'],
        label: 'Editable Word document or template in the requested format.',
      }];
    }
    // Remove format decisions from specialist records: each requested output owns its format.
    if (!formatChoices[record.keyId!]) {
      record.preferences = record.preferences?.filter(p => !['diagram.format', 'document.format'].includes(p.key));
    }
    record.content = record.content
      .replaceAll('Run the commands pattern above;', 'Run the applicable repository quality checks;')
      .replaceAll('camelCase.ts', 'kebab-case.ts')
      .replaceAll('placeOrder.ts', 'place-order.ts')
      .replaceAll('getOrders.ts', 'get-orders.ts');
    record.examples = record.examples?.map(example => example
      .replaceAll('placeOrder.ts', 'place-order.ts').replaceAll('getOrders.ts', 'get-orders.ts'));
    if (record.keyId === 'network-architecture' || record.keyId === 'doc-database') {
      const normalizeFormat = (text: string) => text
        .replace(/\.drawio/g, 'diagram source')
        .replace(/Draw\.io/g, 'the selected diagram format')
        .replace(/Mermaid erDiagram|erDiagram/g, 'entity-relationship diagram');
      record.content = normalizeFormat(record.content);
      record.principles = record.principles?.map(normalizeFormat);
      record.reviewCriteria = record.reviewCriteria?.map(normalizeFormat);
      record.requirements = record.requirements?.map(requirement => ({
        ...requirement, label: normalizeFormat(requirement.label),
      }));
      record.examples = record.examples?.map(normalizeFormat);
    }
    const scope = templateKeys.has(record.keyId!)
      ? 'Apply this template only when its document is requested or explicitly in scope. It does not require creating a new document for an unrelated coding task.'
      : 'Apply this specialist guidance only to the task and artifacts actually in scope. Scale evidence to the change; do not create formal documents, infrastructure, integrations or tool installations solely because this record is available. Existing project decisions and explicit task instructions take precedence over defaults.';
    record.content = `${scope}\n\n${record.content}`;
    if (record.keyId === 'thinking') {
      const scaleDecision = (text: string) => text
        .replace(/at least three options/gi, 'appropriate alternatives for significant decisions')
        .replace(/a trade-off table/g, 'a trade-off comparison when needed')
        .replace(/The trade-off table covers/g, 'For significant decisions, the comparison covers');
      record.content = scaleDecision(record.content);
      record.principles = record.principles?.map(scaleDecision);
      record.reviewCriteria = record.reviewCriteria?.map(scaleDecision);
      record.requirements = record.requirements?.map(requirement => ({
        ...requirement, label: scaleDecision(requirement.label),
      }));
      record.content += '\n\nSmall reversible decisions need only a short rationale. Compare alternatives and record formal ADRs for significant decisions; do not invent options to meet a fixed count.';
    }
    return record;
  });
  return [...records, ...languageStandards];
}

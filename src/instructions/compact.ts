import type {BrainRecord} from '../core/models.ts';

// Catalog styles repeat the same scope and procedures paragraphs, and restate the summary,
// useWhen and principles fields as content sections. complianceInstructions carries the shared
// rules once, so agents get each record without the repeats (about a quarter of all content).
const SHARED = [
  'Apply this specialist guidance only to the task and artifacts actually in scope. Scale evidence to the change; do not create formal documents, infrastructure, integrations or tool installations solely because this record is available. Existing project decisions and explicit task instructions take precedence over defaults.',
  'Apply this template only when its document is requested or explicitly in scope. It does not require creating a new document for an unrelated coding task.',
  'PROCEDURES\nUse relevant installed skills for technical steps. Their incidental defaults do not override explicit task choices or applicable personal preferences. A missing optional skill is not a reason to invent verification.',
];

/** Content without the shared scope and procedures paragraphs (stated once by the caller). */
export function withoutSharedText(content: string): string {
  let out = content;
  for (const text of SHARED) {
    out = out.split(text).join('');
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** The record as an agent should read it; stored content is unchanged. */
export function compactForAgent<T extends BrainRecord>(record: T): T {
  let content = record.content || '';
  for (const text of SHARED) {
    content = content.split(text).join('');
  }
  const same = (a: string, b: string) =>
    a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();
  const bullets = (body: string) =>
    body
      .trim()
      .split('\n')
      .map((line) => line.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean);
  const sections: Array<[string, (body: string) => boolean]> = [
    ['PERSONAL PREFERENCES', (body) => !!record.summary && same(body, record.summary)],
    ['APPLIES WHEN', (body) => !!record.useWhen && same(body, record.useWhen)],
    [
      'PREFERRED OUTCOMES',
      (body) =>
        !!record.principles?.length &&
        JSON.stringify(bullets(body)) === JSON.stringify(record.principles.map((p) => p.trim())),
    ],
  ];
  for (const [name, duplicate] of sections) {
    const match = new RegExp(`(^|\\n)${name}\\n([\\s\\S]*?)(?=\\n\\n[A-Z][A-Z /&()-]+\\n|$)`).exec(
      content,
    );
    if (match && duplicate(match[2])) {
      content = content.replace(match[0], match[1]);
    }
  }
  content = content.replace(/\n{3,}/g, '\n\n').trim();
  return content === record.content ? record : {...record, content};
}

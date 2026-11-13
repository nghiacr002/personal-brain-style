import {createHash} from 'node:crypto';

export const LEARNING_MODES = ['off', 'suggest', 'explicit'] as const;
export type LearningMode = (typeof LEARNING_MODES)[number];
export const DEFAULT_RETENTION_DAYS = 90;

// ponytail: pattern list catches common token shapes only; add an entropy scanner if leaks appear.
const CREDENTIAL =
  /(sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[abprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bbearer\s+[A-Za-z0-9._-]{20,}|\b(password|passwd|secret|api[_-]?key|(access[_-]?)?token)\s*[:=]\s*\S{6,})/i;
const entropy = (token: string) => {
  const counts = new Map<string, number>();
  for (const c of token) {
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  return [...counts.values()].reduce(
    (h, n) => h - (n / token.length) * Math.log2(n / token.length),
    0,
  );
};
/** Long, mixed-class, high-entropy tokens are treated as secrets even without a known prefix. */
const randomToken = (text: string) =>
  (text.match(/[A-Za-z0-9+/=_-]{24,}/g) || []).some(
    (t) => /[a-z]/.test(t) && /[A-Z]/.test(t) && /\d/.test(t) && entropy(t) > 4,
  );
export const looksLikeCredential = (text: string) => CREDENTIAL.test(text) || randomToken(text);

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

/** Hash only, so a dismissed idea can be recognized without retaining its text. */
export const suppressionFingerprint = (action: string, recordId: string | null, text: string) =>
  createHash('sha256')
    .update(`${action}|${recordId || ''}|${normalize(text)}`)
    .digest('hex');

// ponytail: keyword heuristic for mandatory statements; a semantic fixture runner can replace it.
const OBLIGATION = /\b(must|never|always|required|do not|don't|shall|mandatory)\b/i;

/** Mandatory sentences in `before` whose normalized text no longer appears in `after`. */
export function lostObligations(before: string, after: string): string[] {
  const kept = normalize(after);
  return before
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s && OBLIGATION.test(s) && !kept.includes(normalize(s)));
}

export type Fixtures = {keep: string[]; avoid: string[]};
/** Regression phrases a revision must keep or must not introduce. Failure blocks activation. */
export function fixtureFailures(fixtures: Fixtures, content: string): string[] {
  const text = normalize(content);
  return [
    ...fixtures.keep.filter((p) => !text.includes(normalize(p))).map((p) => 'Missing: ' + p),
    ...fixtures.avoid.filter((p) => text.includes(normalize(p))).map((p) => 'Contains: ' + p),
  ];
}
export function checkFixtures(raw: unknown): Fixtures {
  const x = (raw || {}) as {keep?: unknown; avoid?: unknown};
  const list = (v: unknown) => {
    if (
      !Array.isArray(v) ||
      v.length > 50 ||
      v.some((p) => typeof p !== 'string' || p.length > 500)
    ) {
      throw new Error('Fixtures need up to 50 phrases of at most 500 characters');
    }
    return [...new Set((v as string[]).map((p) => p.trim()).filter(Boolean))];
  };
  return {keep: list(x.keep ?? []), avoid: list(x.avoid ?? [])};
}
export const keyReceipt = (keyId: string) =>
  createHash('sha256')
    .update('deleted-key|' + keyId)
    .digest('hex');

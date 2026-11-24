// Adds the current release catalog's fingerprints to src/styles/catalog-baseline.ts, so an unedited
// copy of this release can upgrade later. Run before each release:
//   node scripts/run.mjs scripts/catalog-baseline.mjs
import {readFileSync, writeFileSync} from 'node:fs';
import {globalStyleCatalog} from '../src/styles/global-style-catalog.ts';
import {catalogBaseline} from '../src/styles/catalog-baseline.ts';
import {fingerprint} from '../src/styles/catalog-upgrade.ts';

const file = new URL('../src/styles/catalog-baseline.ts', import.meta.url);
const next = structuredClone(catalogBaseline);
let added = 0;
for (const r of globalStyleCatalog) {
  const list = (next[r.keyId] ||= []);
  const value = fingerprint(r);
  if (!list.includes(value)) {
    list.push(value);
    added++;
  }
}
const sorted = Object.fromEntries(
  Object.keys(next)
    .sort()
    .map((k) => [k, next[k]]),
);
const source = readFileSync(file, 'utf8');
const start = source.indexOf('export const catalogBaseline');
const end = source.indexOf('export const catalogBaselineLinks');
writeFileSync(
  file,
  source.slice(0, start) +
    `export const catalogBaseline: Record<string, string[]> = ${JSON.stringify(sorted, null, 2)};\n\n` +
    source.slice(end),
);
console.log(`catalog-baseline: ${added} new fingerprints`);

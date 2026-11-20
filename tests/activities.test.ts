import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITIES,
  activityList,
  applicability,
  normalizeActivity,
  validateApplicability,
  validateTaskContext,
} from '../src/core/preference-contract.ts';
import {globalStyleCatalog, previousCatalog} from '../src/styles/global-style-catalog.ts';

test('agent wording maps onto the fixed activity list', () => {
  assert.equal(normalizeActivity('Coding'), 'implement');
  assert.equal(normalizeActivity('bug fix'), 'implement');
  assert.equal(normalizeActivity('QA'), 'test');
  assert.equal(normalizeActivity('deploy'), 'release');
  assert.equal(normalizeActivity('review'), 'review');
  assert.equal(normalizeActivity('gardening'), undefined);
  assert.equal(validateTaskContext({activity: 'Development'}).activity, 'implement');
});

test('unrecognized task wording is unresolved, never silently not applicable', () => {
  const when = {activities: ['implement']};
  assert.equal(applicability(when, validateTaskContext({activity: 'coding'})), 'applicable');
  assert.equal(applicability(when, validateTaskContext({activity: 'review'})), 'not_applicable');
  assert.equal(applicability(when, validateTaskContext({activity: 'gardening'})), 'unresolved');
  assert.equal(applicability(when, validateTaskContext({})), 'unresolved');
});

test('phrases match every activity they name', () => {
  const when = (activities: string[], activity: string) =>
    applicability({activities}, validateTaskContext({activity}));
  assert.deepEqual(activityList('development and verification'), ['implement', 'test']);
  assert.deepEqual(activityList('bug fix and review'), ['implement', 'review']);
  assert.deepEqual(activityList('code review and remediation'), ['review', 'implement']);
  assert.deepEqual(activityList('requirements and design documentation'), [
    'analyze',
    'design',
    'document',
  ]);
  assert.deepEqual(activityList('writing-documents'), ['document']);
  assert.equal(when(['test'], 'development and verification'), 'applicable');
  assert.equal(when(['release'], 'development and verification'), 'not_applicable');
  assert.equal(when(['implement'], 'gardening and cooking'), 'unresolved');
});

test('styles may only name listed activities; synonyms are stored as the listed name', () => {
  assert.deepEqual(validateApplicability({activities: ['coding', 'implement', 'QA']}).activities, [
    'implement',
    'test',
  ]);
  assert.throws(
    () => validateApplicability({activities: ['gardening']}),
    /Unknown activity "gardening"/,
  );
});

test('every built-in style names only listed activities', () => {
  const used = new Set<string>();
  const walk = (value: unknown, key?: string) => {
    if (key === 'activities' && Array.isArray(value)) {
      value.forEach((a) => used.add(a));
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        walk(v, k);
      }
    }
  };
  walk([...previousCatalog, ...globalStyleCatalog]);
  assert.ok(used.size > 0);
  const unknown = [...used].filter((a) => !(ACTIVITIES as readonly string[]).includes(a));
  assert.deepEqual(unknown, []);
});

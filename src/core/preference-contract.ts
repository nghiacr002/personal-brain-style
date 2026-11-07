import {BrainError, type Applicability, type TaskContext, type BrainRecord} from './models.ts';

const object = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BrainError('Expected preference contract object');
  }
  return value as Record<string, any>;
};
const text = (value: unknown, max = 2000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new BrainError('Invalid preference text');
  }
  return value.trim();
};
const list = (value: unknown, max = 30): any[] => {
  if (!Array.isArray(value) || value.length > max) {
    throw new BrainError('Invalid preference list');
  }
  return value;
};
function fields(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((k) => !allowed.includes(k))) {
    throw new BrainError('Unknown preference contract field');
  }
}
export function validateApplicability(value: unknown): Applicability {
  const v = object(value);
  fields(v, ['activities', 'formats', 'languages', 'frameworks', 'targets']);
  const result: Applicability = {};
  for (const key of ['activities', 'formats', 'languages', 'frameworks', 'targets'] as const) {
    if (v[key] !== undefined) {
      result[key] = list(v[key], 20).map((x) => text(x, 80).toLowerCase());
      if (!result[key]!.length) {
        throw new BrainError('Applicability list must not be empty');
      }
    }
  }
  if (!Object.keys(result).length) {
    throw new BrainError('Conditional guidance needs activities or formats');
  }
  return result;
}
export function validatePreferences(value: unknown) {
  const seen = new Set<string>();
  return list(value).map((item) => {
    const v = object(item);
    fields(v, ['key', 'value']);
    const key = text(v.key, 80);
    if (!/^[a-z][a-z0-9.-]*$/.test(key) || seen.has(key)) {
      throw new BrainError('Invalid or duplicate preference key');
    }
    seen.add(key);
    return {key, value: text(v.value, 500)};
  });
}
export function validateTaskContext(value: unknown): TaskContext {
  if (value === undefined) {
    return {};
  }
  const v = object(value);
  fields(v, ['activity', 'formats', 'languages', 'frameworks', 'targets', 'preferences']);
  return {
    ...(v.activity !== undefined ? {activity: text(v.activity, 80).toLowerCase()} : {}),
    ...Object.fromEntries(
      ['languages', 'frameworks', 'targets']
        .filter((key) => v[key] !== undefined)
        .map((key) => [key, list(v[key], 20).map((x) => text(x, 80).toLowerCase())]),
    ),
    ...(v.formats !== undefined
      ? {formats: list(v.formats, 20).map((x) => text(x, 80).toLowerCase())}
      : {}),
    ...(v.preferences !== undefined ? {preferences: validatePreferences(v.preferences)} : {}),
  };
}
export function applicability(when: Applicability | undefined, context: TaskContext) {
  if (!when) {
    return 'applicable';
  }
  let unresolved = false;
  for (const key of ['activities', 'formats', 'languages', 'frameworks', 'targets'] as const) {
    const expected = when[key];
    if (!expected) {
      continue;
    }
    const actual =
      key === 'activities' ? (context.activity ? [context.activity] : undefined) : context[key];
    if (actual === undefined) {
      unresolved = true;
    } else if (!expected.some((value) => actual.includes(value))) {
      return 'not_applicable';
    }
  }
  return unresolved ? 'unresolved' : 'applicable';
}

export function validatePreferenceContract(value: Record<string, unknown>): Partial<BrainRecord> {
  const result: Partial<BrainRecord> = {
    compatibility: undefined,
    standardLanguage: undefined,
    appliesWhen: undefined,
  };
  if (value.compatibility !== undefined) {
    if (typeof value.compatibility !== 'boolean') {
      throw new BrainError('Invalid compatibility flag');
    }
    result.compatibility = value.compatibility;
  }
  if (value.standardLanguage !== undefined) {
    result.standardLanguage = text(value.standardLanguage, 80);
  }
  if (value.appliesWhen !== undefined) {
    result.appliesWhen = validateApplicability(value.appliesWhen);
  }
  if (value.sourceVersion !== undefined) {
    if (!Number.isInteger(value.sourceVersion) || Number(value.sourceVersion) < 1) {
      throw new BrainError('Invalid source version');
    }
    result.sourceVersion = Number(value.sourceVersion);
  }
  if (value.preferences !== undefined) {
    result.preferences = validatePreferences(value.preferences);
  }
  if (value.supportingLinks !== undefined) {
    result.supportingLinks = list(value.supportingLinks, 12).map((item) => {
      const v = object(item);
      fields(v, ['recordId', 'when']);
      return {recordId: text(v.recordId, 150), when: validateApplicability(v.when)};
    });
  }
  if (value.skillBindings !== undefined) {
    result.skillBindings = list(value.skillBindings).map((item) => {
      const v = object(item);
      fields(v, ['name', 'when', 'required', 'fallback']);
      if (typeof v.required !== 'boolean') {
        throw new BrainError('Skill binding needs required boolean');
      }
      return {
        name: text(v.name, 150),
        required: v.required,
        fallback: text(v.fallback),
        ...(v.when !== undefined ? {when: validateApplicability(v.when)} : {}),
      };
    });
  }
  return result;
}
export const linkedIds = (record: Pick<BrainRecord, 'requiredIds' | 'supportingLinks'>) => [
  ...new Set([
    ...(record.requiredIds || []),
    ...(record.supportingLinks || []).map((x) => x.recordId),
  ]),
];

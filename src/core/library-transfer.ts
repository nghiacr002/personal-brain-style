import {createHash} from 'node:crypto';
import {BrainDB, checkInput} from './database.ts';
import {BrainError, validDomain, type RecordInput} from './models.ts';
import {linkedIds} from './preference-contract.ts';

export const libraryTransferLimit = 5_000_000;
type Entry = RecordInput & {id: string};
type Bundle = {
  format: 'personal-brain-library';
  version: 1;
  records: Entry[];
  domains: Array<{id: string; name: string; combinable: boolean}>;
};
function selection(value: unknown) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > 300 ||
    !value.every((id) => typeof id === 'string') ||
    new Set(value).size !== value.length
  ) {
    throw new BrainError('Select 1–300 unique library items');
  }
  return value as string[];
}
function parseBundle(value: unknown): Bundle {
  if (
    !value ||
    typeof value !== 'object' ||
    Buffer.byteLength(JSON.stringify(value)) > libraryTransferLimit
  ) {
    throw new BrainError('Invalid or oversized library file');
  }
  const b = value as Bundle;
  if (
    b.format !== 'personal-brain-library' ||
    b.version !== 1 ||
    !Array.isArray(b.records) ||
    !b.records.length ||
    b.records.length > 300 ||
    !Array.isArray(b.domains) ||
    b.domains.length > 300
  ) {
    throw new BrainError('Unsupported library file; expected personal-brain-library version 1');
  }
  const ids = new Set<string>(),
    keys = new Set<string>(),
    domains = new Set<string>();
  for (const d of b.domains) {
    if (
      !d ||
      !validDomain(d.id) ||
      d.id === 'all' ||
      typeof d.name !== 'string' ||
      !d.name.trim() ||
      d.name.length > 60 ||
      typeof d.combinable !== 'boolean' ||
      domains.has(d.id)
    ) {
      throw new BrainError('Invalid or duplicate capability');
    }
    domains.add(d.id);
  }
  const records = b.records.map((r) => {
    if (
      !r ||
      typeof r.id !== 'string' ||
      !r.id ||
      r.id.length > 150 ||
      ids.has(r.id) ||
      r.projectId ||
      r.sourceStyleId ||
      r.sourceVersion
    ) {
      throw new BrainError('Invalid, duplicate or private library item');
    }
    const item = checkInput(r);
    if (!domains.has(item.domain) || keys.has(item.keyId!)) {
      throw new BrainError('Missing capability or duplicate item key');
    }
    ids.add(r.id);
    keys.add(item.keyId!);
    return {...item, id: r.id, backend: item.backend ? {...item.backend, enabled: false} : null};
  });
  const done = new Set<string>(),
    visiting = new Set<string>();
  const visit = (id: string) => {
    if (done.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      throw new BrainError('Library links contain a cycle');
    }
    const r = records.find((r) => r.id === id);
    if (!r) {
      throw new BrainError('Library file is missing a linked item');
    }
    visiting.add(id);
    for (const child of linkedIds(r)) {
      const target = records.find((r) => r.id === child);
      if (target?.status !== 'active') {
        throw new BrainError('Linked items must exist and be active');
      }
      visit(child);
    }
    visiting.delete(id);
    done.add(id);
  };
  records.forEach((r) => visit(r.id));
  return {...b, records};
}
export function exportLibrary(db: BrainDB, ids: unknown) {
  const records: Entry[] = [],
    seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    const r = db.get(id);
    if (!r || r.projectId) {
      throw new BrainError('Export accepts shared library items only');
    }
    for (const child of linkedIds(r)) {
      visit(child);
    }
    const clean = checkInput(r);
    delete clean.projectId;
    delete clean.sourceStyleId;
    delete clean.sourceVersion;
    records.push({
      ...clean,
      id: r.id,
      backend: clean.backend ? {...clean.backend, enabled: false} : null,
    });
  };
  selection(ids).forEach(visit);
  const bundle = parseBundle({
    format: 'personal-brain-library',
    version: 1,
    records,
    domains: db.domains().filter((d) => records.some((r) => r.domain === d.id)),
  });
  if (Buffer.byteLength(JSON.stringify(bundle, null, 2)) > 4_800_000) {
    throw new BrainError('Export is too large; select fewer items');
  }
  return bundle;
}
export function previewLibraryImport(db: BrainDB, value: unknown) {
  const bundle = parseBundle(value);
  const items = bundle.records.map((r) => {
    const existing = db.styleByKey(r.keyId!);
    const conflict =
      existing &&
      (existing.kind !== r.kind || existing.domain !== r.domain || existing.status !== r.status);
    return {
      id: r.id,
      title: r.title,
      summary: r.summary,
      content: r.content,
      kind: r.kind,
      keyId: r.keyId,
      linkedIds: linkedIds(r),
      action: conflict ? 'conflict' : existing ? 'keep' : 'create',
      existingId: existing?.id,
      existingVersion: existing?.version,
    };
  });
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({bundle, items, domains: db.domains()}))
    .digest('hex');
  return {items, fingerprint};
}
export function importLibrary(db: BrainDB, value: unknown, ids: unknown, fingerprint: unknown) {
  return db.transaction(() => {
    const bundle = parseBundle(value),
      preview = previewLibraryImport(db, value);
    if (preview.fingerprint !== fingerprint) {
      throw new BrainError('Library changed; preview the import again', 'CONFLICT', 409);
    }
    const mapped = new Map<string, string>();
    let created = 0,
      kept = 0;
    const visit = (id: string): string => {
      if (mapped.has(id)) {
        return mapped.get(id)!;
      }
      const row = bundle.records.find((r) => r.id === id),
        plan = preview.items.find((r) => r.id === id);
      if (!row || !plan) {
        throw new BrainError('Selected item is not in this library file');
      }
      if (plan.action === 'conflict') {
        throw new BrainError(
          'Existing key has a different type, capability or status: ' + row.keyId,
        );
      }
      if (plan.action === 'keep') {
        mapped.set(id, plan.existingId!);
        kept++;
        return plan.existingId!;
      }
      const requiredIds = (row.requiredIds || []).map(visit),
        supportingLinks = row.supportingLinks?.map((l) => ({...l, recordId: visit(l.recordId)}));
      if (!db.hasDomain(row.domain)) {
        const d = bundle.domains.find((d) => d.id === row.domain)!;
        const made = db.saveDomain(d.id, undefined, undefined, d.combinable);
        if (made.name !== d.name) {
          db.saveDomain(d.name, made.id, made.name, d.combinable);
        }
      }
      const record = db.create({...row, requiredIds, supportingLinks});
      mapped.set(id, record.id);
      created++;
      return record.id;
    };
    selection(ids).forEach(visit);
    return {created, kept, recordIds: [...mapped.values()]};
  });
}

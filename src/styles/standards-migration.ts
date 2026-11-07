import {createHash, randomUUID} from 'node:crypto';
import {BrainDB, checkInput} from '../core/database.ts';
import {BrainError, type BrainRecord, type RecordInput} from '../core/models.ts';
import {globalStyleCatalog} from './global-style-catalog.ts';
import {knownStandardsBaselines} from './standards-baselines.ts';

export const standardsMigrationMarker = 'development_standards_v2';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}
export function standardsFingerprint(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
}
export function standardInput(record: RecordInput, keyForId: (id: string) => string): RecordInput {
  const input = checkInput(record);
  return {
    ...input,
    compatibility: input.compatibility || false,
    preferences: input.preferences || [],
    skillBindings: input.skillBindings || [],
    requiredIds: (input.requiredIds || []).map(keyForId),
    supportingLinks: (input.supportingLinks || []).map((link) => ({
      ...link,
      recordId: keyForId(link.recordId),
    })),
  };
}
function state(db: BrainDB) {
  return {records: db.list({limit: 300}), projects: db.projects(), domains: db.domains()};
}

export function previewStandardsMigration(db: BrainDB) {
  const snapshot = state(db);
  const keyForId = (id: string) => snapshot.records.find((record) => record.id === id)?.keyId || id;
  const items = globalStyleCatalog.map((source) => {
    const existing = snapshot.records.find(
      (record) => !record.projectId && record.keyId === source.keyId,
    );
    const proposed = standardInput(source, (key) => key);
    const before = existing ? standardInput(existing, keyForId) : null;
    const currentHash = before ? standardsFingerprint(before) : '';
    const overridden =
      existing &&
      snapshot.projects.some((project) =>
        project.assignments.some(
          (assignment) => assignment.recordId === existing.id && assignment.override !== null,
        ),
      );
    const action = !existing
      ? 'create'
      : currentHash === standardsFingerprint(proposed)
        ? 'keep'
        : overridden ||
            existing.status !== 'active' ||
            !knownStandardsBaselines[source.keyId!]?.includes(currentHash)
          ? 'conflict'
          : 'update';
    return {
      key: source.keyId!,
      id: existing?.id,
      version: existing?.version,
      title: source.title,
      action,
      before,
      after: proposed,
      reason:
        action === 'conflict'
          ? 'Personal edits, project text override or unknown baseline; preserve and compare manually.'
          : '',
    };
  });
  return {
    fingerprint: standardsFingerprint({snapshot, catalog: globalStyleCatalog}),
    items,
    conflicts: items.filter((item) => item.action === 'conflict').map((item) => item.key),
    projectSelectionsChanged: false,
  };
}

/** Explicit migration only; startup seeding never overwrites an existing library. */
export function applyStandardsMigration(db: BrainDB, expectedFingerprint: string) {
  return db.transaction(() => {
    const preview = previewStandardsMigration(db);
    if (preview.fingerprint !== expectedFingerprint) {
      throw new BrainError(
        'Library changed; preview the standards migration again',
        'CONFLICT',
        409,
      );
    }
    if (preview.conflicts.length) {
      throw new BrainError(
        'Standards migration preserves personal edits; resolve conflicts before applying: ' +
          preview.conflicts.join(', '),
        'CONFLICT',
        409,
      );
    }
    if (preview.items.every((item) => item.action === 'keep')) {
      return {changed: 0, created: 0, migrationId: null};
    }
    const before = state(db);
    const mapped = new Map(
      before.records
        .filter((record) => !record.projectId)
        .map((record) => [record.keyId!, record.id]),
    );
    const created: string[] = [];
    const create = (key: string): string => {
      const existing = mapped.get(key);
      if (existing) {
        return existing;
      }
      const source = globalStyleCatalog.find((record) => record.keyId === key);
      if (!source) {
        throw new BrainError('Missing standard: ' + key);
      }
      const input = standardInput(source, create);
      const record = db.create(input);
      mapped.set(key, record.id);
      created.push(record.id);
      return record.id;
    };
    for (const item of preview.items.filter((item) => item.action === 'create')) {
      create(item.key);
    }
    const changes = preview.items
      .filter((item) => item.action === 'update')
      .map((item) => ({
        id: item.id!,
        expectedVersion: item.version!,
        input: standardInput(
          globalStyleCatalog.find((source) => source.keyId === item.key)!,
          (key) => mapped.get(key)!,
        ),
      }));
    db.updateBatch(changes);
    const migrationId = randomUUID();
    const after = state(db);
    const manifest = {
      migrationId,
      before: before.records.filter((record) => changes.some((change) => change.id === record.id)),
      created,
      afterFingerprint: standardsFingerprint(after),
      previousMarker:
        db.db.prepare('SELECT value FROM meta WHERE key=?').get(standardsMigrationMarker)?.value ??
        null,
    };
    db.db
      .prepare('INSERT INTO meta(key,value) VALUES(?,?)')
      .run('standards-migration:' + migrationId, JSON.stringify(manifest));
    db.db
      .prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)')
      .run(standardsMigrationMarker, migrationId);
    return {changed: changes.length, created: created.length, migrationId};
  });
}

export function rollbackStandardsMigration(db: BrainDB, migrationId: string) {
  return db.transaction(() => {
    const row = db.db
      .prepare('SELECT value FROM meta WHERE key=?')
      .get('standards-migration:' + migrationId);
    if (!row) {
      throw new BrainError('Standards migration not found');
    }
    const manifest = JSON.parse(String(row.value)) as {
      before: BrainRecord[];
      created: string[];
      afterFingerprint: string;
      previousMarker: string | null;
    };
    if (standardsFingerprint(state(db)) !== manifest.afterFingerprint) {
      throw new BrainError(
        'Library changed after migration; rollback would overwrite later edits',
        'CONFLICT',
        409,
      );
    }
    const restore = manifest.before.map((record) => ({
      id: record.id,
      expectedVersion: db.get(record.id)!.version,
      input: {
        ...checkInput(record),
        preferences: record.preferences || [],
        supportingLinks: record.supportingLinks || [],
        skillBindings: record.skillBindings || [],
      },
    }));
    const archive = manifest.created.map((id) => ({
      id,
      expectedVersion: db.get(id)!.version,
      input: {status: 'archived' as const, requiredIds: [], supportingLinks: []},
    }));
    db.updateBatch([...restore, ...archive]);
    if (manifest.previousMarker === null) {
      db.db.prepare('DELETE FROM meta WHERE key=?').run(standardsMigrationMarker);
    } else {
      db.db
        .prepare('UPDATE meta SET value=? WHERE key=?')
        .run(manifest.previousMarker, standardsMigrationMarker);
    }
    db.db.prepare('DELETE FROM meta WHERE key=?').run('standards-migration:' + migrationId);
    return {restored: restore.length, archived: archive.length};
  });
}

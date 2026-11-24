import {createHash} from 'node:crypto';
import {BrainDB, checkInput} from '../core/database.ts';
import {BrainError, type BrainRecord} from '../core/models.ts';
import {catalogBaseline, catalogBaselineLinks} from './catalog-baseline.ts';
import {globalStyleCatalog} from './global-style-catalog.ts';
import {validateRequirements} from '../core/requirements.ts';

export const fingerprint = (r: Partial<BrainRecord>) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        content: r.content,
        principles: r.principles || [],
        reviewCriteria: r.reviewCriteria || [],
        externalSkills: r.externalSkills || [],
        // Saving normalizes requirements (for example their conditions), so compare that form.
        requirements: validateRequirements(r.requirements || []),
        checks: r.checks || [],
      }),
    )
    .digest('hex');
export function catalogUpgradePreview(db: BrainDB) {
  const rows = db.list({limit: 300}).filter((r) => !r.projectId);
  return rows.flatMap((current) => {
    const proposed = globalStyleCatalog.find((r) => r.keyId === current.keyId);
    // A release can change only requirements, criteria, title, tags or Use when text; those count too.
    const surface = (r: Partial<BrainRecord>) =>
      JSON.stringify([fingerprint(r), r.title, r.summary, r.useWhen, [...(r.tags || [])].sort()]);
    if (!proposed || surface(current) === surface(proposed)) {
      return [];
    }
    const originalLinks = catalogBaselineLinks[current.keyId!] || [];
    const links = JSON.stringify((current.requiredIds || []).map((id) => db.get(id)?.keyId).sort());
    // Links of the first release, or of the current release (later releases added links).
    const releasedLinks = [originalLinks, proposed.requiredIds || []].map((l) =>
      JSON.stringify([...l].sort()),
    );
    const unchanged =
      (catalogBaseline[current.keyId!] || []).includes(fingerprint(current)) &&
      releasedLinks.includes(links) &&
      !current.supportingLinks?.length &&
      // Catalog skill bindings are release content, not personal edits.
      (!current.skillBindings?.length ||
        JSON.stringify(current.skillBindings) === JSON.stringify(proposed.skillBindings || [])) &&
      (!current.preferences?.length ||
        JSON.stringify(current.preferences) === JSON.stringify(proposed.preferences || []));
    return [
      {
        id: current.id,
        version: current.version,
        title: current.title,
        eligible: unchanged,
        reason: unchanged
          ? 'Known release content; review before applying'
          : 'Personal or unknown content: preserve and compare manually',
        before: JSON.stringify(
          {
            content: current.content,
            requiredIds: current.requiredIds,
            externalSkills: current.externalSkills,
            supportingLinks: current.supportingLinks,
            skillBindings: current.skillBindings,
            preferences: current.preferences,
          },
          null,
          2,
        ),
        after: JSON.stringify(
          {
            content: proposed.content,
            requiredKeys: proposed.requiredIds,
            externalSkills: proposed.externalSkills,
            supportingLinks: proposed.supportingLinks,
            skillBindings: proposed.skillBindings,
            preferences: proposed.preferences,
          },
          null,
          2,
        ),
      },
    ];
  });
}
export function applyCatalogUpgrade(db: BrainDB, id: string, expectedVersion: number) {
  return db.transaction(() => {
    const preview = catalogUpgradePreview(db).find((r) => r.id === id);
    if (!preview?.eligible || preview.version !== expectedVersion) {
      throw new BrainError(
        'Catalog candidate changed or contains personal edits; refresh the preview',
        'CONFLICT',
        409,
      );
    }
    const current = db.get(id)!,
      source = globalStyleCatalog.find((r) => r.keyId === current.keyId)!;
    const lookup = (key: string) => {
      const row = db
        .list({limit: 300})
        .find((r) => !r.projectId && r.keyId === key && r.status === 'active');
      if (!row) {
        throw new BrainError('Required catalog style missing: ' + key);
      }
      return row.id;
    };
    // Explicit update only: private copies, assignments and deleted records are never replaced.
    return db.update(
      id,
      {
        ...checkInput(source),
        sourceStyleId: current.sourceStyleId,
        sourceVersion: current.sourceVersion,
        projectId: current.projectId,
        supportingLinks: source.supportingLinks?.map((l) => ({...l, recordId: lookup(l.recordId)})),
        requiredIds: source.requiredIds?.map(lookup),
      },
      expectedVersion,
    );
  });
}

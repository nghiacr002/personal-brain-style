import {existsSync, readFileSync, realpathSync, unlinkSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {BrainDB} from '../core/database.ts';
import {BrainError, type BrainRecord} from '../core/models.ts';
import {resolveProjectScope, linkRepository} from './project-scope.ts';
import {projectFolder} from './skill-discovery.ts';
import {repositoryEvidence} from './repository-evidence.ts';
import {analyzeStyles} from './style-analysis.ts';

// allowLinked: read-only callers and an explicit "replace link" choice may use a linked folder.
export function onboardingFolder(folder: unknown, allowLinked = false) {
  if (typeof folder !== 'string' || !folder.trim()) {
    throw new BrainError('Enter the absolute repository folder path.');
  }
  const scope = resolveProjectScope(undefined, folder.trim(), '');
  if (scope.projectId && !allowLinked) {
    throw new BrainError(
      'This folder already belongs to a project. Open that project, or choose an unlinked folder.',
      'CONFLICT',
      409,
    );
  }
  return realpathSync(folder.trim());
}
// Reports an existing link so the wizard can offer "edit existing" or "replace with a new project".
export function inspectOnboardingFolder(db: BrainDB, folder: unknown) {
  const root = onboardingFolder(folder, true);
  const scope = resolveProjectScope(undefined, root, '');
  if (!scope.projectId || !scope.file) {
    return {folder: root, existing: null};
  }
  let projectName: string | null = null;
  try {
    projectName = db.project(scope.projectId).name;
  } catch {
    /* Linked to a project this Personal Brain does not have (for example another computer). */
  }
  return {
    folder: root,
    existing: {
      projectId: scope.projectId,
      projectName,
      file: scope.file,
      inFolder: dirname(scope.file) === root,
    },
  };
}
export function createLinkedProject(
  db: BrainDB,
  project: unknown,
  folder: unknown,
  replaceLink = false,
) {
  const root = onboardingFolder(folder, replaceLink);
  const linkFile = join(root, '.personal-brain.json');
  const previousLink = existsSync(linkFile) ? readFileSync(linkFile) : null;
  let link: {file: string; projectId: string} | undefined;
  try {
    return db.transaction(() => {
      const saved = db.saveProject(project);
      db.scopedRecords(saved.id); // Validate dependency closure before writing the repository link.
      link = linkRepository(root, saved.id, replaceLink);
      db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run('repository:' + saved.id, root);
      return saved;
    });
  } catch (error) {
    if (link && JSON.parse(readFileSync(link.file, 'utf8')).projectId === link.projectId) {
      // Put back the link the user replaced, or remove the one this attempt created.
      if (previousLink) {
        writeFileSync(link.file, previousLink, {mode: 0o600});
      } else {
        unlinkSync(link.file);
      }
    }
    throw error;
  }
}
export function validateRecommendations(
  value: unknown,
  styles: BrainRecord[],
  projectId?: string,
  combinable: ReadonlySet<string> = new Set(),
) {
  const rows = (value as {recommendations?: unknown})?.recommendations;
  if (!Array.isArray(rows) || rows.length > 30) {
    throw new BrainError('AI must return at most 30 style recommendations.');
  }
  const slots = new Set<string>();
  return rows.map((row) => {
    const style = styles.find((r) => r.id === row?.id);
    if (
      !style ||
      (style.projectId && style.projectId !== projectId) ||
      style.status !== 'active' ||
      style.kind !== 'preference'
    ) {
      throw new BrainError(
        'AI returned an unavailable style. Try again or select styles manually.',
      );
    }
    const slot = combinable.has(style.domain) ? style.domain + ':' + style.id : style.domain;
    if (slots.has(slot)) {
      throw new BrainError(
        'AI recommended conflicting styles. Try again or select styles manually.',
      );
    }
    slots.add(slot);
    if (typeof row.reason !== 'string' || !row.reason.trim() || row.reason.length > 2000) {
      throw new BrainError('AI returned an invalid recommendation reason.');
    }
    if (
      row.customizationNote !== undefined &&
      (typeof row.customizationNote !== 'string' ||
        !row.customizationNote.trim() ||
        row.customizationNote.length > 2000)
    ) {
      throw new BrainError('AI returned an invalid customization note.');
    }
    if (
      row.projectGuidelines !== undefined &&
      (typeof row.projectGuidelines !== 'string' || row.projectGuidelines.length > 12000)
    ) {
      throw new BrainError('AI returned invalid project guidelines.');
    }
    return {
      id: style.id,
      reason: row.reason,
      ...(row.projectGuidelines?.trim() ? {projectGuidelines: row.projectGuidelines.trim()} : {}),
      ...(row.customizationNote ? {customizationNote: row.customizationNote} : {}),
    };
  });
}
let analyzing = false;
export async function recommendProjectStyles(
  db: BrainDB,
  folder: unknown,
  agent: unknown,
  signal?: AbortSignal,
  projectId?: string,
) {
  if (projectId !== undefined && (typeof projectId !== 'string' || !projectId.trim())) {
    throw new BrainError('Invalid project scope.');
  }
  if (agent !== 'codex' && agent !== 'claude') {
    throw new BrainError('Choose Codex or Claude.');
  }
  if (analyzing) {
    throw new BrainError(
      'Another project analysis is running. Try again when it finishes.',
      'CONFLICT',
      409,
    );
  }
  const root = projectId ? projectFolder(db, projectId) : onboardingFolder(folder, true),
    source = repositoryEvidence(root);
  if (!source.evidence.length) {
    throw new BrainError(
      'No readable README, repository instructions or build manifest found. Select styles manually.',
    );
  }
  const styles = db.activePreferences(projectId);
  const combinable = db
    .domains()
    .filter((d) => d.combinable)
    .map((d) => d.id);
  analyzing = true;
  try {
    const result = await analyzeStyles(
      {
        agent,
        signal,
        evidence: source.evidence,
        files: source.files,
        combinableDomains: combinable,
      },
      styles,
    );
    return {
      recommendations: validateRecommendations(
        {recommendations: result.rows},
        styles,
        projectId,
        new Set(combinable),
      ),
      files: source.evidence.map((e) => e.file),
      issues: [...source.issues, ...result.issues],
      limited: source.truncated || source.nextOffset !== null,
    };
  } finally {
    analyzing = false;
  }
}

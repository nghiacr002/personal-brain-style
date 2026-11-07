import {applicability, validateApplicability} from './preference-contract.ts';
import {BrainError, type BrainRecord, type Requirement, type TaskContext} from './models.ts';

export function validateRequirements(value: unknown): Requirement[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > 30) {
    throw new BrainError('Requirements must be an array of at most 30 entries');
  }
  const ids = new Set<string>();
  return value.map((r) => {
    if (
      !r ||
      typeof r !== 'object' ||
      !['artifact', 'manual'].includes(r.type) ||
      typeof r.id !== 'string' ||
      !/^req-[a-z0-9-]{1,60}$/.test(r.id) ||
      ids.has(r.id) ||
      typeof r.label !== 'string' ||
      !r.label.trim() ||
      r.label.length > 500
    ) {
      throw new BrainError(
        'Invalid or duplicate requirement; use a unique req- ID, label and artifact/manual type',
      );
    }
    if (
      r.type === 'artifact' &&
      r.extensions === undefined &&
      (typeof r.extension !== 'string' || !/^\.[a-z0-9]{1,12}$/.test(r.extension))
    ) {
      throw new BrainError('Artifact requirement needs an extension such as .drawio');
    }
    if (
      r.extensions !== undefined &&
      (!Array.isArray(r.extensions) ||
        !r.extensions.length ||
        r.extensions.length > 10 ||
        r.extension !== undefined ||
        !r.extensions.every((e: unknown) => typeof e === 'string' && /^\.[a-z0-9]{1,12}$/.test(e)))
    ) {
      throw new BrainError('Invalid artifact extension alternatives');
    }
    if (r.type === 'manual' && (r.extension !== undefined || r.extensions !== undefined)) {
      throw new BrainError('Manual requirements cannot specify an extension');
    }
    ids.add(r.id);
    return {
      id: r.id,
      label: r.label.trim(),
      type: r.type,
      ...(r.type === 'artifact'
        ? r.extensions
          ? {extensions: r.extensions}
          : {extension: r.extension}
        : {}),
      ...(r.when !== undefined ? {when: validateApplicability(r.when)} : {}),
    };
  });
}

export function requirementChecklist(records: BrainRecord[], context: TaskContext = {}) {
  return records.flatMap((r) =>
    [
      ...(r.requirements || []).map((requirement) => ({
        ...requirement,
        applicability: applicability(requirement.when, context),
      })),
      ...(r.reviewCriteria || []).map((label, i) => ({
        id: `review-${i + 1}`,
        label,
        type: 'manual' as const,
      })),
      ...(r.skillBindings || []).map((skill, i) => ({
        id: `binding-${i + 1}`,
        label: `${skill.required ? 'Required' : 'Optional'} procedure: ${skill.name}. Fallback: ${skill.fallback}`,
        type: 'manual' as const,
        applicability: applicability(skill.when, context),
        optional: !skill.required,
      })),
      ...(r.externalSkills || []).map((skill, i) => ({
        id: `skill-${i + 1}`,
        label: `Read and apply applicable skill: ${skill}`,
        type: 'manual' as const,
      })),
    ].map((requirement) => ({
      applicability: 'applicable',
      optional: false,
      ...requirement,
      recordId: r.id,
      recordVersion: r.version,
      style: r.title,
    })),
  );
}

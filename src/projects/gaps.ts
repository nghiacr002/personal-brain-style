import {existsSync, readFileSync, statSync} from 'node:fs';
import {homedir} from 'node:os';
import {delimiter, isAbsolute, join} from 'node:path';
import {BrainDB} from '../core/database.ts';
import {BrainError, type BrainRecord, type SkillBinding} from '../core/models.ts';
import {installedSkills, projectFolder, skillReferences} from './skill-discovery.ts';

export type Gap = {
  type: 'dependency' | 'skill' | 'tool' | 'dev-tool';
  required: boolean;
  recordId: string;
  recordTitle: string;
  name: string;
  status: string;
  message: string;
  setup: string;
};

// A check is a repository-relative file, or "file#text" when the file must contain that text.
type DevTool = {name: string; checks: string[]; setup: string};

const prettierFiles = ['', '.json', '.js', '.mjs', '.cjs', '.yaml', '.yml'].map(
  (suffix) => '.prettierrc' + suffix,
);
const eslintFiles = [
  ...['js', 'mjs', 'cjs', 'ts'].map((suffix) => 'eslint.config.' + suffix),
  ...['', '.json', '.js', '.cjs', '.yml'].map((suffix) => '.eslintrc' + suffix),
];

// Mirrors the verification rule of each language substyle in src/styles/development-standards.ts.
const devTools: Record<string, DevTool[]> = {
  typescript: [
    {
      name: 'Prettier',
      checks: [
        ...prettierFiles,
        'prettier.config.js',
        'prettier.config.mjs',
        'package.json#"prettier"',
      ],
      setup:
        'Run npm install --save-dev prettier, then add .prettierrc.json and a format:check script.',
    },
    {
      name: 'ESLint',
      checks: [...eslintFiles, 'package.json#"eslintConfig"'],
      setup: 'Run npm init @eslint/config@latest, then add a lint script.',
    },
    {
      name: 'TypeScript type checking',
      checks: ['tsconfig.json'],
      setup: 'Run npx tsc --init, enable strict mode and add a typecheck script (tsc --noEmit).',
    },
  ],
  python: [
    {
      name: 'Formatter and linter',
      checks: [
        'ruff.toml',
        '.ruff.toml',
        '.flake8',
        'pyproject.toml#[tool.ruff',
        'pyproject.toml#[tool.black',
        'setup.cfg#[flake8',
      ],
      setup: 'Add Ruff (pip install ruff) and configure [tool.ruff] in pyproject.toml.',
    },
    {
      name: 'Static type checking',
      checks: [
        'mypy.ini',
        'pyrightconfig.json',
        'pyproject.toml#[tool.mypy',
        'pyproject.toml#[tool.pyright',
      ],
      setup: 'Add mypy or Pyright and configure it in pyproject.toml.',
    },
  ],
  csharp: [
    {
      name: 'dotnet format and analyzers',
      checks: ['.editorconfig'],
      setup:
        'Add an .editorconfig with analyzer severities and run dotnet format --verify-no-changes in CI.',
    },
  ],
  java: [
    {
      name: 'Build wrapper',
      checks: ['mvnw', 'gradlew'],
      setup: 'Add the Maven or Gradle wrapper (mvn wrapper:wrapper or gradle wrapper).',
    },
  ],
  swift: [
    {
      name: 'Swift formatter or linter',
      checks: ['.swiftlint.yml', '.swift-format', '.swiftformat'],
      setup: 'Add SwiftLint (.swiftlint.yml) or swift-format (.swift-format).',
    },
  ],
  kotlin: [
    {
      name: 'detekt or ktlint',
      checks: ['detekt.yml', 'config/detekt/detekt.yml', '.editorconfig#ktlint'],
      setup: 'Add detekt (detekt.yml) or ktlint rules in .editorconfig.',
    },
  ],
  dart: [
    {
      name: 'Dart analyzer rules',
      checks: ['analysis_options.yaml'],
      setup:
        'Add analysis_options.yaml (include: package:flutter_lints/flutter.yaml or package:lints/recommended.yaml).',
    },
  ],
};

function hasRepositoryFile(folder: string, check: string) {
  const [file, text] = check.split('#');
  const path = join(folder, file);
  if (!existsSync(path) || !statSync(path).isFile()) {
    return false;
  }
  return text === undefined || readFileSync(path, 'utf8').includes(text);
}

function onPath(command: string, searchPath = process.env.PATH || '') {
  if (isAbsolute(command) || /[\\/]/.test(command)) {
    return existsSync(command);
  }
  const suffixes = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  return searchPath
    .split(delimiter)
    .filter(Boolean)
    .some((directory) => suffixes.some((suffix) => existsSync(join(directory, command + suffix))));
}

// Walks selections and required links without throwing, so every gap is reported at once.
function collectRecords(
  db: BrainDB,
  recordIds: string[],
  projectId: string | undefined,
  gaps: Gap[],
) {
  const records = new Map<string, BrainRecord>();
  const queue: Array<{id: string; from?: BrainRecord}> = recordIds.map((id) => ({id}));
  while (queue.length) {
    const {id, from} = queue.shift()!;
    if (records.has(id)) {
      continue;
    }
    const record = db.get(id);
    const usable =
      record && record.status === 'active' && (!record.projectId || record.projectId === projectId);
    if (!usable) {
      let state = 'unavailable';
      if (record) {
        state = record.status === 'active' ? 'private to another project' : record.status;
      }
      gaps.push({
        type: 'dependency',
        required: true,
        recordId: from?.id || id,
        recordTitle: from?.title || record?.title || id,
        name: record?.title || id,
        status: state,
        message: from
          ? `${from.title} requires ${record?.title || id}, which is ${state}.`
          : `Selected style ${record?.title || id} is ${state}.`,
        setup: from
          ? 'Restore or activate the required style in Library, or deselect the style that needs it.'
          : 'Activate the style in Library or remove it from this project.',
      });
      continue;
    }
    records.set(id, record);
    for (const dependency of record.requiredIds || []) {
      queue.push({id: dependency, from: record});
    }
  }
  return [...records.values()];
}

export function scanGaps(
  db: BrainDB,
  recordIds: unknown,
  folder?: string,
  projectId?: string,
  home = homedir(),
) {
  if (!Array.isArray(recordIds) || recordIds.some((id) => typeof id !== 'string')) {
    throw new BrainError('recordIds must be a list of style IDs');
  }
  if (recordIds.length > 300) {
    throw new BrainError('Too many styles to scan');
  }
  const gaps: Gap[] = [];
  const records = collectRecords(db, recordIds, projectId, gaps);

  const inventory = installedSkills(folder, home);
  const skillHome = folder ? join(folder, '.claude', 'skills') : '~/.claude/skills';
  for (const ref of skillReferences(records, inventory.skills)) {
    if (ref.status === 'available') {
      continue;
    }
    // "plugin:skill (when …)" installs as a folder named after the skill.
    const name = ref.reference.split(' ')[0].split(':').at(-1);
    // Skill bindings carry required/fallback; plain externalSkills references are required.
    const binding = 'fallback' in ref ? (ref as typeof ref & SkillBinding) : undefined;
    const copies = ref.skills.map((skill) => skill.file).join(', ');
    gaps.push({
      type: 'skill',
      required: binding ? binding.required : true,
      recordId: ref.recordId,
      recordTitle: ref.title,
      name: ref.reference,
      status: ref.status,
      message:
        ref.status === 'missing'
          ? `${ref.title} uses the skill ${ref.reference}, which is not installed.`
          : `${ref.title} uses the skill ${ref.reference}, but different copies are installed: ${copies}.`,
      setup:
        (ref.status === 'missing'
          ? `Install it at ${skillHome}/${name}/SKILL.md for this project, or ~/.agents/skills/${name}/SKILL.md for every project.`
          : `Keep one copy, or install a project copy at ${skillHome}/${name}/SKILL.md (project copies take precedence).`) +
        (binding?.fallback ? ` Until then: ${binding.fallback}` : ''),
    });
  }

  for (const record of records.filter((r) => r.kind === 'tool')) {
    if (!record.backend) {
      continue;
    }
    const {command, enabled, toolName} = record.backend;
    let status: string | undefined;
    if (!enabled) {
      status = 'disabled';
    } else if (!onPath(command)) {
      status = 'command not found';
    }
    if (status) {
      gaps.push({
        type: 'tool',
        required: true,
        recordId: record.id,
        recordTitle: record.title,
        name: toolName,
        status,
        message:
          status === 'disabled'
            ? `Tool ${toolName} is registered but disabled.`
            : `Tool ${toolName} needs the command "${command}", which is not on PATH.`,
        setup:
          status === 'disabled'
            ? 'Enable the tool in Library after reviewing its command.'
            : `Install ${command} on this computer, or update the tool command in Library.`,
      });
    }
  }

  // ponytail: checks the repository root only; monorepo packages need per-package scanning.
  for (const record of records.filter((r) => r.standardLanguage && devTools[r.standardLanguage])) {
    for (const tool of devTools[record.standardLanguage!]) {
      if (folder && tool.checks.some((check) => hasRepositoryFile(folder, check))) {
        continue;
      }
      gaps.push({
        type: 'dev-tool',
        required: false,
        recordId: record.id,
        recordTitle: record.title,
        name: tool.name,
        status: folder ? 'not configured' : 'not checked',
        message: folder
          ? `${record.title} expects ${tool.name}; no configuration was found in the repository.`
          : `${record.title} expects ${tool.name}; link a repository folder to check it.`,
        setup: tool.setup,
      });
    }
  }

  return {
    folder: folder || null,
    scannedStyles: records.map((r) => ({id: r.id, title: r.title})),
    gaps,
    issues: inventory.issues,
  };
}

export function scanProjectGaps(db: BrainDB, projectId: string, home = homedir()) {
  const project = db.project(projectId);
  let folder: string | undefined;
  try {
    folder = projectFolder(db, projectId);
  } catch {
    /* Without a linked repository, repository checks are reported as not checked. */
  }
  return scanGaps(
    db,
    project.assignments.map((a) => a.recordId),
    folder,
    projectId,
    home,
  );
}

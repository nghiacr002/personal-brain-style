import {BrainDB} from '../core/database.ts';

export function installDevelopmentStructureStyle(db: BrainDB) {
  const marker = 'shared_development_structure_v1';
  return db.transaction(() => {
    const renameMarker = 'development_structure_typescript_title_v1';
    if (!db.db.prepare('SELECT 1 FROM meta WHERE key=?').get(renameMarker)) {
      const style = db
        .list({kind: 'preference', limit: 300})
        .find((r) => r.tags.includes('shared-development-structure'));
      if (style?.title === 'Development structure — frontend and backend boundaries') {
        db.update(
          style.id,
          {title: 'Development structure — frontend and backend boundaries for typescript'},
          style.version,
        );
      }
      db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run(renameMarker, '1');
    }
    if (db.db.prepare('SELECT 1 FROM meta WHERE key=?').get(marker)) {
      return 0;
    }
    if (!db.hasDomain('development-structure')) {
      db.saveDomain('Development structure');
    }
    const existing = db
      .list({kind: 'preference', limit: 300})
      .find((r) => r.tags.includes('shared-development-structure'));
    if (!existing) {
      const research = db
        .list({kind: 'preference', status: 'active', limit: 300})
        .find((r) => r.tags.includes('shared-research-standard'));
      db.create({
        kind: 'preference',
        domain: 'development-structure',
        title: 'Development structure — frontend and backend boundaries for typescript',
        summary:
          'Organize source by feature and responsibility, preserve framework conventions and verify build, runtime and package paths.',
        useWhen:
          'Creating a frontend, backend or full-stack project; planning source folders; onboarding a repository; moving modules or reviewing dependency boundaries.',
        tags: [
          'shared-development-structure',
          'project structure',
          'folder structure',
          'directory layout',
          'frontend',
          'backend',
          'FE',
          'BE',
          'full-stack',
          'scaffold',
          'refactor',
          'modules',
          'monorepo',
          'nodejs',
        ],
        priority: 90,
        status: 'active',
        checks: [],
        backend: null,
        requiredIds: research ? [research.id] : [],
        content: `Inspect the existing tree, framework/version, entry points, build configuration, public package contracts, tests and architecture decisions before proposing a layout. Prefer a coherent existing convention. The examples below are adaptable patterns, not a universal standard. Produce a concise annotated tree, folder responsibilities, permitted import direction and verification steps. Create only folders needed by real code; do not add empty layers, framework dependencies or a monorepo merely to resemble a template.

FRONTEND
Keep routes and app composition in the framework's required locations. Group feature-owned views, components, state, API adapters and tests near their feature. Promote a component or utility into shared code only when multiple features need the same stable behavior. Keep design tokens and reusable UI primitives distinct from business features. Keep server-only code, credentials and database access out of browser dependency graphs. Distinguish public assets from imported assets and generated output. Respect framework-specific server/client and routing conventions; moving a route file can change the public URL. Use the framework's testing convention, with integration/end-to-end tests separate when needed.

BACKEND
Keep the process entry point small: configuration, composition, startup and shutdown. Group cohesive capabilities into modules. Transport handlers validate requests and call application behavior; persistence and external-service adapters handle I/O. Avoid business rules duplicated across HTTP, jobs, MCP and CLI handlers. A small service may use a few responsibility folders; introduce domain/application/infrastructure layers only when complexity warrants them. Share contracts through deliberate interfaces, not cross-feature imports of internal files. Keep dependency direction explicit and avoid cycles; extract an interface only when it solves a real boundary or testing need. Keep schema migrations, seed fixtures and runtime user data distinct; never bundle secrets or personal databases.

FULL-STACK AND PACKAGING
Use a single package when one deployable and its tooling suffice. Use apps/web, apps/api and packages/contracts only when separate build/deployment or genuine shared-package needs justify workspaces. Shared contracts must not import server implementations, database clients or secret configuration. Preserve public CLI paths, package exports, route paths and hook registrations during moves. Select module format and import extensions according to the installed runtime/build tools; do not change ESM/CommonJS semantics incidentally. Keep source, tests, scripts, docs and generated dist/build output identifiable. Root configuration belongs where the framework or tooling expects it. Ignore credentials, local data and build artifacts; publish only intended files. Document supported runtime and clean install/build/test commands.

RESTRUCTURING EXISTING CODE
Map every old path to its destination. Update imports, tests, aliases, runtime file URLs, static assets, scripts, fixtures, watchers, CI, containers and package entry points that reference those paths. Preserve behavior and user data; do not rename external contracts just to improve internal naming. Review the resulting dependency graph, run relevant tests and builds, and install/test the packed artifact from a temporary directory when publishing a package. Verify default hook/CLI commands and asset paths, not just TypeScript compilation. Report blocked checks separately.

Research basis (reviewed 2026-11-04): Angular supports feature grouping and colocating related files; Next.js defines routing conventions while allowing several organization strategies; NestJS describes cohesive modules and explicit exports; Node.js defines package entry points and export boundaries. The combined FE/BE examples here are a recommended synthesis, not an official cross-framework standard.
https://angular.dev/style-guide
https://nextjs.org/docs/app/getting-started/project-structure
https://docs.nestjs.com/modules
https://nodejs.org/api/packages.html`,
        principles: [
          'Choose structure from framework conventions, cohesion and project size.',
          'Keep feature ownership and dependency direction explicit.',
          'Preserve public contracts and verify runtime paths after moves.',
          'Separate source, generated artifacts, secrets and runtime data.',
        ],
        externalSkills: [
          'codebase-memory (when tracing or restructuring an existing codebase)',
          'ponytail:ponytail-review (when reviewing code or module moves)',
        ],
        examples: [
          'Frontend example (adapt to the framework): src/app/ for composition and routes; src/features/orders/ for order views, state, API adapters and colocated tests; src/shared/ui/ for reused primitives; src/shared/theme/ for tokens; public/ for public assets; tests/e2e/ for workflows. A Next.js app keeps its special page/layout files in app/ or src/app/; an Angular app follows its own feature conventions.',
          'Small backend example: src/main.ts composes the process; src/modules/orders/ owns routes, application behavior and persistence code; src/platform/ owns shared database/configuration adapters; migrations/ stores schema changes; tests/integration/ tests boundaries; scripts/ holds build/setup helpers; dist/ is generated. Split files or sublayers only as actual responsibilities grow.',
          'Full-stack workspace example, only with independent packages: apps/web/ and apps/api/ each own source, tests and package metadata; packages/contracts/ exposes browser-safe schemas/types through explicit exports. Web imports contracts, never API internals. Keep one workspace lockfile and documented per-app build/deploy commands.',
          'Existing Node CLI example: move HTTP handling into src/server/ and MCP/hooks into src/agents/, keep src/cli.ts stable, update paths derived from import.meta.url and compile nested sources. Install the tarball into a temporary directory and verify CLI, MCP, hook commands and static assets.',
        ],
        reviewCriteria: [
          'Does the layout follow the installed framework and explicit repository decisions?',
          'Can each folder be explained by a real responsibility without empty speculative layers?',
          'Are feature boundaries and import direction clear, with no unintended cycles or browser imports of server-only code?',
          'Are source, public assets, generated output, migrations, fixtures and runtime data separated appropriately?',
          'Have all moved-path consumers, public entry points, build scripts and deployment configurations been checked?',
          'Do builds and relevant tests pass, and does the packed/deployed artifact resolve hooks, CLI commands and assets from outside the repository?',
          'Does the README document the tree, ownership and development commands, with unperformed checks reported honestly?',
        ],
      });
    }
    db.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run(marker, '1');
    return existing ? 0 : 1;
  });
}

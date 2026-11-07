import {
  previewStandardsMigration,
  applyStandardsMigration,
  rollbackStandardsMigration,
} from '../styles/standards-migration.ts';
import {
  exportLibrary,
  previewLibraryImport,
  importLibrary,
  libraryTransferLimit,
} from '../core/library-transfer.ts';
import {catalogUpgradePreview, applyCatalogUpgrade} from '../styles/catalog-upgrade.ts';
import {resolveInstructions} from '../instructions/resolve.ts';
import {
  seedGlobalStyles,
  installCatalogAdditions,
  globalCatalogMarker,
} from '../styles/global-style-seed.ts';
import {installDevelopmentStructureStyle} from '../styles/development-structure-style.ts';
import {
  fusionHistory,
  fusionJob,
  startFusion,
  applyFusion,
  rejectFusion,
  cancelFusion,
} from '../instructions/fusion.ts';
import {installResearchStyle} from '../styles/research-style.ts';
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {readFileSync, existsSync, statSync} from 'node:fs';
import {dirname, join, extname, resolve, delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveProjectScope, linkRepository} from '../projects/project-scope.ts';
import {
  onboardingFolder,
  inspectOnboardingFolder,
  createLinkedProject,
  recommendProjectStyles,
} from '../projects/onboarding.ts';
import {selectFolder} from '../projects/folder-browser.ts';
import {scanGaps, scanProjectGaps} from '../projects/gaps.ts';
import {
  discoverProject,
  installedSkills,
  projectFolder,
  skillReferences,
} from '../projects/skill-discovery.ts';
import {BrainDB} from '../core/database.ts';
import {seed, seedStyles, archiveSamples} from '../styles/seed.ts';
import {installStyleDependencies} from '../styles/style-dependencies.ts';
import {
  upgradeWorkspaceDesign,
  upgradeWorkspaceNavigation,
  upgradeWorkspacePalette,
} from '../styles/design-review-style.ts';
import {installProjectDefaults} from '../projects/project-defaults.ts';
import {requireDevelopmentReview} from '../styles/development-review-style.ts';
import {installBaQcStyles} from '../styles/ba-qc-styles.ts';
import {splitDesignStyle} from '../styles/split-design-style.ts';
import {installWritingStyle} from '../styles/writing-style.ts';
import {installDrawingStyles, upgradeVisualDrawing} from '../styles/drawing-styles.ts';
import {installNetworkDrawingStyle} from '../styles/network-drawing-style.ts';
import {installReviewStandard} from '../styles/review-standard.ts';
import {installStyleContracts, installStyleExamples} from '../styles/style-contracts.ts';
import {
  installPersonalBrainStyles,
  upgradeDesignComposition,
} from '../styles/personal-brain-styles.ts';
import {installArchitectureStyles} from '../styles/architecture-styles.ts';
import {manageHookConfig} from '../agents/hook-install.ts';
import {commandLine} from '../agents/launcher.ts';
import {BrainError, KINDS, type Domain, type Kind} from '../core/models.ts';

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../public');
function json(res: ServerResponse, status: number, payload: unknown) {
  const data = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(data);
}
// Parsed request JSON is handed to handlers whose services validate their own fields.
// TODO: replace with per-endpoint request validation, then return unknown.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function body(req: IncomingMessage, maxBytes = 180000): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBytes) {
      throw new BrainError('Request too large', 'TOO_LARGE', 413);
    }
    chunks.push(bytes);
  }
  const data = Buffer.concat(chunks).toString('utf8');
  if (!data.trim()) {
    return {};
  }
  try {
    return JSON.parse(data);
  } catch {
    throw new BrainError('Invalid JSON');
  }
}
function allowOrigin(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (!origin) {
    return true;
  }
  try {
    const parsed = new URL(origin);
    return (
      parsed.hostname === '127.0.0.1' &&
      parsed.protocol === 'http:' &&
      parsed.host === req.headers.host
    );
  } catch {
    return false;
  }
}
// How this copy was installed decides which command a user can paste later:
// npx caches can be cleared, so they get the npx form; a global install gets the bin name;
// a source checkout gets absolute paths to this checkout.
// Version, UI build time and the command a person should type for this copy.
export function installInfo(here = dirname(fileURLToPath(import.meta.url))) {
  let dir = here,
    version = 'unknown';
  for (let i = 0; i < 5; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      if (pkg.name === 'personal-brain-style') {
        version = pkg.version;
        break;
      }
    } catch {
      /* keep looking upward */
    }
    dir = dirname(dir);
  }
  let builtAt: string | null = null;
  try {
    builtAt = statSync(resolve(here, '../../public/app.js')).mtime.toISOString();
  } catch {
    /* no built UI */
  }
  return {version, builtAt, ...commandLine(here)};
}

export function createBrainHttpServer(db: BrainDB) {
  const development = process.env.PB_DEV_RELOAD === '1';
  const started = Date.now();
  seedGlobalStyles(db);
  installCatalogAdditions(db);
  if (!db.db.prepare('SELECT 1 FROM meta WHERE key=?').get(globalCatalogMarker)) {
    archiveSamples(db);
    installArchitectureStyles(db);
    installPersonalBrainStyles(db);
    installStyleContracts(db);
    installStyleExamples(db);
    installWritingStyle(db);
    upgradeDesignComposition(db);
    splitDesignStyle(db);
    installBaQcStyles(db);
    requireDevelopmentReview(db);
    installProjectDefaults(db);
    upgradeWorkspaceDesign(db);
    upgradeWorkspaceNavigation(db);
    upgradeWorkspacePalette(db);
    installStyleDependencies(db);
    installDrawingStyles(db);
    upgradeVisualDrawing(db);
    installNetworkDrawingStyle(db);
    installReviewStandard(db);
    installResearchStyle(db);
    installDevelopmentStructureStyle(db);
    if (db.projects().some((p) => p.id === 'b3937377-32ad-43a8-9adc-c21d06a9b4a4')) {
      db.privatizeLegacyProjectStyles('b3937377-32ad-43a8-9adc-c21d06a9b4a4');
    }
  }
  return createServer(async (req, res) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    res.setHeader('Referrer-Policy', 'no-referrer');
    const method = req.method || 'GET';
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const path = url.pathname;
      if (path.startsWith('/api/')) {
        if (!allowOrigin(req)) {
          return json(res, 403, {error: 'INVALID_ORIGIN'});
        }
        if (path === '/api/dev-version' && method === 'GET' && development) {
          return json(res, 200, {
            version: [
              started,
              ...['index.html', 'app.js', 'style.css', 'live-reload.js'].map(
                (name) => statSync(join(publicDir, name)).mtimeMs,
              ),
            ].join(':'),
          });
        }
        const removal = path.match(
          /^\/api\/removal\/(record|domain|project|reset)\/([a-zA-Z0-9-]+)$/,
        );
        if (removal && method === 'GET') {
          return json(res, 200, db.deletionPreview(removal[1], removal[2]));
        }
        if (removal && method === 'POST') {
          const x = await body(req);
          return json(res, 200, db.deleteWithPreview(removal[1], removal[2], x.fingerprint));
        }
        if (path === '/api/projects' && method === 'GET') {
          return json(
            res,
            200,
            db.projects().map((p) => ({...p, activity: db.projectActivity(p.id)})),
          );
        }
        if (path === '/api/projects' && method === 'POST') {
          return json(res, 201, db.saveProject(await body(req)));
        }
        if (path === '/api/onboarding/folder' && method === 'POST') {
          return json(res, 200, inspectOnboardingFolder(db, (await body(req)).folder));
        }
        if (path === '/api/folders/select' && method === 'POST') {
          return json(res, 200, await selectFolder());
        }
        if (path === '/api/onboarding/create' && method === 'POST') {
          const x = await body(req);
          return json(
            res,
            201,
            createLinkedProject(db, x.project, x.folder, x.replaceLink === true),
          );
        }
        if (path === '/api/onboarding/analyze' && method === 'POST') {
          const x = await body(req),
            controller = new AbortController();
          const cancel = () => controller.abort();
          res.on('close', cancel);
          try {
            return json(
              res,
              200,
              await recommendProjectStyles(db, x.folder, x.agent, controller.signal, x.projectId),
            );
          } finally {
            res.off('close', cancel);
          }
        }
        const publishMatch = path.match(
          /^\/api\/projects\/([a-f0-9-]{36})\/items\/([a-f0-9-]{36})\/publish$/,
        );
        if (publishMatch && method === 'POST') {
          const x = await body(req);
          return json(
            res,
            201,
            db.publishProjectRecord(publishMatch[1], publishMatch[2], x.expectedVersion),
          );
        }
        const personalizeMatch = path.match(
          /^\/api\/projects\/([a-f0-9-]{36})\/items\/([a-f0-9-]{36})$/,
        );
        if (personalizeMatch && method === 'PUT') {
          const x = await body(req);
          return json(
            res,
            200,
            db.personalizeRecord(
              personalizeMatch[1],
              personalizeMatch[2],
              x.record,
              x.expectedVersion,
              x.expectedProjectVersion,
            ),
          );
        }
        if (path === '/api/skills' && method === 'GET') {
          const projectId = url.searchParams.get('projectId') || undefined;
          let folder: string | undefined;
          const issues: Array<{type: string; message: string}> = [];
          if (projectId) {
            db.project(projectId);
            try {
              folder = projectFolder(db, projectId);
            } catch (e) {
              issues.push({type: 'repository', message: (e as Error).message});
            }
          }
          const inventory = installedSkills(folder);
          const records = projectId
            ? db.scopedRecords(projectId)
            : db.list({limit: 1000}).filter((r) => !r.projectId && r.status === 'active');
          return json(res, 200, {
            ...inventory,
            issues: [...issues, ...inventory.issues],
            references: skillReferences(records, inventory.skills),
          });
        }
        const discoveryMatch = path.match(/^\/api\/projects\/([a-f0-9-]{36})\/discovery$/);
        if (discoveryMatch && method === 'GET') {
          return json(res, 200, discoverProject(db, discoveryMatch[1]));
        }
        if (discoveryMatch && method === 'POST') {
          return json(res, 200, discoverProject(db, discoveryMatch[1], true));
        }
        const gapsMatch = path.match(/^\/api\/projects\/([a-f0-9-]{36})\/gaps$/);
        if (gapsMatch && method === 'GET') {
          return json(res, 200, scanProjectGaps(db, gapsMatch[1]));
        }
        if (path === '/api/gaps/scan' && method === 'POST') {
          const x = await body(req);
          const folder = x.folder ? onboardingFolder(x.folder, true) : undefined;
          return json(res, 200, scanGaps(db, x.recordIds, folder));
        }
        const repositoryMatch = path.match(/^\/api\/projects\/([a-f0-9-]{36})\/repository$/);
        if (repositoryMatch && method === 'GET') {
          const id = repositoryMatch[1];
          db.project(id);
          const stored = db.db
            .prepare('SELECT value FROM meta WHERE key=?')
            .get('repository:' + id) as {value: string} | undefined;
          let folder = stored?.value || '';
          let linked = false;
          let error = '';
          try {
            const scope = resolveProjectScope(undefined, folder || process.cwd(), '');
            linked = scope.projectId === id;
            if (linked && scope.file) {
              folder = dirname(scope.file);
            }
          } catch (e) {
            error = e instanceof Error ? e.message : String(e);
          }
          return json(res, 200, {folder, linked, error});
        }
        if (repositoryMatch && method === 'POST') {
          db.project(repositoryMatch[1]);
          const x = await body(req);
          if (typeof x.folder !== 'string') {
            throw new BrainError('Repository folder is required');
          }
          if (x.action === 'link') {
            const result = linkRepository(x.folder, repositoryMatch[1]);
            db.db
              .prepare(
                'INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
              )
              .run('repository:' + repositoryMatch[1], dirname(result.file));
            return json(res, 200, result);
          }
          if (x.action !== 'test') {
            throw new BrainError('Invalid repository action');
          }
          const scope = resolveProjectScope(undefined, x.folder, '');
          const records = scope.projectId ? db.scopedRecords(scope.projectId) : [];
          return json(res, 200, {
            ...scope,
            matches: scope.projectId === repositoryMatch[1],
            records: records.map((r) => ({id: r.id, title: r.title})),
            note: 'Local configuration checked. Agent connection is confirmed only by observed calls.',
          });
        }
        const activityMatch = path.match(/^\/api\/projects\/([a-f0-9-]{36})\/activity$/);
        if (activityMatch && method === 'GET') {
          return json(res, 200, db.projectActivity(activityMatch[1]));
        }
        const projectMatch = path.match(/^\/api\/projects\/([a-f0-9-]{36})(\/resolved)?$/);
        if (projectMatch && method === 'GET') {
          return json(
            res,
            200,
            projectMatch[2] ? db.scopedRecords(projectMatch[1]) : db.project(projectMatch[1]),
          );
        }
        if (projectMatch && !projectMatch[2] && method === 'PUT') {
          const x = await body(req);
          return json(res, 200, db.saveProject(x.project, projectMatch[1], x.expectedVersion));
        }
        if (path === '/api/fusion' && method === 'GET') {
          return json(res, 200, fusionHistory(db));
        }
        if (path === '/api/fusion' && method === 'POST') {
          return json(res, 202, startFusion(db, await body(req)));
        }
        const fusion = path.match(/^\/api\/fusion\/([a-f0-9-]{36})(\/(?:apply|reject|cancel))?$/);
        if (fusion && method === 'GET' && !fusion[2]) {
          return json(res, 200, fusionJob(db, fusion[1]));
        }
        if (fusion && method === 'POST' && fusion[2] === '/cancel') {
          return json(res, 200, cancelFusion(db, fusion[1]));
        }
        if (fusion && method === 'POST' && fusion[2]) {
          return json(
            res,
            200,
            (fusion[2] === '/reject' ? rejectFusion : applyFusion)(
              db,
              fusion[1],
              (await body(req)).targetId,
            ),
          );
        }
        if (path === '/api/summary' && method === 'GET') {
          return json(res, 200, db.summary());
        }
        if (path === '/api/styles/seed' && method === 'POST') {
          return json(res, 200, {created: seedStyles(db)});
        }
        if (path === '/api/examples/seed' && method === 'POST') {
          return json(res, 200, {created: seed(db), summary: db.summary()});
        }
        if (path === '/api/trace/stats' && method === 'GET') {
          return json(res, 200, db.traceStats(url.searchParams.get('projectId') || undefined));
        }
        if (path === '/api/trace' && method === 'GET') {
          return json(
            res,
            200,
            db.listTrace({
              projectId: url.searchParams.get('projectId') || undefined,
              agent: url.searchParams.get('agent') || undefined,
              channel: url.searchParams.get('channel') || undefined,
              recordId: url.searchParams.get('recordId') || undefined,
              runId: url.searchParams.get('runId') || undefined,
              includeDemo: url.searchParams.get('demo') === '1',
              limit: Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 150))),
            }),
          );
        }
        if (path === '/api/trace/demo' && method === 'POST') {
          return json(res, 200, {created: db.seedTraceDemo()});
        }
        if (path === '/api/trace/demo' && method === 'DELETE') {
          return json(res, 200, {removed: db.clearTraceDemo()});
        }
        if (path === '/api/about' && method === 'GET') {
          return json(res, 200, installInfo());
        }
        if (path === '/api/chatgpt/setup' && method === 'GET') {
          const project = db.project(url.searchParams.get('projectId') || '');
          const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
          const command = [
            process.execPath,
            resolve(dirname(fileURLToPath(import.meta.url)), '../../scripts/run.mjs'),
            resolve(dirname(fileURLToPath(import.meta.url)), '../cli.ts'),
            'mcp',
            'chatgpt',
            project.id,
          ]
            .map(quote)
            .join(' ');
          const info = installInfo(),
            connectCommand = 'personal-brain chatgpt-connect ' + project.id,
            connectRaw = info.raw + ' chatgpt-connect ' + project.id;
          // Lets the setup guide show whether tunnel-client is reachable before the user opens Terminal.
          const onPath = (name: string) =>
            (process.env.PATH || '').split(delimiter).some((dir) => {
              try {
                return statSync(join(dir, name)).isFile();
              } catch {
                return false;
              }
            });
          return json(res, 200, {
            command,
            connectCommand,
            connectRaw,
            connectNpx: info.npx + ' chatgpt-connect ' + project.id,
            commandOnPath: info.onPath,
            projectId: project.id,
            tunnelClient: onPath(
              process.platform === 'win32' ? 'tunnel-client.exe' : 'tunnel-client',
            ),
          });
        }
        if (path === '/api/activation' && method === 'GET') {
          return json(res, 200, {
            claude: manageHookConfig('status', 'claude'),
            codex: manageHookConfig('status', 'codex'),
            opencode: manageHookConfig('status', 'opencode'),
          });
        }
        if (path === '/api/domains' && method === 'GET') {
          return json(res, 200, db.domains());
        }
        if (path === '/api/domains' && method === 'POST') {
          const x = await body(req);
          return json(res, 201, db.saveDomain(x.name, undefined, undefined, x.combinable));
        }
        const domainRoute = path.match(/^\/api\/domains\/([a-z][a-z0-9-]{0,59})$/);
        if (domainRoute && method === 'PUT') {
          const x = await body(req);
          return json(
            res,
            200,
            db.saveDomain(x.name, domainRoute[1], x.expectedName, x.combinable),
          );
        }
        if (path === '/api/items' && method === 'GET') {
          const k = url.searchParams.get('kind');
          const d = url.searchParams.get('domain');
          const projectId = url.searchParams.get('projectId') || undefined;
          let folder: string | undefined;
          if (projectId) {
            try {
              folder = projectFolder(db, projectId);
            } catch {
              /* Missing repository is reported by project discovery. */
            }
          }
          const inventory = installedSkills(folder);
          return json(
            res,
            200,
            db
              .list({
                projectId,
                kind: KINDS.includes(k as Kind) ? (k as Kind) : undefined,
                domain: db.hasDomain(d) ? (d as Domain) : undefined,
                status: url.searchParams.get('status') || undefined,
                query: url.searchParams.get('q') || undefined,
                limit: 300,
              })
              .map((record) => ({
                ...record,
                skillWarnings: skillReferences([record], inventory.skills)
                  .filter((ref) => ref.status !== 'available')
                  .map((ref) => ref.reference + ': ' + ref.status),
              })),
          );
        }
        if (path === '/api/preferences/resolve' && method === 'POST') {
          const x = await body(req);
          if (typeof x.projectId !== 'string') {
            throw new BrainError('Project required');
          }
          return json(res, 200, resolveInstructions(db, x.projectId, x));
        }
        if (path === '/api/library/export' && method === 'POST') {
          const x = await body(req);
          return json(res, 200, exportLibrary(db, x.ids));
        }
        if (path === '/api/library/import/preview' && method === 'POST') {
          const x = await body(req, libraryTransferLimit);
          return json(res, 200, previewLibraryImport(db, x.bundle));
        }
        if (path === '/api/library/import' && method === 'POST') {
          const x = await body(req, libraryTransferLimit);
          return json(res, 200, importLibrary(db, x.bundle, x.ids, x.fingerprint));
        }
        if (path === '/api/standards-migration' && method === 'GET') {
          return json(res, 200, previewStandardsMigration(db));
        }
        if (path === '/api/standards-migration' && method === 'POST') {
          const x = await body(req);
          return json(res, 200, applyStandardsMigration(db, x.fingerprint));
        }
        if (path === '/api/standards-migration/rollback' && method === 'POST') {
          const x = await body(req);
          return json(res, 200, rollbackStandardsMigration(db, x.migrationId));
        }
        if (path === '/api/catalog-upgrade' && method === 'GET') {
          return json(res, 200, catalogUpgradePreview(db));
        }
        if (path === '/api/catalog-upgrade' && method === 'POST') {
          const x = await body(req);
          return json(res, 200, applyCatalogUpgrade(db, x.id, x.expectedVersion));
        }
        if (path === '/api/items' && method === 'POST') {
          return json(res, 201, db.create(await body(req)));
        }
        const item = path.match(/^\/api\/items\/([a-f0-9-]{36})$/);
        if (item || path.match(/^\/api\/items\/([a-f0-9-]{36})\/(history|restore)$/)) {
          const recordId = path.split('/')[3];
          const existing = db.get(recordId);
          if (
            existing?.projectId !== undefined &&
            existing.projectId !== url.searchParams.get('projectId')
          ) {
            throw new BrainError('Record not found', 'NOT_FOUND', 404);
          }
        }
        if (item && method === 'GET') {
          const found = db.get(item[1]);
          return found ? json(res, 200, found) : json(res, 404, {error: 'NOT_FOUND'});
        }
        if (item && method === 'PUT') {
          const x = await body(req);
          return json(res, 200, db.update(item[1], x.record, Number(x.expectedVersion)));
        }
        const history = path.match(/^\/api\/items\/([a-f0-9-]{36})\/history$/);
        if (history && method === 'GET') {
          return json(res, 200, db.history(history[1]));
        }
        const restore = path.match(/^\/api\/items\/([a-f0-9-]{36})\/restore$/);
        if (restore && method === 'POST') {
          const x = await body(req);
          return json(
            res,
            200,
            db.restore(restore[1], Number(x.version), Number(x.expectedVersion)),
          );
        }
        if (path === '/api/bootstrap' && method === 'GET') {
          return json(res, 200, {
            text: db.bootstrap(3500, url.searchParams.get('projectId') || undefined),
          });
        }
        if (path === '/api/discover' && method === 'GET') {
          return json(
            res,
            200,
            db.discover(
              url.searchParams.get('q') || '',
              undefined,
              24,
              url.searchParams.get('projectId') || undefined,
            ),
          );
        }
        if (path === '/api/review' && method === 'POST') {
          const x = await body(req);
          return json(
            res,
            200,
            db.evaluate(
              String(x.content || ''),
              db.hasDomain(x.domain) ? x.domain : 'general',
              typeof x.projectId === 'string' ? x.projectId : undefined,
            ),
          );
        }
        if (path === '/api/feedback' && method === 'GET') {
          return json(res, 200, db.listFeedback());
        }
        if (path === '/api/feedback' && method === 'POST') {
          return json(res, 201, db.addFeedback(await body(req)));
        }
        if (path === '/api/audit' && method === 'GET') {
          return json(res, 200, db.auditLog());
        }
        return json(res, 404, {error: 'NOT_FOUND'});
      }
      if (method !== 'GET') {
        return json(res, 405, {error: 'METHOD_NOT_ALLOWED'});
      }
      const route = path === '/' ? '/index.html' : path;
      if (
        ![
          '/index.html',
          '/app.js',
          '/style.css',
          ...(development ? ['/live-reload.js'] : []),
        ].includes(route)
      ) {
        return json(res, 404, {error: 'NOT_FOUND'});
      }
      const file = join(publicDir, route.slice(1));
      if (!existsSync(file)) {
        return json(res, 404, {error: 'NOT_FOUND'});
      }
      const mime: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
      };
      res.writeHead(200, {
        'Content-Type': mime[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(
        development && route === '/index.html'
          ? readFileSync(file, 'utf8').replace(
              '</body>',
              '<script src="/live-reload.js"></script></body>',
            )
          : readFileSync(file),
      );
    } catch (error) {
      const code = error instanceof BrainError ? error.status : 500;
      return json(res, code, {
        error: error instanceof BrainError ? error.code : 'SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

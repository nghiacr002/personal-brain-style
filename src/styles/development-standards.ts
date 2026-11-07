import type {Applicability, RecordInput, Requirement} from '../core/models.ts';

type CatalogRecord = RecordInput & {id: string};
type Section = {title: string; when: Applicability; rules: string[]};

const commonRules = [
  'Follow Clean Code, pragmatic SOLID, DRY, KISS and YAGNI. Prefer the simplest correct solution for a present need; do not introduce patterns, interfaces or configuration switches speculatively.',
  'Optimize for readable, maintainable code, not fewer physical lines; minimal changes means minimal complexity. Never sacrifice readability to reduce generated output length.',
  'Use one statement per line, braces around control-flow bodies in brace-based languages, and blank lines between logical steps. Wrap complex expressions; avoid nested ternaries and deeply nested control flow.',
  'Follow explicit repository formatter and naming rules; compressed legacy code is not a formatting convention to imitate. Language substyles supply defaults when a project has none.',
  'Use clear, consistent domain names that reveal intent and units; avoid vague names, unnecessary abbreviations and misleading suffixes. Constants name true invariants.',
  'Name booleans as predicates, functions as actions and collections in the plural. Keep one main concept per file. Comments explain constraints and decisions, not obvious code; document public APIs and link deferred work to an owner or issue. Remove dead code and commented-out implementations from the affected change.',
  'Prefer immutable values and explicit absence; avoid sentinel values, unexplained non-null assertions and mutation of caller-owned data. Function, parameter and file-size limits are review signals, not reasons to fragment cohesive code.',
  'Prefer small, focused functions and components, pure functions where useful, explicit side effects and typed parameter objects when they clarify calls. Do not extract trivial helpers or boolean-mode APIs just to shorten code.',
  'Separate business rules from UI, transport and persistence where complexity warrants. Keep modules cohesive, dependencies explicit and acyclic; introduce interfaces or dependency injection for actual substitution or testability.',
  'Reuse project helpers, standard-library and platform features, then suitable maintained libraries. Consolidate duplicated knowledge, not merely similar-looking code. Justify new dependencies and avoid wrappers that add no value.',
  'Avoid hard-coded links and parameters wherever practical. Make URLs, endpoints, paths, ports, timeouts, limits and other values that vary by environment, deployment or user configurable through the existing configuration mechanism. Use named constants for true invariants; do not introduce configuration for fixed protocol rules. Provide documented defaults where safe, validate configuration, and keep secrets out of source code.',
  'Handle errors explicitly at the right boundary, preserve diagnostic context and data integrity, and keep internal diagnostics separate from user messages. Never swallow failures or use exceptions for ordinary branching.',
  'Log useful structured events and correlation identifiers where available; log failures once where handled. Never log credentials, tokens, secrets or sensitive personal data.',
  'Apply secure defaults: validate untrusted input at external boundaries, parameterize queries, authorize protected operations server-side, use least privilege and safe serialization/file handling. Avoid unsafe dynamic execution.',
  'Use safe independent concurrency, explicit timeouts and cancellation where relevant. Preserve resource lifetime and transaction boundaries; avoid hidden or unhandled asynchronous work.',
  'Test critical business rules, validation, edge cases and failure paths. Use integration tests for affected external boundaries and regression tests for defects. Keep tests deterministic and independent of private implementation details; mock external boundaries rather than every internal function.',
  'Use the repository formatter and linter, and report each check with evidence. If either is missing, flag the gap and propose setup rather than claim a pass or silently install tooling.',
  'Formatting and lint checks should be enforced in repository CI; a personal preference or agent assurance does not replace executable checks. Run applicable type checks, builds, tests and analyzers and review security, errors and architecture.',
  'Keep broad formatting cleanup separate from behavior changes, preserve semantics, and verify the cleanup with relevant tests. Rebuild generated files from their source.',
  'Implement only requested changes and necessary supporting changes. Read callers first, preserve architecture and behavior, avoid unrelated refactoring, and fix issues introduced by the change.',
  'Follow the target language/runtime versions and explicit project standards. Report Pass, Fail or Not verified with actual evidence; never claim a command, build, test or visual review ran when it did not.',
  'Specialist architecture, formal test plans, BRDs, ADRs, LLDs, deployment and operational artifacts apply only when the task requires them. Ordinary coding work does not require these documents.',
];

const uiRules = [
  'For UI work, keep state ownership clear and render loading, error, empty and success states; preserve drafts and keyboard focus. Use accessible semantic controls, project tokens and native platform conventions.',
  'Use a configured API boundary with validation, failure mapping, timeouts and cancellation. Keep secrets out of client bundles and use secure platform storage as appropriate.',
  'For UI changes, inspect relevant responsive layouts, keyboard interactions and accessibility. Establish performance budgets from product needs and measure before optimizing; do not restyle or add a design system merely to satisfy this standard.',
  'For mobile UI, preserve platform units: target at least 44 by 44 pt on iOS and 48 by 48 dp on Android. Check safe areas, keyboard avoidance and large text. Validate cold-start deep links, permission denial and lifecycle restoration when affected; use TLS and secure credential storage. Offline queues, push, background sync and staged rollout apply only when required, with explicit conflict/retry and recovery policies.',
];
const serviceRules = [
  'For published API/service changes, preserve explicit contracts and compatibility, validate requests, authorize protected resources, bound payloads and pagination, and use meaningful user-safe errors.',
  'For persistence/messaging changes, use constraints and transactions for invariants, parameterized access, appropriate indexes, safe migrations and idempotent delivery/retry where required; avoid N+1 access and unbounded memory use.',
  'For deployable services, use validated configuration, graceful shutdown, appropriate health/telemetry and bounded resilience. SDKs and CLI tools do not need HTTP endpoints, databases or deployment infrastructure unless requested.',
];

function content(title: string, rules: string[], sections: Section[] = []) {
  return [
    'PERSONAL PREFERENCES',
    title,
    'Explicit task instructions and explicit project configuration take precedence over personal defaults. Language/framework-specific settings refine common defaults. Unresolved equal-scope conflicts must be reported; ranking priority is not authority.',
    'PREFERRED OUTCOMES',
    ...rules.map((rule) => '- ' + rule),
    ...sections.flatMap((section) => [
      `WHEN ${section.title.toUpperCase()} (${JSON.stringify(section.when)})`,
      ...section.rules.map((rule) => '- ' + rule),
    ]),
    'ACCEPTANCE',
    'Verify applicable rules with repository commands and focused review. Report unavailable checks as Not verified. Conditional sections apply only to matching task context; unknown context must be resolved rather than guessed. Skills provide procedures, not permission to replace requested outcomes.',
  ].join('\n\n');
}

export const commonStandard: CatalogRecord = {
  id: 'development',
  keyId: 'development',
  kind: 'preference',
  domain: 'engineering-standards',
  title: 'Global Development Standard',
  summary:
    'One language-independent baseline: readable, secure, maintainable code; pragmatic design, configurable operational values and verified changes.',
  useWhen:
    'Use to implement a feature or API change, fix a bug, refactor code, validate inputs, handle failures and add regression tests in any programming language.',
  content: content('Global Development Standard', commonRules, [
    {title: 'UI work', when: {targets: ['web', 'mobile']}, rules: uiRules},
    {title: 'service or API work', when: {targets: ['api', 'worker']}, rules: serviceRules},
  ]),
  principles: commonRules,
  requiredIds: [],
  supportingLinks: [],
  preferences: [],
  tags: [
    'starter-implementation',
    'development',
    'coding',
    'implement',
    'feature',
    'code',
    'change',
    'bug',
    'regression',
    'refactor',
    'security',
    'testing',
    'clean-code',
    'solid',
    'dry',
    'kiss',
    'yagni',
  ],
  requirements: [
    {
      id: 'req-dev-verification-report',
      type: 'manual',
      label:
        'Report relevant formatting, lint, type/build and test checks with actual evidence as Pass, Fail or Not verified.',
    },
    {
      id: 'req-dev-ui',
      type: 'manual',
      label:
        'Inspect changed UI states, responsive behavior, keyboard operation and accessibility.',
      when: {targets: ['web', 'mobile']},
    },
    {
      id: 'req-dev-service',
      type: 'manual',
      label:
        'Verify affected service contracts, authorization, data integrity and failure handling.',
      when: {targets: ['api', 'worker']},
    },
  ],
  reviewCriteria: [
    'Changes preserve behavior and data, cover relevant failure paths, and avoid unrelated refactoring.',
    'Readability, configuration, security and evidence satisfy the common principles.',
  ],
  examples: [
    'A CLI bug fix gets a regression test and the available quality checks; it does not add an API, LLD or deployment pipeline.',
  ],
  externalSkills: [],
  skillBindings: [],
  checks: [],
  backend: null,
  priority: 95,
  status: 'active',
};

function language(
  name: string,
  key: string,
  rules: string[],
  sections: Section[],
  settings: Record<string, string>,
  verification: string,
  references: string[] = [],
): CatalogRecord {
  const requirements: Requirement[] = [
    {id: `req-${key}-checks`, type: 'manual', label: verification},
    ...sections.map((section, index): Requirement => ({
      id: `req-${key}-scope-${index + 1}`,
      type: 'manual',
      when: section.when,
      label: `Review applicable ${section.title} rules and test the affected behavior.`,
    })),
  ];
  return {
    id: `coding-${key}`,
    keyId: `coding-${key}`,
    standardLanguage: key,
    kind: 'preference',
    domain: 'engineering-standards',
    title: `Development — ${name}`,
    summary: `${name} substyle of Global Development Standard: language conventions, safe types, runtime-specific behavior and quality checks.`,
    useWhen: `Use when writing or reviewing ${name} code. Apply only framework/runtime sections matching the task.`,
    content:
      content(name, rules, sections) +
      '\n\nVERIFICATION\n' +
      verification +
      (references.length ? '\n\nREFERENCES\n' + references.join('\n') : ''),
    principles: rules,
    requiredIds: ['development'],
    supportingLinks: [],
    preferences: Object.entries(settings).map(([setting, value]) => ({
      key: `${key}.${setting}`,
      value,
    })),
    tags: [key, ...name.toLowerCase().split(/[^a-z0-9#+.]+/), 'development', 'language-standard'],
    requirements,
    reviewCriteria: [
      'Language conventions and applicable framework rules are followed; explicit project differences are recorded.',
    ],
    examples: [
      `A ${name} library inherits the common standard without unrelated API or UI deliverables.`,
    ],
    externalSkills: [],
    skillBindings: [],
    checks: [],
    backend: null,
    priority: 92,
    status: 'active',
  };
}

export const languageStandards = [
  language(
    'TypeScript',
    'typescript',
    [
      'Use 2-space indentation, a 100-character line target, semicolons and single quotes, with Prettier as layout authority. Use braces for every conditional and loop; enforce this with lint rules. Never compress statements or nest ternaries.',
      'Use camelCase variables/functions, PascalCase classes/interfaces/type aliases, camelCase local constants or UPPER_SNAKE_CASE module constants. Ordinary modules/utilities use kebab-case filenames; React components use PascalCase.tsx and hooks use useX.ts. Preserve framework-reserved filenames.',
      'Enable strict mode. Prefer unknown to any at untrusted boundaries; validate external API and database values before narrowing. Avoid unnecessary assertions and non-null assertions; document necessary suppressions with @ts-expect-error rather than hiding errors.',
      'Use discriminated unions for state variations and readonly for values that must not change. Infer types from validated schemas where useful; use the existing schema library, or Zod/another suitable tool when needed.',
      'Prefer async/await and explicit failure handling; Promise.all is for safely independent operations. Support AbortSignal and timeouts where appropriate; do not leave floating promises.',
      'Keep presentation, application, domain and infrastructure concerns distinct when complexity warrants. Business rules are framework-independent; validation and persistence have clear boundaries. Keep modules cohesive and acyclic.',
      'Use the existing test runner (node:test, Vitest or Jest as appropriate); test domain rules, validation, failures and regressions. Integration tests cover affected database/service boundaries, not every internal function.',
      'Use supported project compiler/runtime settings; a bundle is not a type check. Keep one package manager and lockfile, reproducible installs and justified dependencies. Do not force bundler module resolution on Node code or Node resolution on browser code.',
    ],
    [
      {
        title: 'React',
        when: {frameworks: ['react', 'nextjs', 'react-native']},
        rules: [
          'Use functional components and follow hook rules. Keep UI components focused; put business logic in domain/services or appropriate custom hooks. Avoid redundant state and effects for values derivable during rendering.',
          'Use stable collection keys; avoid unnecessary useMemo/useCallback. Render loading/error/empty/success states. Prefer semantic accessible controls and query UI tests by role and label.',
          'Follow the existing server-data strategy (framework loaders, server components or query cache); do not add an effect-based fetch/cache system unnecessarily. With Next.js, isolate server-only modules and expose only intentionally public client configuration.',
        ],
      },
      {
        title: 'other web frameworks',
        when: {frameworks: ['vue', 'angular', 'svelte']},
        rules: [
          'Follow the supported framework conventions: typed Vue props/emits and Composition API, Angular typed forms/change detection and standalone components where supported, Svelte/SvelteKit state and loader conventions. Use framework type checking and lint rules; preserve project versions.',
          'Use project tokens and the existing build/test approach; keep secrets out of public environment prefixes. Inspect relevant component states, critical journeys and accessibility without installing a replacement framework.',
        ],
      },
      {
        title: 'Node.js',
        when: {frameworks: ['node', 'express', 'fastify', 'nestjs']},
        rules: [
          'Avoid heavy synchronous work on request/event-loop paths; stream large data or use workers when justified. Parse typed configuration once and fail clearly on invalid values.',
          'For Express, Fastify or NestJS APIs, validate at the transport boundary and map asynchronous errors centrally; honor existing framework conventions. Use parameterized database queries, safe transactions/migrations and bounded pools where a database is used.',
          'For long-running services/workers, handle shutdown and resource cleanup. CLI exit codes and diagnostics must be meaningful. Unhandled asynchronous failures are not silently ignored.',
        ],
      },
      {
        title: 'React Native',
        when: {frameworks: ['react-native']},
        rules: [
          'Use the existing navigation/router and native secure storage; preserve drafts/lifecycle and validate deep links. Handle permission denial, offline behavior when required, and platform accessibility/device tests.',
          'Keep generated native folders managed by their generator. Release signing, staged rollout and crash reporting apply when releasing, not on every source edit.',
        ],
      },
    ],
    {
      indent: '2',
      'line-length': '100',
      quotes: 'single',
      semicolons: 'true',
      'module-filenames': 'kebab-case',
    },
    'Run available Prettier check, ESLint, TypeScript type checking, relevant tests and build. Review security, errors, readability and boundaries; report every unrun check.',
  ),

  language(
    'C# / .NET',
    'csharp',
    [
      'Use 4-space indentation, a 120-character line target and opening braces on new lines. Use braces for conditionals/loops and one statement per line; prefer guard clauses and readable multiline expressions. Use .editorconfig and dotnet format.',
      'Use PascalCase types/methods/properties/constants, I-prefixed interfaces, camelCase locals/parameters, _camelCase private fields and Async suffixes for asynchronous methods. Follow domain terminology; avoid vague Service/Manager/Helper classes and Hungarian notation.',
      'Enable nullable reference types; avoid unnecessary casts and null-forgiving operators. Use explicit domain types, immutable records, required properties and readable pattern matching when supported by the target framework. Enums represent stable domain values.',
      'Use small cohesive methods with clear responsibilities and explicit side effects; avoid boolean mode parameters, speculative interfaces, unnecessary repositories and framework wrappers.',
      'Use async/await for I/O and pass CancellationToken through cancellable calls. Avoid .Result, .Wait() and unnecessary Task.Run in request paths. Dispose IDisposable/IAsyncDisposable correctly; use Task.WhenAll only for safe independent work and protect shared mutable state.',
      'Use meaningful errors, preserve exception context/stack traces, and avoid generic Exception for expected application outcomes. Use ILogger<T> structured logging where available and keep diagnostics private.',
      'Prefer strongly typed validated configuration and framework-native features. Keep domain logic independent of transport/persistence; add layers/projects only for justified boundaries. Use the established test framework (xUnit/NUnit or another project choice).',
    ],
    [
      {
        title: 'ASP.NET Core',
        when: {frameworks: ['aspnetcore']},
        rules: [
          'Use built-in DI with correct lifetimes; keep controllers/endpoints thin and persistence outside them. Validate requests, centralize authentication/authorization and exception mapping, and use Problem Details or the established API contract.',
          'Use middleware for cross-cutting HTTP concerns and configured typed/named HttpClient through IHttpClientFactory. Set appropriate timeouts/resilience; require health checks only for relevant deployable services. Do not mandate Entra ID or Azure without that project choice.',
          'Use request/response DTOs when useful; test API behavior, authorization, cancellation and failures with WebApplicationFactory or the existing integration approach.',
        ],
      },
      {
        title: 'Entity Framework Core',
        when: {frameworks: ['efcore']},
        rules: [
          'Use async database I/O, read-only AsNoTracking queries and projections where appropriate. Avoid N+1 queries, unbounded materialization and unsuitable IQueryable exposure.',
          'Use database constraints and transactions for invariants. Review/version migrations with deployment controls and recovery plans; parameterize SQL and do not wrap EF with a generic repository that adds no value.',
        ],
      },
    ],
    {indent: '4', 'line-length': '120', braces: 'new-line'},
    'Run dotnet format verification, configured analyzers, affected builds and relevant tests. Review nullable warnings, security and dependency boundaries; report unavailable checks.',
  ),

  language(
    'Python',
    'python',
    [
      'Follow PEP 8 and the repository formatter. Default to 4 spaces, snake_case functions/variables/modules, CapWords classes and UPPER_SNAKE_CASE constants; never compress compound statements. Use the configured line target; absent one, PEP 8 uses 79 columns for code and 72 for prose.',
      'Use clear type hints on public interfaces and significant logic, compatible with the supported Python version. Hints are not runtime validation: validate untrusted input and narrow values explicitly; do not use Any as a shortcut.',
      'Use context managers for resources, specific exception handling with preserved causes, and no mutable default arguments. Avoid blanket except/pass and unsafe eval, exec or untrusted pickle deserialization.',
      'Prefer standard-library facilities and cohesive packages; avoid import-time side effects and circular imports. Use isolated reproducible environments and the existing pyproject/tooling conventions.',
      'Use async only where the workload and libraries support it; do not block an event loop. Bound external I/O and propagate cancellation; choose concurrency for the actual I/O/CPU workload.',
      'Use the established formatter/linter/type checker and pytest or unittest. Do not install competing tools; test domain rules, validation, exceptions and affected external boundaries deterministically.',
    ],
    [
      {
        title: 'Python web services',
        when: {frameworks: ['django', 'fastapi', 'flask']},
        rules: [
          'Use framework validation/auth/security features and scoped resource/session lifetimes. Keep business rules outside routes, parameterize database access, preserve migrations and test API/database boundaries. Do not require a web framework for scripts or packages.',
        ],
      },
    ],
    {indent: '4', 'line-length': '79', 'module-filenames': 'snake_case'},
    'Run the project formatter check, lint, configured static type checks and relevant pytest/unittest tests; build/package checks when affected. Report unavailable checks.',
    ['https://peps.python.org/pep-0008/', 'https://docs.python.org/3/library/typing.html'],
  ),

  language(
    'Java',
    'java',
    [
      'Follow explicit project conventions and its formatter. When none exist, use Google Java Style: 2-space block indentation, 100-column target, same-line opening braces, braces for control flow and one statement per line. Do not change an established project style without scope.',
      'Use UpperCamelCase types, lowerCamelCase methods/fields/locals, UPPER_SNAKE_CASE true constants and lowercase package names. Match public type and file names; avoid wildcard imports and vague names.',
      'Use generics and domain types instead of raw types or unchecked casts. Prefer immutable values and records when supported; model nullability explicitly with the project approach. Avoid speculative interfaces and inheritance hierarchies.',
      'Use try-with-resources for AutoCloseable resources, meaningful exceptions and preserved causes. Do not swallow interruptions; propagate or restore interrupt status as appropriate. Never use exceptions for ordinary branching.',
      'Use the pinned project JDK and Maven/Gradle conventions; no preview language feature without explicit project choice. Keep business logic framework-independent and modules cohesive.',
      'Use bounded timeouts and cancellation for external work; choose safe concurrency appropriate to the supported JDK. Avoid shared mutable state and blocking work on event-loop frameworks.',
      'Use parameterized database access, safe serialization, validated configuration and secure defaults. Use the existing logging and test tools (JUnit or the established framework); do not add a framework for a small library.',
    ],
    [
      {
        title: 'Spring services',
        when: {frameworks: ['spring', 'spring-boot']},
        rules: [
          'Keep controllers thin; validate boundary DTOs, authorize protected operations and configure dependency lifetimes explicitly. Keep transaction boundaries clear and avoid persistence entities leaking into external contracts.',
          'Use configured HTTP clients, timeouts and relevant health/observability for deployed services. Test affected API and database paths; libraries do not require Spring or a deployment stack.',
        ],
      },
    ],
    {indent: '2', 'line-length': '100', braces: 'same-line'},
    'Run the configured formatter/style checks, compiler/static analysis and relevant tests through the existing Maven/Gradle wrapper. Review warnings, security and resource lifetimes; report unrun checks.',
    ['https://google.github.io/styleguide/javaguide.html', 'https://dev.java/learn/'],
  ),

  language(
    'Swift',
    'swift',
    [
      'Follow Swift API naming and the project Swift formatter: UpperCamelCase types, lowerCamelCase members and descriptive argument labels; preserve the supported Swift/toolchain version.',
      'Prefer value types and let, explicit optional handling and typed errors; avoid force unwraps and hidden side effects. Use async/await with cancellation and actor/isolation rules when supported.',
      'Keep domain logic testable without UI frameworks; use the existing package/layout and test conventions.',
    ],
    [
      {
        title: 'SwiftUI / iOS',
        when: {frameworks: ['swiftui', 'ios']},
        rules: [
          'Use observable state and platform navigation conventions, safe areas, Dynamic Type, VoiceOver and appropriate touch targets. Handle lifecycle restoration, permissions, secure Keychain storage and validated deep links.',
          'Offline storage/sync, push, signing and staged release are conditional on the feature or release. Test changed flows on relevant devices/OS versions and record limitations.',
        ],
      },
    ],
    {},
    'Run the configured Swift formatter/linter, build and unit tests; run relevant UI/device/accessibility checks for UI changes and report unrun checks.',
  ),

  language(
    'Kotlin',
    'kotlin',
    [
      'Follow project ktlint/detekt and Kotlin conventions: PascalCase types, camelCase members, UPPER_SNAKE_CASE const values, lowercase packages and descriptive source filenames.',
      'Prefer val and explicit null handling; avoid unnecessary !!, unsafe casts and stateful global objects. Use sealed types for finite state and small cohesive functions.',
      'Use structured coroutine concurrency, cancellation and appropriate dispatchers; do not block main/event-loop threads or launch unowned background work.',
    ],
    [
      {
        title: 'Android / Compose',
        when: {frameworks: ['android', 'compose']},
        rules: [
          'Use lifecycle-aware state, platform navigation, safe areas, TalkBack, font scaling and native touch targets. Follow existing ViewModel/StateFlow and DI conventions rather than adding a replacement stack.',
          'Use Keystore-backed storage, validated deep links and in-context permissions. Offline Room/outbox work, background sync and staged signed releases apply only when needed; test affected device/OS paths.',
        ],
      },
    ],
    {},
    'Run project formatting/detekt or ktlint, compiler and unit tests; Android lint and relevant UI/device checks for Android changes. Report unrun checks.',
  ),

  language(
    'Dart',
    'dart',
    [
      'Follow Effective Dart and dart format: UpperCamelCase types, lowerCamelCase members/constants, snake_case source files. Keep null safety and avoid dynamic or forced casts as shortcuts.',
      'Use final/const where suitable, focused components and explicit async error/cancellation/resource handling. Keep domain logic independent of Flutter and do not create speculative layers.',
    ],
    [
      {
        title: 'Flutter',
        when: {frameworks: ['flutter']},
        rules: [
          'Use the existing state/navigation approach, focused widgets, semantic accessibility and responsive platform conventions. Preserve lifecycle/drafts and handle permission denial and deep links.',
          'Keep secrets out of bundles, use secure storage, and add offline persistence/sync only when required. Test relevant device/OS paths; signing and staged rollout apply to releases.',
        ],
      },
    ],
    {},
    'Run dart format check, dart analyze (flutter analyze for Flutter), relevant unit/widget tests and affected builds. Report unrun device or integration checks.',
  ),
];

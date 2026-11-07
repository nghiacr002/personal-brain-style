# Development standards consolidation

The approved hierarchy is one `development` common preference and seven language
preferences: TypeScript, C#/.NET, Python, Java, Swift, Kotlin and Dart. Each language
requires only the common record. Framework sections remain conditional; they are
not separate competing common standards.

## Content reconciliation

The following mapping covers the sections supplied by the user. Rules are merged
by meaning rather than copied twice. The canonical source is
[`development-standards.ts`](../../src/styles/development-standards.ts).
Common rules are inherited by every child; language verification and conditional
framework checks supplement the common verification requirement.

| Supplied section | Destination and retained requirements |
|---|---|
| TS 1 / C# 1: principles | Common: Clean Code, pragmatic SOLID/DRY/KISS/YAGNI, readability, maintainability, existing conventions, minimal abstractions, suitable maintained/platform libraries. Language profiles retain type safety and supported runtime conventions. |
| TS 2: formatting | TypeScript: 2 spaces, 100-column target, semicolons, single quotes, braces, Prettier; common retains separate statements, multiline expressions, guard clauses and no nested ternaries. |
| TS 3: naming | TypeScript: camelCase values/functions, PascalCase types/interfaces/classes, local/module constant conventions, PascalCase React components, kebab-case ordinary files, use-prefixed hooks. Common: meaningful consistent names, no vague abbreviations. |
| TS 4: types | TypeScript: strict mode, unknown at boundaries, validation before narrowing, discriminated unions, readonly, justified assertions/suppressions, existing schema tools or Zod when appropriate. |
| TS 5 / C# 5: functions | Common: one responsibility, focused functions, named business rules, typed argument objects where useful, pure functions, explicit side effects, shallow control flow, no trivial helpers. C#: avoid boolean modes and premature generalization. |
| TS 6 / C# 6: architecture | Common: cohesive modules, proportionate separation, domain independence, validation/persistence boundaries, acyclic dependencies, DI for real substitution/testability. Language profiles retain framework boundaries; ASP.NET keeps thin controllers, built-in DI, no valueless repositories. Layering and microservices are not defaults. |
| TS 7: async | TypeScript + common: async/await, explicit errors, safe Promise.all, AbortSignal/timeouts, no floating rejections, no blocking Node event loop. |
| TS 8: React | TS conditional React section: functional components/hooks, domain logic outside UI, minimal state, no derived-state effects, no unnecessary memoization, stable keys, explicit UI states, semantic accessibility. |
| TS 9 / C# 10: errors/logging | Common: meaningful errors, diagnostic/user-message separation, no silent swallowing, no exception-based normal branching, structured safe logging and correlation. C#: preserve stack/cause, ILogger<T>, no generic expected errors or pointless rethrows. |
| TS 10 / C# 11: security | Common: validate boundaries, parameterize queries, secrets out of source/logs, server authorization, secure defaults, least privilege, safe serialization/files, no unsafe dynamic execution. Dependency choices and checks respect repository policy. |
| TS 11 / C# 12: testing | Common: critical rules, validation, failures, edges, boundary integration tests, deterministic independent tests, boundary mocks and regressions. TS keeps established runner (Vitest/Jest/node:test); C# keeps established xUnit/NUnit and conditional WebApplicationFactory, cancellation/authorization tests. |
| TS 12 / C# 13: quality gates | Common evidence reporting plus language-specific formatter/lint/type/build/analyzer/test checks. Nullable warnings are explicit in C#. Husky, lint-staged, StyleCop and Coverlet remain optional tooling choices, not mandatory dependencies. |
| TS 13 / C# 14: agent instructions | Common: readable output, no brevity-driven compression, no speculative abstraction, preserve architecture/behavior, requested scope only, fix introduced issues, truthful executed checks. TS disallows any shortcuts; C# avoids automatic interfaces/repositories and prefers framework features. |
| C# 2: formatting | C#: 4 spaces, 120-column target, newline opening braces, control-flow braces, one statement per line, .editorconfig/dotnet format; common guard clauses and wrapping. |
| C# 3: naming | C#: PascalCase public/type/method/property/constant names, I interfaces, camelCase locals/parameters, _camelCase fields, Async suffix; domain terms and no meaningless suffixes/Hungarian notation. |
| C# 4: types/features | C#: nullable references, domain types, typed configuration, immutable records, stable enums, readable pattern matching, supported modern syntax/required properties, no unnecessary casts/null-forgiving operators. |
| C# 7: concurrency | C#: async I/O, CancellationToken, no Result/Wait in async paths or unnecessary Task.Run, correct sync/async disposal, safe Task.WhenAll, thread safety. |
| C# 8: ASP.NET | Conditional: built-in DI/lifetimes, Problem Details, appropriate DTOs, validation, centralized auth/errors, middleware, configured IHttpClientFactory, timeouts/resilience and relevant health checks. |
| C# 9: EF/database | Conditional: async I/O, no N+1, appropriate AsNoTracking/projection, bounded data, careful IQueryable exposure, transactions/invariants, reviewed migrations and parameterized SQL. |

Legacy `coding-style` v3 readability/configuration rules are retained in common:
one statement per line, braces, blank lines, explicit formatter authority,
legacy compression is not a convention, missing-tool reporting, CI enforcement,
separate formatting cleanup, regenerated outputs, and configurable operational
URLs/paths/ports/timeouts/limits with validated defaults. Fixed protocol invariants
remain constants. Comments/public API documentation, explicit absence,
immutability and dead-code cleanup are retained. Old numeric function/file limits
become review signals so they do not force artificial abstractions.

Retired frontend/backend baselines map to common UI/service sections. TypeScript
web and Node profiles merge into one TypeScript child with React/Next.js,
Vue/Angular/Svelte, Node and React Native conditions. Native mobile guidance maps
to Swift, Kotlin and Dart, with platform touch-target units, lifecycle, permissions,
secure storage and device checks. Offline, push, release signing, rollout and
performance budgets depend on the actual product/release. Specific library names,
command recipes and fixed rollout percentages are examples/procedures rather than
universal obligations; existing project choices win. Old versions remain in history.

Python adds PEP 8, type hints versus runtime validation, context managers, safe
exceptions, no mutable defaults, package/environment conventions and appropriate
async/tests. Java adds project-or-Google style, generics/immutability, resource and
interrupt handling, pinned JDK/build tooling and conditional Spring guidance.
Defaults are overridable: [PEP 8](https://peps.python.org/pep-0008/),
[Python typing](https://docs.python.org/3/library/typing.html),
[Google Java Style](https://google.github.io/styleguide/javaguide.html),
[Java learning reference](https://dev.java/learn/).

## Conflict audit disposition

| Findings | Implementation |
|---|---|
| C01, C13 | Language-qualified exact settings, aligned ordinary TypeScript filenames; separate TS/C# values coexist. |
| C02–C04 | Specialist formats no longer veto selected outputs. Format records have applicability; multiple requested outputs survive. Word accepts the requested docx/dotx and rejects a wrong alternative. |
| C05–C06, C16 | Common has no document/specialist dependencies. Framework/target conditions distinguish UI, API, CLI, SDK and mobile. Specialist prose starts with an explicit scope constraint. |
| C07–C08 | Explicit task/project settings beat personal defaults. Priority is ranking, not authority. Existing frameworks/tools remain authoritative. |
| C09 | Removed fixed three-option rules from thinking content, principles and criteria; evidence scales with significance. |
| C10, C14 | Common owns everyday quality expectations; specialists own detailed evidence, formal strategy and review. Compatibility records contain no duplicate rule bodies. |
| C11–C12 | One canonical catalog for seed and reviewed migration; full record fields updated, known-baseline hashes, transactions, optimistic preview fingerprints, revision-producing rollback. |
| C15 | Language/framework/target context carried through validation, discovery, preparation, review and transfer. Unknown required context is unresolved. |

Natural-language scope is still reviewed by the agent; the resolver does not
semantically remove paragraphs or prove absence of every possible contradiction.

## Migration and compatibility

The batch keeps original IDs and project assignments, adds seven profiles and
converts seven old development profiles into compatibility references. Eleven
formal document records become Templates. Fresh seeds include the same hidden
compatibility references for consistent IDs/exports, without duplicate baseline
rules. Existing projects can keep old selected IDs; select new languages explicitly
where a generic old record cannot identify the language.

Known unchanged seed and audited live generations can migrate. Personal edits,
project text overrides, inactive records or unknown fingerprints block the batch.
Private copies are retained. A manifest allows rollback through new revisions;
rollback refuses to overwrite later Library/project edits. Archived children after
rollback require manual comparison before a later reapplication.

Use Library → … → Review standards consolidation. Review the complete comparison,
then apply. The result offers Undo. Startup/seed never overwrites an existing Library.

## Verification and limits

Execution on 2026-11-07: **189 tests passed, zero failed** using Node 22.23.4.
`npm run build:package`, the packed-install smoke test, catalog documentation
generation and `git diff --check` passed. The live migration updated 55 records
and created seven; readback verified canonical seed parity, original IDs/history,
unchanged projects and a no-op repeat preview. The Brain project retains TypeScript
through its existing selected compatibility record.

Live migration ID: `53f6b25e-ba4c-48b3-a742-ad6a08e956fe`.
Private pre-migration backup:
`~/.personal-brain-style/backups/before-development-standards-2026-11-07.sqlite`.
The pre-migration MCP compliance report is
`9c5cf2c4-319c-4d39-b497-0e360ff2ea99`; it deliberately reports manual claims as
Not verified, separately from the executed checks above.

- Automated tests cover seven-child inheritance, mixed-language overrides,
  conditional scopes, format selection, migration parity, cycles, concurrent
  edits, private copies, project overrides, idempotence and guarded rollback.
- MCP contract tests and packaged CLI/MCP/hook-path smoke checks cover shared
  integration code. These are not real end-to-end Codex/Claude/OpenCode sessions.
- Native Chrome inspection on a temporary Library copy verified preview/apply,
  seven-child hierarchy, keyboard tab focus and Escape closing. Narrow-screen
  and screen-reader behavior remain unverified.
- UI TypeScript compilation and package build run. Backend package compilation
  is transpilation, not a full backend type check. The repository has no configured
  formatter/linter command; those checks are Not verified.
- npm publication, host reconnection, mass formatting and new tooling installation
  are outside this change. Restart long-running hosts to load the new MCP schema.

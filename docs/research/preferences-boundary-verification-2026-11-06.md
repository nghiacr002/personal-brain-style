# Preference boundary implementation verification

The nine audited gaps now have implementation changes and regression coverage. On 2026-11-06, all 175 tests passed, the web TypeScript build and package build passed, and `git diff --check` passed. This verifies the bounded contract described below, not universal host-model compliance. Changes are uncommitted and unpublished; the live library was not migrated.

## Changes and evidence

| Finding | Result | Evidence and limits |
|---|---|---|
| F1: preferences duplicate procedures | Implemented | All 55 release records classified in `catalog-boundary-inventory.md`; preference bodies retain outcomes and acceptance, templates retain conventions, external procedures use bindings. Fresh seed and existing-library preview tested. |
| F2: unconditional scope expansion | Implemented | Supporting links resolve by explicit activity/formats; unknown conditions remain unresolved. PB-01/04/11/12 tests cover planning, conditional alternatives, optional procedures and required checks. |
| F3: implicit precedence | Implemented for structured choices | Task > private project > global; same-level differences stay conflicts. PB-02/03 and private-precedence regression pass. Prose overrides remain readable and do not change structured fields. |
| F4: divergent, opaque retrieval | Implemented | Hooks use discovery ranking; matched fields/terms and selection reasons returned. Expected-style hit@3 is 23/30 (audit baseline 22/30). Three unrelated queries return zero candidates. This small negative set does not establish general precision. |
| F5: unavailable ChatGPT operations | Implemented | Read-only `brain_resolve`, pinned scope and capability-specific instructions tested through MCP. No local skill or persisted review operations exposed. |
| F6: ambiguous procedure bindings | Implemented | Validated structured bindings plus host filtering; legacy string references remain. Host-specific and OpenCode directory fixtures pass. Host permission policies are not simulated. |
| F7: Fusion procedure growth | Implemented as guarded proposals | Sources limited to preferences, prompts require reusable outcomes, common new command/XML recipes rejected. Existing atomic/staleness/mandatory-field protections tested. Semantic review remains necessary. |
| F8: private origin unclear | Implemented | Source versions captured on clone, preserved across edits, cleared or corrected on identity changes. History compares base/current-global/current-private contracts. Unknown historical bases are labelled; no automatic rebase. |
| F9: authoring concepts mixed | Implemented | Preference/legacy procedure labels, outcome-first editor, conditional contract disclosure, procedure counts and full catalog-update comparison. Desktop library/editor inspected with Chrome accessibility tree and screenshot. |

## Regression run

Environment: macOS, Node 22.23.4, isolated SQLite fixtures. HTTP tests ran with permission to bind temporary loopback ports. UI inspection used a temporary `PB_HOME` at `/tmp/pb-boundary-preview`, not the live library; that preview server was stopped afterward.

Commands (each executed through `rtk proxy`):

```sh
/Users/nghiadh/.nvm/versions/node/v22.23.4/bin/node scripts/run.mjs --test tests/*.test.ts tests/*.test.mjs
/Users/nghiadh/.nvm/versions/node/v22.23.4/bin/node node_modules/typescript/bin/tsc --project tsconfig.web.json
/Users/nghiadh/.nvm/versions/node/v22.23.4/bin/node scripts/build-package.mjs
/Users/nghiadh/.nvm/versions/node/v22.23.4/bin/node scripts/catalog-doc.mjs
git diff --check
```

Final suite: 175 passed, 0 failed, 0 skipped. Session log: `/tmp/pb-boundary-final-tests.log` (temporary, not a committed artifact). Existing database, private-style, import/export, HTTP, MCP, hooks, Fusion, stale-instruction and UI-source tests cover consumers of the new contract. New `preference-boundary.test.ts` covers PB-01 through PB-09 and PB-11/12; Fusion recipe rejection covers PB-10 alongside existing source/proposal guards.

During implementation, regression checks caught legacy expectation changes, a QA key mismatch, omitted procedure counts and stale METHOD references. These were corrected. A new negative retrieval fixture initially found common interrogative/conjunction matches; expanded stop-word handling removed those matches while preserving the 23/30 positive benchmark. Final tests passed after these corrections.

Graph review used refreshed codebase-memory coverage plus source fallback. Changed source paths had matching metadata; `web/app.ts:183` has a known partial parse and was read directly. Scripts, generated files, documentation and tests were checked from source because the graph excludes them.

## Not verified and scope limits

- Live Codex, Claude, OpenCode and ChatGPT task execution: not run. Protocol parity is tested; behavioral parity is not proven.
- Mobile viewport, screen-reader session and browser end-to-end catalog application: not run. Desktop editor inspected; catalog migration behavior is covered by database tests.
- Arbitrary prose conflict detection and semantic Fusion recipe detection: require review by design. No automatic semantic proof is claimed.
- Formal release certification, npm publication and live catalog updates: out of scope for this implementation. Existing customized records remain unchanged until deliberately reviewed.
- No dedicated repository lint/formatter command is configured. TypeScript web compilation, runtime suite, package transpilation and diff whitespace checks were run.

Catalog updates are version-checked and history-preserving. A known-release fingerprint permits application; personal or unknown content is comparison-only. Deleted records and private copies are not recreated or overwritten. This conservative migration means existing libraries do not immediately receive the revised defaults.

Self-review verdict: implementation checks passed with the limitations above; independent compliance is Not verified. Personal Brain review `a453023d-3959-463a-8bba-dc7870d063cc` recorded artifact presence and correctly retained Not verified for manual claims and unexecuted text checks. It is not a release approval.

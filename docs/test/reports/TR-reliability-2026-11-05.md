# Reliability execution report — 2026-11-05

The implemented reliability increment passes local automated checks. This is self-verification, not independent release approval or evidence of improved generated outputs.

Build: working tree based on `b402c8d`; package `1.3.0-beta.3`. Environment: macOS, Node 22.23.4. Sources: [plan](../TP-reliability.md), [cases](../cases/reliability.md), [user guide](../../INSTRUCTION-QUALITY.md).

| Gate / criterion | Method and current-session evidence | Outcome |
|---|---|---|
| AC-1 MCP version and fallback | TC-REL-001 subprocess assertions; full suite | Passed |
| AC-2 YAML preservation and failure isolation | TC-REL-002 plus existing discovery consumers | Passed |
| AC-3 Historical delivery observations | TC-REL-003; packaged doctor output | Passed |
| AC-4 Selection baseline and isolation | `npm run test:quality`: 22/30 expected-style hit@3; full dependencies and unselected-ID rejection | Passed baseline gate; eight relevance misses remain |
| AC-5 Envelope recovery | TC-REL-005 malformed input followed by successful ping | Passed |
| AC-6 Offline installed artifact | `npm pack --ignore-scripts --cache /tmp/pb-reliability-npm-cache`, then `node scripts/test-package.mjs` | Passed |
| Regression | `npm test`: 159 passed, 0 failed, 0 skipped | Passed |
| UI type check and runtime package build | `npm run build:package` | Passed |
| Patch whitespace | `git diff --check` | Passed |
| Linter / formatter | No configured commands found; existing conventions preserved | Not verified by tools |
| Live agent clients / modern MCP | Not run; legacy protocol only | Not verified; release reviewer owns host checks |
| Independent quality gains | No model comparison or human evaluation | Not verified; product/quality owner owns follow-up |
| Persisted Personal Brain review | Not retried after earlier automatic approval rejection for transmitting project artifacts | Not verified; local evidence retained |

Six acceptance cases passed, zero failed, zero blocked, zero not run. The full automated suite contains 159 tests; this count is separate from the six acceptance-case groups. No release waiver or external approval is claimed.

## Defects and retest evidence

| Defect | Trigger and previous result | Expected / correction | Severity / priority | Status |
|---|---|---|---|---|
| DEF-REL-001 | Initialize reported 1.2.0 and echoed arbitrary protocol versions | Package-derived version; supported legacy version returned | Medium / P1 | Fixed, TC-REL-001 and offline package retest |
| DEF-REL-002 | YAML literal/folded description became empty | YAML parser preserves full text; invalid input reports an issue | Medium / P1 | Fixed, TC-REL-002 |
| DEF-REL-003 | Valid JSON `null` reached property access and terminated MCP | Invalid request response; next request still served | High availability impact / P1 | Fixed, TC-REL-005 |

The first trace-suite run was blocked by sandbox `listen EPERM`; the authorised localhost run passed. An initial npm fetch failed under restricted networking; the authorised dependency fetch succeeded. An initial pack command could not write the default cache, so its following smoke tested the older tarball and failed the new version assertion. Repacking with a writable temporary cache and rerunning offline smoke passed. No user cache ownership or permissions were changed.

## Change impact and remaining risk

MCP changes affect stdio clients and packaged startup. Parser changes affect HTTP skill inventory/item diagnostics, MCP retrieval, project discovery and installed-skill loading. Doctor adds historical trace aggregation without database migration or writes. YAML is the only new runtime dependency and is bundled for offline installation. Invalid metadata formerly tolerated by regex can now be rejected; users may need to correct affected SKILL.md files.

The codebase graph predates the reorganised source paths; impact was verified with direct caller searches and source reads. The understand-diff skill was read, but its `.ua`/legacy knowledge graph was absent, so no overlay is claimed. A `/understand` refresh would enable that optional graph report; it was unnecessary for these bounded checks. The existing codebase-memory graph likewise remains stale.

Ranking was not tuned to make the benchmark green. The eight misses remain visible in output, and the 22/30 floor only prevents aggregate regression. The small authored set does not represent customer traffic; individual tasks can regress while the total stays constant. The next quality step is label review and a held-out comparison before altering ranking.

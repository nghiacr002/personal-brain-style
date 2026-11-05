# TP-REL: Instruction delivery reliability

Version 1. Status: implementation self-test plan; no independent approval claimed. Build: working tree based on `b402c8d`, package `1.3.0-beta.3`. Owner: implementation maintainer role; release approver unassigned.

## Purpose and references

Deliver the first reliability increment from the [product research](../research/product-improvements-2026-11-05.md). This plan records the acceptance criteria announced before implementation; its written form was consolidated after the initial focused tests.

## Scope and acceptance

- AC-1: MCP reports the package version and negotiates only the implemented 2025-11-25 lifecycle.
- AC-2: Skill metadata preserves YAML multiline text and rejects malformed input without ending discovery.
- AC-3: Doctor reports observed handshake, retrieval and hook stages; demo activity and failed calls do not establish success.
- AC-4: A repeatable 30-task benchmark reports retrieval misses and prevents regression below the initial 22/30 hit@3 baseline. Scoped retrieval returns full dependencies and rejects unselected records.
- AC-5: Invalid JSON-RPC envelopes produce errors without terminating the process.
- AC-6: Built npm installation works offline with its runtime parser dependency.

Output-quality gains, native-host certification, the modern MCP lifecycle, semantic ranking changes and portable style exports are outside this increment.

## Risks and approach

| Area | Likelihood × impact (1–3) | Check |
|---|---|---|
| MCP contract and malformed input | 2 × 3 | Real subprocess request/response tests |
| YAML compatibility and untrusted aliases | 2 × 3 | Valid, malformed, duplicate-key, alias, length and CRLF fixtures |
| Misleading diagnostics | 2 × 2 | Empty, failed, demo and successful trace cases |
| Cross-project retrieval | 2 × 3 | Scoped retrieval and existing project isolation suites |
| Missing packaged dependency | 2 × 3 | Offline installation in an empty temporary directory |

## Levels, environment and data

Unit and integration checks use Node 22.23.4 on macOS. All databases, skills and trace data are synthetic temporary fixtures; cleanup removes them. HTTP regression tests need localhost access. The existing suite covers callers in HTTP, MCP, project discovery, hooks and package startup. No production database or agent configuration is modified.

## Entry, exit and execution

Entry: source and callers inspected; acceptance criteria stated. Exit: all focused cases, full suite, UI/package build and offline package smoke pass. Suspend on data leakage or unresolved regression; resume after correction and rerun. Run focused checks first, then regression, build and packaged smoke. No deployment date or release approval is implied.

The maintainer executes checks and records outcomes in the [execution report](reports/TR-reliability-2026-11-05.md). An independent reviewer owns live-host and release approval. Cases are in [the case register](cases/reliability.md); test output is local, not sent to an external review service.

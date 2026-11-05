# Reliability case register

All cases use synthetic temporary fixtures on the runtime in the test plan. Priority P1 unless stated. Automated test setup and cleanup define the executable steps.

| ID | Requirement | Type / level | Preconditions and data | Steps | Expected | Automation |
|---|---|---|---|---|---|---|
| TC-REL-001 | AC-1 | Contract / integration | Seeded temporary DB; unknown requested version | Initialize, reject invalid version type, list and call tools | Supported version, actual package version, valid errors; requests still work | `tests/mcp.test.ts` |
| TC-REL-002 | AC-2 | Boundary / integration | Skill files with literal/folded YAML, quotes, CRLF, 1,024-character description, invalid YAML, duplicate keys, aliases and non-text fields | Inventory temporary home | Four valid records preserve descriptions; four invalid records report issues | `tests/skill-discovery.test.ts` |
| TC-REL-003 | AC-3 | Functional / unit | Empty trace DB | Add demo, error, success events; inspect health | Unknown remains for demo/errors; successful observations include count and timestamp | `tests/trace.test.ts` |
| TC-REL-004 | AC-4 | Quality and isolation / integration | Fresh catalog; 30 authored prompts; separate selected projects | Rank catalog, retrieve scoped root/dependencies, try unselected ID | Report every miss; at least 22 top-three hits; exact dependency closure; reject unselected ID | `tests/instruction-quality.test.ts` |
| TC-REL-005 | AC-5 | Negative / integration | New MCP process | Send broken JSON, null, array, number, then ping | Parse/invalid-request errors followed by successful ping | `tests/mcp.test.ts` |
| TC-REL-006 | AC-6 | Packaging / integration | Fresh tarball; empty npm cache and install directory | Offline install; run doctor, MCP, hooks and HTTP handler smoke | Bundled YAML resolves; version and compiled paths match; clean startup | `scripts/test-package.mjs` |

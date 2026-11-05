# Instruction delivery and quality checks

Use `personal-brain doctor` to inspect historical delivery observations and `npm run test:quality` from the source checkout to measure retrieval against a fixed synthetic task set. Neither proves that an agent followed an instruction or produced a good artifact.

## Delivery diagnostics

Doctor's `delivery.agents` reports handshake, full-record retrieval, session-hook emission and prompt-hook emission per agent. Each stage includes `observed` or `unknown`, a successful-event count and last observed time. Demo events and failures are excluded. Observations span the stored history and projects; they are not a current-session health check. Clearing history resets this evidence. Existing registration commands remain available in doctor output.

An unknown stage means no successful event was recorded. Start the host, discover and retrieve a selected style, then run doctor again. Registration alone does not establish retrieval, and retrieval does not establish compliance.

## Protocol and skill contracts

The server implements the MCP **2025-11-25 legacy lifecycle**. Initialization requires a protocol-version string; unsupported requests receive the supported version. Clients must disconnect if they cannot use that version, as specified in the [MCP lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle). The newer per-request lifecycle is not implemented. Server identity reads the installed package version.

Skill frontmatter uses the [YAML parser](https://eemeli.org/yaml/), bundled in the npm artifact so the offline installation smoke remains meaningful. Literal/folded strings, quoting and comments are parsed; full descriptions are retained. Malformed mappings, duplicate keys, aliases, unsupported tags and non-string name/description values report scan issues. Existing files without frontmatter retain their directory-name fallback. Files remain subject to the existing 64 KiB bound. Some previously tolerated malformed skills may now need correction.

## Retrieval baseline

On 2026-11-05 the fresh bundled catalog returned the expected style in its first three results for **22 of 30 tasks (73.3%)**. Tasks cover BRD, HLD, LLD, research and development. All eight misses are printed by the test, including their actual ranks. The initial observed score is a regression floor, not a product acceptance target. Labels are author judgements and some prompts are ambiguous; review them before making ranking changes.

Run from the repository with supported Node:

```sh
npm run test:quality
```

The test uses a temporary database, checks scoped retrieval and dependencies, and leaves personal data unchanged. It is also included in `npm test`. It does not use model calls or measure latency, billing, human satisfaction or generated-output correctness.

## Measuring output quality next

Before claiming improved outputs, run an opt-in comparison of native instructions alone, current Brain styles and a candidate revision. Use the same tasks/model/host versions, repeated runs and held-out tasks. Predefine deterministic artifact checks and a blind human rubric. Record first-pass acceptance, corrections, elapsed time and host-reported token usage when available. Keep raw task content local unless the user authorises sharing. No output-quality improvement has yet been measured.

# Fusion and scoped diagnostics

Open **Fusion**, select projects and choose Codex or Claude. **Analyze with agent** sends the selected style records and shared target styles to the installed, authenticated CLI provider. It does not send repository files or traces. The agent proposes reusable changes to existing global styles; it cannot publish them directly.

Review the current and proposed instructions, supporting criteria, source versions, rationale and conflicts. **Publish new global version** creates a revision only if its sources and target are unchanged and no conflicts remain. Project-private records stay unchanged. Projects consuming the shared record receive its new version.

Runs are stored locally. Missing CLI/login, invalid output and a five-minute timeout produce a failed run. Refresh status to retrieve the result. Restarted runs must be started again. This implementation updates existing global styles; it does not create new global targets or infer success from usage frequency.

Trace Explorer filters activity by project, agent, channel and record. Project scope also controls summary counts; other filters narrow the event listing. Filters survive URL refresh. Token counts remain estimates from emitted context, not model billing or total task consumption.

Diagnostics keeps style discovery, startup preview and text validation available with explicit project scope. These are simulations and deterministic checks, not proof of agent compliance. History, feedback and external tool registration remain available for recovery and maintenance.

The shared navigation uses short names and labeled icons. Evidence explanations and synthetic traces use progressive disclosure. The Research style is selected for existing projects and linked from relevant shared architecture, BA, design and technology styles. Its guidance requires primary evidence, traceable claims, alternatives and explicit uncertainty.

Design references: [NN/g icon usability](https://www.nngroup.com/articles/icon-usability/), [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/), and [Carbon filtering](https://www.carbondesignsystem.com/building-blocks/core/patterns/filtering).

Validation: focused tests cover project trace isolation, publication validation, private-source preservation, idempotent Research installation and missing-CLI failures. Authenticated provider execution and a complete narrow-screen visual audit remain unverified.

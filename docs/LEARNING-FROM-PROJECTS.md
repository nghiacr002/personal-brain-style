# Learning from projects and scoped diagnostics

Learning from projects is automatic. It is off until you turn it on: the first time you open **Learning**, the page asks once and stores your answer (change it later under Settings). When on, while the app is running, it checks every two minutes whether any project's customized styles (private copies or overrides) changed since the last comparison. If so, it asks Codex (or Claude, or the agent chosen in Settings) to compare them; if nothing changed, or projects use shared styles unchanged, no agent is called. Turn this off, pick the agent, or exclude projects under Settings; **Compare now** forces a comparison. It sends the customized project styles and the shared target styles to the installed, authenticated CLI provider. It does not send repository files or traces. The agent proposes reusable changes to existing global styles; it cannot publish them directly.

Each proposal appears on the same page, marked _From your projects_. Review the word diff, supporting fields, source versions, rationale and conflicts. **Apply** creates a revision only if its sources and target are unchanged and no conflicts remain. Project-private records stay unchanged. Projects consuming the shared record receive its new version.

Runs are stored locally. Missing CLI/login, invalid output and a five-minute timeout produce a failed run, shown in the status card on the Learning page; an unchanged library is not retried. Restarted runs must be started again. This implementation updates existing global styles; it does not create new global targets or infer success from usage frequency.

Trace Explorer filters activity by project, agent, channel and record. Project scope also controls summary counts; other filters narrow the event listing. Filters survive URL refresh. Token counts remain estimates from emitted context, not model billing or total task consumption.

Diagnostics keeps style discovery, startup preview and text validation available with explicit project scope. These are simulations and deterministic checks, not proof of agent compliance. History, feedback and external tool registration remain available for recovery and maintenance.

The shared navigation uses short names and labeled icons. Evidence explanations and synthetic traces use progressive disclosure. The Research style is selected for existing projects and linked from relevant shared architecture, BA, design and technology styles. Its guidance requires primary evidence, traceable claims, alternatives and explicit uncertainty.

Design references: [NN/g icon usability](https://www.nngroup.com/articles/icon-usability/), [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/), and [Carbon filtering](https://www.carbondesignsystem.com/building-blocks/core/patterns/filtering).

Validation: focused tests cover project trace isolation, publication validation, private-source preservation, idempotent Research installation and missing-CLI failures. Authenticated provider execution and a complete narrow-screen visual audit remain unverified.

# Personal architecture styles

> **Legacy document.** This describes the pre-catalog legacy installers and samples. Fresh installs use the release catalog instead; see [STYLE-CATALOG.md](STYLE-CATALOG.md). Where this document says required links allow eight IDs, the current limit is 12.

The next HTTP server startup installs three active personal styles once. These are the requested personal records, not the generic samples. The installer marker prevents future startups from overwriting edits or restoring deliberately archived styles.

| Style | Domain | Required-linked styles |
| --- | --- | --- |
| Architecture drawing — clear cloud flow diagrams | architecture | Thinking and technology selection |
| Architecture technology selection — Azure first | technology | Thinking |
| Architecture thinking — security and operations | thinking | None |

Find them in Library → My Styles. Edit the **Required-linked styles** field to manage dependencies. Drawing specifies editable draw.io, square boxes, labeled arrows, a sky-blue palette, legend and official Azure/GCP cloud icon sources. Technology selection defaults to Azure; thinking covers security and operations. Icon sources are instructions for selecting assets, not a downloaded icon archive.

`requiredIds` is an optional array of up to eight record IDs. Create, update and restore reject missing/inactive dependencies and cycles. Existing records without it remain compatible. Links are resolved transitively and deduplicated by `brain_get`, `brain_style` and task hooks. Discovery includes dependency IDs; `brain_get` returns full dependency records in `requiredLinked`. Hook and bootstrap excerpts instruct agents to retrieve full instructions before work. These instructions cannot guarantee agent compliance.

Project content overrides apply to linked records. A required record replaced by another selection in the same project slot, or subsequently archived, produces an explicit error on resolution. Reconfigure the project or update the link; a dependency is never silently substituted. Project overrides change content, not dependency identity.

Research sources are embedded in each record: Microsoft Azure Well-Architected security and operational excellence guidance, Azure Architecture Center technology choices and icons, Google Cloud's icon library, and draw.io's Azure diagram documentation.

## Additional styles and dependency map

A second one-time installer adds **Architecture technology selection — Cloud Agnostic** and **Architecture design patterns — microservices, DDD and modular design** as drafts. Existing records and edits stay unchanged. Both require the active security/operations thinking record when available. Activate the desired alternative before selecting it for a project or linking to it. Cloud Agnostic does not override Azure First automatically: replace that technology selection and update any exact required links that still point to Azure First.

Library now has **Table** and **Dependency map** modes. The table's **Dependencies** column opens the required-link editor directly. In the map, arrows point from a style to each required style; selecting a node opens its editor. Search, domain filters and pagination select the root records; their transitive dependencies remain visible as dashed context nodes. Missing or archived references appear as unavailable nodes and are preserved in the editor until explicitly removed. Cycles and invalid dependencies are rejected when saving. The map describes shared library links, not resolved project overrides.

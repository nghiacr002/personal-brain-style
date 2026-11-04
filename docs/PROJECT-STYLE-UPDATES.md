# Project style updates

Agents can call `brain_update_project_style` to change a selected style or skill record without changing the shared library. Read `brain_projects` for the project version and `brain_get` with the project ID for the effective record and its version.

```json
{
  "projectId": "<project ID>",
  "id": "<record ID>",
  "expectedVersion": 1,
  "expectedProjectVersion": 2,
  "changes": {
    "externalSkills": ["codebase-memory", "ponytail:ponytail-review"],
    "reviewCriteria": ["Review backend and UI changes against the selected styles."]
  }
}
```

Array fields replace the existing array. Omitted fields are preserved. The response includes the private record ID and updated project version; use these for later calls. Stale versions fail without saving. Capability, record type and active status remain unchanged. Required private links must belong to the same project. Shared ancestors that require the edited record are copied and rewired within the project.

In a project's Styles or Personalized styles tab, use **Publish to global** to create a shared copy. The confirmation includes required private dependencies: those are also copied, while existing shared dependencies are reused. Private records and project selections stay unchanged. Active published copies become global defaults and available to other projects; drafts remain drafts. Publishing again creates another independent copy.

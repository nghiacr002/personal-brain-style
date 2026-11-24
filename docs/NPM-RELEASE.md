# npm beta release

Build from the repository root using Node 24 LTS or supported Node 22.

1. Run node scripts/run.mjs scripts/catalog-baseline.mjs and commit the result, so unedited copies of this release can take later catalog updates (a test fails when a catalog style has no recorded fingerprint).
2. Run npm pack (builds the compiled runtime and UI).
3. Run node scripts/test-package.mjs using a supported Node version. This installs the tarball offline into a temporary directory and checks CLI, MCP and clean startup.
4. Inspect the archive with tar -tzf personal-brain-style-1.3.0-beta.11.tgz. Confirm no database, credentials, personal configuration or third-party skill contents are included.
5. Run npm login, then npm whoami. Check npm view personal-brain-style name version. A registry 404 means the name is not registered; network errors do not establish availability. If the name is owned by another publisher, choose an owned scope and rebuild.
6. Publish the tested artifact: npm publish ./personal-brain-style-1.3.0-beta.11.tgz --access public --tag beta
7. Verify npm view personal-brain-style@beta version and install it in a clean environment.

Publication requires an authorized npm account and may require browser verification or a one-time password. Never put tokens in repository files. The beta tag avoids replacing a stable latest release. Registry versions cannot be overwritten; increment the version for subsequent releases.

The package contains reusable built-in style templates and historical migration code, but no user's SQLite database or project selections. The existing installation has not been replaced by the packaging tests.

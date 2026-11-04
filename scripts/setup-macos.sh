#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if ! command -v node >/dev/null; then
  echo "Node.js is not installed. Install Node 24 LTS using nvm or Homebrew." >&2
  exit 1
fi
node scripts/run.mjs --check
printf '\nPersonal Brain · macOS setup\nNode %s\n\n' "$(node --version)"
node scripts/run.mjs src/cli.ts seed
node scripts/run.mjs --test tests/*.test.ts tests/*.test.mjs
printf '\nReady. Start the web UI:\n\n  cd "%s"\n  npm start\n\nOpen http://127.0.0.1:4177 and enter the access token from Terminal.\n' "$ROOT"
printf '\nTo register MCP integrations, run:\n\n  bash scripts/connect-macos.sh\n'

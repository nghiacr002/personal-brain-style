#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BOOTSTRAP_NODE="$(command -v node || true)"
if [[ -z "$BOOTSTRAP_NODE" ]]; then echo "Node.js is required; install Node 24 first."; exit 1; fi
NODE="$("$BOOTSTRAP_NODE" "$ROOT/scripts/select-node.mjs")"
export PB_NODE="$NODE"
if command -v cygpath >/dev/null 2>&1; then NODE="$(cygpath -u "$NODE")"; fi
echo "Using Node: $NODE ($("$NODE" --version))"
RUNNER="$ROOT/scripts/run.mjs"
ENTRY="$ROOT/src/cli.ts"
print_cmds() {
  printf '\nClaude Code:\n  claude mcp add --transport stdio --scope user personal-brain -- %q %q %q mcp claude\n' "$NODE" "$RUNNER" "$ENTRY"
  printf '\nCodex CLI:\n  codex mcp add personal-brain -- %q %q %q mcp codex\n' "$NODE" "$RUNNER" "$ENTRY"
}
if [[ "${1:-}" != "--apply" && "${1:-}" != "--repair" ]]; then
  echo 'Review these commands before installation; no CLI settings were changed.'
  print_cmds
  printf '\nTo register both automatically: bash scripts/connect-macos.sh --apply\n'
  exit 0
fi
if command -v claude >/dev/null;then
  echo 'Registering Claude MCP...'
  if [[ "${1:-}" == "--repair" ]]; then
    existing="$(claude mcp get personal-brain 2>/dev/null || true)"
    if [[ "$existing" == *"$RUNNER"* ]]; then claude mcp remove personal-brain --scope user; fi
  fi
  if claude mcp get personal-brain >/dev/null 2>&1; then
    echo "Claude MCP already registered; existing entry preserved. To attribute MCP calls to Claude, verify the final argument is 'claude' (see README.md)."
  elif ! claude mcp add --transport stdio --scope user personal-brain -- "$NODE" "$RUNNER" "$ENTRY" mcp claude; then
    echo "WARNING: Claude MCP registration was not completed. Check claude mcp list." >&2
  fi
else echo 'Claude CLI not found; skipped.';fi
if command -v codex >/dev/null;then
  echo 'Registering Codex MCP...'
  if [[ "${1:-}" == "--repair" ]]; then
    existing="$(codex mcp get personal-brain 2>/dev/null || true)"
    if [[ "$existing" == *"$RUNNER"* ]]; then codex mcp remove personal-brain; fi
  fi
  if codex mcp get personal-brain >/dev/null 2>&1; then
    echo "Codex MCP already registered; existing entry preserved. To attribute MCP calls to Codex, verify the final argument is 'codex' (see README.md)."
  elif ! codex mcp add personal-brain -- "$NODE" "$RUNNER" "$ENTRY" mcp codex; then
    echo "WARNING: Codex MCP registration was not completed. Check codex mcp list." >&2
  fi
else echo 'Codex CLI not found; skipped.';fi
printf '\nMCP registration attempted. Verify using claude mcp list and codex mcp list.\n'

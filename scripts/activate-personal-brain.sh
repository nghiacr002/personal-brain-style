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
# Desktop uses native Node paths and JSON configuration on every supported OS.
for arg in "$@"; do
  if [[ "$arg" == "--desktop" ]]; then
    action=preview
    desktop_args=()
    for value in "$@"; do
      case "$value" in
        --desktop) ;;
        --apply) action=install ;;
        --repair) action=repair ;;
        --remove) action=remove ;;
        --status) action=status ;;
        *) desktop_args+=("$value") ;;
      esac
    done
    exec "$NODE" "$RUNNER" "$ENTRY" desktop "$action" ${desktop_args[@]+"${desktop_args[@]}"}
  fi
 done
if [[ "${1:-}" == "--apply" || "${1:-}" == "--repair" ]]; then
  echo "Registering MCP servers..."
  bash "$ROOT/scripts/connect-macos.sh" "${1}"
  echo "Installing Claude and Codex hooks and the OpenCode plugin..."
  "$NODE" "$RUNNER" "$ENTRY" hooks install all
  printf '\nDone. Restart Claude, Codex and OpenCode. In Codex run /hooks and trust the two Personal Brain hooks. The OpenCode plugin registers MCP when OpenCode starts.\n'
elif [[ "${1:-}" == "--remove" ]]; then
  "$NODE" "$RUNNER" "$ENTRY" hooks remove all
  echo "Personal Brain hooks and OpenCode plugin removed. Claude and Codex MCP registrations were left unchanged. Restart OpenCode to unload its plugin and MCP connection."
elif [[ "${1:-}" == "--status" ]]; then
  "$NODE" "$RUNNER" "$ENTRY" hooks status all
else
  echo "PREVIEW ONLY — no settings will be changed."
  "$NODE" "$RUNNER" "$ENTRY" hooks status all
  bash "$ROOT/scripts/connect-macos.sh"
  printf '\nOpenCode: installs ~/.config/opencode/plugins/personal-brain.js; the plugin registers MCP and supplies context when OpenCode starts.\n'
  printf '\nTo repair this installation’s MCP registrations and hooks: bash scripts/activate-personal-brain.sh --repair\n'
  printf '\nTo activate MCP and hooks: bash scripts/activate-personal-brain.sh --apply\n'
  printf 'To remove hooks and the OpenCode plugin: bash scripts/activate-personal-brain.sh --remove\n'
fi

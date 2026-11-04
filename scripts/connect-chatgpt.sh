#!/usr/bin/env bash
set -euo pipefail
set +x

# Credentials stay in this process environment, never in browser storage or command arguments.
if ! command -v tunnel-client >/dev/null 2>&1; then
  echo 'Install the supported tunnel-client from https://platform.openai.com/settings/organization/tunnels and rerun this command.' >&2
  exit 1
fi
if [[ -z "${CONTROL_PLANE_TUNNEL_ID:-}" ]]; then
  read -r -p 'OpenAI tunnel ID: ' CONTROL_PLANE_TUNNEL_ID
fi
if [[ ! "$CONTROL_PLANE_TUNNEL_ID" =~ ^tunnel_([a-z0-9]{4}_)?[a-z0-9]{32}$ ]]; then
  echo 'Invalid tunnel ID. Copy the complete ID from OpenAI Platform.' >&2
  exit 1
fi
if [[ -z "${CONTROL_PLANE_API_KEY:-}" ]]; then
  read -r -s -p 'Runtime API key (hidden): ' CONTROL_PLANE_API_KEY
  printf '\n'
fi
if [[ -z "$CONTROL_PLANE_API_KEY" ]]; then
  echo 'A runtime API key with Tunnels Read + Use is required.' >&2
  exit 1
fi
export CONTROL_PLANE_API_KEY CONTROL_PLANE_TUNNEL_ID
unset OPENAI_ADMIN_KEY MCP_SERVER_URL
echo 'Checking tunnel configuration…'
tunnel-client doctor --mcp.command "$1" --explain
echo 'Starting the tunnel. Keep this terminal open; Ctrl+C stops it.'
echo 'Once healthy, add this tunnel in ChatGPT: https://chatgpt.com/#settings/Connectors'
exec tunnel-client run --mcp.command "$1" --health.listen-addr 127.0.0.1:0

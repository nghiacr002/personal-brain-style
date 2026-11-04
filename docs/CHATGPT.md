# Connect ChatGPT to a project

Personal Brain provides a read-only, project-pinned MCP mode:

```sh
node scripts/run.mjs src/cli.ts mcp chatgpt <projectId>
```

Use **Agent setup → ChatGPT chat** to select a project and obtain the absolute command for this installation. Keep the command and runtime key private. The server shares the selected styles and their required dependencies, including their stored text and examples. Review those contents before sharing with ChatGPT.

## Guided connection

1. Open **Agent setup → ChatGPT chat**, select your project, and click **Copy connection command**.
2. Paste it into Terminal. The command validates the project and starts the setup helper. If tunnel-client is missing, it provides the official download page.
3. Enter the tunnel ID and runtime key when prompted. Key input is hidden. Personal Brain does not save the key or put it in command arguments; it is passed to the tunnel client through its process environment.
4. The helper checks configuration with tunnel-client doctor. Only a successful check proceeds to starting the foreground tunnel.
5. Once the tunnel reports healthy, add it through [ChatGPT connector settings](https://chatgpt.com/#settings/Connectors) and enable it in your chat. Keep the terminal open; Ctrl+C stops the tunnel.

The underlying command is:

```sh
node scripts/run.mjs src/cli.ts chatgpt-connect <projectId>
```

Existing CONTROL_PLANE_TUNNEL_ID and CONTROL_PLANE_API_KEY environment variables are reused. Otherwise the helper prompts for them each launch. It does not install a background service or persist credentials.

Create the tunnel and download the supported client from [OpenAI Platform](https://platform.openai.com/settings/organization/tunnels). Create a runtime key with Tunnels Read + Use permissions from [API keys](https://platform.openai.com/settings/organization/api-keys). Workspace permission to add custom MCP plugins is required. Personal Brain cannot grant that permission or enable a plugin on your behalf.

See the [OpenAI guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) and [official tunnel-client instructions](https://github.com/openai/tunnel-client/blob/master/docs/onboarding.md).

## Scope and limitations

Only brain_bootstrap, brain_discover, brain_get and brain_style are exposed. The server rejects a different project ID and working-directory overrides. It does not expose repository discovery, local skill files, writes or external tool execution. Tool annotations describe read-only behavior; the server also enforces that restriction.

ChatGPT can read skill references but cannot execute Codex/Claude CLI skills through this connection. It must report missing capabilities rather than claim compliance. Trace Explorer records these MCP calls under ChatGPT and the pinned project; this records retrieval, not proof that the model followed every instruction. Connecting the tunnel and enabling the plugin require your account setup; installing the code alone does not connect a ChatGPT account.

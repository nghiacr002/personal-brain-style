# Connect ChatGPT to a project

Personal Brain provides a read-only, project-pinned MCP mode: `personal-brain mcp chatgpt <projectId>`. You normally do not run it yourself; the connect command below starts it through the tunnel.

Use **Agent setup → ChatGPT** to select a project. Keep the runtime key private. The server shares the selected styles and their required dependencies, including their stored text and templates. Review those contents before sharing with ChatGPT.

## Guided connection

Agent setup shows four steps with progress. Ticks are remembered per browser and per project.

1. **Check prerequisites.** Agent setup detects tunnel-client on the server's PATH; if it is missing, install it from [OpenAI Platform → Tunnels](https://platform.openai.com/settings/organization/tunnels). An admin of your ChatGPT workspace must allow custom MCP servers. On OpenAI Platform you need Tunnels Read + Manage to create a tunnel and Tunnels Read + Use to run it; role changes can take up to 30 minutes.
2. **Create a tunnel and a key.** Open [Tunnels](https://platform.openai.com/settings/organization/tunnels), create a tunnel, link it to your ChatGPT workspace and copy its `tunnel_…` ID. Create a key with Tunnels Read + Use under [API keys](https://platform.openai.com/settings/organization/api-keys).
3. **Start the tunnel.** Copy the connect command shown and paste it into Terminal. It prompts for the tunnel ID and the key (input hidden), runs `tunnel-client doctor`, and starts `tunnel-client run` only when the check succeeds. Keep Terminal open while you use ChatGPT; Ctrl+C stops it. Personal Brain does not save the key or put it in command arguments; it reaches tunnel-client through its process environment.
4. **Add it in ChatGPT.** Open [ChatGPT Plugins](https://chatgpt.com/plugins), select **+** → **Add custom MCP server**, choose **Connection: Tunnel**, pick your tunnel, then **I understand and want to continue** → **Create as a plugin**. Turn the plugin on in a chat and test it, for example: "Use Personal Brain to find my styles for writing a BRD." If the tunnel is not listed, check that it is linked to your ChatGPT workspace and that you have Tunnels Read + Use.

The status badge changes to **Connected · last request …** by itself (the page polls every 5 seconds) only after ChatGPT makes a real tool call. Handshake and tool-list requests, such as those from `tunnel-client doctor`, do not count.

### Connect command

The guide always shows the installed command:

```sh
personal-brain chatgpt-connect <projectId>
```

If `personal-brain` is not installed, the guide says so and offers, under **Other ways to run it**: installing it once (`npm install -g personal-brain-style@beta`), running without installing (`npx --yes personal-brain-style@<version> chatgpt-connect <projectId>`, pinned to the running version), or, from a source checkout, the absolute command for that checkout.

Existing CONTROL_PLANE_TUNNEL_ID and CONTROL_PLANE_API_KEY environment variables are reused. Otherwise the helper prompts for them each launch. It does not install a background service or persist credentials.

Personal Brain cannot grant workspace or Platform permissions, or enable a plugin on your behalf.

See the [OpenAI guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) and [official tunnel-client instructions](https://github.com/openai/tunnel-client/blob/master/docs/onboarding.md).

## Scope and limitations

Only brain_bootstrap, brain_discover, brain_get and brain_style are exposed. The server rejects a different project ID and working-directory overrides. It does not expose repository discovery, local skill files, writes or external tool execution. Tool annotations describe read-only behavior; the server also enforces that restriction.

ChatGPT can read skill references but cannot execute Codex/Claude CLI skills through this connection. It must report missing capabilities rather than claim compliance. Trace Explorer records these MCP calls under ChatGPT and the pinned project; this records retrieval, not proof that the model followed every instruction. Connecting the tunnel and enabling the plugin require your account setup; installing the code alone does not connect a ChatGPT account.

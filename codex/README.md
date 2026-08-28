# Codex workstation kit

A schema-v2 mixin for Docker Sandbox's built-in `codex` agent. It installs the requested editor, runtime, browser, service CLI, LSP, ACP, GitHub SSH/signing, and Codex app-server tooling during sandbox creation.

## Run

```sh
sbx settings set kit.allowedSources '["docker.io/","github.com/docker/","github.com/slurpyb/"]'
sbx run --kit 'git+https://github.com/slurpyb/sbx-kits.git#ref=main&dir=codex' codex
```

For reproducibility, replace `main` with a release tag or commit SHA. Validate a
checkout with `sbx kit validate ./codex`.

## Host configuration

Configure required secrets with `sbx secret set` before creating the sandbox.
The built-in Codex agent supplies the `openai` and `github` credentials. This mixin declares only `outline`, `linear`, `shopify`, `cloudflare`, `firecrawl`, `jina`, and `perplexity`. GitHub SSH authentication and commit signing use the host's forwarded SSH agent.

Builder Methods Agent OS is cloned to `/home/agent/agent-os`. `/usr/local/bin` contains direct aliases for `agent-os-project-install`, `agent-os-sync-to-profile`, and `agent-os-common-functions`. Change into a project and run `agent-os-project-install` to install it there.

Use `sbx ports <sandbox>` to discover the mapped SSH and code-server ports.
Microsoft's server tunnel is started manually with `vscode-server`; browser
code-server starts automatically on container port 8080.

The kit contains no network deny rule. Docker Sandbox local or organization
governance may still apply independently.

## Observability

Start the local dashboard with `docker compose -f observability/compose.yaml up -d --build` from this repository, then open `http://localhost:8000`. Hooks fall back to `/home/agent/logs/<session-id>/events.jsonl` while it is unavailable. Create `/home/agent/.never-output-hooks` to disable capture. See [`../observability/README.md`](../observability/README.md) for the data and security model.

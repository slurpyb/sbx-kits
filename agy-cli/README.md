# Antigravity CLI workstation kit

A schema-v2 mixin for Docker Sandbox's built-in `gemini` agent. It replaces the Gemini CLI launcher with Google's Antigravity CLI (`agy`) 1.1.22 and adds the requested editor, runtimes, browser automation, service CLIs, LSPs, GitHub SSH, and SSH commit signing. It defaults to `gemini-3.1-pro-high` with high effort.

Docker Sandbox launches the built-in agent by resolving `gemini` through `PATH`; `/home/agent/.local/bin` comes first. The mixin installs a `gemini` shim there that launches `agy-default` and translates Gemini's built-in `--yolo` argument to Antigravity's equivalent `--dangerously-skip-permissions`. There is no `GEMINI_EXECUTABLE` override in Docker Sandbox v0.39.0 or the installed Gemini CLI.

## Run

```sh
sbx settings set kit.allowedSources '["docker.io/","github.com/docker/","github.com/slurpyb/"]'
sbx run --kit 'git+https://github.com/slurpyb/sbx-kits.git#ref=main&dir=agy-cli' gemini
```

For reproducibility, replace `main` with a release tag or commit SHA. Validate a
checkout with `sbx kit validate ./agy-cli`.

## Authentication and ACP

Configure the built-in Gemini agent's `google` secret so its inherited `GEMINI_API_KEY` can be proxy-managed. The mixin does not redeclare `google` or `github`; duplicate base credential services prevent kit composition. It sets Antigravity's required `modelProvider` to `gemini`; setting the environment variable alone is not sufficient in agy. The mixin declares only `outline`, `linear`, `shopify`, `cloudflare`, `firecrawl`, `jina`, and `perplexity`.

Builder Methods Agent OS is cloned to `/home/agent/agent-os`. `/usr/local/bin` contains direct aliases for `agent-os-project-install`, `agent-os-sync-to-profile`, and `agent-os-common-functions`. Change into a project and run `agent-os-project-install` to install it there.

Agy does not currently document native ACP support. This kit installs the
unofficial, version-pinned `agy-acp` 0.5.2 adapter and points it at the configured
agy launcher. The bridge depends on agy's PTY and local conversation database,
so revalidate it when upgrading agy and replace it when Google ships native ACP.

GitHub SSH authentication and commit signing use the host's forwarded SSH agent.
Use `sbx ports <sandbox>` to discover code-server's mapped port. Microsoft's VS
Code tunnel is started manually with `vscode-server`; browser code-server starts
automatically on container port 8080.

The kit contains no network deny rule. Docker Sandbox local or organization
governance may still apply independently.

## Observability

Start the local dashboard with `docker compose -f observability/compose.yaml up -d --build` from this repository, then open `http://localhost:8000`. Hooks fall back to `/home/agent/logs/<session-id>/events.jsonl` while it is unavailable. Create `/home/agent/.never-output-hooks` to disable capture. See [`../observability/README.md`](../observability/README.md) for the data and security model.

# Claude workstation kit

A schema-v2 mixin for Docker Sandbox's built-in `claude` agent. It installs the requested editor, runtimes, browser automation, service CLIs, LSPs, ACP, GitHub SSH, and SSH commit signing during sandbox creation. Claude defaults to Opus 5 at xhigh effort.

## Run

```sh
sbx settings set kit.allowedSources '["docker.io/","github.com/docker/","github.com/slurpyb/"]'
sbx run --kit 'git+https://github.com/slurpyb/sbx-kits.git#ref=main&dir=claude' claude
```

For reproducibility, replace `main` with a release tag or commit SHA. Validate a
checkout with `sbx kit validate ./claude`.

## Host configuration

Configure required secrets with `sbx secret set` before creating the sandbox.
The kit declares `anthropic`, `github`, `outline`, `linear`, `shopify`,
`cloudflare`, `firecrawl`, `jina`, and `perplexity` services. GitHub SSH authentication and
commit signing use the host's forwarded SSH agent rather than `GH_TOKEN`.

Builder Methods Agent OS is cloned to `/home/agent/agent-os`. Its scripts are available as `agent-os-project-install`, `agent-os-sync-to-profile`, and `agent-os-common-functions`; run `agent-os-project-install .` when you want to install Agent OS into the current project.

Use `sbx ports <sandbox>` to discover code-server's mapped port. Microsoft's VS
Code tunnel is started manually with `vscode-server`; browser code-server starts
automatically on container port 8080.

The kit contains no network deny rule. Docker Sandbox local or organization
governance may still apply independently.

## Observability

Start the local dashboard with `docker compose -f observability/compose.yaml up -d --build` from this repository, then open `http://localhost:8000`. Hooks fall back to `/home/agent/logs/<session-id>/events.jsonl` while it is unavailable. Create `/home/agent/.never-output-hooks` to disable capture. See [`../observability/README.md`](../observability/README.md) for the data and security model.

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
The built-in Claude agent supplies the `anthropic` and `github` credentials. This mixin declares only `outline`, `linear`, `shopify`, `cloudflare`, `firecrawl`, `jina`, and `perplexity`. GitHub SSH authentication and commit signing use the host's forwarded SSH agent.

Builder Methods Agent OS is cloned to `/home/agent/agent-os`. `/usr/local/bin` contains direct aliases for `agent-os-project-install`, `agent-os-sync-to-profile`, and `agent-os-common-functions`. Change into a project and run `agent-os-project-install` to install it there.

VS Code is no longer part of this kit. Stack the `claude-code` mixin alongside
it for browser-based code-server on port 8080 plus the Microsoft VS Code CLI
tunnel; splitting the two ~250&nbsp;MB downloads out is a large part of why this
kit now launches quickly.

Claude Code's self-updater is disabled (`DISABLE_AUTOUPDATER=1`). The kit
installs its launcher at `/home/agent/.local/bin/claude` — the same path the
updater rewrites — so leaving it on would replace the wrapper mid-session and
strand the preserved `claude-real` binary. The sandbox therefore tracks the
base image's Claude version; recreate the sandbox to pick up a newer one.

Commit and PR attribution trailers are turned off by merging `attribution`
into `/home/agent/.claude/settings.json` at startup, after the platform writes
that file. The merge uses `setdefault`, so a value you set by hand survives a
restart, and it applies to every project in the sandbox rather than only the
mounted workspace.

The kit contains no network deny rule. Docker Sandbox local or organization
governance may still apply independently.

## Observability

Start the local dashboard with `docker compose -f observability/compose.yaml up -d --build` from this repository, then open `http://localhost:8000`. Capture is opt-in: create `/home/agent/.agent-observe-enabled` inside the sandbox to turn it on. Without that file the hooks do no network or disk I/O at all. Once enabled, events fall back to `/home/agent/logs/<session-id>/events.jsonl` while the dashboard is unavailable. See [`../observability/README.md`](../observability/README.md) for the data and security model.

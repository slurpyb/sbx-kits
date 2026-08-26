# Pi Docker Sandbox kit

A GitHub-hosted Docker Sandbox kit for
[`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent).
It runs on Docker's stock `docker/sandbox-templates:shell-docker` template and
installs the latest Pi release during sandbox creation. No custom image or
Docker Hub publication is required.

## Install from GitHub

Docker Sandboxes restricts Git kit sources by default. Allow this GitHub
account once while retaining the default sources:

```console
sbx settings set kit.allowedSources '["docker.io/","github.com/docker/","github.com/slurpyb/"]'
```

Track the `main` branch:

```console
sbx run --kit "git+https://github.com/slurpyb/sbx-kits.git#ref=main&dir=pi" pi
```

For reproducible use, pin a release tag:

```console
sbx run --kit "git+https://github.com/slurpyb/sbx-kits.git#ref=v0.1.0&dir=pi" pi
```

Or pin an exact commit:

```console
sbx run --kit "git+https://github.com/slurpyb/sbx-kits.git#ref=<commit-sha>&dir=pi" pi
```

Without `ref`, sbx uses the repository's default branch:

```console
sbx run --kit "git+https://github.com/slurpyb/sbx-kits.git#dir=pi" pi
```

## Use a local checkout

```console
sbx run --kit /path/to/sbx-kits/pi pi
```

### Automatically create a host worktree

Kit hooks run inside the sandbox and cannot create host directories. From a
local checkout, use the included host-side launcher instead:

```console
/path/to/sbx-kits/pi/run-in-worktree
```

When run from `$HOME/repos/<github-user>/<repo>`, it creates a detached Git
worktree at `$HOME/worktrees/<github-user>/<repo>` and mounts it as the primary
sandbox workspace. It also mounts the common Git directory so normal Git
operations continue to work. Extra arguments are forwarded to `sbx run`; pass
Pi arguments after `--`.

Override the directory roots when needed:

```console
PI_SBX_REPOS_ROOT=/path/to/repos \
PI_SBX_WORKTREES_ROOT=/path/to/worktrees \
/path/to/sbx-kits/pi/run-in-worktree
```

A plain `sbx run` mounts the current directory directly because sbx chooses
host mounts before loading kit hooks.

## Included setup

At sandbox creation, the kit:

- installs the latest Pi release
- installs latest Bun and exposes its global package binaries on `PATH`
- installs `@fission-ai/openspec` globally with Bun
- installs latest `uv` into `/usr/local/bin`
- installs code-server and starts it on port `8080`
- installs the configured Pi extensions, tools, and themes
- defaults to `openai-codex/gpt-5.6-sol` with thinking level `high`
- generates concise `AGENTS.md` guidance about sandbox credentials, networking,
  Bun, and `uv`

Use `sbx ports` to find the host port mapped to code-server's container port
`8080`.

## Credentials

The kit declares proxy-managed credential injection for:

- OpenAI: `OPENAI_API_KEY`
- Google: `GEMINI_API_KEY`
- GitHub: `GH_TOKEN`
- OpenCode Zen and Go: shared `OPENCODE_API_KEY`

Credential values inside the sandbox are sentinels. The sandbox proxy replaces
them only for approved destination hosts, so do not print, persist, replace, or
use them for an interactive login.

Configure credentials on the host before creating the sandbox. Global secret
changes require recreating an existing sandbox.

## Validate a local checkout

```console
sbx kit validate ./pi
```

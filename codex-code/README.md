# Codex workstation + VS Code

A schema-v2 mixin that adds browser-based **code-server** (container port 8080)
and the Microsoft **VS Code CLI** tunnel to the `codex` agent. It was split out
of the `codex-workstation` kit so that kit stays fast to launch — the two VS Code downloads
were roughly 250&nbsp;MB of its create time.

## Run

Stack it after the workstation kit:

```sh
sbx run \
  --kit 'git+https://github.com/slurpyb/sbx-kits.git#ref=<commit-sha>&dir=codex-workstation' \
  --kit 'git+https://github.com/slurpyb/sbx-kits.git#ref=<commit-sha>&dir=codex-code' \
  codex
```

Pin a commit SHA rather than `main`: sbx resolves a moving ref once and reuses
the cached artifact, so `ref=main` will keep serving you the old spec.

## Ports

code-server starts automatically. Host ports are ephemeral on `127.0.0.1`, so
find the mapped one with `sbx ports <sandbox>`, or pin it:

```sh
sbx ports <sandbox> --publish 8080:8080/tcp
```

`vscode-server` is **not** started automatically — run it when you want a
Microsoft tunnel instead of the browser editor. It needs an interactive sign-in.

## Security

code-server runs with `--auth none`. That is bounded because sbx publishes to
`127.0.0.1` by default, so only the host reaches it. Publishing it to a
non-loopback address exposes an unauthenticated editor with a terminal inside
the sandbox — don't, unless you add authentication first.

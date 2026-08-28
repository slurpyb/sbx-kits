# Agent Observatory

A small local-first dashboard and event sink for the native hooks bundled into
the `codex`, `claude`, and `agy-cli` kits. It stores events in SQLite and shows
live session timelines, prompts and assistant output, tool activity, transcript
deltas, raw payloads, searchable history, stars, and notes.

## Start on the host

```sh
cd observability
docker compose up -d --build
open http://localhost:8000
```

Or, with Bun 1.4 installed:

```sh
cd observability
bun install --frozen-lockfile
bun run start
```

The server exposes:

- `GET /healthcheck` → `{ "status": "ok" }`
- `POST /events` → hook event ingestion
- `GET /api/sessions` and `GET /api/events` → dashboard data
- `PATCH /api/events/:id` → stars and notes
- `GET /stream` → live server-sent events

Data is kept in `observability/data/events.sqlite` for native runs or in the
`agent-observability-data` volume for Compose.

## Sandbox behavior

The kits default `AGENT_OBSERVABILITY_URL` to
`http://host.docker.internal:8000`. Override it when the collector has another
Docker-network address. Every hook performs a short health check before sending.
If the collector is down or a POST fails, the exact event is appended to:

```text
/home/agent/logs/<session-id>/events.jsonl
```

Backlogged events are retried when a later hook or agent startup can reach the
collector. Create `/home/agent/.never-output-hooks` inside a sandbox to disable
all hook output immediately. Remove the file to resume collection.

## Coverage

- **Codex:** session start, user prompts, completed tools, subagent lifecycle,
  stop events, last assistant messages, and Codex transcript deltas.
- **Claude Code:** session lifecycle, user prompts, completed/failed tools,
  subagent lifecycle, stop messages, and Claude transcript deltas.
- **Antigravity CLI:** pre/post model invocation, completed tools, stop events,
  and Antigravity transcript deltas.

The relay merges rather than replaces existing Codex/Claude hook settings. Agy's
configuration is isolated under the `sbx-observability` hook key.

## Security and research decision

Hook payloads and transcripts can contain source code, prompts, command output,
file contents, and secrets. The Compose port is bound to host loopback only and
there is intentionally no remote telemetry. Do not expose port 8000 without
adding authentication and TLS. Protect the SQLite volume and fallback logs as
sensitive data.

Research found mature dashboards for subsets of the problem: Agent Flow supports
Claude Code hooks and Codex rollout files, while agentglass supports Claude hooks
and OpenTelemetry-capable agents. Neither provided verified native Antigravity
hook coverage. This repository therefore uses each harness's documented native
hooks and a small common HTTP contract, avoiding transcript scraping outside the
sandbox and keeping all three agents visible in one local dashboard.

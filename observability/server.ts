import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const port = Number(process.env.PORT ?? 8000);
const dataDir =
  process.env.OBSERVABILITY_DATA_DIR ?? join(import.meta.dir, "data");
const dbPath = process.env.OBSERVABILITY_DB ?? join(dataDir, "events.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath, { create: true });
db.run("PRAGMA journal_mode=WAL");
db.run("PRAGMA busy_timeout=5000");
db.run(`CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at TEXT NOT NULL,
  emitted_at TEXT,
  harness TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  cwd TEXT,
  model TEXT,
  summary TEXT,
  payload TEXT NOT NULL,
  starred INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT ''
)`);
db.run(
  "CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, id DESC)",
);
db.run(
  "CREATE INDEX IF NOT EXISTS idx_events_received ON events(received_at DESC)",
);
db.run(
  "CREATE INDEX IF NOT EXISTS idx_events_starred ON events(starred, id DESC)",
);

const insertEvent = db.query(`
  INSERT INTO events
    (received_at, emitted_at, harness, session_id, event_name, cwd, model, summary, payload)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateEvent = db.query(
  "UPDATE events SET starred = ?, note = ? WHERE id = ?",
);
const selectEvent = db.query("SELECT * FROM events WHERE id = ?");
const streamClients = new Set<ReadableStreamDefaultController<string>>();

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function summarize(body: JsonObject, payload: JsonObject): string {
  const direct =
    text(payload.prompt) ??
    text(payload.last_assistant_message) ??
    text(payload.lastAssistantMessage) ??
    text(payload.terminationReason) ??
    text(payload.error);
  if (direct) return direct.slice(0, 500);
  const toolCall = object(payload.toolCall);
  const tool =
    text(payload.tool_name) ?? text(payload.toolName) ?? text(toolCall.name);
  if (tool) return `Tool: ${tool}`;
  const delta = text(body.transcript_delta);
  return delta ? delta.slice(-500) : "";
}

function normalize(body: JsonObject) {
  const payload =
    Object.keys(object(body.payload)).length > 0 ? object(body.payload) : body;
  const sessionId =
    text(body.session_id) ??
    text(payload.session_id) ??
    text(payload.sessionId) ??
    text(payload.conversationId) ??
    "unknown";
  const eventName =
    text(body.event_name) ??
    text(payload.hook_event_name) ??
    text(payload.hookEventName) ??
    text(payload.eventName) ??
    "event";
  const workspacePaths = Array.isArray(payload.workspacePaths)
    ? payload.workspacePaths
    : [];
  return {
    receivedAt: new Date().toISOString(),
    emittedAt: text(body.emitted_at),
    harness: text(body.harness) ?? "unknown",
    sessionId,
    eventName,
    cwd: text(payload.cwd) ?? text(workspacePaths[0]),
    model: text(payload.model) ?? text(payload.modelName),
    summary: summarize(body, payload),
    payload: JSON.stringify(body),
  };
}

function rowToJson(row: JsonObject | null): JsonObject | null {
  if (!row) return row;
  let payload: unknown = {};
  try {
    payload = JSON.parse(String(row.payload));
  } catch {
    payload = { malformed: true, raw: String(row.payload) };
  }
  return {
    ...row,
    starred: Boolean(row.starred),
    payload,
  };
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function broadcast(event: unknown) {
  const message = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of [...streamClients]) {
    try {
      client.enqueue(message);
    } catch {
      streamClients.delete(client);
    }
  }
}

async function ingest(req: Request): Promise<Response> {
  let body: JsonObject;
  try {
    body = object(await req.json());
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const event = normalize(body);
  const result = insertEvent.run(
    event.receivedAt,
    event.emittedAt ?? null,
    event.harness,
    event.sessionId,
    event.eventName,
    event.cwd ?? null,
    event.model ?? null,
    event.summary,
    event.payload,
  );
  const saved = rowToJson(
    selectEvent.get(Number(result.lastInsertRowid)) as JsonObject | null,
  );
  if (!saved) return json({ error: "event insert failed" }, 500);
  broadcast(saved);
  return json({ status: "accepted", id: saved.id }, 202);
}

function listSessions(): Response {
  const rows = db
    .query(`
    SELECT session_id, harness, MAX(received_at) AS last_seen, COUNT(*) AS event_count,
           SUM(starred) AS starred_count, MAX(cwd) AS cwd, MAX(model) AS model
    FROM events GROUP BY session_id, harness ORDER BY last_seen DESC LIMIT 500
  `)
    .all();
  return json(rows);
}

function listEvents(url: URL): Response {
  const session = url.searchParams.get("session");
  const q = url.searchParams.get("q")?.trim();
  const starred = url.searchParams.get("starred") === "1";
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 500), 1),
    2000,
  );
  const where: string[] = [];
  const args: Array<string | number> = [];
  if (session) {
    where.push("session_id = ?");
    args.push(session);
  }
  if (starred) where.push("starred = 1");
  if (q) {
    where.push("(summary LIKE ? OR payload LIKE ? OR note LIKE ?)");
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const sql = `SELECT * FROM events ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT ?`;
  args.push(limit);
  const rows = db.query(sql).all(...args) as JsonObject[];
  return json(rows.map(rowToJson));
}

async function patchEvent(req: Request, id: number): Promise<Response> {
  const current = selectEvent.get(id) as JsonObject | null;
  if (!current) return json({ error: "not found" }, 404);
  let patch: JsonObject;
  try {
    patch = object(await req.json());
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const starred =
    typeof patch.starred === "boolean"
      ? Number(patch.starred)
      : Number(current.starred);
  const note =
    typeof patch.note === "string"
      ? patch.note.slice(0, 4000)
      : String(current.note ?? "");
  updateEvent.run(starred, note, id);
  const saved = rowToJson(selectEvent.get(id) as JsonObject | null);
  broadcast(saved);
  return json(saved);
}

function eventStream(): Response {
  let controllerRef: ReadableStreamDefaultController<string>;
  const stream = new ReadableStream<string>({
    start(controller) {
      controllerRef = controller;
      streamClients.add(controller);
      controller.enqueue(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    },
    cancel() {
      if (controllerRef) streamClients.delete(controllerRef);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function route(req: Request): Promise<Response> {
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return json({ error: "invalid URL" }, 400);
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (url.pathname === "/healthcheck") return json({ status: "ok" });
  if (url.pathname === "/events" && req.method === "POST") return ingest(req);
  if (url.pathname === "/api/sessions") return listSessions();
  if (url.pathname === "/api/events") return listEvents(url);
  const eventMatch = url.pathname.match(/^\/api\/events\/(\d+)$/);
  if (eventMatch && req.method === "PATCH")
    return patchEvent(req, Number(eventMatch[1]));
  if (url.pathname === "/stream") return eventStream();
  if (url.pathname === "/app.js")
    return new Response(Bun.file(join(import.meta.dir, "app.js")), {
      headers: { "Content-Type": "text/javascript" },
    });
  if (url.pathname === "/" || url.pathname === "/index.html")
    return new Response(Bun.file(join(import.meta.dir, "index.html")), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  return json({ error: "not found" }, 404);
}

const server = Bun.serve({ hostname: "0.0.0.0", port, fetch: route });

process.stdout.write(
  `Agent observability dashboard listening on http://0.0.0.0:${server.port}\n`,
);

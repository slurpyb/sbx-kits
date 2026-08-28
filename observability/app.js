const sessionsEl = document.querySelector('#sessions');
const eventsEl = document.querySelector('#events');
const searchEl = document.querySelector('#search');
const starredEl = document.querySelector('#starred');
const statusEl = document.querySelector('#status');
let activeSession = '';
let sessions = [];
let events = [];

const formatTime = value => value ? new Date(value).toLocaleString() : '';

async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function renderSessions() {
  sessionsEl.replaceChildren();
  if (!sessions.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No sessions';
    sessionsEl.append(empty);
    return;
  }
  for (const session of sessions) {
    const element = document.createElement('div');
    element.className = `session ${session.session_id === activeSession ? 'active' : ''}`;
    const title = document.createElement('strong');
    title.textContent = session.harness;
    const id = document.createElement('div');
    id.textContent = session.session_id;
    const metadata = document.createElement('div');
    metadata.className = 'muted';
    metadata.textContent = `${session.event_count} events · ${formatTime(session.last_seen)}`;
    const cwd = document.createElement('div');
    cwd.className = 'muted';
    cwd.textContent = session.cwd || '';
    element.append(title, id, metadata, cwd);
    element.addEventListener('click', () => {
      activeSession = session.session_id;
      renderSessions();
      loadEvents();
    });
    sessionsEl.append(element);
  }
}

function renderEvents() {
  eventsEl.replaceChildren();
  eventsEl.className = events.length ? '' : 'empty';
  if (!events.length) {
    eventsEl.textContent = 'No matching events.';
    return;
  }
  for (const event of events) {
    const element = document.createElement('article');
    element.className = 'event';
    const head = document.createElement('div');
    head.className = 'event-head';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = event.harness;
    const name = document.createElement('strong');
    name.textContent = event.event_name;
    const time = document.createElement('span');
    time.className = 'muted';
    time.textContent = formatTime(event.received_at);
    const model = document.createElement('span');
    model.className = 'muted';
    model.textContent = event.model || '';
    const star = document.createElement('button');
    star.className = `star ${event.starred ? 'on' : ''}`;
    star.title = 'Save this event';
    star.textContent = event.starred ? '★' : '☆';
    head.append(badge, name, time, model, star);
    const summary = document.createElement('div');
    summary.className = 'summary';
    summary.textContent = event.summary || event.payload?.transcript_delta || '';
    const details = document.createElement('details');
    const detailsTitle = document.createElement('summary');
    detailsTitle.textContent = 'Raw event and transcript delta';
    const raw = document.createElement('pre');
    raw.textContent = JSON.stringify(event.payload, null, 2);
    details.append(detailsTitle, raw);
    const note = document.createElement('textarea');
    note.className = 'note';
    note.placeholder = 'Why was this useful? Troubleshooting notes…';
    note.value = event.note || '';
    star.addEventListener('click', async () => patchEvent(event.id, { starred: !event.starred, note: note.value }));
    note.addEventListener('change', async () => patchEvent(event.id, { starred: event.starred, note: note.value }));
    element.append(head, summary, details, note);
    eventsEl.append(element);
  }
}

async function patchEvent(id, patch) {
  const updated = await getJson(`/api/events/${id}`, { method: 'PATCH', headers: {'content-type':'application/json'}, body: JSON.stringify(patch) });
  events = events.map(event => event.id === id ? updated : event);
  renderEvents();
  await loadSessions();
}

async function loadSessions() {
  sessions = await getJson('/api/sessions');
  renderSessions();
}

async function loadEvents() {
  const params = new URLSearchParams({ limit: '1000' });
  if (activeSession) params.set('session', activeSession);
  if (searchEl.value.trim()) params.set('q', searchEl.value.trim());
  if (starredEl.checked) params.set('starred', '1');
  events = await getJson(`/api/events?${params}`);
  renderEvents();
}

async function refresh() {
  try {
    await Promise.all([loadSessions(), loadEvents()]);
    statusEl.textContent = 'live';
  } catch (error) {
    statusEl.textContent = `offline: ${error.message}`;
  }
}

document.querySelector('#refresh').addEventListener('click', refresh);
searchEl.addEventListener('input', () => { clearTimeout(searchEl.timer); searchEl.timer = setTimeout(loadEvents, 250); });
starredEl.addEventListener('change', loadEvents);
document.querySelector('#export').addEventListener('click', async () => {
  const data = await getJson('/api/events?starred=1&limit=2000');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `agent-observatory-starred-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

const stream = new EventSource('/stream');
stream.onopen = () => statusEl.textContent = 'live';
stream.onerror = () => statusEl.textContent = 'reconnecting…';
stream.onmessage = () => refresh();
refresh();

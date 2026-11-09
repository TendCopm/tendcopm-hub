/**
 * Local CRM only. Never deployed. Synthetic records live in /tmp.
 * Production Pages functions do not include this login.
 */
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { sha256Hex } from '../functions/portal/_lib/crm/auth.js';
import { handleCrm } from '../functions/portal/_lib/crm/http.js';

const root = join(import.meta.dirname, '..', 'public');
const dbPath = '/tmp/tendco-crm-local.sqlite';
const raw = new DatabaseSync(dbPath);
raw.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL DEFAULT '',
    password_salt TEXT NOT NULL DEFAULT '',
    password_iter INTEGER NOT NULL DEFAULT 100000,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT
  );
`);
raw.exec(readFileSync(join(import.meta.dirname, '..', 'migrations', '0016_crm_internal.sql'), 'utf8'));

const PEOPLE = [
  { id: 'user-owner', name: 'Avery Owner', email: 'avery@tendcopm.com', role: 'owner', token: 'local-owner-token-synthetic-01' },
  { id: 'user-staff', name: 'Blair Staff', email: 'blair@tendcopm.com', role: 'staff', token: 'local-staff-token-synthetic-01' },
  { id: 'user-pm', name: 'Casey PM', email: 'casey@northwind.example', role: 'pm', token: 'local-pm-token-synthetic-0001' },
];
const PASSWORD = 'ExampleStaff1!';

function bound(stmt, args) {
  return {
    async first() {
      const row = stmt.get(...args);
      return row === undefined ? null : row;
    },
    async all() { return { results: stmt.all(...args) }; },
    async run() { stmt.run(...args); return { success: true }; },
    bind(...more) { return bound(stmt, more); },
  };
}
const db = { prepare(sql) { return bound(raw.prepare(sql), []); } };

for (const person of PEOPLE) {
  raw.prepare(`INSERT INTO users (id, client_id, email, name, role) VALUES (?, 'local-hub', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET role = excluded.role, email = excluded.email, name = excluded.name`)
    .run(person.id, person.email, person.name, person.role);
  const hash = await sha256Hex(person.token);
  raw.prepare(`INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen) VALUES (?, ?, datetime('now'), datetime('now', '+7 day'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET expires_at = excluded.expires_at`)
    .run(hash, person.id);
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };

function send(res, status, body, headers) {
  res.writeHead(status, headers || {});
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/__local/enter') {
    const who = PEOPLE.find((p) => p.role === (url.searchParams.get('role') || 'staff')) || PEOPLE[1];
    res.writeHead(302, {
      location: '/portal/crm.html',
      'set-cookie': `hub_session=${who.token}; Path=/; HttpOnly; SameSite=Lax`,
    });
    res.end();
    return;
  }
  if (url.pathname === '/portal/api/auth/login' && req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    const person = PEOPLE.find((p) => p.email === String(body.email || '').toLowerCase());
    if (!person || body.password !== PASSWORD) {
      send(res, 401, JSON.stringify({ ok: false, error: 'Invalid email or password' }), { 'content-type': 'application/json' });
      return;
    }
    send(res, 200, JSON.stringify({ ok: true }), {
      'content-type': 'application/json',
      'set-cookie': `hub_session=${person.token}; Path=/; HttpOnly; SameSite=Lax`,
    });
    return;
  }
  if (url.pathname === '/portal/api/me' || url.pathname === '/portal/api/board') {
    const request = new Request('http://127.0.0.1/portal/api/crm', { headers: { cookie: req.headers.cookie || '' } });
    const { actorFromRequest } = await import('../functions/portal/_lib/crm/auth.js');
    const actor = await actorFromRequest(db, request);
    if (!actor) {
      send(res, 401, JSON.stringify({ ok: false, error: 'Sign in required' }), { 'content-type': 'application/json' });
      return;
    }
    const user = { name: actor.name, email: actor.email, role: actor.role, client_name: 'TendCo internal', property_mode: 'multifamily' };
    if (url.pathname === '/portal/api/me') {
      send(res, 200, JSON.stringify({ ok: true, user }), { 'content-type': 'application/json' });
      return;
    }
    send(res, 200, JSON.stringify({ ok: true, user, turns: [], units: [], events: [], kpi: {}, photos_bound: false }), { 'content-type': 'application/json' });
    return;
  }
  if (url.pathname.startsWith('/portal/api/crm')) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const request = new Request('http://127.0.0.1' + url.pathname + url.search, {
      method: req.method,
      headers: { cookie: req.headers.cookie || '', 'content-type': 'application/json', 'user-agent': req.headers['user-agent'] || '' },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
    });
    const response = await handleCrm(request, { db });
    const text = await response.text();
    send(res, response.status, text, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return;
  }
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/portal/index.html';
  const file = normalize(join(root, pathname));
  if (!file.startsWith(root) || !existsSync(file) || extname(file) === '') {
    send(res, 404, 'Not found', { 'content-type': 'text/plain' });
    return;
  }
  send(res, 200, readFileSync(file), { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
});

const port = Number(process.env.PORT || 4188);
server.listen(port, '127.0.0.1', () => {
  console.log(`local crm http://127.0.0.1:${port}/__local/enter`);
  console.log(`demo hub http://127.0.0.1:${port}/portal/app.html?demo=1`);
});

/**
 * Local static Hub plus the CRM API.
 * No password and no committed session token.
 * CRM_LOCAL_EPHEMERAL=1 inserts one in-memory owner session and prints
 * a one-time cookie path. That session is not a production Hub login.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { sha256Hex } from '../functions/portal/_lib/crm/auth.js';
import { handleCrm } from '../functions/portal/_lib/crm/http.js';

const root = join(import.meta.dirname, '..', 'public');
const raw = new DatabaseSync(':memory:');
raw.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY, client_id TEXT NOT NULL, email TEXT NOT NULL,
    password_hash TEXT NOT NULL DEFAULT '', password_salt TEXT NOT NULL DEFAULT '',
    password_iter INTEGER NOT NULL DEFAULT 100000, name TEXT NOT NULL, role TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL, last_seen TEXT NOT NULL, ip TEXT, user_agent TEXT
  );
`);
raw.exec(readFileSync(join(import.meta.dirname, '..', 'migrations', '0016_crm_internal.sql'), 'utf8'));
raw.exec(readFileSync(join(import.meta.dirname, '..', 'migrations', '0017_crm_internal_alerts.sql'), 'utf8'));
raw.exec(readFileSync(join(import.meta.dirname, '..', 'migrations', '0018_crm_ar_turn.sql'), 'utf8'));

function bound(stmt, args) {
  return {
    async first() { const row = stmt.get(...args); return row === undefined ? null : row; },
    async all() { return { results: stmt.all(...args) }; },
    async run() { stmt.run(...args); return { success: true }; },
    bind(...more) { return bound(stmt, more); },
  };
}
const db = { prepare(sql) { return bound(raw.prepare(sql), []); } };

let ephemeral = null;
if (process.env.CRM_LOCAL_EPHEMERAL === '1') {
  ephemeral = randomBytes(24).toString('hex');
  const hash = await sha256Hex(ephemeral);
  const doneAt = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
  raw.exec(`CREATE TABLE clients (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE turns (
      id TEXT PRIMARY KEY, client_id TEXT NOT NULL, unit_id TEXT, status TEXT NOT NULL,
      completed_at TEXT, created_at TEXT, updated_at TEXT
    );`);
  raw.prepare(`INSERT INTO clients (id, name) VALUES ('local-hub', 'Local Example')`).run();
  raw.prepare(`INSERT INTO users (id, client_id, email, name, role) VALUES ('local-owner', 'local-hub', 'local-owner@example.test', 'Local Owner', 'owner')`).run();
  raw.prepare(`INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen) VALUES (?, 'local-owner', datetime('now'), datetime('now', '+1 day'), datetime('now'))`).run(hash);
  raw.prepare(`INSERT INTO turns (id, client_id, unit_id, status, completed_at, created_at, updated_at)
    VALUES ('turn-local-example', 'local-hub', 'unit-local', 'complete', ?, ?, ?)`).run(doneAt, doneAt, doneAt);
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };

function send(res, status, body, headers) {
  res.writeHead(status, headers || {});
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/__local/enter') {
    if (!ephemeral) {
      send(res, 404, 'Ephemeral session is off', { 'content-type': 'text/plain' });
      return;
    }
    res.writeHead(302, {
      location: '/portal/crm.html',
      'set-cookie': `__Host-tb_session=${ephemeral}; Path=/; Secure; HttpOnly; SameSite=Lax`,
    });
    res.end();
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
    send(res, response.status, await response.text(), { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
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
  console.log(`hub demo http://127.0.0.1:${port}/portal/app.html?demo=1`);
  if (ephemeral) console.log(`ephemeral crm http://127.0.0.1:${port}/__local/enter`);
});

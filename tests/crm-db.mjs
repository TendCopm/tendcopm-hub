import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { sha256Hex } from '../functions/portal/_lib/crm/auth.js';

export function openCrmDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE users (
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
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT
    );
  `);
  db.exec(readFileSync(new URL('../migrations/0016_crm_internal.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0017_crm_internal_alerts.sql', import.meta.url), 'utf8'));
  return wrap(db);
}

function bound(stmt, args) {
  return {
    async first() {
      const row = stmt.get(...args);
      return row === undefined ? null : row;
    },
    async all() {
      return { results: stmt.all(...args) };
    },
    async run() {
      stmt.run(...args);
      return { success: true };
    },
    bind(...more) {
      return bound(stmt, more);
    },
  };
}

function wrap(db) {
  return {
    prepare(sql) {
      return bound(db.prepare(sql), []);
    },
  };
}

export async function seedUser(db, { id, name, email, role, token }) {
  await db.prepare(
    `INSERT INTO users (id, client_id, email, name, role) VALUES (?, 'hub-client', ?, ?, ?)`
  ).bind(id, email, name, role).run();
  const hash = await sha256Hex(token);
  await db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen) VALUES (?, ?, ?, ?, ?)`
  ).bind(hash, id, '2026-11-01T00:00:00.000Z', '2027-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z').run();
  return token;
}

export function crmRequest(method, path, token, body) {
  return new Request(`https://hub.local${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      cookie: token ? `hub_session=${token}` : '',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleCrm } from '../functions/portal/_lib/crm/http.js';
import { raiseOverdueAlerts } from '../functions/portal/_lib/crm/ar-alert.js';
import { assertInvoiceBeforeClose, loadHubWorkOrders } from '../functions/portal/_lib/crm/hub-ar-contract.js';
import { scheduledArPass } from '../functions/portal/_lib/crm/scheduled.js';
import { sha256Hex } from '../functions/portal/_lib/crm/auth.js';
import { crmRequest, openCrmDb, seedUser, sessionToken } from './crm-db.mjs';
import { d1Like } from './d1-like.mjs';

const NOW = new Date('2026-11-09T15:00:00.000Z');

function alertDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(readFileSync(new URL('../migrations/0017_crm_internal_alerts.sql', import.meta.url), 'utf8'));
  return { raw, db: d1Like(raw) };
}

async function call(db, method, path, token, body, headers) {
  const req = crmRequest(method, path, token, body);
  if (headers) {
    const next = new Request(req, { headers: { ...Object.fromEntries(req.headers), ...headers } });
    const res = await handleCrm(next, { db, now: () => NOW });
    return { status: res.status, json: await res.json() };
  }
  const res = await handleCrm(req, { db, now: () => NOW });
  return { status: res.status, json: await res.json() };
}

test('close gate is a pure rule and the Hub feed is unavailable', async () => {
  assert.throws(() => assertInvoiceBeforeClose(''), /invoice reference/i);
  assert.doesNotThrow(() => assertInvoiceBeforeClose('QB-100'));
  await assert.rejects(loadHubWorkOrders(), (err) => err.code === 'hub_cross_client_reader_not_used');
});

test('bot session contract and negative access', async () => {
  const db = openCrmDb();
  const ownerToken = await seedUser(db, {
    id: 'user-owner', name: 'Avery Owner', email: 'avery@tendcopm.com', role: 'owner', token: sessionToken('owner'),
  });
  const pmToken = await seedUser(db, {
    id: 'user-pm', name: 'Casey PM', email: 'casey@northwind.example', role: 'pm', token: sessionToken('pm'),
  });
  const expiredToken = sessionToken('expired');
  await db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen) VALUES (?, 'user-owner', ?, ?, ?)`
  ).bind(await sha256Hex(expiredToken), '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', '2026-01-01T00:00:00.000Z').run();

  const anon = await call(db, 'GET', '/portal/api/crm/ar', null);
  assert.equal(anon.status, 401);
  assert.equal(anon.json.work_orders, undefined);

  const bearer = await call(db, 'GET', '/portal/api/crm/ar', null, null, { authorization: `Bearer ${ownerToken}`, cookie: '' });
  assert.equal(bearer.status, 200);
  assert.equal(bearer.json.authoritative, false);
  assert.equal(bearer.json.blocked, true);
  assert.equal(bearer.json.code, 'hub_work_order_source_unavailable');
  assert.deepEqual(bearer.json.work_orders, []);
  assert.equal(bearer.json.done_status, 'complete');

  const pm = await call(db, 'GET', '/portal/api/crm/ar', pmToken);
  assert.equal(pm.status, 403);
  assert.equal(JSON.stringify(pm.json).includes('work_orders'), false);

  const expired = await call(db, 'GET', '/portal/api/crm/ar', expiredToken);
  const wrongCookie = await handleCrm(new Request('https://hub.local/portal/api/crm/ar', {
    headers: { cookie: `hub_session=${ownerToken}` },
  }), { db, now: () => NOW });
  assert.equal(wrongCookie.status, 401);
  assert.equal(expired.status, 401);

  const before = await db.prepare(`SELECT COUNT(*) AS n FROM crm_jobs`).first();
  const close = await call(db, 'POST', '/portal/api/crm/ar/close', ownerToken, { invoice_ref: '' });
  assert.equal(close.status, 503);
  assert.equal(close.json.code, 'hub_work_order_source_unavailable');
  const after = await db.prepare(`SELECT COUNT(*) AS n FROM crm_jobs`).first();
  assert.equal(after.n, before.n);
  const alertsAfterGet = await db.prepare(`SELECT COUNT(*) AS n FROM crm_internal_alerts`).first();
  assert.equal(alertsAfterGet.n, 0);

  const grant = await call(db, 'POST', '/portal/api/crm/admin/grant-staff', ownerToken, { user_id: 'user-pm' });
  assert.equal(grant.status, 403);
  const pmRow = await db.prepare(`SELECT role FROM users WHERE id = 'user-pm'`).first();
  assert.equal(pmRow.role, 'pm');
});

test('scheduled pass records one internal blocked alert and does not send', async () => {
  const { raw, db } = alertDb();
  const first = await scheduledArPass(db, NOW);
  const second = await scheduledArPass(db, new Date('2026-11-09T16:00:00.000Z'));
  assert.equal(first.blocked, true);
  assert.equal(second.blocked, true);
  const rows = raw.prepare(`SELECT * FROM crm_internal_alerts`).all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].alert_code, 'ar_feed_blocked');
  assert.equal(rows[0].channel, 'internal');
  assert.equal(rows[0].recipient_role, 'owner');
  const source = readFileSync(new URL('../functions/portal/_lib/crm/ar-alert.js', import.meta.url), 'utf8')
    + readFileSync(new URL('../functions/portal/_lib/crm/scheduled.js', import.meta.url), 'utf8');
  assert.equal(source.includes('fetch('), false);
  assert.equal(/mailto:|messages\.create|send_email|twilio/i.test(source), false);
  assert.match(source, /ON CONFLICT/);
});

test('injected Hub done records alert once, and sent resolves without a new alert', async () => {
  const { raw, db } = alertDb();
  const doneAt = '2026-11-08T12:00:00.000Z';
  const later = new Date('2026-11-09T13:00:00.000Z');
  const orders = [{ id: 'turn-synthetic-1', done_at: doneAt, ar_stage: 'none' }];
  await Promise.all(Array.from({ length: 20 }, () => raiseOverdueAlerts(db, orders, later)));
  assert.equal(raw.prepare(`SELECT COUNT(*) AS n FROM crm_internal_alerts`).get().n, 1);
  const tooSoon = await raiseOverdueAlerts(db, [{ id: 'turn-synthetic-2', done_at: later.toISOString(), ar_stage: 'none' }], later);
  assert.equal(tooSoon.filter((row) => row.work_order_id === 'turn-synthetic-2').length, 0);
  await raiseOverdueAlerts(db, [{ id: 'turn-synthetic-1', done_at: doneAt, ar_stage: 'sent' }], later);
  const row = raw.prepare(`SELECT status, channel FROM crm_internal_alerts WHERE work_order_id = ?`).get('turn-synthetic-1');
  assert.equal(row.status, 'resolved');
  assert.equal(row.channel, 'internal');
  assert.equal(raw.prepare(`SELECT COUNT(*) AS n FROM crm_internal_alerts`).get().n, 1);
});

test('completed Hub turn is the AR record and close does not rewrite the turn', async () => {
  const db = openCrmDb();
  const token = await seedUser(db, {
    id: 'user-owner', name: 'Avery Owner', email: 'avery@tendcopm.com', role: 'owner', token: sessionToken('owner2'),
  });
  await db.prepare(
    `CREATE TABLE turns (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      unit_id TEXT,
      status TEXT NOT NULL,
      notes TEXT,
      scheduled_date TEXT,
      completed_at TEXT,
      created_at TEXT,
      updated_at TEXT
    )`
  ).run();
  const doneAt = '2026-11-08T12:00:00.000Z';
  await db.prepare(
    `INSERT INTO turns (id, client_id, unit_id, status, completed_at, created_at, updated_at)
     VALUES ('turn-local-example', 'hub-client', 'unit-1', 'complete', ?, ?, ?)`
  ).bind(doneAt, doneAt, doneAt).run();
  const listed = await call(db, 'GET', '/portal/api/crm/ar', token);
  assert.equal(listed.json.authoritative, true);
  assert.equal(listed.json.scope, 'session_client');
  assert.equal(listed.json.verified_live, false);
  assert.equal(listed.json.work_orders.length, 1);
  assert.equal(listed.json.work_orders[0].id, 'turn-local-example');
  assert.equal(listed.json.work_orders[0].completed_at, doneAt);
  const blocked = await call(db, 'POST', '/portal/api/crm/ar/turn-local-example/close', token, {});
  assert.equal(blocked.status, 409);
  assert.equal(blocked.json.code, 'invoice_reference_required');
  const closed = await call(db, 'POST', '/portal/api/crm/ar/turn-local-example/close', token, { qb_invoice_ref: 'QB-100' });
  assert.equal(closed.status, 200);
  assert.equal(closed.json.work_order.billing_closed_at != null, true);
  const turn = await db.prepare(`SELECT status, completed_at FROM turns WHERE id = 'turn-local-example'`).first();
  assert.equal(turn.status, 'complete');
  assert.equal(turn.completed_at, doneAt);
  const alerts = await db.prepare(`SELECT COUNT(*) AS n FROM crm_internal_alerts`).first();
  assert.equal(alerts.n, 0);
  const scheduled = await scheduledArPass(db, new Date('2026-11-09T15:00:00.000Z'));
  assert.equal(scheduled.blocked, true);
});

test('D1-style batch rolls back and keeps a failed write from sticking', async () => {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`CREATE TABLE sample (id TEXT PRIMARY KEY, n INTEGER)`);
  const db = d1Like(raw);
  await assert.rejects(db.batch([
    { sql: `INSERT INTO sample (id, n) VALUES ('a', 1)`, args: [] },
    { sql: `INSERT INTO sample (id, n) VALUES ('a', 2)`, args: [] },
  ]));
  assert.equal(raw.prepare(`SELECT COUNT(*) AS n FROM sample`).get().n, 0);
  await db.batch([{ sql: `INSERT INTO sample (id, n) VALUES ('b', 1)`, args: [] }]);
  assert.equal(raw.prepare(`SELECT n FROM sample WHERE id = 'b'`).get().n, 1);
});

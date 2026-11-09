import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleCrm } from '../functions/portal/_lib/crm/http.js';
import { raiseOverdueAlerts } from '../functions/portal/_lib/crm/ar-alert.js';
import { assertInvoiceBeforeClose, loadHubWorkOrders } from '../functions/portal/_lib/crm/hub-ar-contract.js';
import { scheduledArPass } from '../functions/portal/_lib/crm/scheduled.js';
import { sha256Hex } from '../functions/portal/_lib/crm/auth.js';
import { crmRequest, openCrmDb, seedUser } from './crm-db.mjs';
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
  await assert.rejects(loadHubWorkOrders(), (err) => err.code === 'hub_work_order_source_unavailable');
});

test('bot session contract and negative access', async () => {
  const db = openCrmDb();
  const ownerToken = await seedUser(db, {
    id: 'user-owner', name: 'Avery Owner', email: 'avery@tendcopm.com', role: 'owner', token: 'owner-token-synthetic-0001',
  });
  const pmToken = await seedUser(db, {
    id: 'user-pm', name: 'Casey PM', email: 'casey@northwind.example', role: 'pm', token: 'pm-token-synthetic-0000001',
  });
  await db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen) VALUES (?, 'user-owner', ?, ?, ?)`
  ).bind(await sha256Hex('expired-token-synthetic-0001'), '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', '2026-01-01T00:00:00.000Z').run();

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

  const expired = await call(db, 'GET', '/portal/api/crm/ar', 'expired-token-synthetic-0001');
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

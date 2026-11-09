/**
 * Internal overdue alerts for the Hub owner role.
 * One INSERT ... ON CONFLICT per work order. No read-then-insert.
 * Channel is always internal. This module does not send email or text.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SENT = new Set(['sent', 'check_received', 'deposited']);

const INSERT_OVERDUE = `INSERT INTO crm_internal_alerts
  (id, alert_code, work_order_id, done_at, status, created_at, recipient_role, channel)
  VALUES (?, 'ar_done_to_sent_overdue', ?, ?, 'open', ?, 'owner', 'internal')
  ON CONFLICT (alert_code, work_order_id, done_at) DO NOTHING`;

const INSERT_BLOCKED = `INSERT INTO crm_internal_alerts
  (id, alert_code, work_order_id, done_at, status, created_at, recipient_role, channel)
  VALUES (?, 'ar_feed_blocked', 'source:hub-turns', '', 'open', ?, 'owner', 'internal')
  ON CONFLICT (alert_code, work_order_id, done_at) DO NOTHING`;

function rowsOf(result) {
  if (!result) return [];
  return result.results || result;
}

export async function listInternalAlerts(db) {
  const rows = await db.prepare(
    `SELECT id, alert_code, work_order_id, done_at, status, created_at, recipient_role, channel
       FROM crm_internal_alerts
      WHERE channel = 'internal'
      ORDER BY created_at`
  ).all();
  return rowsOf(rows);
}

export async function raiseFeedBlocked(db, now) {
  await db.prepare(INSERT_BLOCKED).bind(crypto.randomUUID(), now.toISOString()).run();
  const open = (await listInternalAlerts(db)).filter((row) => row.alert_code === 'ar_feed_blocked' && row.status === 'open');
  return { code: 'ar_feed_blocked', open: open.length };
}

/**
 * workOrders: { id, done_at, ar_stage } from a verified Hub source.
 * Sent stages resolve an existing alert. They do not create one.
 */
export async function raiseOverdueAlerts(db, workOrders, now) {
  const at = now.toISOString();
  for (const order of workOrders || []) {
    if (!order || !order.id || !order.done_at) continue;
    if (SENT.has(order.ar_stage)) {
      await db.prepare(
        `UPDATE crm_internal_alerts
            SET status = 'resolved'
          WHERE alert_code = 'ar_done_to_sent_overdue'
            AND work_order_id = ?
            AND done_at = ?
            AND status = 'open'
            AND channel = 'internal'`
      ).bind(order.id, order.done_at).run();
      continue;
    }
    const done = Date.parse(order.done_at);
    if (!Number.isFinite(done) || now.getTime() - done <= DAY_MS) continue;
    await db.prepare(INSERT_OVERDUE).bind(crypto.randomUUID(), order.id, order.done_at, at).run();
  }
  return listInternalAlerts(db);
}

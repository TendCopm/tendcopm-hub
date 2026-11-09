import { assertInvoiceBeforeClose } from './hub-ar-contract.js';
import { listCompletedTurnsForClient, readTurnForClient } from './hub-turns.js';
import { fail } from './store.js';

const STAGES = ['none', 'created', 'sent', 'check_received', 'deposited'];

function rowsOf(result) {
  if (!result) return [];
  return result.results || result;
}

async function loadArMap(db, ids) {
  const map = new Map();
  if (!ids.length) return map;
  const placeholders = ids.map(() => '?').join(',');
  try {
    const rows = await db.prepare(
      `SELECT turn_id, qb_invoice_ref, ar_stage, ar_sent_at, billing_closed_at
         FROM crm_ar WHERE turn_id IN (${placeholders})`
    ).bind(...ids).all();
    for (const row of rowsOf(rows)) map.set(row.turn_id, row);
  } catch (err) {
    if (!/no such table/i.test(String(err && err.message || ''))) throw err;
  }
  return map;
}

export function presentWorkOrder(turn, ar) {
  const stage = ar && ar.ar_stage ? ar.ar_stage : 'none';
  return {
    id: turn.id,
    status: turn.status,
    completed_at: turn.completed_at,
    ar_stage: stage,
    qb_invoice_ref: ar && ar.qb_invoice_ref ? ar.qb_invoice_ref : '',
    billing_closed_at: ar ? ar.billing_closed_at : null,
    ar_authoritative: true,
  };
}

export async function workOrdersForActor(db, actor) {
  const turns = await listCompletedTurnsForClient(db, actor.client_id);
  const ar = await loadArMap(db, turns.map((turn) => turn.id));
  return turns.map((turn) => presentWorkOrder(turn, ar.get(turn.id)));
}

async function requireDoneTurn(db, actor, turnId) {
  const turn = await readTurnForClient(db, turnId, actor.client_id);
  if (!turn) throw fail(404, 'Hub turn not found for this session client');
  if (turn.status !== 'complete' || !turn.completed_at) {
    throw fail(409, 'The Hub turn is not Done. completed_at is set only when status is complete.');
  }
  return turn;
}

async function existingAr(db, turnId) {
  try {
    return await db.prepare(`SELECT * FROM crm_ar WHERE turn_id = ?`).bind(turnId).first();
  } catch (err) {
    if (/no such table/i.test(String(err && err.message || ''))) {
      throw fail(503, 'AR storage is not initialized', 'crm_ar_not_initialized');
    }
    throw err;
  }
}

export async function saveArStage(db, actor, now, turnId, body) {
  const turn = await requireDoneTurn(db, actor, turnId);
  const current = await existingAr(db, turnId);
  const stage = current ? current.ar_stage : 'none';
  const next = body.ar_stage;
  const idx = STAGES.indexOf(stage);
  if (next !== STAGES[idx + 1]) throw fail(400, 'AR stage moves one step at a time');
  let qb = current ? current.qb_invoice_ref : '';
  const stamps = {
    ar_created_at: current ? current.ar_created_at : null,
    ar_sent_at: current ? current.ar_sent_at : null,
    ar_check_at: current ? current.ar_check_at : null,
    ar_deposited_at: current ? current.ar_deposited_at : null,
  };
  const at = now.toISOString();
  if (next === 'created') {
    qb = String(body.qb_invoice_ref || qb || '').trim();
    if (!qb) throw fail(400, 'QuickBooks invoice number is required when the invoice is created');
    stamps.ar_created_at = at;
  } else if (body.qb_invoice_ref != null) qb = String(body.qb_invoice_ref).trim();
  if (next === 'sent') stamps.ar_sent_at = at;
  if (next === 'check_received') stamps.ar_check_at = at;
  if (next === 'deposited') stamps.ar_deposited_at = at;
  await db.prepare(
    `INSERT INTO crm_ar (turn_id, qb_invoice_ref, ar_stage, ar_created_at, ar_sent_at, ar_check_at, ar_deposited_at, billing_closed_at, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(turn_id) DO UPDATE SET
       qb_invoice_ref = excluded.qb_invoice_ref,
       ar_stage = excluded.ar_stage,
       ar_created_at = excluded.ar_created_at,
       ar_sent_at = excluded.ar_sent_at,
       ar_check_at = excluded.ar_check_at,
       ar_deposited_at = excluded.ar_deposited_at,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`
  ).bind(turn.id, qb, next, stamps.ar_created_at, stamps.ar_sent_at, stamps.ar_check_at, stamps.ar_deposited_at, current ? current.billing_closed_at : null, at, actor.id).run();
  return presentWorkOrder(turn, { ...stamps, ar_stage: next, qb_invoice_ref: qb, billing_closed_at: current ? current.billing_closed_at : null });
}

export async function closeArForTurn(db, actor, now, turnId, body) {
  const turn = await requireDoneTurn(db, actor, turnId);
  const current = await existingAr(db, turnId);
  const qb = String((body && body.qb_invoice_ref) || (current && current.qb_invoice_ref) || '').trim();
  assertInvoiceBeforeClose(qb);
  const at = now.toISOString();
  await db.prepare(
    `INSERT INTO crm_ar (turn_id, qb_invoice_ref, ar_stage, ar_created_at, ar_sent_at, ar_check_at, ar_deposited_at, billing_closed_at, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(turn_id) DO UPDATE SET
       qb_invoice_ref = excluded.qb_invoice_ref,
       billing_closed_at = excluded.billing_closed_at,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`
  ).bind(
    turn.id,
    qb,
    current ? current.ar_stage : 'none',
    current ? current.ar_created_at : null,
    current ? current.ar_sent_at : null,
    current ? current.ar_check_at : null,
    current ? current.ar_deposited_at : null,
    at,
    at,
    actor.id,
  ).run();
  return presentWorkOrder(turn, {
    ar_stage: current ? current.ar_stage : 'none',
    qb_invoice_ref: qb,
    billing_closed_at: at,
  });
}

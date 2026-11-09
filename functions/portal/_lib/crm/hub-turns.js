/**
 * Turn read contract copied from historical Pages source.
 * Provenance: tendcopm-pages-deploy commit 2319029bec170de8f8ae0708430d0a6e67c32bfb
 * branch prod-nav-tendyhub. Not verified as the current live deployment.
 * migrations/ and SCHEMA.md were not tracked at that commit.
 *
 * Evidence used, and nothing past it:
 * - lib/api.js PATCH /turns/:id sets turns.status and, on first transition to
 *   'complete', sets completed_at. Leaving 'complete' clears completed_at.
 * - The same file's session reader is client-scoped (requireUser + client_id).
 * - The only cross-client turn list is GET /admin/turns behind X-Admin-Key.
 *   This module does not read ADMIN_KEY and does not call that route.
 * - lib/api.js also emails on complete (Resend or FormSubmit). This module
 *   does not import that function and does not update turns.
 */

export const TURN_WRITER_COMMIT = '2319029bec170de8f8ae0708430d0a6e67c32bfb';
export const HUB_DONE_STATUS = 'complete';

export class HubWorkOrderSourceUnavailable extends Error {
  constructor(message) {
    super(message || 'Hub turns table is not readable with the historical writer columns.');
    this.name = 'HubWorkOrderSourceUnavailable';
    this.status = 503;
    this.code = 'hub_work_order_source_unavailable';
  }
}

export class HubCrossClientUnavailable extends Error {
  constructor() {
    super('Cross-client Done turns are only listed behind X-Admin-Key in the historical writer. CRM does not use that key.');
    this.name = 'HubCrossClientUnavailable';
    this.status = 503;
    this.code = 'hub_cross_client_reader_not_used';
  }
}

function missingRelation(err) {
  return /no such (table|column)/i.test(String(err && err.message || ''));
}

function rowsOf(result) {
  if (!result) return [];
  return result.results || result;
}

/** Same client scope as requireUser in the historical writer. */
export async function listCompletedTurnsForClient(db, clientId) {
  if (!clientId) throw new HubWorkOrderSourceUnavailable('Session has no Hub client.');
  try {
    const rows = await db.prepare(
      `SELECT id, status, completed_at, client_id
         FROM turns
        WHERE client_id = ? AND status = ? AND completed_at IS NOT NULL`
    ).bind(clientId, HUB_DONE_STATUS).all();
    return rowsOf(rows).map((row) => ({
      id: row.id,
      status: row.status,
      completed_at: row.completed_at,
      client_id: row.client_id,
    }));
  } catch (err) {
    if (missingRelation(err)) throw new HubWorkOrderSourceUnavailable();
    throw err;
  }
}

export async function readTurnForClient(db, turnId, clientId) {
  if (!clientId) throw new HubWorkOrderSourceUnavailable('Session has no Hub client.');
  try {
    return await db.prepare(
      `SELECT id, status, completed_at, client_id FROM turns WHERE id = ? AND client_id = ?`
    ).bind(turnId, clientId).first();
  } catch (err) {
    if (missingRelation(err)) throw new HubWorkOrderSourceUnavailable();
    throw err;
  }
}

/** Schedule has no session client. The historical cross-client reader needs a key we do not use. */
export async function loadHubWorkOrders() {
  throw new HubCrossClientUnavailable();
}

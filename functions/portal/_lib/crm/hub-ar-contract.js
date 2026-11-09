/**
 * Contract for accounts receivable on Hub work orders.
 *
 * Observed in public/portal/assets/app.js (the client). The server that
 * stores the turn is not in this repository, and the turns table SQL is
 * not in git. This module does not query or update `turns`.
 *
 * Identity: the id in PATCH /portal/api/turns/:id.
 * Field Done, as the client sends it: JSON body { status: "complete" }.
 * The client label for that status is "Tended". The client does not send
 * completed_at on the real (non-demo) complete request. Whatever column
 * the missing server uses for the Done clock is unknown here.
 *
 * Close gate: a Hub work order must not be closed for billing without a
 * manual QuickBooks invoice reference. The missing turn writer has to call
 * assertInvoiceBeforeClose. This repo does not patch turns.
 */

export const HUB_WORK_ORDER_ROUTE = '/portal/api/turns/:id';
export { HUB_DONE_STATUS, TURN_WRITER_COMMIT, loadHubWorkOrders } from './hub-turns.js';

export function invoiceReferencePresent(invoiceRef) {
  return String(invoiceRef || '').trim().length > 0;
}

export function assertInvoiceBeforeClose(invoiceRef) {
  if (!invoiceReferencePresent(invoiceRef)) {
    const err = new Error('An invoice reference is required before closing the Hub work order.');
    err.status = 409;
    err.code = 'invoice_reference_required';
    throw err;
  }
}

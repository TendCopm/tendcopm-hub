import { raiseFeedBlocked, raiseOverdueAlerts } from './ar-alert.js';
import { loadHubWorkOrders } from './hub-ar-contract.js';

/**
 * Entry for a Cloudflare Worker scheduled event. Not registered in
 * wrangler.toml. Do not deploy or enable the cron until the Hub turn
 * writer is in this repo. Running it today only records one internal
 * "feed blocked" alert. It does not email or text.
 *
 * Binding when that source exists:
 *   wrangler worker, D1 binding TURN_DB = tendco-turn-board-db
 *   cron "17 * * * *" (hourly, not on the hour)
 *   handler: scheduled(event, env, ctx) { ctx.waitUntil(scheduledArPass(env.TURN_DB, new Date(event.scheduledTime))) }
 */
export async function scheduledArPass(db, now = new Date(), source = loadHubWorkOrders) {
  try {
    const orders = await source(db);
    const alerts = await raiseOverdueAlerts(db, orders, now);
    return { blocked: false, alerts };
  } catch (err) {
    if (err && (err.code === 'hub_work_order_source_unavailable' || err.code === 'hub_cross_client_reader_not_used')) {
      const blocked = await raiseFeedBlocked(db, now);
      return { blocked: true, ...blocked };
    }
    throw err;
  }
}

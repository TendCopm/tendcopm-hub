import { hubDatabase } from '../../../_lib/crm/auth.js';
import { handleCrm } from '../../../_lib/crm/http.js';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function onRequest(context) {
  const db = hubDatabase(context.env);
  if (!db) return json(503, { ok: false, error: 'CRM storage is not configured' });
  return handleCrm(context.request, { db });
}

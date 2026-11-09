import { listInternalAlerts } from './ar-alert.js';
import { actorFromRequest, isInternalActor } from './auth.js';
import { loadHubWorkOrders } from './hub-ar-contract.js';
import {
  addContact,
  addFollowup,
  addNote,
  completeFollowup,
  createClient,
  createDraft,
  createJob,
  createSite,
  decideJobType,
  getClient,
  getJob,
  getSite,
  listActivity,
  listClients,
  listDrafts,
  listFollowups,
  listJobTypes,
  listJobs,
  listNotes,
  mapPins,
  proposeJobType,
  restoreClient,
  restoreJob,
  restoreSite,
  searchRecords,
  setHighWater,
  transferSite,
  updateClient,
  updateJob,
  updateSite,
} from './store.js';

function json(status, body, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...(extraHeaders || {}),
    },
  });
}

async function readBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return {};
  const text = await request.text();
  if (!text) return {};
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('bad');
    return body;
  } catch {
    const err = new Error('Expected a JSON object');
    err.status = 400;
    throw err;
  }
}

function deny(status, error, code) {
  const body = { ok: false, error };
  if (code) body.code = code;
  return json(status, body);
}

export async function handleCrm(request, deps) {
  try {
    return await routeCrm(request, deps);
  } catch (err) {
    const message = err && err.message ? err.message : '';
    if (err && err.status) return deny(err.status, message, err.code);
    if (/no such table/i.test(message)) return deny(503, 'CRM storage is not initialized');
    return deny(500, 'CRM request failed');
  }
}

async function routeCrm(request, deps) {
  const db = deps.db;
  const now = deps.now ? deps.now() : new Date();
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const prefix = '/portal/api/crm';
  if (path !== prefix && !path.startsWith(prefix + '/')) return deny(404, 'Not found');

  const actor = await actorFromRequest(db, request, now);
  if (!actor) return deny(401, 'Sign in required');
  if (!isInternalActor(actor)) return deny(403, 'TendCo staff only');

  const rest = path.slice(prefix.length).replace(/^\//, '');
  const parts = rest ? rest.split('/') : [];
  const method = request.method.toUpperCase();
  const body = await readBody(request);
  const ua = request.headers.get('user-agent') || '';
  const q = url.searchParams;

  if (method === 'GET' && parts.length === 0) {
    return json(200, { ok: true, user: { id: actor.id, name: actor.name, role: actor.role } });
  }
  if (parts[0] === 'search' && method === 'GET') {
    return json(200, { ok: true, results: await searchRecords(db, q.get('q') || '') });
  }
  if (parts[0] === 'clients' && parts.length === 1 && method === 'GET') {
    return json(200, { ok: true, clients: await listClients(db) });
  }
  if (parts[0] === 'clients' && parts.length === 1 && method === 'POST') {
    return json(201, { ok: true, client: await createClient(db, actor, now, body) });
  }
  if (parts[0] === 'clients' && parts.length === 2 && method === 'GET') {
    return json(200, { ok: true, client: await getClient(db, parts[1]) });
  }
  if (parts[0] === 'clients' && parts.length === 2 && method === 'PATCH') {
    return json(200, { ok: true, client: await updateClient(db, actor, now, parts[1], body) });
  }
  if (parts[0] === 'clients' && parts[2] === 'restore' && method === 'POST') {
    return json(200, { ok: true, client: await restoreClient(db, actor, now, parts[1]) });
  }
  if (parts[0] === 'clients' && parts[2] === 'contacts' && method === 'POST') {
    return json(201, { ok: true, contact: await addContact(db, actor, now, parts[1], body) });
  }
  if (parts[0] === 'clients' && parts[2] === 'sites' && method === 'POST') {
    return json(201, { ok: true, site: await createSite(db, actor, now, parts[1], body, ua) });
  }
  if (parts[0] === 'sites' && parts.length === 2 && method === 'GET') {
    return json(200, { ok: true, site: await getSite(db, parts[1], ua) });
  }
  if (parts[0] === 'sites' && parts.length === 2 && method === 'PATCH') {
    return json(200, { ok: true, site: await updateSite(db, actor, now, parts[1], body, ua) });
  }
  if (parts[0] === 'sites' && parts[2] === 'restore' && method === 'POST') {
    return json(200, { ok: true, site: await restoreSite(db, actor, now, parts[1], ua) });
  }
  if (parts[0] === 'sites' && parts[2] === 'transfer' && method === 'POST') {
    return json(200, { ok: true, site: await transferSite(db, actor, now, parts[1], body, ua) });
  }
  if (parts[0] === 'sites' && parts[2] === 'history' && method === 'GET') {
    const site = await getSite(db, parts[1], ua);
    return json(200, { ok: true, public_id: site.public_id, transfers: site.transfers });
  }
  if (parts[0] === 'jobs' && parts.length === 1 && method === 'GET') {
    return json(200, { ok: true, jobs: await listJobs(db, now, {
      industry: q.get('industry') || '',
      category: q.get('category') || '',
      job_type_id: q.get('job_type') || '',
      from: q.get('from') || '',
      to: q.get('to') || '',
      approved_only: q.get('approved') === '1',
    }) });
  }
  if (parts[0] === 'jobs' && parts.length === 1 && method === 'POST') {
    return json(201, { ok: true, job: await createJob(db, actor, now, body) });
  }
  if (parts[0] === 'jobs' && parts.length === 2 && method === 'GET') {
    return json(200, { ok: true, job: await getJob(db, parts[1], now) });
  }
  if (parts[0] === 'jobs' && parts.length === 2 && method === 'PATCH') {
    return json(200, { ok: true, job: await updateJob(db, actor, now, parts[1], body) });
  }
  if (parts[0] === 'jobs' && parts[2] === 'restore' && method === 'POST') {
    return json(200, { ok: true, job: await restoreJob(db, actor, now, parts[1]) });
  }
  if (parts[0] === 'job-types' && parts.length === 1 && method === 'GET') {
    return json(200, { ok: true, job_types: await listJobTypes(db, q.get('all') === '1') });
  }
  if (parts[0] === 'job-types' && parts.length === 1 && method === 'POST') {
    return json(201, { ok: true, job_type: await proposeJobType(db, actor, now, body) });
  }
  if (parts[0] === 'job-types' && parts[2] === 'decision' && method === 'POST') {
    return json(200, { ok: true, job_type: await decideJobType(db, actor, now, parts[1], body) });
  }
  if (parts[0] === 'notes' && method === 'GET') {
    return json(200, { ok: true, notes: await listNotes(db, q.get('entity_type'), q.get('entity_id')) });
  }
  if (parts[0] === 'notes' && method === 'POST') {
    return json(201, { ok: true, note: await addNote(db, actor, now, body) });
  }
  if (parts[0] === 'followups' && parts.length === 1 && method === 'GET') {
    return json(200, { ok: true, followups: await listFollowups(db, q.get('status') || '') });
  }
  if (parts[0] === 'followups' && parts.length === 1 && method === 'POST') {
    return json(201, { ok: true, followup: await addFollowup(db, actor, now, body) });
  }
  if (parts[0] === 'followups' && parts[2] === 'done' && method === 'POST') {
    return json(200, { ok: true, followup: await completeFollowup(db, actor, now, parts[1]) });
  }
  if (parts[0] === 'activity' && method === 'GET') {
    return json(200, { ok: true, activity: await listActivity(db, q.get('entity_type'), q.get('entity_id')) });
  }
  if (parts[0] === 'ar' && method === 'GET' && (parts.length === 1 || parts[1] === 'summary')) {
    let alerts = [];
    try {
      alerts = await listInternalAlerts(db);
    } catch (err) {
      if (!/no such table/i.test(err && err.message || '')) throw err;
    }
    return json(200, {
      ok: true,
      authoritative: false,
      blocked: true,
      code: 'hub_work_order_source_unavailable',
      route: '/portal/api/turns/:id',
      done_status: 'complete',
      work_orders: [],
      alerts,
    });
  }
  if (parts[0] === 'ar' && parts[1] === 'close' && method === 'POST') {
    await loadHubWorkOrders();
    return deny(500, 'CRM request failed');
  }
  if (parts[0] === 'schedule' && method === 'GET') {
    return json(200, { ok: true, jobs: await listJobs(db, now, {
      industry: q.get('industry') || '',
      category: q.get('category') || '',
      job_type_id: q.get('job_type') || '',
      from: q.get('from') || '',
      to: q.get('to') || '',
      approved_only: true,
    }) });
  }
  if (parts[0] === 'map' && method === 'GET') {
    return json(200, { ok: true, ...(await mapPins(db)) });
  }
  if (parts[0] === 'drafts' && method === 'GET') {
    return json(200, { ok: true, drafts: await listDrafts(db) });
  }
  if (parts[0] === 'drafts' && method === 'POST' && parts.length === 1) {
    return json(201, { ok: true, draft: await createDraft(db, actor, now, body) });
  }
  if (parts[0] === 'admin' && parts[1] === 'high-water' && method === 'POST') {
    return json(200, { ok: true, counters: await setHighWater(db, actor, now, body) });
  }
  if (parts[0] === 'admin' && parts[1] === 'grant-staff') {
    return deny(403, 'CRM does not grant Hub access. Use an existing internal session.', 'session_required');
  }
  if (parts[0] === 'drafts' && parts[2] === 'send') {
    return deny(405, 'Drafts are not sent from the CRM');
  }
  return deny(404, 'Not found');
}

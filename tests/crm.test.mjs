import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { handleCrm } from '../functions/portal/_lib/crm/http.js';
import { directionsUrl } from '../functions/portal/_lib/crm/constants.js';
import { crmRequest, openCrmDb, seedUser } from './crm-db.mjs';

const NOW = new Date('2026-11-09T15:00:00.000Z');

async function world() {
  const db = openCrmDb();
  const owner = await seedUser(db, {
    id: 'user-owner', name: 'Avery Owner', email: 'avery@tendcopm.com', role: 'owner', token: 'owner-token-synthetic-0001',
  });
  const staff = await seedUser(db, {
    id: 'user-staff', name: 'Blair Staff', email: 'blair@tendcopm.com', role: 'staff', token: 'staff-token-synthetic-0001',
  });
  const pm = await seedUser(db, {
    id: 'user-pm', name: 'Casey PM', email: 'casey@northwind.example', role: 'pm', token: 'pm-token-synthetic-0000001',
  });
  const tech = await seedUser(db, {
    id: 'user-tech', name: 'Devon Tech', email: 'devon@northwind.example', role: 'tech', token: 'tech-token-synthetic-000001',
  });
  const vendor = await seedUser(db, {
    id: 'user-vendor', name: 'Eden Vendor', email: 'eden@vendor.example', role: 'vendor', token: 'vendor-token-synthetic-001',
  });
  const supervisor = await seedUser(db, {
    id: 'user-sup', name: 'Fran Supervisor', email: 'fran@northwind.example', role: 'maintenance_supervisor', token: 'supervisor-token-synthetic1',
  });
  return { db, owner, staff, pm, tech, vendor, supervisor };
}

async function call(db, method, path, token, body, now = NOW) {
  const res = await handleCrm(crmRequest(method, path, token, body), { db, now: () => now });
  const json = await res.json();
  return { status: res.status, json };
}

test('unauthenticated and client roles get no CRM records', async () => {
  const { db, owner, pm, tech, vendor, supervisor } = await world();
  const created = await call(db, 'POST', '/portal/api/crm/clients', owner, {
    name: 'Northwind Property Group', industry: 'Property management',
  });
  assert.equal(created.status, 201);
  const secret = created.json.client.public_id;
  for (const [token, status] of [[null, 401], [pm, 403], [tech, 403], [vendor, 403], [supervisor, 403]]) {
    const res = await call(db, 'GET', '/portal/api/crm/clients', token);
    assert.equal(res.status, status);
    assert.equal(res.json.ok, false);
    assert.equal(JSON.stringify(res.json).includes(secret), false);
    assert.equal(JSON.stringify(res.json).includes('Northwind'), false);
    const direct = await call(db, 'GET', `/portal/api/crm/clients/${created.json.client.id}`, token);
    assert.equal(direct.status, status);
    assert.equal(JSON.stringify(direct.json).includes(secret), false);
  }
  const anonJob = await call(db, 'GET', '/portal/api/crm/jobs', null);
  assert.deepEqual(anonJob.json, { ok: false, error: 'Sign in required' });
});

test('create, edit, save, and reload keep the same record', async () => {
  const { db, staff } = await world();
  const created = await call(db, 'POST', '/portal/api/crm/clients', staff, {
    name: 'Harbor Example Management',
    industry: 'Property management',
    management_address: '10 Example St, Maitland, FL',
    management_phone: '407-555-0100',
    owner_names: 'Riley Chen',
  });
  assert.equal(created.json.client.public_id, 'CL-0001');
  const id = created.json.client.id;
  const edited = await call(db, 'PATCH', `/portal/api/crm/clients/${id}`, staff, {
    name: 'Harbor Example Management LLC',
    fee_note: 'Per visit',
  });
  assert.equal(edited.status, 200);
  const reloaded = await call(db, 'GET', `/portal/api/crm/clients/${id}`, staff);
  assert.equal(reloaded.json.client.name, 'Harbor Example Management LLC');
  assert.equal(reloaded.json.client.public_id, 'CL-0001');
  assert.equal(reloaded.json.client.fee_note, 'Per visit');
  assert.equal(reloaded.json.client.management_phone, '407-555-0100');
});

test('concurrent creates never reuse client, site, or job numbers', async () => {
  const { db, owner } = await world();
  const created = await Promise.all(Array.from({ length: 12 }, (_, i) => call(db, 'POST', '/portal/api/crm/clients', owner, {
    name: `Example Client ${i}`,
    industry: 'Multifamily',
  })));
  const ids = created.map((res) => res.json.client.public_id);
  assert.equal(new Set(ids).size, 12);
  assert.deepEqual(ids.slice().sort(), Array.from({ length: 12 }, (_, i) => `CL-${String(i + 1).padStart(4, '0')}`));

  const client = created[0].json.client;
  const sites = await Promise.all(Array.from({ length: 5 }, (_, i) => call(db, 'POST', `/portal/api/crm/clients/${client.id}/sites`, owner, {
    name: `Example Court ${i}`,
    address_line: `${100 + i} Example Ave`,
    city: 'Maitland',
    region: 'FL',
    postal: '32751',
    email: `office${i}@example.test`,
    contact: { name: `Pat Example ${i}`, email: `pat${i}@example.test` },
  })));
  const siteIds = sites.map((res) => res.json.site.public_id);
  assert.deepEqual(siteIds.slice().sort(), ['ST-1-001', 'ST-1-002', 'ST-1-003', 'ST-1-004', 'ST-1-005']);

  const jobs = await Promise.all(siteIds.slice(0, 4).map((publicId, i) => {
    const site = sites.find((res) => res.json.site.public_id === publicId).json.site;
    return call(db, 'POST', '/portal/api/crm/jobs', owner, {
      site_id: site.id,
      category: 'Make ready',
      job_type_id: 'jt-painting',
      title: `Paint ${i}`,
    });
  }));
  assert.deepEqual(jobs.map((res) => res.json.job.public_id).sort(), ['TC-000001', 'TC-000002', 'TC-000003', 'TC-000004']);
});

test('archive and restore do not free numbers', async () => {
  const { db, staff } = await world();
  const first = await call(db, 'POST', '/portal/api/crm/clients', staff, { name: 'First Example', industry: 'Commercial' });
  await call(db, 'PATCH', `/portal/api/crm/clients/${first.json.client.id}`, staff, { deleted: true });
  const second = await call(db, 'POST', '/portal/api/crm/clients', staff, { name: 'Second Example', industry: 'Commercial' });
  assert.equal(first.json.client.public_id, 'CL-0001');
  assert.equal(second.json.client.public_id, 'CL-0002');
  const restored = await call(db, 'POST', `/portal/api/crm/clients/${first.json.client.id}/restore`, staff, {});
  assert.equal(restored.json.client.public_id, 'CL-0001');
  assert.equal(restored.json.client.deleted_at, null);
  const third = await call(db, 'POST', '/portal/api/crm/clients', staff, { name: 'Third Example', industry: 'Commercial' });
  assert.equal(third.json.client.public_id, 'CL-0003');
});

test('site transfer keeps the original number and destination counter', async () => {
  const { db, owner } = await world();
  const a = await call(db, 'POST', '/portal/api/crm/clients', owner, { name: 'Alpha Example', industry: 'Property management' });
  const b = await call(db, 'POST', '/portal/api/crm/clients', owner, { name: 'Bravo Example', industry: 'Property management' });
  const site = await call(db, 'POST', `/portal/api/crm/clients/${a.json.client.id}/sites`, owner, siteBody('Cedar Court'));
  const bravoSite = await call(db, 'POST', `/portal/api/crm/clients/${b.json.client.id}/sites`, owner, siteBody('Bravo House'));
  assert.equal(site.json.site.public_id, 'ST-1-001');
  assert.equal(bravoSite.json.site.public_id, 'ST-2-001');
  const moved = await call(db, 'POST', `/portal/api/crm/sites/${site.json.site.id}/transfer`, owner, {
    to_client_id: b.json.client.id,
    transfer_type: 'management',
    notice_days: 30,
    who_pays: 'new',
    note: 'Management change',
  });
  assert.equal(moved.status, 200);
  assert.equal(moved.json.site.public_id, 'ST-1-001');
  assert.equal(moved.json.site.client_id, b.json.client.id);
  assert.equal(moved.json.site.origin_client_seq, 1);
  const again = await call(db, 'POST', `/portal/api/crm/clients/${b.json.client.id}/sites`, owner, siteBody('Next Bravo'));
  assert.equal(again.json.site.public_id, 'ST-2-002');
  const history = await call(db, 'GET', `/portal/api/crm/sites/${site.json.site.id}/history`, owner);
  assert.equal(history.json.transfers.length, 1);
  assert.equal(history.json.transfers[0].from_public_id, 'CL-0001');
  assert.equal(history.json.transfers[0].to_public_id, 'CL-0002');
  const sale = await call(db, 'POST', `/portal/api/crm/sites/${bravoSite.json.site.id}/transfer`, owner, {
    to_client_id: a.json.client.id, transfer_type: 'sale', notice_days: 60, who_pays: 'previous', sale_balance_cents: 2500,
  });
  assert.equal(sale.status, 400);
  assert.match(sale.json.error, /\$0/);
});

test('follow-ups and activity record the actor', async () => {
  const { db, staff, owner } = await world();
  const client = await call(db, 'POST', '/portal/api/crm/clients', staff, {
    name: 'Follow Example', industry: 'Single-family',
  });
  const follow = await call(db, 'POST', '/portal/api/crm/followups', staff, {
    entity_type: 'client',
    entity_id: client.json.client.id,
    due_on: '2026-11-12',
    note: 'Call the office about the sample agreement',
    owner_user_id: owner === staff ? undefined : 'user-owner',
  });
  assert.equal(follow.status, 201);
  assert.equal(follow.json.followup.owner_name, 'Avery Owner');
  assert.equal(follow.json.followup.status, 'open');
  const note = await call(db, 'POST', '/portal/api/crm/notes', staff, {
    entity_type: 'client', entity_id: client.json.client.id, body: 'Sample note only',
  });
  assert.equal(note.status, 201);
  const done = await call(db, 'POST', `/portal/api/crm/followups/${follow.json.followup.id}/done`, owner, {});
  assert.equal(done.json.followup.status, 'done');
  const activity = await call(db, 'GET', `/portal/api/crm/activity?entity_type=client&entity_id=${client.json.client.id}`, staff);
  const actions = activity.json.activity.map((row) => row.action);
  assert.ok(actions.includes('client.create'));
  assert.ok(actions.includes('followup.create'));
  assert.ok(actions.includes('followup.done'));
  assert.ok(actions.includes('note.create'));
  assert.equal(activity.json.activity[0].actor_name, 'Blair Staff');
});

test('search finds synthetic records and drafts never send', async () => {
  const { db, staff } = await world();
  const client = await call(db, 'POST', '/portal/api/crm/clients', staff, {
    name: 'Lakeside Example', industry: 'Property management',
  });
  const site = await call(db, 'POST', `/portal/api/crm/clients/${client.json.client.id}/sites`, staff, siteBody('Lake House'));
  const job = await call(db, 'POST', '/portal/api/crm/jobs', staff, {
    site_id: site.json.site.id, category: 'Emergency', job_type_id: 'jt-hvac', title: 'No cool',
  });
  const found = await call(db, 'GET', '/portal/api/crm/search?q=ST-1-001', staff);
  assert.equal(found.json.results.some((row) => row.public_id === 'ST-1-001'), true);
  const byJob = await call(db, 'GET', `/portal/api/crm/search?q=${job.json.job.public_id}`, staff);
  assert.equal(byJob.json.results.some((row) => row.kind === 'job'), true);
  const draft = await call(db, 'POST', '/portal/api/crm/drafts', staff, {
    kind: 'schedule-confirm', entity_type: 'job', entity_id: job.json.job.id, body: 'Draft only. Do not send.',
  });
  assert.equal(draft.json.draft.status, 'draft');
  const send = await call(db, 'POST', `/portal/api/crm/drafts/${draft.json.draft.id}/send`, staff, {});
  assert.equal(send.status, 405);
});

test('CRM jobs are not the AR record', async () => {
  const { db, owner } = await world();
  const client = await call(db, 'POST', '/portal/api/crm/clients', owner, { name: 'AR Example', industry: 'Multifamily' });
  const site = await call(db, 'POST', `/portal/api/crm/clients/${client.json.client.id}/sites`, owner, siteBody('Invoice House'));
  const job = await call(db, 'POST', '/portal/api/crm/jobs', owner, {
    site_id: site.json.site.id, category: 'Make ready', job_type_id: 'jt-cleaning', title: 'Make ready clean',
  });
  const before = job.json.job.qb_invoice_ref;
  const rejected = await call(db, 'PATCH', `/portal/api/crm/jobs/${job.json.job.id}`, owner, {
    ar_stage: 'sent', qb_invoice_ref: 'QB-1', status: 'closed',
  });
  assert.equal(rejected.status, 409);
  assert.equal(rejected.json.code, 'hub_work_order_source_unavailable');
  const reloaded = await call(db, 'GET', `/portal/api/crm/jobs/${job.json.job.id}`, owner);
  assert.equal(reloaded.json.job.qb_invoice_ref, before);
  assert.equal(reloaded.json.job.status, 'scheduled');
  assert.equal(reloaded.json.job.ar_authoritative, false);
});

test('job type approval stays off the schedule until the owner accepts it', async () => {
  const { db, staff, owner } = await world();
  const proposed = await call(db, 'POST', '/portal/api/crm/job-types', staff, { name: 'Window film' });
  assert.equal(proposed.json.job_type.status, 'pending');
  const denied = await call(db, 'POST', `/portal/api/crm/job-types/${proposed.json.job_type.id}/decision`, staff, { decision: 'approved' });
  assert.equal(denied.status, 403);
  const client = await call(db, 'POST', '/portal/api/crm/clients', staff, { name: 'Type Example', industry: 'Commercial' });
  const site = await call(db, 'POST', `/portal/api/crm/clients/${client.json.client.id}/sites`, staff, siteBody('Film House'));
  const pendingJob = await call(db, 'POST', '/portal/api/crm/jobs', staff, {
    site_id: site.json.site.id, category: 'Work order', job_type_name: 'Window film', title: 'Film',
  });
  assert.equal(pendingJob.status, 201);
  const schedule = await call(db, 'GET', '/portal/api/crm/schedule', staff);
  assert.equal(schedule.json.jobs.some((job) => job.public_id === pendingJob.json.job.public_id), false);
  const types = await call(db, 'GET', '/portal/api/crm/job-types', staff);
  assert.equal(types.json.job_types.some((type) => type.name === 'Window film'), false);
  const approved = await call(db, 'POST', `/portal/api/crm/job-types/${proposed.json.job_type.id}/decision`, owner, { decision: 'approved' });
  assert.equal(approved.json.job_type.status, 'approved');
  const scheduleAfter = await call(db, 'GET', '/portal/api/crm/schedule', staff);
  assert.equal(scheduleAfter.json.jobs.some((job) => job.title === 'Film'), true);
});

test('high water only moves forward and map skips failed geocodes', async () => {
  const { db, owner, staff } = await world();
  const raised = await call(db, 'POST', '/portal/api/crm/admin/high-water', owner, {
    client_seq: 40, job_seq: 7, site_counters: [{ client_seq: 41, next_site_seq: 3 }],
  });
  assert.equal(raised.json.counters.client_seq, 40);
  const lowered = await call(db, 'POST', '/portal/api/crm/admin/high-water', owner, { client_seq: 2, job_seq: 1 });
  assert.equal(lowered.json.counters.client_seq, 40);
  assert.equal(lowered.json.counters.job_seq, 7);
  const staffTry = await call(db, 'POST', '/portal/api/crm/admin/high-water', staff, { client_seq: 90, job_seq: 90 });
  assert.equal(staffTry.status, 403);
  const client = await call(db, 'POST', '/portal/api/crm/clients', owner, { name: 'After Water', industry: 'Property management' });
  assert.equal(client.json.client.public_id, 'CL-0041');
  const pinned = await call(db, 'POST', `/portal/api/crm/clients/${client.json.client.id}/sites`, owner, {
    ...siteBody('Pinned'), geo_lat: 28.5, geo_lng: -81.3,
  });
  const failed = await call(db, 'POST', `/portal/api/crm/clients/${client.json.client.id}/sites`, owner, {
    ...siteBody('Unpinned'), geo_failed: true,
  });
  assert.equal(pinned.json.site.public_id, 'ST-41-004');
  assert.equal(failed.json.site.geo_status, 'failed');
  const map = await call(db, 'GET', '/portal/api/crm/map', owner);
  assert.equal(map.json.pins.length, 1);
  assert.equal(map.json.pins[0].public_id, pinned.json.site.public_id);
  assert.equal(map.json.failed, 1);
  assert.match(pinned.json.site.directions_url, /google\.com\/maps/);
  assert.match(directionsUrl('100 Example Ave', 'Mozilla/5.0 (iPhone) Safari'), /maps\.apple\.com/);
});

test('site save requires email and a contact', async () => {
  const { db, staff } = await world();
  const client = await call(db, 'POST', '/portal/api/crm/clients', staff, { name: 'Gate Example', industry: 'Multifamily' });
  const missing = await call(db, 'POST', `/portal/api/crm/clients/${client.json.client.id}/sites`, staff, {
    name: 'No Contact', address_line: '1 Example Ave', email: 'desk@example.test',
  });
  assert.equal(missing.status, 400);
});

test('missing CRM tables do not dump data', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const raw = new DatabaseSync(':memory:');
  raw.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, client_id TEXT, email TEXT, name TEXT, role TEXT);
    CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, created_at TEXT, expires_at TEXT, last_seen TEXT);`);
  const db = {
    prepare(sql) {
      const stmt = raw.prepare(sql);
      return { bind(...args) { return { async first() { return stmt.get(...args) ?? null; }, async all() { return { results: stmt.all(...args) }; }, async run() { stmt.run(...args); } }; } };
    },
  };
  const res = await handleCrm(crmRequest('GET', '/portal/api/crm/clients', 'missing-token-not-a-session'), { db, now: () => NOW });
  const json = await res.json();
  assert.equal(res.status, 401);
  assert.equal(json.error, 'Sign in required');
});

test('repo bundle has no client-book markers and Hub pages stay in place', () => {
  const root = new URL('..', import.meta.url).pathname;
  const names = [/greystar/i, /tricon/i, /yardi/i, /invitation homes/i, /progress residential/i, /american homes/i, /firstkey/i, /amherst/i, /resicap/i];
  const files = walk(join(root, 'public'))
    .concat(walk(join(root, 'functions')), walk(join(root, 'migrations')), walk(join(root, 'docs')), walk(join(root, 'scripts')));
  const placeholders = new Set(['workorders@tendcopm.com', 'you@company.com', 'requests@vendor.com', 'pm@theircompany.com']);
  const emailOk = (value) => placeholders.has(value.toLowerCase())
    || /@(?:[\w.-]+\.)?(?:example|example\.test|oakridgepm\.example)$/i.test(value);
  for (const file of files) {
    if (!/\.(js|mjs|html|css|sql|json|svg|md)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const needle of names) assert.equal(needle.test(text), false, file);
    const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    for (const email of emails) assert.equal(emailOk(email), true, `${file} ${email}`);
    if (file.includes(`${join('functions', 'portal')}`) || file.includes(`${join('scripts', 'crm')}`)) {
      assert.equal(/password\s*[:=]\s*['"][^'"]+['"]/i.test(text), false, file);
      assert.equal(/hub_session=[A-Za-z0-9]/i.test(text), false, file);
    }
  }
  const app = readFileSync(join(root, 'public/portal/app.html'), 'utf8');
  assert.match(app, /Make Ready Board/);
  assert.match(app, /Address board/);
  assert.match(app, /Common areas/);
  assert.match(app, /id="nav-internal" class="hidden"/);
  const index = readFileSync(join(root, 'public/portal/index.html'), 'utf8');
  assert.match(index, /alex@oakridgepm\.example/);
  const crmJs = readFileSync(join(root, 'public/portal/assets/crm.js'), 'utf8');
  assert.equal(crmJs.includes('localStorage'), false);
  assert.equal(crmJs.includes('fetch('), true);
});

function siteBody(name) {
  return {
    name,
    address_line: '100 Example Ave',
    city: 'Maitland',
    region: 'FL',
    postal: '32751',
    email: 'office@example.test',
    units: 12,
    contact: { name: 'Riley Chen', email: 'riley@example.test', phone: '407-555-0199' },
  };
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

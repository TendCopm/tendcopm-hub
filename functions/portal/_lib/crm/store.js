import {
  AR_STAGES,
  CATEGORIES,
  JOB_STATUSES,
  addDays,
  clientPublicId,
  directionsUrl,
  invoiceOverdue,
  iso,
  isInternalRole,
  jobPublicId,
  sitePublicId,
} from './constants.js';

export function fail(status, error) {
  const err = new Error(error);
  err.status = status;
  return err;
}

function id() {
  return crypto.randomUUID();
}

async function activity(db, actor, now, action, entityType, entityId, summary, before, after) {
  await db.prepare(
    `INSERT INTO crm_activity
      (id, at, actor_id, actor_name, action, entity_type, entity_id, summary, before_json, after_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id(),
    iso(now),
    actor.id,
    actor.name,
    action,
    entityType,
    entityId,
    summary,
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null,
  ).run();
}

async function nextCounter(db, column) {
  if (column !== 'client_seq' && column !== 'job_seq') throw fail(500, 'Bad counter');
  const row = await db.prepare(
    `UPDATE crm_counters SET ${column} = ${column} + 1 WHERE id = 1 RETURNING ${column} AS seq`
  ).bind().first();
  if (!row || !row.seq) throw fail(503, 'CRM storage is not initialized');
  return row.seq;
}

async function nextSiteSeq(db, clientSeq) {
  await db.prepare(
    `INSERT INTO crm_site_counters (client_seq, next_site_seq) VALUES (?, 0)
     ON CONFLICT(client_seq) DO NOTHING`
  ).bind(clientSeq).run();
  const row = await db.prepare(
    `UPDATE crm_site_counters SET next_site_seq = next_site_seq + 1
     WHERE client_seq = ? RETURNING next_site_seq AS seq`
  ).bind(clientSeq).first();
  if (!row || !row.seq) throw fail(503, 'CRM storage is not initialized');
  return row.seq;
}

function like(q) {
  return `%${String(q).replace(/[%_]/g, '')}%`;
}

function present(value) {
  return String(value || '').trim();
}

async function staffUser(db, userId) {
  const row = await db.prepare(
    `SELECT id, name, role, email FROM users WHERE id = ?`
  ).bind(userId).first();
  if (!row || !isInternalRole(row.role)) throw fail(400, 'Owner must be a TendCo staff user');
  return row;
}

function publicClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    public_id: row.public_id,
    seq: row.seq,
    name: row.name,
    industry: row.industry,
    management_address: row.management_address,
    management_phone: row.management_phone,
    owner_names: row.owner_names,
    asset_note: row.asset_note,
    fee_note: row.fee_note,
    website: row.website,
    offices: JSON.parse(row.multi_office_json || '[]'),
    owner_user_id: row.owner_user_id,
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function publicSite(row, userAgent) {
  if (!row) return null;
  const address = [row.address_line, row.city, row.region, row.postal].filter(Boolean).join(', ');
  return {
    ...row,
    address,
    missing_info: !!row.missing_info,
    directions_url: address ? directionsUrl(address, userAgent) : '',
  };
}

function publicJob(row, now) {
  if (!row) return null;
  return {
    ...row,
    invoice_overdue: invoiceOverdue(row, now),
  };
}

export async function searchRecords(db, q) {
  const term = present(q);
  if (term.length < 1) return [];
  const p = like(term);
  const rows = await db.prepare(
    `SELECT kind, id, public_id, label, detail FROM (
       SELECT 'client' AS kind, id, public_id, name AS label, industry AS detail
         FROM crm_clients
        WHERE deleted_at IS NULL AND (public_id LIKE ? OR name LIKE ? OR industry LIKE ? OR management_phone LIKE ?)
       UNION ALL
       SELECT 'contact', cl.id, cl.public_id, c.name, c.email
         FROM crm_contacts c JOIN crm_clients cl ON cl.id = c.client_id
        WHERE c.deleted_at IS NULL AND cl.deleted_at IS NULL
          AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)
       UNION ALL
       SELECT 'site', s.id, s.public_id, s.name, s.address_line
         FROM crm_sites s
        WHERE s.deleted_at IS NULL
          AND (s.public_id LIKE ? OR s.name LIKE ? OR s.address_line LIKE ? OR s.city LIKE ? OR s.email LIKE ?)
       UNION ALL
       SELECT 'job', j.id, j.public_id, j.title, j.qb_invoice_ref
         FROM crm_jobs j
        WHERE j.deleted_at IS NULL
          AND (j.public_id LIKE ? OR j.title LIKE ? OR j.qb_invoice_ref LIKE ? OR j.category LIKE ?)
     ) LIMIT 50`
  ).bind(p, p, p, p, p, p, p, p, p, p, p, p, p, p, p, p).all();
  return rows.results || rows;
}

export async function listClients(db) {
  const rows = await db.prepare(
    `SELECT c.*,
        (SELECT COUNT(*) FROM crm_sites s WHERE s.client_id = c.id AND s.deleted_at IS NULL) AS site_count
       FROM crm_clients c
      WHERE c.deleted_at IS NULL
      ORDER BY c.seq`
  ).all();
  return (rows.results || rows).map((row) => ({ ...publicClient(row), site_count: row.site_count }));
}

export async function getClient(db, clientId) {
  const row = await db.prepare(`SELECT * FROM crm_clients WHERE id = ?`).bind(clientId).first();
  if (!row || row.deleted_at) throw fail(404, 'Client not found');
  const contacts = await db.prepare(
    `SELECT * FROM crm_contacts WHERE client_id = ? AND deleted_at IS NULL ORDER BY created_at`
  ).bind(clientId).all();
  const sites = await db.prepare(
    `SELECT * FROM crm_sites WHERE client_id = ? AND deleted_at IS NULL ORDER BY site_seq`
  ).bind(clientId).all();
  return {
    ...publicClient(row),
    contacts: (contacts.results || contacts),
    sites: (sites.results || sites).map((s) => publicSite(s)),
  };
}

export async function createClient(db, actor, now, body) {
  const name = present(body.name);
  const industry = present(body.industry);
  if (!name) throw fail(400, 'Client name is required');
  if (!industry) throw fail(400, 'Industry is required');
  const seq = await nextCounter(db, 'client_seq');
  const rowId = id();
  const at = iso(now);
  const offices = JSON.stringify(Array.isArray(body.offices) ? body.offices : []);
  await db.prepare(
    `INSERT INTO crm_clients
      (id, public_id, seq, name, industry, management_address, management_phone, owner_names,
       asset_note, fee_note, website, multi_office_json, owner_user_id, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    rowId,
    clientPublicId(seq),
    seq,
    name,
    industry,
    present(body.management_address),
    present(body.management_phone),
    present(body.owner_names),
    present(body.asset_note),
    present(body.fee_note),
    present(body.website),
    offices,
    actor.id,
    at,
    at,
    actor.id,
    actor.id,
  ).run();
  const created = await getClient(db, rowId);
  await activity(db, actor, now, 'client.create', 'client', rowId, `Created ${created.public_id} ${created.name}`, null, created);
  return created;
}

export async function updateClient(db, actor, now, clientId, body) {
  const current = await getClient(db, clientId);
  if (body.deleted === true) {
    const at = iso(now);
    await db.prepare(`UPDATE crm_clients SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE id = ?`)
      .bind(at, at, actor.id, clientId).run();
    await activity(db, actor, now, 'client.delete', 'client', clientId, `Archived ${current.public_id}. Number stays reserved.`, current, { deleted_at: at });
    return { ...current, deleted_at: at };
  }
  const name = body.name != null ? present(body.name) : current.name;
  const industry = body.industry != null ? present(body.industry) : current.industry;
  if (!name || !industry) throw fail(400, 'Name and industry are required');
  let ownerUserId = current.owner_user_id;
  if (body.owner_user_id) {
    const staff = await staffUser(db, body.owner_user_id);
    ownerUserId = staff.id;
  }
  const at = iso(now);
  await db.prepare(
    `UPDATE crm_clients SET name=?, industry=?, management_address=?, management_phone=?, owner_names=?,
      asset_note=?, fee_note=?, website=?, multi_office_json=?, owner_user_id=?, updated_at=?, updated_by=?
     WHERE id=?`
  ).bind(
    name,
    industry,
    body.management_address != null ? present(body.management_address) : current.management_address,
    body.management_phone != null ? present(body.management_phone) : current.management_phone,
    body.owner_names != null ? present(body.owner_names) : current.owner_names,
    body.asset_note != null ? present(body.asset_note) : current.asset_note,
    body.fee_note != null ? present(body.fee_note) : current.fee_note,
    body.website != null ? present(body.website) : current.website,
    body.offices ? JSON.stringify(body.offices) : JSON.stringify(current.offices || []),
    ownerUserId,
    at,
    actor.id,
    clientId,
  ).run();
  const next = await getClient(db, clientId);
  await activity(db, actor, now, 'client.update', 'client', clientId, `Updated ${next.public_id}`, current, next);
  return next;
}

export async function restoreClient(db, actor, now, clientId) {
  const row = await db.prepare(`SELECT * FROM crm_clients WHERE id = ?`).bind(clientId).first();
  if (!row) throw fail(404, 'Client not found');
  if (!row.deleted_at) return getClient(db, clientId);
  const at = iso(now);
  await db.prepare(`UPDATE crm_clients SET deleted_at = NULL, updated_at = ?, updated_by = ? WHERE id = ?`)
    .bind(at, actor.id, clientId).run();
  await activity(db, actor, now, 'client.restore', 'client', clientId, `Restored ${row.public_id} with the same number`, { deleted_at: row.deleted_at }, { deleted_at: null });
  return getClient(db, clientId);
}

export async function addContact(db, actor, now, clientId, body) {
  await getClient(db, clientId);
  const name = present(body.name);
  if (!name) throw fail(400, 'Contact name is required');
  const email = present(body.email);
  const phone = present(body.phone);
  if (!email && !phone) throw fail(400, 'Contact needs an email or a phone');
  const rowId = id();
  const at = iso(now);
  await db.prepare(
    `INSERT INTO crm_contacts (id, client_id, site_id, name, title, email, phone, kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(rowId, clientId, body.site_id || null, name, present(body.title), email, phone, present(body.kind) || 'general', at, at).run();
  const row = await db.prepare(`SELECT * FROM crm_contacts WHERE id = ?`).bind(rowId).first();
  await activity(db, actor, now, 'contact.create', 'contact', rowId, `Added contact ${name}`, null, row);
  return row;
}

export async function createSite(db, actor, now, clientId, body, userAgent) {
  const client = await getClient(db, clientId);
  const name = present(body.name);
  const address = present(body.address_line);
  const email = present(body.email);
  const contact = body.contact || {};
  if (!name || !address) throw fail(400, 'Site name and address are required');
  if (!email) throw fail(400, 'Site email is required');
  if (!present(contact.name) || (!present(contact.email) && !present(contact.phone))) {
    throw fail(400, 'A site contact with a name and email or phone is required');
  }
  const siteSeq = await nextSiteSeq(db, client.seq);
  const rowId = id();
  const at = iso(now);
  const geo = geoFields(body);
  await db.prepare(
    `INSERT INTO crm_sites
      (id, public_id, client_id, origin_client_id, origin_client_seq, site_seq, name, address_line, city, region, postal,
       units, buildings, year_built, avg_sqft, avg_rent_note, class, email, website, area_supervisor_name, area_supervisor_phone,
       owner_name, owner_address, property_type, property_tags, geo_lat, geo_lng, geo_status, missing_info,
       created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
  ).bind(
    rowId,
    sitePublicId(client.seq, siteSeq),
    clientId,
    clientId,
    client.seq,
    siteSeq,
    name,
    address,
    present(body.city),
    present(body.region),
    present(body.postal),
    numOrNull(body.units),
    numOrNull(body.buildings),
    numOrNull(body.year_built),
    numOrNull(body.avg_sqft),
    present(body.avg_rent_note),
    present(body.class),
    email,
    present(body.website),
    present(body.area_supervisor_name),
    present(body.area_supervisor_phone),
    present(body.owner_name),
    present(body.owner_address),
    present(body.property_type),
    present(body.property_tags),
    geo.lat,
    geo.lng,
    geo.status,
    at,
    at,
    actor.id,
    actor.id,
  ).run();
  await addContact(db, actor, now, clientId, { ...contact, site_id: rowId, kind: contact.kind || 'site' });
  const site = await getSite(db, rowId, userAgent);
  await activity(db, actor, now, 'site.create', 'site', rowId, `Created ${site.public_id} ${site.name}`, null, { public_id: site.public_id });
  return site;
}

function numOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function geoFields(body) {
  const lat = numOrNull(body.geo_lat);
  const lng = numOrNull(body.geo_lng);
  if (body.geo_failed) return { lat: null, lng: null, status: 'failed' };
  if (lat == null || lng == null) return { lat: null, lng: null, status: 'unset' };
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { lat: null, lng: null, status: 'failed' };
  return { lat, lng, status: 'ok' };
}

export async function getSite(db, siteId, userAgent) {
  const row = await db.prepare(`SELECT * FROM crm_sites WHERE id = ?`).bind(siteId).first();
  if (!row || row.deleted_at) throw fail(404, 'Site not found');
  const contacts = await db.prepare(
    `SELECT * FROM crm_contacts WHERE site_id = ? AND deleted_at IS NULL ORDER BY created_at`
  ).bind(siteId).all();
  const history = await db.prepare(
    `SELECT t.*, fc.public_id AS from_public_id, fc.name AS from_name, tc.public_id AS to_public_id, tc.name AS to_name
       FROM crm_site_transfers t
       JOIN crm_clients fc ON fc.id = t.from_client_id
       JOIN crm_clients tc ON tc.id = t.to_client_id
      WHERE t.site_id = ?
      ORDER BY t.created_at`
  ).bind(siteId).all();
  return {
    ...publicSite(row, userAgent),
    contacts: contacts.results || contacts,
    transfers: history.results || history,
  };
}

export async function updateSite(db, actor, now, siteId, body, userAgent) {
  const current = await getSite(db, siteId, userAgent);
  if (body.deleted === true) {
    const at = iso(now);
    await db.prepare(`UPDATE crm_sites SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE id = ?`)
      .bind(at, at, actor.id, siteId).run();
    await activity(db, actor, now, 'site.delete', 'site', siteId, `Archived ${current.public_id}. Number stays reserved.`, { public_id: current.public_id }, { deleted_at: at });
    return { ...current, deleted_at: at };
  }
  const geo = body.geo_lat != null || body.geo_lng != null || body.geo_failed ? geoFields(body) : {
    lat: current.geo_lat, lng: current.geo_lng, status: current.geo_status,
  };
  const email = body.email != null ? present(body.email) : current.email;
  if (!email) throw fail(400, 'Site email is required');
  const at = iso(now);
  await db.prepare(
    `UPDATE crm_sites SET name=?, address_line=?, city=?, region=?, postal=?, units=?, buildings=?, year_built=?,
      avg_sqft=?, avg_rent_note=?, class=?, email=?, website=?, area_supervisor_name=?, area_supervisor_phone=?,
      owner_name=?, owner_address=?, property_type=?, property_tags=?, geo_lat=?, geo_lng=?, geo_status=?,
      missing_info=?, updated_at=?, updated_by=? WHERE id=?`
  ).bind(
    body.name != null ? present(body.name) : current.name,
    body.address_line != null ? present(body.address_line) : current.address_line,
    body.city != null ? present(body.city) : current.city,
    body.region != null ? present(body.region) : current.region,
    body.postal != null ? present(body.postal) : current.postal,
    body.units != null ? numOrNull(body.units) : current.units,
    body.buildings != null ? numOrNull(body.buildings) : current.buildings,
    body.year_built != null ? numOrNull(body.year_built) : current.year_built,
    body.avg_sqft != null ? numOrNull(body.avg_sqft) : current.avg_sqft,
    body.avg_rent_note != null ? present(body.avg_rent_note) : current.avg_rent_note,
    body.class != null ? present(body.class) : current.class,
    email,
    body.website != null ? present(body.website) : current.website,
    body.area_supervisor_name != null ? present(body.area_supervisor_name) : current.area_supervisor_name,
    body.area_supervisor_phone != null ? present(body.area_supervisor_phone) : current.area_supervisor_phone,
    body.owner_name != null ? present(body.owner_name) : current.owner_name,
    body.owner_address != null ? present(body.owner_address) : current.owner_address,
    body.property_type != null ? present(body.property_type) : current.property_type,
    body.property_tags != null ? present(body.property_tags) : current.property_tags,
    geo.lat,
    geo.lng,
    geo.status,
    email ? 0 : 1,
    at,
    actor.id,
    siteId,
  ).run();
  const next = await getSite(db, siteId, userAgent);
  await activity(db, actor, now, 'site.update', 'site', siteId, `Updated ${next.public_id}`, { public_id: current.public_id }, { public_id: next.public_id, name: next.name });
  return next;
}

export async function restoreSite(db, actor, now, siteId, userAgent) {
  const row = await db.prepare(`SELECT * FROM crm_sites WHERE id = ?`).bind(siteId).first();
  if (!row) throw fail(404, 'Site not found');
  if (row.deleted_at) {
    const at = iso(now);
    await db.prepare(`UPDATE crm_sites SET deleted_at = NULL, updated_at = ?, updated_by = ? WHERE id = ?`)
      .bind(at, actor.id, siteId).run();
    await activity(db, actor, now, 'site.restore', 'site', siteId, `Restored ${row.public_id} with the same number`, null, { public_id: row.public_id });
  }
  return getSite(db, siteId, userAgent);
}

async function openInvoiceGaps(db, siteId) {
  const rows = await db.prepare(
    `SELECT public_id, status, qb_invoice_ref FROM crm_jobs
      WHERE site_id = ? AND deleted_at IS NULL
        AND status IN ('done', 'needs_return', 'closed')
        AND trim(qb_invoice_ref) = ''`
  ).bind(siteId).all();
  return rows.results || rows;
}

export async function transferSite(db, actor, now, siteId, body, userAgent) {
  const site = await getSite(db, siteId, userAgent);
  const to = await getClient(db, body.to_client_id);
  if (to.id === site.client_id) throw fail(400, 'Site is already on that client');
  const type = body.transfer_type;
  if (type !== 'management' && type !== 'sale') throw fail(400, 'Transfer type must be management or sale');
  const notice = Number(body.notice_days);
  if (notice !== 30 && notice !== 60) throw fail(400, 'Notice must be 30 or 60 days');
  const who = body.who_pays;
  if (!['previous', 'new', 'tendco'].includes(who)) throw fail(400, 'Who pays must be previous, new, or tendco');
  const gaps = await openInvoiceGaps(db, siteId);
  if (gaps.length) {
    throw fail(400, `Hand-off is blocked until invoiced (${gaps.map((g) => g.public_id).join(', ')})`);
  }
  let saleBalance = null;
  if (type === 'sale') {
    saleBalance = Number(body.sale_balance_cents);
    if (!Number.isFinite(saleBalance) || saleBalance !== 0) {
      throw fail(400, 'Sale hand-off is blocked until the sale balance is $0');
    }
  }
  if (body.billing_contact_id) {
    const contact = await db.prepare(`SELECT id, client_id FROM crm_contacts WHERE id = ? AND deleted_at IS NULL`)
      .bind(body.billing_contact_id).first();
    if (!contact || (contact.client_id !== site.client_id && contact.client_id !== to.id)) {
      throw fail(400, 'Billing contact must belong to the previous or next client');
    }
  }
  const beforeCounter = await db.prepare(`SELECT next_site_seq FROM crm_site_counters WHERE client_seq = ?`)
    .bind(to.seq).first();
  const starts = present(body.notice_starts_on) || iso(now).slice(0, 10);
  const at = iso(now);
  const transferId = id();
  await db.prepare(
    `INSERT INTO crm_site_transfers
      (id, site_id, from_client_id, to_client_id, transfer_type, notice_days, notice_starts_on, countdown_end,
       billing_contact_id, who_pays, sale_balance_cents, created_at, actor_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    transferId,
    siteId,
    site.client_id,
    to.id,
    type,
    notice,
    starts,
    addDays(starts, notice),
    body.billing_contact_id || null,
    who,
    saleBalance,
    at,
    actor.id,
    present(body.note),
  ).run();
  await db.prepare(`UPDATE crm_sites SET client_id = ?, updated_at = ?, updated_by = ? WHERE id = ?`)
    .bind(to.id, at, actor.id, siteId).run();
  const afterCounter = await db.prepare(`SELECT next_site_seq FROM crm_site_counters WHERE client_seq = ?`)
    .bind(to.seq).first();
  if ((beforeCounter && beforeCounter.next_site_seq) !== (afterCounter && afterCounter.next_site_seq)
      && (beforeCounter || afterCounter)) {
    // Destination counter must not move. A missing row staying missing is fine.
    if (beforeCounter && afterCounter && beforeCounter.next_site_seq !== afterCounter.next_site_seq) {
      throw fail(500, 'Destination site counter changed');
    }
  }
  const next = await getSite(db, siteId, userAgent);
  if (next.public_id !== site.public_id) throw fail(500, 'Site number changed during transfer');
  await activity(db, actor, now, 'site.transfer', 'site', siteId,
    `Transferred ${site.public_id} to ${to.public_id}. Original number kept.`,
    { client_id: site.client_id, public_id: site.public_id },
    { client_id: to.id, public_id: next.public_id, transfer_id: transferId });
  return next;
}

export async function listJobTypes(db, includePending) {
  const sql = includePending
    ? `SELECT * FROM crm_job_types ORDER BY status, name`
    : `SELECT * FROM crm_job_types WHERE status = 'approved' ORDER BY name`;
  const rows = await db.prepare(sql).all();
  return rows.results || rows;
}

export async function proposeJobType(db, actor, now, body) {
  const name = present(body.name);
  if (!name) throw fail(400, 'Job type name is required');
  const existing = await db.prepare(`SELECT * FROM crm_job_types WHERE name = ? COLLATE NOCASE`).bind(name).first();
  if (existing) return existing;
  const rowId = id();
  const at = iso(now);
  await db.prepare(
    `INSERT INTO crm_job_types (id, name, status, created_at) VALUES (?, ?, 'pending', ?)`
  ).bind(rowId, name, at).run();
  const row = await db.prepare(`SELECT * FROM crm_job_types WHERE id = ?`).bind(rowId).first();
  await activity(db, actor, now, 'job_type.propose', 'job_type', rowId, `Proposed job type ${name}`, null, row);
  return row;
}

export async function decideJobType(db, actor, now, typeId, body) {
  if (actor.role !== 'owner' && actor.role !== 'admin') throw fail(403, 'Only the owner can approve job types');
  const decision = body.decision;
  if (decision !== 'approved' && decision !== 'rejected') throw fail(400, 'Decision must be approved or rejected');
  const row = await db.prepare(`SELECT * FROM crm_job_types WHERE id = ?`).bind(typeId).first();
  if (!row) throw fail(404, 'Job type not found');
  const at = iso(now);
  await db.prepare(`UPDATE crm_job_types SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?`)
    .bind(decision, at, actor.id, typeId).run();
  const next = await db.prepare(`SELECT * FROM crm_job_types WHERE id = ?`).bind(typeId).first();
  await activity(db, actor, now, 'job_type.decide', 'job_type', typeId, `${decision} job type ${row.name}`, row, next);
  return next;
}

async function resolveJobType(db, actor, now, body) {
  if (body.job_type_id) {
    const row = await db.prepare(`SELECT * FROM crm_job_types WHERE id = ?`).bind(body.job_type_id).first();
    if (!row) throw fail(400, 'Unknown job type');
    if (row.status !== 'approved') throw fail(400, 'That job type is not approved yet');
    return row;
  }
  if (body.job_type_name) return proposeJobType(db, actor, now, { name: body.job_type_name });
  throw fail(400, 'Job type is required');
}

export async function createJob(db, actor, now, body) {
  const site = await db.prepare(`SELECT * FROM crm_sites WHERE id = ? AND deleted_at IS NULL`).bind(body.site_id).first();
  if (!site) throw fail(404, 'Site not found');
  if (!CATEGORIES.includes(body.category)) throw fail(400, 'Category must be Emergency, Work order, or Make ready');
  const type = await resolveJobType(db, actor, now, body);
  if (type.status !== 'approved' && !body.job_type_name) throw fail(400, 'That job type is not approved yet');
  const seq = await nextCounter(db, 'job_seq');
  const rowId = id();
  const at = iso(now);
  let ownerUserId = actor.id;
  if (body.owner_user_id) ownerUserId = (await staffUser(db, body.owner_user_id)).id;
  await db.prepare(
    `INSERT INTO crm_jobs
      (id, public_id, seq, client_id, site_id, category, job_type_id, title, status, owner_user_id, scheduled_on,
       qb_invoice_ref, ar_stage, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, '', 'none', ?, ?, ?, ?)`
  ).bind(
    rowId,
    jobPublicId(seq),
    seq,
    site.client_id,
    site.id,
    body.category,
    type.id,
    present(body.title) || type.name,
    ownerUserId,
    present(body.scheduled_on) || null,
    at,
    at,
    actor.id,
    actor.id,
  ).run();
  const job = await getJob(db, rowId, now);
  await activity(db, actor, now, 'job.create', 'job', rowId, `Saved ${job.public_id}`, null, { public_id: job.public_id, category: job.category });
  return job;
}

export async function getJob(db, jobId, now) {
  const row = await db.prepare(
    `SELECT j.*, t.name AS job_type_name, t.status AS job_type_status, s.public_id AS site_public_id, s.name AS site_name,
            c.public_id AS client_public_id, c.name AS client_name, c.industry AS industry
       FROM crm_jobs j
       JOIN crm_job_types t ON t.id = j.job_type_id
       JOIN crm_sites s ON s.id = j.site_id
       JOIN crm_clients c ON c.id = j.client_id
      WHERE j.id = ?`
  ).bind(jobId).first();
  if (!row || row.deleted_at) throw fail(404, 'Job not found');
  return publicJob(row, now);
}

export async function listJobs(db, now, filters = {}) {
  const clauses = ['j.deleted_at IS NULL'];
  const args = [];
  if (filters.industry) { clauses.push('c.industry = ?'); args.push(filters.industry); }
  if (filters.category) { clauses.push('j.category = ?'); args.push(filters.category); }
  if (filters.job_type_id) { clauses.push('j.job_type_id = ?'); args.push(filters.job_type_id); }
  if (filters.from) { clauses.push('(j.scheduled_on IS NULL OR j.scheduled_on >= ?)'); args.push(filters.from); }
  if (filters.to) { clauses.push('(j.scheduled_on IS NULL OR j.scheduled_on <= ?)'); args.push(filters.to); }
  if (filters.approved_only) { clauses.push(`t.status = 'approved'`); }
  const rows = await db.prepare(
    `SELECT j.*, t.name AS job_type_name, t.status AS job_type_status, s.public_id AS site_public_id, s.name AS site_name,
            c.public_id AS client_public_id, c.name AS client_name, c.industry AS industry
       FROM crm_jobs j
       JOIN crm_job_types t ON t.id = j.job_type_id
       JOIN crm_sites s ON s.id = j.site_id
       JOIN crm_clients c ON c.id = j.client_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY j.seq
      LIMIT 200`
  ).bind(...args).all();
  return (rows.results || rows).map((row) => publicJob(row, now));
}

export async function updateJob(db, actor, now, jobId, body) {
  const current = await getJob(db, jobId, now);
  if (body.deleted === true) {
    const at = iso(now);
    await db.prepare(`UPDATE crm_jobs SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE id = ?`)
      .bind(at, at, actor.id, jobId).run();
    await activity(db, actor, now, 'job.delete', 'job', jobId, `Archived ${current.public_id}. Number stays reserved.`, { public_id: current.public_id }, { deleted_at: at });
    return { ...current, deleted_at: at };
  }
  let status = current.status;
  let doneAt = current.done_at;
  let closedAt = current.closed_at;
  let arStage = current.ar_stage;
  let qb = current.qb_invoice_ref || '';
  const stamps = {
    ar_created_at: current.ar_created_at,
    ar_sent_at: current.ar_sent_at,
    ar_check_at: current.ar_check_at,
    ar_deposited_at: current.ar_deposited_at,
  };
  if (body.status) {
    if (!JOB_STATUSES.includes(body.status)) throw fail(400, 'Unknown job status');
    status = body.status;
    if (status === 'done' || status === 'needs_return' || status === 'closed') {
      if (!doneAt) doneAt = iso(now);
    }
    if (status === 'closed') {
      qb = present(body.qb_invoice_ref != null ? body.qb_invoice_ref : qb);
      if (!qb) throw fail(400, 'An invoice reference is required before closing the job');
      closedAt = iso(now);
    }
  }
  if (body.qb_invoice_ref != null) qb = present(body.qb_invoice_ref);
  if (body.ar_stage) {
    const idx = AR_STAGES.indexOf(arStage);
    const next = AR_STAGES[idx + 1];
    if (body.ar_stage !== next) throw fail(400, 'AR stage moves one step at a time');
    if (!doneAt && status !== 'done' && status !== 'needs_return' && status !== 'closed') {
      throw fail(400, 'Mark the job done before invoicing');
    }
    if (!doneAt) doneAt = iso(now);
    if (body.ar_stage === 'created') {
      qb = present(body.qb_invoice_ref != null ? body.qb_invoice_ref : qb);
      if (!qb) throw fail(400, 'QuickBooks invoice number is required when the invoice is created');
      stamps.ar_created_at = iso(now);
    } else if (body.ar_stage === 'sent') stamps.ar_sent_at = iso(now);
    else if (body.ar_stage === 'check_received') stamps.ar_check_at = iso(now);
    else if (body.ar_stage === 'deposited') stamps.ar_deposited_at = iso(now);
    arStage = body.ar_stage;
  }
  let ownerUserId = current.owner_user_id;
  if (body.owner_user_id) ownerUserId = (await staffUser(db, body.owner_user_id)).id;
  let jobTypeId = current.job_type_id;
  if (body.job_type_id || body.job_type_name) {
    const type = await resolveJobType(db, actor, now, body);
    if (type.status !== 'approved') throw fail(400, 'That job type is not approved yet');
    jobTypeId = type.id;
  }
  const category = body.category || current.category;
  if (!CATEGORIES.includes(category)) throw fail(400, 'Category must be Emergency, Work order, or Make ready');
  const at = iso(now);
  await db.prepare(
    `UPDATE crm_jobs SET category=?, job_type_id=?, title=?, status=?, owner_user_id=?, scheduled_on=?,
      done_at=?, closed_at=?, qb_invoice_ref=?, ar_stage=?, ar_created_at=?, ar_sent_at=?, ar_check_at=?, ar_deposited_at=?,
      updated_at=?, updated_by=? WHERE id=?`
  ).bind(
    category,
    jobTypeId,
    body.title != null ? present(body.title) : current.title,
    status,
    ownerUserId,
    body.scheduled_on != null ? present(body.scheduled_on) || null : current.scheduled_on,
    doneAt,
    closedAt,
    qb,
    arStage,
    stamps.ar_created_at,
    stamps.ar_sent_at,
    stamps.ar_check_at,
    stamps.ar_deposited_at,
    at,
    actor.id,
    jobId,
  ).run();
  const next = await getJob(db, jobId, now);
  await activity(db, actor, now, 'job.update', 'job', jobId, `Updated ${next.public_id} (${next.status}, AR ${next.ar_stage})`,
    { status: current.status, ar_stage: current.ar_stage, qb_invoice_ref: current.qb_invoice_ref },
    { status: next.status, ar_stage: next.ar_stage, qb_invoice_ref: next.qb_invoice_ref });
  return next;
}

export async function restoreJob(db, actor, now, jobId) {
  const row = await db.prepare(`SELECT * FROM crm_jobs WHERE id = ?`).bind(jobId).first();
  if (!row) throw fail(404, 'Job not found');
  if (row.deleted_at) {
    const at = iso(now);
    await db.prepare(`UPDATE crm_jobs SET deleted_at = NULL, updated_at = ?, updated_by = ? WHERE id = ?`)
      .bind(at, actor.id, jobId).run();
    await activity(db, actor, now, 'job.restore', 'job', jobId, `Restored ${row.public_id} with the same number`, null, { public_id: row.public_id });
  }
  return getJob(db, jobId, now);
}

export async function arSummary(db, now) {
  const jobs = await listJobs(db, now, {});
  const overdue = jobs.filter((job) => job.invoice_overdue).map((job) => ({
    id: job.id,
    public_id: job.public_id,
    title: job.title,
    done_at: job.done_at,
    ar_stage: job.ar_stage,
    age_hours: Math.round((now.getTime() - Date.parse(job.done_at)) / HOUR) ,
  }));
  function avg(pairs) {
    if (!pairs.length) return null;
    const sum = pairs.reduce((n, v) => n + v, 0);
    return Math.round((sum / pairs.length) * 10) / 10;
  }
  const hours = (a, b) => (Date.parse(b) - Date.parse(a)) / HOUR;
  const doneToSent = jobs.filter((j) => j.done_at && j.ar_sent_at).map((j) => hours(j.done_at, j.ar_sent_at));
  const sentToCheck = jobs.filter((j) => j.ar_sent_at && j.ar_check_at).map((j) => hours(j.ar_sent_at, j.ar_check_at));
  const checkToDep = jobs.filter((j) => j.ar_check_at && j.ar_deposited_at).map((j) => hours(j.ar_check_at, j.ar_deposited_at));
  const counts = { none: 0, created: 0, sent: 0, check_received: 0, deposited: 0, overdue: overdue.length };
  for (const job of jobs) counts[job.ar_stage] = (counts[job.ar_stage] || 0) + 1;
  return {
    overdue,
    counts,
    averages_hours: {
      done_to_sent: avg(doneToSent),
      sent_to_check: avg(sentToCheck),
      check_to_deposited: avg(checkToDep),
    },
  };
}

const HOUR = 60 * 60 * 1000;

export async function mapPins(db) {
  const rows = await db.prepare(
    `SELECT id, public_id, name, address_line, city, region, postal, geo_lat, geo_lng, geo_status
       FROM crm_sites WHERE deleted_at IS NULL`
  ).all();
  const all = rows.results || rows;
  const pins = all.filter((s) => s.geo_status === 'ok' && s.geo_lat != null && s.geo_lng != null);
  return {
    pins,
    failed: all.filter((s) => s.geo_status === 'failed').length,
    unset: all.filter((s) => s.geo_status === 'unset').length,
  };
}

export async function addNote(db, actor, now, body) {
  const entityType = body.entity_type;
  const entityId = body.entity_id;
  const text = present(body.body);
  if (!['client', 'site', 'job', 'contact'].includes(entityType)) throw fail(400, 'Unknown note target');
  if (!entityId || !text) throw fail(400, 'Note needs a record and text');
  if (text.length > 4000) throw fail(400, 'Note is too long');
  await assertEntity(db, entityType, entityId);
  const rowId = id();
  const at = iso(now);
  await db.prepare(
    `INSERT INTO crm_notes (id, entity_type, entity_id, body, author_id, author_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(rowId, entityType, entityId, text, actor.id, actor.name, at).run();
  const row = await db.prepare(`SELECT * FROM crm_notes WHERE id = ?`).bind(rowId).first();
  await activity(db, actor, now, 'note.create', entityType, entityId, `Note added`, null, { note_id: rowId });
  return row;
}

export async function listNotes(db, entityType, entityId) {
  const rows = await db.prepare(
    `SELECT * FROM crm_notes WHERE entity_type = ? AND entity_id = ? ORDER BY created_at`
  ).bind(entityType, entityId).all();
  return rows.results || rows;
}

async function assertEntity(db, entityType, entityId) {
  const table = { client: 'crm_clients', site: 'crm_sites', job: 'crm_jobs', contact: 'crm_contacts' }[entityType];
  const row = await db.prepare(`SELECT id, deleted_at FROM ${table} WHERE id = ?`).bind(entityId).first();
  if (!row || row.deleted_at) throw fail(404, 'Record not found');
}

export async function addFollowup(db, actor, now, body) {
  const entityType = body.entity_type;
  const entityId = body.entity_id;
  const note = present(body.note);
  const due = present(body.due_on);
  if (!['client', 'site', 'job'].includes(entityType)) throw fail(400, 'Unknown follow-up target');
  if (!note || !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw fail(400, 'Follow-up needs a note and a due date');
  await assertEntity(db, entityType, entityId);
  let owner = actor;
  if (body.owner_user_id) owner = await staffUser(db, body.owner_user_id);
  const rowId = id();
  const at = iso(now);
  await db.prepare(
    `INSERT INTO crm_followups
      (id, entity_type, entity_id, due_on, owner_user_id, owner_name, note, status, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`
  ).bind(rowId, entityType, entityId, due, owner.id, owner.name, note, at, actor.id).run();
  const row = await db.prepare(`SELECT * FROM crm_followups WHERE id = ?`).bind(rowId).first();
  await activity(db, actor, now, 'followup.create', entityType, entityId, `Follow-up for ${owner.name} on ${due}`, null, row);
  return row;
}

export async function listFollowups(db, status) {
  const rows = status
    ? await db.prepare(`SELECT * FROM crm_followups WHERE status = ? ORDER BY due_on`).bind(status).all()
    : await db.prepare(`SELECT * FROM crm_followups ORDER BY due_on`).all();
  return rows.results || rows;
}

export async function completeFollowup(db, actor, now, followupId) {
  const row = await db.prepare(`SELECT * FROM crm_followups WHERE id = ?`).bind(followupId).first();
  if (!row) throw fail(404, 'Follow-up not found');
  const at = iso(now);
  await db.prepare(`UPDATE crm_followups SET status = 'done', done_at = ? WHERE id = ?`).bind(at, followupId).run();
  const next = await db.prepare(`SELECT * FROM crm_followups WHERE id = ?`).bind(followupId).first();
  await activity(db, actor, now, 'followup.done', row.entity_type, row.entity_id, `Completed follow-up`, row, next);
  return next;
}

export async function listActivity(db, entityType, entityId) {
  const rows = entityType
    ? await db.prepare(
      `SELECT id, at, actor_id, actor_name, action, entity_type, entity_id, summary
         FROM crm_activity WHERE entity_type = ? AND entity_id = ? ORDER BY at`
    ).bind(entityType, entityId).all()
    : await db.prepare(
      `SELECT id, at, actor_id, actor_name, action, entity_type, entity_id, summary
         FROM crm_activity ORDER BY at DESC LIMIT 100`
    ).all();
  return rows.results || rows;
}

export async function createDraft(db, actor, now, body) {
  const text = present(body.body);
  if (!text) throw fail(400, 'Draft text is required');
  const rowId = id();
  const at = iso(now);
  await db.prepare(
    `INSERT INTO crm_drafts (id, kind, entity_type, entity_id, body, status, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`
  ).bind(rowId, present(body.kind) || 'note', body.entity_type || null, body.entity_id || null, text, at, actor.id).run();
  await activity(db, actor, now, 'draft.create', body.entity_type || 'draft', body.entity_id || rowId, 'Saved a message draft. Nothing was sent.', null, { id: rowId });
  return db.prepare(`SELECT * FROM crm_drafts WHERE id = ?`).bind(rowId).first();
}

export async function listDrafts(db) {
  const rows = await db.prepare(`SELECT * FROM crm_drafts ORDER BY created_at DESC LIMIT 100`).all();
  return rows.results || rows;
}

export async function setHighWater(db, actor, now, body) {
  if (actor.role !== 'owner' && actor.role !== 'admin') throw fail(403, 'Only the owner can set numbering high water');
  const clientSeq = Number(body.client_seq ?? 0);
  const jobSeq = Number(body.job_seq ?? 0);
  if (!Number.isInteger(clientSeq) || !Number.isInteger(jobSeq) || clientSeq < 0 || jobSeq < 0) {
    throw fail(400, 'High water must be a whole number');
  }
  const before = await db.prepare(`SELECT client_seq, job_seq FROM crm_counters WHERE id = 1`).first();
  await db.prepare(
    `UPDATE crm_counters
        SET client_seq = CASE WHEN client_seq > ? THEN client_seq ELSE ? END,
            job_seq = CASE WHEN job_seq > ? THEN job_seq ELSE ? END
      WHERE id = 1`
  ).bind(clientSeq, clientSeq, jobSeq, jobSeq).run();
  if (Array.isArray(body.site_counters)) {
    for (const item of body.site_counters) {
      const seq = Number(item.client_seq);
      const next = Number(item.next_site_seq);
      if (!Number.isInteger(seq) || !Number.isInteger(next) || seq < 1 || next < 0) {
        throw fail(400, 'Site high water is invalid');
      }
      await db.prepare(
        `INSERT INTO crm_site_counters (client_seq, next_site_seq) VALUES (?, ?)
         ON CONFLICT(client_seq) DO UPDATE SET next_site_seq = CASE
           WHEN crm_site_counters.next_site_seq > excluded.next_site_seq THEN crm_site_counters.next_site_seq
           ELSE excluded.next_site_seq END`
      ).bind(seq, next).run();
    }
  }
  const after = await db.prepare(`SELECT client_seq, job_seq FROM crm_counters WHERE id = 1`).first();
  await activity(db, actor, now, 'admin.high_water', 'counters', '1', 'Raised numbering high water. Numbers were not lowered.', before, after);
  return after;
}

export async function grantStaff(db, actor, now, body) {
  if (actor.role !== 'owner' && actor.role !== 'admin') throw fail(403, 'Only the owner can grant staff access');
  const userId = present(body.user_id);
  if (!userId) throw fail(400, 'User id is required');
  const user = await db.prepare(`SELECT id, email, role, name FROM users WHERE id = ?`).bind(userId).first();
  if (!user || !/@tendcopm\.com$/i.test(user.email || '')) {
    throw fail(400, 'Staff access can only be granted to an existing @tendcopm.com login');
  }
  if (user.role === 'owner') return { id: user.id, role: user.role, email: user.email };
  await db.prepare(`UPDATE users SET role = 'staff' WHERE id = ?`).bind(user.id).run();
  await activity(db, actor, now, 'admin.grant_staff', 'user', user.id, `Granted staff CRM access to ${user.email}`, { role: user.role }, { role: 'staff' });
  return { id: user.id, role: 'staff', email: user.email };
}

-- Internal TendCo CRM. Additive only: does not alter Hub portal tables.
-- Do not apply on production until a backup exists and the old public
-- Pages snapshots are deleted. Numbers in crm_counters only move forward.

CREATE TABLE IF NOT EXISTS crm_counters (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  client_seq INTEGER NOT NULL DEFAULT 0,
  job_seq INTEGER NOT NULL DEFAULT 0
);

INSERT INTO crm_counters (id, client_seq, job_seq) VALUES (1, 0, 0)
  ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_site_counters (
  client_seq INTEGER PRIMARY KEY,
  next_site_seq INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crm_clients (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  seq INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  management_address TEXT NOT NULL DEFAULT '',
  management_phone TEXT NOT NULL DEFAULT '',
  owner_names TEXT NOT NULL DEFAULT '',
  asset_note TEXT NOT NULL DEFAULT '',
  fee_note TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  multi_office_json TEXT NOT NULL DEFAULT '[]',
  owner_user_id TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_contacts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  site_id TEXT,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'general',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_client ON crm_contacts (client_id);

CREATE TABLE IF NOT EXISTS crm_sites (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  origin_client_id TEXT NOT NULL,
  origin_client_seq INTEGER NOT NULL,
  site_seq INTEGER NOT NULL,
  name TEXT NOT NULL,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  postal TEXT NOT NULL DEFAULT '',
  units INTEGER,
  buildings INTEGER,
  year_built INTEGER,
  avg_sqft INTEGER,
  avg_rent_note TEXT NOT NULL DEFAULT '',
  class TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  website TEXT NOT NULL DEFAULT '',
  area_supervisor_name TEXT NOT NULL DEFAULT '',
  area_supervisor_phone TEXT NOT NULL DEFAULT '',
  owner_name TEXT NOT NULL DEFAULT '',
  owner_address TEXT NOT NULL DEFAULT '',
  property_type TEXT NOT NULL DEFAULT '',
  property_tags TEXT NOT NULL DEFAULT '',
  geo_lat REAL,
  geo_lng REAL,
  geo_status TEXT NOT NULL DEFAULT 'unset',
  missing_info INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  UNIQUE (origin_client_seq, site_seq)
);

CREATE INDEX IF NOT EXISTS idx_crm_sites_client ON crm_sites (client_id);

CREATE TABLE IF NOT EXISTS crm_site_transfers (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  from_client_id TEXT NOT NULL,
  to_client_id TEXT NOT NULL,
  transfer_type TEXT NOT NULL,
  notice_days INTEGER NOT NULL,
  notice_starts_on TEXT NOT NULL,
  countdown_end TEXT NOT NULL,
  billing_contact_id TEXT,
  who_pays TEXT NOT NULL,
  sale_balance_cents INTEGER,
  created_at TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_crm_transfers_site ON crm_site_transfers (site_id, created_at);

CREATE TABLE IF NOT EXISTS crm_job_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT
);

CREATE TABLE IF NOT EXISTS crm_jobs (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  seq INTEGER NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  category TEXT NOT NULL,
  job_type_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  owner_user_id TEXT,
  scheduled_on TEXT,
  done_at TEXT,
  closed_at TEXT,
  qb_invoice_ref TEXT NOT NULL DEFAULT '',
  ar_stage TEXT NOT NULL DEFAULT 'none',
  ar_created_at TEXT,
  ar_sent_at TEXT,
  ar_check_at TEXT,
  ar_deposited_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_jobs_site ON crm_jobs (site_id);
CREATE INDEX IF NOT EXISTS idx_crm_jobs_client ON crm_jobs (client_id);

CREATE TABLE IF NOT EXISTS crm_notes (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_notes_entity ON crm_notes (entity_type, entity_id, created_at);

CREATE TABLE IF NOT EXISTS crm_followups (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  due_on TEXT NOT NULL,
  owner_user_id TEXT,
  owner_name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  done_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_crm_followups_open ON crm_followups (status, due_on);

CREATE TABLE IF NOT EXISTS crm_activity (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_crm_activity_entity ON crm_activity (entity_type, entity_id, at);
CREATE INDEX IF NOT EXISTS idx_crm_activity_at ON crm_activity (at);

CREATE TABLE IF NOT EXISTS crm_drafts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

INSERT INTO crm_job_types (id, name, status, created_at) VALUES
  ('jt-painting', 'Painting', 'approved', '2026-11-09T00:00:00.000Z'),
  ('jt-cleaning', 'Cleaning', 'approved', '2026-11-09T00:00:00.000Z'),
  ('jt-punch', 'Punch / drywall', 'approved', '2026-11-09T00:00:00.000Z'),
  ('jt-carpet-clean', 'Carpet cleaning', 'approved', '2026-11-09T00:00:00.000Z'),
  ('jt-carpet-replace', 'Carpet replacement', 'approved', '2026-11-09T00:00:00.000Z'),
  ('jt-plumbing', 'Plumbing', 'approved', '2026-11-09T00:00:00.000Z'),
  ('jt-electrical', 'Electrical', 'approved', '2026-11-09T00:00:00.000Z'),
  ('jt-hvac', 'HVAC', 'approved', '2026-11-09T00:00:00.000Z'),
  ('jt-pest', 'Pest control', 'approved', '2026-11-09T00:00:00.000Z'),
  ('jt-maintenance', 'Maintenance', 'approved', '2026-11-09T00:00:00.000Z'),
  ('jt-trash', 'Trash out', 'approved', '2026-11-09T00:00:00.000Z'),
  ('jt-inspection', 'Inspection', 'approved', '2026-11-09T00:00:00.000Z')
ON CONFLICT(id) DO NOTHING;

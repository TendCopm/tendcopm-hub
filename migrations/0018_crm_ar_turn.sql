-- AR satellite for a Hub turn id. Does not alter turns.
-- Provenance of the turn id and completed_at clock: historical writer
-- commit 2319029bec170de8f8ae0708430d0a6e67c32bfb. Not a live schema file.
-- Do not apply on production until docs/crm-internal.md backup steps are done.

CREATE TABLE IF NOT EXISTS crm_ar (
  turn_id TEXT PRIMARY KEY,
  qb_invoice_ref TEXT NOT NULL DEFAULT '',
  ar_stage TEXT NOT NULL DEFAULT 'none',
  ar_created_at TEXT,
  ar_sent_at TEXT,
  ar_check_at TEXT,
  ar_deposited_at TEXT,
  billing_closed_at TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

-- Internal AR alerts. Not an email or SMS outbox.
-- Do not apply on production until the backup in docs/crm-internal.md is taken.
-- This table does not alter Hub turns, invoices, or notify_outbox.

CREATE TABLE IF NOT EXISTS crm_internal_alerts (
  id TEXT PRIMARY KEY,
  alert_code TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  done_at TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  recipient_role TEXT NOT NULL DEFAULT 'owner',
  channel TEXT NOT NULL DEFAULT 'internal' CHECK (channel = 'internal'),
  UNIQUE (alert_code, work_order_id, done_at)
);

CREATE INDEX IF NOT EXISTS idx_crm_internal_alerts_open
  ON crm_internal_alerts (status, recipient_role);

/** Internal Hub roles. Client portal roles are rejected by the CRM API. */
export const INTERNAL_ROLES = new Set(['owner', 'staff', 'admin']);

export const CATEGORIES = ['Emergency', 'Work order', 'Make ready'];

export const JOB_STATUSES = [
  'scheduled',
  'on_the_way',
  'arrived',
  'started',
  'done',
  'needs_return',
  'closed',
];

export const AR_STAGES = ['none', 'created', 'sent', 'check_received', 'deposited'];

export const HOUR_MS = 60 * 60 * 1000;

export function isInternalRole(role) {
  return INTERNAL_ROLES.has(String(role || ''));
}

export function clientPublicId(seq) {
  return `CL-${String(seq).padStart(4, '0')}`;
}

export function sitePublicId(clientSeq, siteSeq) {
  return `ST-${clientSeq}-${String(siteSeq).padStart(3, '0')}`;
}

export function jobPublicId(seq) {
  return `TC-${String(seq).padStart(6, '0')}`;
}

export function iso(now) {
  const d = now instanceof Date ? now : new Date(now || Date.now());
  return d.toISOString();
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Apple Maps on Apple browsers. Google Maps everywhere else. */
export function directionsUrl(address, userAgent) {
  const q = encodeURIComponent(String(address || '').trim());
  const ua = String(userAgent || '');
  const appleDevice = /iPhone|iPad|iPod/.test(ua)
    || (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|FxiOS/.test(ua));
  if (appleDevice) return `https://maps.apple.com/?daddr=${q}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

export function invoiceOverdue(job, now) {
  if (!job || !job.done_at || job.deleted_at) return false;
  const sent = job.ar_stage === 'sent'
    || job.ar_stage === 'check_received'
    || job.ar_stage === 'deposited';
  if (sent) return false;
  const done = Date.parse(job.done_at);
  const at = now instanceof Date ? now.getTime() : Date.parse(now);
  return Number.isFinite(done) && Number.isFinite(at) && (at - done) > 24 * HOUR_MS;
}

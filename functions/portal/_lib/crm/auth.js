import { isInternalRole } from './constants.js';

/**
 * Session contract from tendcopm-pages-deploy lib/auth.js at
 * 2319029bec170de8f8ae0708430d0a6e67c32bfb. Not verified live.
 * Historical handleApi reads only this cookie. Bearer is the same token
 * shape for CRM calls; that file does not read Authorization.
 */
export const SESSION_COOKIE = '__Host-tb_session';
export const SESSION_TOKEN_RE = /^[A-Za-z0-9_-]{40,60}$/;

export async function sha256Hex(value) {
  const data = new TextEncoder().encode(String(value));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function readSessionToken(request) {
  const raw = request.headers.get('cookie') || request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== SESSION_COOKIE) continue;
    let value = part.slice(i + 1).trim();
    try { value = decodeURIComponent(value); } catch { /* keep raw */ }
    if (SESSION_TOKEN_RE.test(value)) return value;
  }
  const bearer = (request.headers.get('authorization') || '').match(/^Bearer\s+(\S+)$/i);
  if (bearer && SESSION_TOKEN_RE.test(bearer[1])) return bearer[1];
  return null;
}

/**
 * Same lookup as getSessionUser: sessions.id is SHA-256 hex, join users
 * and clients, reject expired rows. Also refreshes last_seen after an hour,
 * matching that function. Returns null when the token, row, or client is missing.
 */
export async function actorFromRequest(db, request, now = new Date()) {
  const token = readSessionToken(request);
  if (!token) return null;
  const at = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const hash = await sha256Hex(token);
  let row;
  try {
    row = await db.prepare(
      `SELECT s.id AS session_id, s.expires_at, s.last_seen,
              u.id, u.email, u.name, u.role, u.client_id, c.name AS client_name
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN clients c ON c.id = u.client_id
        WHERE s.id = ?`
    ).bind(hash).first();
  } catch (err) {
    if (/no such (table|column)/i.test(String(err && err.message || ''))) return null;
    throw err;
  }
  if (!row || row.expires_at < at) return null;
  const seen = Date.parse(row.last_seen || '');
  if (!Number.isFinite(seen) || Date.now() - seen > 3600000) {
    try {
      await db.prepare('UPDATE sessions SET last_seen = ? WHERE id = ?').bind(at, hash).run();
    } catch {
      /* session read still stands if last_seen cannot be written */
    }
  }
  return {
    id: row.id,
    name: row.name,
    email: String(row.email || '').toLowerCase(),
    role: row.role,
    client_id: row.client_id,
    client_name: row.client_name,
  };
}

export function isInternalActor(actor) {
  return !!(actor && isInternalRole(actor.role));
}

export function hubDatabase(env) {
  if (!env) return null;
  return env.TURN_DB || env.DB || null;
}

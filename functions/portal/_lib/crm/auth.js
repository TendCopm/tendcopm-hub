import { isInternalRole } from './constants.js';

export async function sha256Hex(value) {
  const data = new TextEncoder().encode(String(value));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function cookieValues(header) {
  if (!header) return [];
  return header.split(';').map((part) => {
    const i = part.indexOf('=');
    if (i < 0) return '';
    return decodeURIComponent(part.slice(i + 1).trim());
  }).filter((v) => v.length >= 20);
}

export function tokensFromRequest(request) {
  const out = [];
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.match(/^Bearer\s+(\S+)$/i);
  if (bearer) out.push(bearer[1]);
  out.push(...cookieValues(request.headers.get('cookie')));
  return out;
}

/**
 * Resolve a Hub session. sessions.id is the SHA-256 hex of the token,
 * matching the live tendco-turn-board-db comment. Every cookie and bearer
 * token is hashed and looked up so CRM does not depend on a cookie name
 * that is not in this git snapshot.
 */
export async function actorFromRequest(db, request, now = new Date()) {
  const tokens = tokensFromRequest(request);
  if (!tokens.length) return null;
  const at = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  for (const token of tokens) {
    const hash = await sha256Hex(token);
    const row = await db.prepare(
      `SELECT u.id, u.name, u.email, u.role, u.client_id, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    ).bind(hash).first();
    if (!row) continue;
    if (String(row.expires_at) <= at) continue;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      client_id: row.client_id,
    };
  }
  return null;
}

export function isInternalActor(actor) {
  return !!(actor && isInternalRole(actor.role));
}

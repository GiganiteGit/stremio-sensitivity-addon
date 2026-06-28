// Lightweight, privacy-preserving usage analytics for the addon.
//
// Stremio gives no install count, so we approximate active users by logging a
// row per resource/configure/install request to Supabase table `addon_events`.
// We never store a raw IP: ip_hash = sha256(salt + clientIp), truncated. Distinct
// ip_hash over a window ≈ unique users; the install/configure kinds give a funnel.
//
// Degrades to a no-op when SUPABASE_URL / SUPABASE_KEY are unset, and every call
// is fire-and-forget — analytics must NEVER block or break a real request.
'use strict';

const crypto = require('crypto');

const TABLE = 'addon_events';
// A secret, stable salt makes ip_hash a consistent pseudonym (so DAU/WAU/MAU
// distinct counts are correct) while keeping the raw IP unrecoverable. Set
// ANALYTICS_SALT in the deploy env; the fallback only keeps local dev working.
const SALT = process.env.ANALYTICS_SALT || 'sensitivity-notes-dev-salt';

let client; // undefined = unresolved, false = unavailable, object = client
function supa() {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    client = false;
    return client;
  }
  const { createClient } = require('@supabase/supabase-js');
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

// Best-effort real client IP behind Cloudflare + BeamUp's nginx.
function clientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return String(cf).trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || '';
}

function ipHash(req) {
  const ip = clientIp(req);
  if (!ip) return null;
  return crypto.createHash('sha256').update(SALT + ip).digest('hex').slice(0, 32);
}

// Record one event. Fire-and-forget: returns immediately, swallows all errors.
function record(kind, req, hasConfig) {
  try {
    const db = supa();
    if (!db) return;
    const row = { kind, ip_hash: ipHash(req), has_config: !!hasConfig };
    // .then with a no-op rejection handler so a failed insert never surfaces.
    db.from(TABLE).insert(row).then(() => {}, () => {});
  } catch {
    /* analytics is non-essential */
  }
}

module.exports = { record, TABLE };

// Durable response cache (Phase 4): Supabase table dtdd_cache(imdb_id, payload, fetched_at).
// Survives restarts so we re-query DTDD as little as possible (politeness, plan §3/§4).
//
// Degrades gracefully: with no SUPABASE_URL / SUPABASE_KEY set, every call is a
// no-op and the addon runs on the in-memory cache alone. SUPABASE_KEY should be a
// service_role key (server-side only) so writes aren't blocked by RLS.
'use strict';

const TABLE = 'dtdd_cache';

let client; // undefined = not yet resolved, false = unavailable, object = client
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

// Returns { value, fetchedAt(ms) } for a cached imdb id, or undefined on miss /
// error / when no DB is configured. Never throws — callers fall back to live.
async function get(imdbId) {
  const db = supa();
  if (!db) return undefined;
  try {
    const { data, error } = await db
      .from(TABLE)
      .select('payload, fetched_at')
      .eq('imdb_id', imdbId)
      .maybeSingle();
    if (error || !data) return undefined;
    return { value: data.payload, fetchedAt: new Date(data.fetched_at).getTime() };
  } catch {
    return undefined;
  }
}

// Upsert a payload. Fire-and-forget; failures are swallowed (best-effort cache).
async function set(imdbId, payload) {
  const db = supa();
  if (!db) return;
  try {
    await db
      .from(TABLE)
      .upsert(
        { imdb_id: imdbId, payload, fetched_at: new Date().toISOString() },
        { onConflict: 'imdb_id' },
      );
  } catch {
    /* best-effort */
  }
}

const available = () => !!supa();

module.exports = { get, set, available, TABLE };

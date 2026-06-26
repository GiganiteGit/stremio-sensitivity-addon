// Tiny in-memory TTL cache with in-flight de-duplication and negative caching.
// Keeps DTDD load low between restarts (politeness, plan §3/§4). The durable
// Supabase cache is Phase 4; this is the polite stopgap for live stream lookups.
'use strict';

const store = new Map(); // key -> { value, expires }
const inflight = new Map(); // key -> Promise

function get(key) {
  const e = store.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expires) {
    store.delete(key);
    return undefined;
  }
  return e.value;
}

function set(key, value, ttlMs) {
  store.set(key, { value, expires: Date.now() + ttlMs });
}

// Run `producer` at most once per key (single-flight) and cache the result.
// `ttlFor(value)` picks the TTL, so callers can use a shorter negative TTL.
async function through(key, producer, ttlFor) {
  const cached = get(key);
  if (cached !== undefined) return cached;
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const value = await producer();
      set(key, value, ttlFor(value));
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

module.exports = { get, set, through };

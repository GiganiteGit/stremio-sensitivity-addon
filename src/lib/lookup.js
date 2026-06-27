// Layered DTDD lookup (Phase 4): one place that turns a tt id into a cached,
// minimal trigger payload for the stream handler.
//
//   L1  in-memory TTL cache (cache.js) — dedupes in-flight + fast repeat hits
//   L2  durable Supabase cache (store.js) — survives restarts, the real politeness win
//   L3  live resolve (Cinemeta -> DTDD search -> DTDD media)
//
// Content warnings rarely change, so positive results get a long TTL. No-match
// results get a short TTL (titles DTDD doesn't have yet may appear later).
// Transient errors are cached very briefly in memory only — never durably.
'use strict';

const { resolveTriggers, baseId } = require('./resolve');
const { presentTriggers } = require('./triggers');
const mem = require('./cache');
const store = require('./store');

const DAY = 24 * 3600 * 1000;
const TTL = {
  ok: 30 * DAY, // warnings rarely change (plan §4)
  nomatch: 3 * DAY, // retry dead/unmatched titles occasionally
  error: 10 * 60 * 1000, // transient; retry soon
};
const ttlFor = (v) => TTL[v && v.state] ?? TTL.error;

// One live resolve, normalised to a small cacheable shape.
async function resolvePayload(type, ttId) {
  try {
    const r = await resolveTriggers(type, ttId);
    if (!r.match) return { state: 'nomatch', name: r.meta?.name ?? ttId };
    return { state: 'ok', name: r.meta.name, dtddId: r.dtddId, triggers: presentTriggers(r.stats) };
  } catch (e) {
    return { state: 'error', message: e.message };
  }
}

const isFresh = (hit) => hit && Date.now() - hit.fetchedAt < ttlFor(hit.value);

// L1 -> L2 -> live. Returns the payload { state, ... }.
function lookup(type, id) {
  const ttId = baseId(id);
  return mem.through(
    `${type}:${ttId}`,
    async () => {
      const hit = await store.get(ttId);
      if (isFresh(hit)) return hit.value;
      const value = await resolvePayload(type, ttId);
      if (value.state !== 'error') store.set(ttId, value); // durable, fire-and-forget
      return value;
    },
    ttlFor,
  );
}

module.exports = { lookup, ttlFor, TTL };

// Resolve a Stremio id (tt...) to DTDD trigger data:
//   tt id -> Cinemeta title/year -> DTDD search -> best match -> DTDD media.
// DTDD is title-level, so :season:episode is stripped (plan §5).
'use strict';

const dtdd = require('./dtdd');

const CINEMETA = 'https://v3-cinemeta.strem.io';
const baseId = (id) => String(id).split(':')[0];

async function cinemeta(type, ttId) {
  const res = await fetch(`${CINEMETA}/meta/${type}/${ttId}.json`, {
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Cinemeta ${type}/${ttId} HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.meta) throw new Error(`Cinemeta ${type}/${ttId} returned no meta`);
  return json.meta; // { name, year, poster, background, description, ... }
}

// Pick the DTDD search result for our title: imdbId first, then name(+year), then best guess.
function pickMatch(items, ttId, name, year) {
  if (!Array.isArray(items) || !items.length) return null;
  const byImdb = items.find((it) => (it.imdbId || it.imdb_id) === ttId);
  if (byImdb) return { item: byImdb, how: 'imdbId' };
  const sameName = items.filter(
    (it) => (it.name || '').toLowerCase() === (name || '').toLowerCase(),
  );
  if (sameName.length) {
    const yr = sameName.find((it) => String(it.releaseYear) === String(year));
    return { item: yr || sameName[0], how: yr ? 'name+year' : 'name' };
  }
  return { item: items[0], how: 'first-result(fuzzy)' };
}

// Full chain. Returns { ttId, meta, match, dtddId, stats } ; match is null on no DTDD hit.
async function resolveTriggers(type, rawId) {
  const ttId = baseId(rawId);
  const meta = await cinemeta(type, ttId);
  const items = await dtdd.search(meta.name);
  const match = pickMatch(items, ttId, meta.name, meta.year);
  if (!match) return { ttId, meta, match: null, dtddId: null, stats: [] };
  const m = await dtdd.media(match.item.id);
  return { ttId, meta, match, dtddId: match.item.id, stats: m?.topicItemStats ?? [] };
}

module.exports = { baseId, cinemeta, pickMatch, resolveTriggers };

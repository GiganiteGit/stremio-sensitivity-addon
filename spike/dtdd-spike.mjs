// Phase 0 throwaway spike (sensitivity-addon-plan.md §8-§9).
// Prove the chain: tt id -> Cinemeta (title/year) -> DTDD search -> DTDD media
// -> sensitivity triggers. NO Stremio code. Confirm response shapes, especially
// the TopicId -> name mapping situation.
//
// Run from repo root:  node --env-file=.env.local spike/dtdd-spike.mjs

import { writeFileSync } from 'node:fs';

const TOPICS_PATH = new URL('../topics.json', import.meta.url); // repo-root, CWD-independent
const DTDD_BASE = 'https://www.doesthedogdie.com';
const CINEMETA  = 'https://v3-cinemeta.strem.io';
const KEY = process.env.DTDD_API_KEY;
const UA  = 'SensitivityNotesStremioAddon/0.1 (Phase0 spike; contact martin.taylor@findmylegacy.co.uk)';

// Known cases to validate against (all movies).
const TESTS = [
  { ttId: 'tt0050798', type: 'movie', label: 'Old Yeller -> expect ANIMAL DEATH = yes' },
  { ttId: 'tt3606756', type: 'movie', label: 'Incredibles 2 -> expect FLASHING LIGHTS = yes' },
  { ttId: 'tt1109624', type: 'movie', label: 'Paddington -> expect relatively clean' },
];

const sleep  = (ms) => new Promise((r) => setTimeout(r, ms));
const baseId = (id) => id.split(':')[0]; // strip :season:episode (DTDD is title-level)

async function getJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA, ...headers },
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, json, text };
}

async function cinemeta(type, ttId) {
  const { ok, status, json } = await getJson(`${CINEMETA}/meta/${type}/${ttId}.json`);
  if (!ok || !json?.meta) throw new Error(`Cinemeta ${type}/${ttId} -> HTTP ${status}`);
  return { name: json.meta.name, year: json.meta.year, imdb_id: json.meta.imdb_id || ttId };
}

async function dtddSearch(q) {
  const { ok, status, json, text } = await getJson(
    `${DTDD_BASE}/dddsearch?q=${encodeURIComponent(q)}`, { 'X-API-KEY': KEY });
  if (!ok) throw new Error(`DTDD search HTTP ${status}: ${text.slice(0, 200)}`);
  return json;
}

async function dtddMedia(id) {
  const { ok, status, json, text } = await getJson(
    `${DTDD_BASE}/media/${id}`, { 'X-API-KEY': KEY });
  if (!ok) throw new Error(`DTDD media HTTP ${status}: ${text.slice(0, 200)}`);
  return json;
}

function pickMatch(items, ttId, name, year) {
  if (!Array.isArray(items)) return null;
  let m = items.find((it) => (it.imdbId || it.imdb_id) === ttId);
  if (m) return { item: m, how: 'imdbId' };
  const sameName = items.filter((it) => (it.name || '').toLowerCase() === (name || '').toLowerCase());
  if (sameName.length) {
    const yr = sameName.find((it) => String(it.releaseYear) === String(year));
    return { item: yr || sameName[0], how: yr ? 'name+year' : 'name' };
  }
  return items[0] ? { item: items[0], how: 'first-result(fuzzy)' } : null;
}

// Presence = community net-yes. Phase 0 finding: voteSum is NOT yes-no (Old Yeller
// "a dog dies" is 202/11 yet voteSum=34), so it's unreliable; yesSum vs noSum is the
// trustworthy net.
const isPresent = (s) => Number(s.yesSum ?? 0) > Number(s.noSum ?? 0);
const topicName = (s) =>
  s?.Topic?.name || s?.topic?.name || s?.name || `TopicId:${s.TopicId ?? s.topicId ?? '?'}`;

let shapeDumped = false;

async function run() {
  console.log('DTDD key:', KEY ? `present (…${KEY.slice(-4)})` : 'MISSING');
  if (!KEY) process.exit(1);

  for (const t of TESTS) {
    console.log('\n' + '='.repeat(72));
    console.log(`${t.label}  [${t.ttId}]`);
    try {
      const id = baseId(t.ttId);
      const meta = await cinemeta(t.type, id);
      console.log(`  Cinemeta -> "${meta.name}" (${meta.year})`);

      const search = await dtddSearch(meta.name);
      const items = search?.items ?? search?.data ?? search;
      console.log(`  DTDD search -> ${Array.isArray(items) ? items.length + ' results' : 'unexpected shape: ' + Object.keys(search || {}).join(',')}`);

      const match = pickMatch(items, id, meta.name, meta.year);
      if (!match) { console.log('  NO MATCH'); await sleep(600); continue; }
      const it = match.item;
      console.log(`  matched via ${match.how}: id=${it.id} "${it.name}" (${it.releaseYear}) imdb=${it.imdbId ?? it.imdb_id ?? '-'} tmdb=${it.tmdbId ?? '-'}`);

      const media = await dtddMedia(it.id);
      const stats = media?.topicItemStats ?? [];

      if (!shapeDumped && stats[0]) {
        shapeDumped = true;
        console.log('\n  --- SHAPE PROBE (first title only) ---');
        console.log('  media top-level keys:', Object.keys(media || {}).join(', '));
        console.log('  topicItemStats length:', stats.length);
        console.log('  sample topicItemStat keys:', Object.keys(stats[0]).join(', '));
        console.log('  sample topicItemStat:', JSON.stringify(stats[0], null, 2).slice(0, 1000));
        console.log('  -> nested Topic name available?', !!(stats[0].Topic?.name || stats[0].topic?.name));

        // The full 199-topic catalog rides along in every media response, so build
        // the canonical TopicId -> {name, category, slug} table from it here.
        const topics = stats
          .map((s) => ({
            topicId: s.TopicId,
            name: (typeof s.topic === 'string' ? s.topic : s.topic?.name) ?? s.doesName ?? null,
            doesName: s.doesName ?? null,
            category: (typeof s.TopicCategory === 'string' ? s.TopicCategory : s.TopicCategory?.name) ?? null,
            slug: s.slug ?? null,
          }))
          .filter((t) => t.topicId != null)
          .sort((a, b) => a.topicId - b.topicId);
        writeFileSync(TOPICS_PATH, JSON.stringify(topics, null, 2) + '\n');
        console.log(`  wrote topics.json: ${topics.length} topics`);
        console.log('  first 3 entries:', JSON.stringify(topics.slice(0, 3)));
        console.log('  --- end shape probe ---\n');
      }

      const present = stats.filter(isPresent);
      console.log(`  TRIGGERS PRESENT: ${present.length} of ${stats.length} topics`);
      present
        .sort((a, b) => Number(b.yesSum || 0) - Number(a.yesSum || 0))
        .slice(0, 20)
        .forEach((s) => console.log(`    - ${topicName(s)}  (yes ${s.yesSum ?? '?'} / no ${s.noSum ?? '?'})`));
      if (present.length > 20) console.log(`    ...and ${present.length - 20} more`);
    } catch (e) {
      console.log('  ERROR:', e.message);
    }
    await sleep(600); // politeness: low concurrency, small gap
  }
  console.log('\nDone.');
}

run();

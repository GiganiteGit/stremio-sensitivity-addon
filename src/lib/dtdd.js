// DoesTheDogDie API client. Auth via X-API-KEY header. Identify ourselves in the
// User-Agent and keep calls low-volume (DTDD is a small hobby-scale site, plan §3).
'use strict';

const DTDD_BASE = 'https://www.doesthedogdie.com';
const UA =
  'SensitivityNotesStremioAddon/0.1 ' +
  '(+https://github.com/GiganiteGit/stremio-sensitivity-addon; martin.taylor@findmylegacy.co.uk)';

function apiKey() {
  const k = process.env.DTDD_API_KEY;
  if (!k) throw new Error('DTDD_API_KEY is not set (load .env.local)');
  return k;
}

// --- Politeness: cap concurrent calls to DTDD (small hobby-scale site, plan §3) ---
const MAX_CONCURRENT = Number(process.env.DTDD_CONCURRENCY) || 2;
let active = 0;
const waiters = [];
function acquire() {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiters.push(resolve));
}
function release() {
  active -= 1;
  const next = waiters.shift();
  if (next) {
    active += 1;
    next();
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_ATTEMPTS = 3;

// One fetch attempt, returning a normalised shape.
async function fetchOnce(url, headers) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA, ...headers },
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { ok: res.ok, status: res.status, json, text, res };
}

// Concurrency-limited GET with retry/backoff on 429 + 5xx + network errors.
// Honours Retry-After on 429 when present.
async function getJson(url, headers = {}) {
  await acquire();
  try {
    let lastErr;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const r = await fetchOnce(url, headers);
        const retryable = r.status === 429 || r.status >= 500;
        if (!retryable || attempt === MAX_ATTEMPTS) {
          return { ok: r.ok, status: r.status, json: r.json, text: r.text };
        }
        const retryAfter = Number(r.res.headers.get('retry-after'));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
        await sleep(backoff);
      } catch (e) {
        lastErr = e;
        if (attempt === MAX_ATTEMPTS) throw e;
        await sleep(500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250));
      }
    }
    throw lastErr; // unreachable, but keeps control flow explicit
  } finally {
    release();
  }
}

// GET /dddsearch?q= -> array of media items ({ id, name, releaseYear, imdbId, ... })
async function search(query) {
  const { ok, status, json, text } = await getJson(
    `${DTDD_BASE}/dddsearch?q=${encodeURIComponent(query)}`,
    { 'X-API-KEY': apiKey() },
  );
  if (!ok) throw new Error(`DTDD search HTTP ${status}: ${text.slice(0, 150)}`);
  return json?.items ?? json?.data ?? (Array.isArray(json) ? json : []);
}

// GET /media/<id> -> { item, topicItemStats: [...], ... } (full 199-topic catalog)
async function media(id) {
  const { ok, status, json, text } = await getJson(
    `${DTDD_BASE}/media/${id}`,
    { 'X-API-KEY': apiKey() },
  );
  if (!ok) throw new Error(`DTDD media HTTP ${status}: ${text.slice(0, 150)}`);
  return json;
}

// Public web page for a DTDD media id (tappable destination for users).
const pageUrl = (id) => `${DTDD_BASE}/media/${id}`;

module.exports = { DTDD_BASE, search, media, pageUrl };

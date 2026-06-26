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

async function getJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA, ...headers },
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { ok: res.ok, status: res.status, json, text };
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

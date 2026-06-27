// Per-user config (Phase 3): the set of trigger TopicIds the user pinned.
// Encoded as base64url JSON in the install-URL path before /manifest.json
// (the Torrentio/Comet pattern), decoded by the server middleware and handed
// to every handler as `args.config`.
'use strict';

const { byId } = require('./topics');

const SCHEMA_VERSION = 1;
const MAX_PINS = 200; // hard cap; the canonical topic table is ~199 entries.

// Coerce an arbitrary value into a clean, deduped array of known TopicIds.
function cleanPins(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  for (const raw of value) {
    const n = Number(raw);
    if (!Number.isInteger(n)) continue;
    if (!byId.has(n)) continue; // ignore ids that aren't in our topic table
    seen.add(n);
    if (seen.size >= MAX_PINS) break;
  }
  return [...seen];
}

// Object -> base64url string. Empty pins encode to '' (no config segment).
function encodeConfig(config) {
  const pins = cleanPins(config?.pins);
  if (!pins.length) return '';
  const json = JSON.stringify({ v: SCHEMA_VERSION, pins });
  return Buffer.from(json, 'utf8').toString('base64url');
}

// base64url string -> { v, pins } or null if it isn't valid config.
function decodeConfig(segment) {
  if (!segment || typeof segment !== 'string') return null;
  let json;
  try {
    json = Buffer.from(segment, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const pins = cleanPins(parsed.pins);
  if (!pins.length) return null;
  return { v: SCHEMA_VERSION, pins };
}

// Convenience for handlers: a Set of pinned TopicIds from whatever `args.config` is.
// `args.config` may be our decoded object, the SDK's parsed JSON, or {}/false.
function pinsOf(config) {
  return new Set(cleanPins(config && config.pins));
}

module.exports = { SCHEMA_VERSION, encodeConfig, decodeConfig, pinsOf, cleanPins };

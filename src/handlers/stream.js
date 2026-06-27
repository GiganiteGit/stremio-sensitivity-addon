// Stream handler — the workhorse (plan §2). Fires on ANY tt title regardless of
// which addon surfaced it. Returns a single NON-playable entry whose text carries
// the trigger summary and whose externalUrl opens the DTDD page. Live DTDD lookups
// are cached (src/lib/cache) to stay polite.
'use strict';

const { resolveTriggers, baseId } = require('../lib/resolve');
const { presentTriggers, orderByPins } = require('../lib/triggers');
const { pageUrl, DTDD_BASE } = require('../lib/dtdd');
const { pinsOf } = require('../lib/config');
const cache = require('../lib/cache');

const DAY = 24 * 3600 * 1000;
const POSITIVE_TTL = 7 * DAY; // warnings rarely change
const NEGATIVE_TTL = 1 * DAY; // retry no-match / dead titles occasionally
const ERROR_TTL = 10 * 60 * 1000;

const searchUrl = (name) => `${DTDD_BASE}/dddsearch?q=${encodeURIComponent(name || '')}`;

// Resolve to a minimal cacheable payload.
function lookup(type, id) {
  const ttId = baseId(id);
  return cache.through(
    `${type}:${ttId}`,
    async () => {
      try {
        const r = await resolveTriggers(type, ttId);
        if (!r.match) return { state: 'nomatch', name: r.meta?.name ?? ttId };
        return { state: 'ok', name: r.meta.name, dtddId: r.dtddId, triggers: presentTriggers(r.stats) };
      } catch (e) {
        return { state: 'error', message: e.message };
      }
    },
    (v) => (v.state === 'ok' ? POSITIVE_TTL : v.state === 'nomatch' ? NEGATIVE_TTL : ERROR_TTL),
  );
}

function streamHandler(args) {
  const { type, id, config } = args;
  const pins = pinsOf(config);
  return lookup(type, id).then((data) => {
    if (data.state === 'error') {
      return {
        streams: [{
          name: '⚠ Sensitivity Notes',
          description: 'Could not reach DoesTheDogDie right now — tap to open the site.',
          externalUrl: DTDD_BASE,
        }],
        cacheMaxAge: ERROR_TTL / 1000,
      };
    }
    if (data.state === 'nomatch') {
      return {
        streams: [{
          name: '⚠ Sensitivity Notes',
          description: `No DoesTheDogDie match for "${data.name}" — tap to search DTDD.`,
          externalUrl: searchUrl(data.name),
        }],
        cacheMaxAge: NEGATIVE_TTL / 1000,
      };
    }

    const triggers = data.triggers || [];
    const { pinned, ordered } = orderByPins(triggers, pins);
    const seriesNote = type === 'series' ? ' [show-level: all seasons combined]' : '';
    const fmt = (t) => `${pins.has(t.topicId) ? '★ ' : ''}${t.name} (${t.yes}/${t.no})`;
    const top = ordered.slice(0, 6).map(fmt).join(', ');
    const description = triggers.length
      ? `${top}${triggers.length > 6 ? `, +${triggers.length - 6} more` : ''} — tap to open DoesTheDogDie.${seriesNote}`
      : `No community-flagged triggers — tap to open DoesTheDogDie.${seriesNote}`;

    const flagsPart = triggers.length
      ? ` · ${pinned.length ? `${pinned.length} pinned, ` : ''}${triggers.length} flags`
      : '';
    return {
      streams: [{
        name: `⚠ Sensitivity Notes${flagsPart}`,
        description,
        externalUrl: pageUrl(data.dtddId),
      }],
      cacheMaxAge: POSITIVE_TTL / 1000,
    };
  });
}

module.exports = streamHandler;

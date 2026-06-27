// Stream handler — the workhorse (plan §2). Fires on ANY tt title regardless of
// which addon surfaced it. Returns a single NON-playable entry whose text carries
// the trigger summary and whose externalUrl opens the DTDD page. Live DTDD lookups
// are layered-cached (src/lib/lookup: memory + durable Supabase) to stay polite.
'use strict';

const { orderByPins } = require('../lib/triggers');
const { pageUrl, DTDD_BASE } = require('../lib/dtdd');
const { pinsOf } = require('../lib/config');
const { lookup, TTL } = require('../lib/lookup');

const searchUrl = (name) => `${DTDD_BASE}/dddsearch?q=${encodeURIComponent(name || '')}`;

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
        cacheMaxAge: TTL.error / 1000,
      };
    }
    if (data.state === 'nomatch') {
      return {
        streams: [{
          name: '⚠ Sensitivity Notes',
          description: `No DoesTheDogDie match for "${data.name}" — tap to search DTDD.`,
          externalUrl: searchUrl(data.name),
        }],
        cacheMaxAge: TTL.nomatch / 1000,
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
      cacheMaxAge: TTL.ok / 1000,
    };
  });
}

module.exports = streamHandler;

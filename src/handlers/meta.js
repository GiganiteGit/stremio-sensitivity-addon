// Meta handler — enriches our OWN catalog items with the full trigger breakdown.
// Returns empty for anything not in our seed so Stremio falls back to the real
// owner (e.g. Cinemeta) for titles opened elsewhere (plan §2).
'use strict';

const seedData = require('../data/seed-data.json');
const { groupedDescription } = require('../lib/triggers');
const { pageUrl, DTDD_BASE } = require('../lib/dtdd');
const { pinsOf } = require('../lib/config');

const byId = new Map(seedData.map((it) => [it.ttId, it]));

function metaHandler(args) {
  const { type, id, config } = args;
  const item = byId.get(id);
  if (!item || item.type !== type) return Promise.resolve({ meta: {} });

  const pins = pinsOf(config);
  const dtddUrl = item.dtddId ? pageUrl(item.dtddId) : DTDD_BASE;
  const meta = {
    id: item.ttId,
    type: item.type,
    name: item.name,
    poster: item.poster || undefined,
    posterShape: 'poster',
    background: item.background || undefined,
    releaseInfo: item.year ? String(item.year) : undefined,
    description: groupedDescription(item.triggers, dtddUrl, pins),
    links: [{ name: 'Open on DoesTheDogDie', category: 'Sensitivity', url: dtddUrl }],
  };
  return Promise.resolve({ meta, cacheMaxAge: 6 * 3600 });
}

module.exports = metaHandler;

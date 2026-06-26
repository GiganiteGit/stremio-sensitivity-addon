// Catalog handler — browsable "Sensitivity-Safe" rows from the precomputed seed.
// Supports search and the single-trigger `genre` exclusion (plan §2).
'use strict';

const seedData = require('../data/seed-data.json');
const { summaryLine } = require('../lib/triggers');
const { excludedTopicIds } = require('../lib/topics');

function toPreview(item) {
  return {
    id: item.ttId,
    type: item.type,
    name: item.name,
    poster: item.poster || undefined,
    posterShape: 'poster',
    releaseInfo: item.year ? String(item.year) : undefined,
    description: summaryLine(item.triggers),
  };
}

function catalogHandler(args) {
  const { type, extra = {} } = args;
  let items = seedData.filter((it) => it.type === type && it.matched);

  if (extra.search) {
    const q = extra.search.toLowerCase();
    items = items.filter((it) => (it.name || '').toLowerCase().includes(q));
  }

  if (extra.genre) {
    const excluded = excludedTopicIds(extra.genre);
    if (excluded) {
      items = items.filter((it) => !(it.triggers || []).some((t) => excluded.has(t.topicId)));
    }
  }

  const skip = Number(extra.skip) || 0;
  const page = items.slice(skip, skip + 100);

  // Warnings rarely change; cache for 6h.
  return Promise.resolve({ metas: page.map(toPreview), cacheMaxAge: 6 * 3600 });
}

module.exports = catalogHandler;

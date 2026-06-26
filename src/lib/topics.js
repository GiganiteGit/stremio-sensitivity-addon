// Canonical topic table (built in Phase 0) + the catalog genre-filter mapping.
// Stremio's `genre` extra is single-select, so each option excludes ONE trigger set
// (plan §2). The full pinned-trigger config arrives in Phase 3.
'use strict';

const topics = require('../../topics.json');

const byId = new Map(topics.map((t) => [t.topicId, t]));

// Filter label -> predicate over a topic. Grounded in the real categories/names.
const GENRE_FILTERS = {
  'No animal death': (t) => t.category === 'Animal Death',
  'No sexual violence': (t) => t.category === 'Sexual Assault',
  'No suicide': (t) => /suicide/i.test(t.name),
  'No flashing lights': (t) => /flash/i.test(t.name),
};

const GENRE_OPTIONS = Object.keys(GENRE_FILTERS);

// Set of topicIds a given genre option excludes, or null if the option is unknown.
function excludedTopicIds(genreOption) {
  const pred = GENRE_FILTERS[genreOption];
  if (!pred) return null;
  return new Set(topics.filter(pred).map((t) => t.topicId));
}

module.exports = { topics, byId, GENRE_FILTERS, GENRE_OPTIONS, excludedTopicIds };

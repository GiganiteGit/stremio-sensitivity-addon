// Addon manifest (plan §6). Phase 1 = catalog + meta; stream label lands in Phase 2.
// Central DTDD key, so the addon works on install with no config.
'use strict';

const { GENRE_OPTIONS } = require('./lib/topics');

const genreExtra = { name: 'genre', isRequired: false, options: GENRE_OPTIONS };
const catalogExtra = [
  { name: 'search', isRequired: false },
  genreExtra,
  { name: 'skip', isRequired: false },
];

module.exports = {
  id: 'community.sensitivity.dtdd',
  version: '0.1.0',
  name: 'Sensitivity Notes',
  description:
    'Crowdsourced content-sensitivity flags from DoesTheDogDie, shown before you press play. ' +
    'Browse the Sensitivity-Safe catalogs and filter out a trigger you want to avoid. ' +
    '(Phase 1: catalog + meta.)',
  logo: 'https://www.doesthedogdie.com/favicon.ico', // placeholder until we host our own
  contactEmail: 'martin.taylor@findmylegacy.co.uk',
  behaviorHints: { configurable: false, configurationRequired: false, adult: false, p2p: false },
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  resources: ['catalog', 'meta'],
  catalogs: [
    { type: 'movie', id: 'dtdd-safe-movies', name: 'Sensitivity-Safe Movies', extra: catalogExtra },
    { type: 'series', id: 'dtdd-safe-series', name: 'Sensitivity-Safe Series', extra: catalogExtra },
  ],
};

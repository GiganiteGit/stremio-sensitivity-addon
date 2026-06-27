// Addon manifest (plan §6). Catalog + meta + stream are live; Phase 3 adds the
// pin-your-triggers config flow. Central DTDD key, so the addon still installs
// and works with no config — config only personalises which triggers are pinned.
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
    'Browse the Sensitivity-Safe catalogs and filter out a trigger you want to avoid, or ' +
    'open any title to see its trigger summary in the Sources list and tap through to DTDD. ' +
    'Note: that summary entry is a label, not a playable stream.',
  logo: 'https://www.doesthedogdie.com/favicon.ico', // placeholder until we host our own
  contactEmail: 'martin.taylor@findmylegacy.co.uk',
  behaviorHints: { configurable: true, configurationRequired: false, adult: false, p2p: false },
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  resources: ['catalog', 'meta', 'stream'],
  // A single declared field is enough for the SDK to activate the `/:config?`
  // install-URL segment. The real picker is our own configure page; the pinned
  // TopicIds travel as base64url JSON, decoded server-side (see src/lib/config).
  config: [{ key: 'pins', type: 'text', title: 'Pinned triggers (set via the configure page)' }],
  catalogs: [
    { type: 'movie', id: 'dtdd-safe-movies', name: 'Sensitivity-Safe Movies', extra: catalogExtra },
    { type: 'series', id: 'dtdd-safe-series', name: 'Sensitivity-Safe Series', extra: catalogExtra },
  ],
};

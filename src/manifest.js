// Addon manifest (plan §6). Catalog + meta + stream are live; Phase 3 adds the
// pin-your-triggers config flow. Central DTDD key, so the addon still installs
// and works with no config — config only personalises which triggers are pinned.
'use strict';

const { GENRE_OPTIONS } = require('./lib/topics');

// Where our logo/background assets are served from. Set ADDON_BASE_URL at deploy
// (e.g. https://sensitivity.example.com); defaults to the local dev server.
const BASE = (process.env.ADDON_BASE_URL || `http://127.0.0.1:${process.env.PORT || 7000}`)
  .replace(/\/+$/, '');

const genreExtra = { name: 'genre', isRequired: false, options: GENRE_OPTIONS };
const catalogExtra = [
  { name: 'search', isRequired: false },
  genreExtra,
  { name: 'skip', isRequired: false },
];

module.exports = {
  id: 'community.sensitivity.dtdd',
  version: '0.1.0',
  // Developer ownership proof issued by stremio-addons.net — lets the listing
  // verify this manifest is served by the registered author.
  stremioAddonsConfig: {
    issuer: 'https://stremio-addons.net',
    signature:
      'eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..iLAFZBcFN6yq57VaA5BFUg.8hNh_dn-IUGdklwMyCHw2_C_RuVsSW7LRARygcuMumaO7L3QUBpf-bErtA8E4zokLECR03laF-r2ByBk1_VhpBlmh6C9poOMyZwq5dAo0SPNaak_A3kqGKIrY6X91f04.WCYht9Bt77mYby2NnH3VlA',
  },
  name: 'Sensitivity Notes',
  description:
    'Crowdsourced content-sensitivity flags from DoesTheDogDie, shown before you press play. ' +
    'Open any title to see its trigger summary in the Sources list and tap through to DTDD, ' +
    'or browse the Sensitivity-Safe catalogs and filter out a trigger you want to avoid. ' +
    'Two honest notes: that summary entry is a label, not a playable stream (it sits among ' +
    'your real sources), and series flags are show-level, not per-episode.',
  logo: `${BASE}/logo.png`,
  background: `${BASE}/background.png`,
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

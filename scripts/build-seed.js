// Precompute the Phase 1 catalog dataset (one polite batch of DTDD calls).
// Run:  node --env-file=.env.local scripts/build-seed.js
'use strict';

const { writeFileSync } = require('node:fs');
const path = require('node:path');
const seed = require('../src/data/seed');
const { resolveTriggers } = require('../src/lib/resolve');
const { presentTriggers } = require('../src/lib/triggers');

const OUT = path.join(__dirname, '..', 'src', 'data', 'seed-data.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!process.env.DTDD_API_KEY) {
    console.error('DTDD_API_KEY missing — run with: node --env-file=.env.local scripts/build-seed.js');
    process.exit(1);
  }
  const out = [];
  for (const { ttId, type } of seed) {
    try {
      const r = await resolveTriggers(type, ttId);
      const triggers = presentTriggers(r.stats);
      out.push({
        ttId,
        type,
        name: r.meta.name,
        year: r.meta.year ?? null,
        poster: r.meta.poster ?? null,
        background: r.meta.background ?? null,
        dtddId: r.dtddId ?? null,
        matched: !!r.match,
        triggers,
      });
      console.log(`ok  ${ttId} ${type.padEnd(6)} "${r.meta.name}"  ${triggers.length} triggers  via ${r.match ? r.match.how : 'NO MATCH'}`);
    } catch (e) {
      console.log(`ERR ${ttId} ${type}  ${e.message}`);
      out.push({ ttId, type, name: ttId, year: null, poster: null, background: null, dtddId: null, matched: false, triggers: [], error: e.message });
    }
    await sleep(600); // politeness
  }
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  const matched = out.filter((x) => x.matched).length;
  console.log(`\nwrote seed-data.json: ${out.length} titles (${matched} matched)`);
})();

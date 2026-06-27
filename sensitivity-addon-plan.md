# Sensitivity Notes — Stremio Addon Build Plan

> Handoff brief for Claude Code. Save this in the repo root; it can seed `CLAUDE.md`.
> Author of the design decisions below: prior planning session. Don't re-litigate the
> constraints in §2 — they're protocol facts, not preferences.

---

## 1. What we're building (and why)

A Stremio addon that surfaces **crowdsourced content-sensitivity flags** (animal death,
sexual violence, suicide, flashing lights for photosensitive epilepsy, ~200 more) from
**DoesTheDogDie.com (DTDD)**, shown *before* the user presses play. The user pins the
triggers that matter to them once, at install, and every title they browse through this
addon is pre-flagged.

**Why this idea, and not the obvious ones:** the Stremio ecosystem is saturated on stream
scraping, catalog mirroring, and AI natural-language discovery (all have mature, free
incumbents). Sensitivity data is *orthogonal* to all of it — no addon does it. The audience
is real and underserved: trauma-recovery viewers, parents, and the accessibility case
(photosensitive epilepsy is a safety feature). Data already exists in queryable form.

---

## 2. Protocol constraints — READ BEFORE WRITING CODE

A Stremio addon is a **stateless HTTP service returning JSON** for four resource types
(`catalog`, `meta`, `stream`, `subtitles`). Its only user-facing surface is a config form
at install time. It has **no** multi-user sessions, group links, notifications, polls,
in-player buttons, or scheduling. Do not design around any of those.

The three resources we use do **three different jobs**, and only one gives universal coverage:

- **`stream` — the workhorse (deliberate hack).** The only resource that reliably fires on
  *any* title regardless of which addon the user found it through. We return a single
  **non-playable** entry whose `name`/`description` carries the trigger summary and whose
  `externalUrl` opens the DTDD page. Tradeoff to accept: a Stremio "stream" must do something
  when tapped, so it can't be a pure passive label (tap → browser), and it sits in the Sources
  list alongside real streams. Surface this honestly in the addon description.

- **`meta` — NOT a global override.** Stremio resolves a title's metadata from the addon that
  *owns* the catalog it came from. Our meta handler enriches items found through **our own**
  catalogs; it will generally **not** render the detail page for a title opened from Cinemeta.
  Treat meta as "make my own catalog items rich," never "rewrite every description on the platform."

- **`catalog` — the clean, fully-working win.** Our own browsable rows where warnings live in
  the description and filtering genuinely works, because we control the list. Note: Stremio's
  `genre` extra is a single-select, so it expresses "exclude *one* trigger," not a set. The full
  pinned-trigger set lives in the config page, encoded into the install URL.

---

## 3. Data source: DoesTheDogDie API

**Auth:** header `X-API-KEY: <key>`. Request a key from DTDD (email on their site).

**Known endpoints (confirm shapes in Phase 0 before building on them):**

- `GET /dddsearch?q=<title>` → `{ items: [ { id, name, releaseYear, tmdbId, imdbId, ... } ] }`
  - `id` is DTDD's **internal** id. `imdbId`/`tmdbId` are sometimes `null`.
- `GET /media/<dtddId>` → `{ item: {...}, topicItemStats: [ { TopicId, yesSum, noSum, voteSum, comment, ... } ] }`
  - A trigger reads as "present" when the community vote is net-yes (`voteSum > 0`, or `yesSum > noSum`).

**Resolution flow (Stremio gives us an IMDb id, DTDD searches by title):**

1. Input id e.g. `tt1375666` (movie) or `tt0944947:1:5` (series episode). **Strip to base `tt` id**
   — DTDD is title-level, not episode-level (see §5 series note).
2. Resolve title + year from **Cinemeta** (no API key needed):
   `GET https://v3-cinemeta.strem.io/meta/<type>/<ttId>.json` → `meta.name`, `meta.year`.
3. `GET /dddsearch?q=<name>`; from results, **match on `imdbId` first**; fall back to
   `tmdbId` if available, else fuzzy-match on name + year and take the best candidate.
   This step is imperfect by nature — log misses, don't pretend they don't happen.
4. `GET /media/<dtddId>` → map `topicItemStats` through a **TopicId → trigger-name/category** table.

**UNKNOWN — first investigation task:** the endpoint (or canonical list) mapping `TopicId` → trigger
name. Confirm whether DTDD exposes a topics list endpoint; if not, build and hardcode a
`topics.json` (TopicId → { name, category }) from their published trigger set. Do not invent
endpoint names — verify against live responses in Phase 0.

**Politeness / ethics (non-negotiable):** DTDD is a small, hobby-scale, single-server site.
Cache aggressively (§4), keep concurrency low, identify the addon in a User-Agent, and email
them about the integration. We are a guest on their data.

---

## 4. Tech stack, caching, deployment

- **Runtime:** Node + `stremio-addon-sdk` (already being installed). Use `addonBuilder`,
  `defineCatalogHandler`, `defineMetaHandler`, `defineStreamHandler`.
- **Config in URL:** the per-user pinned-trigger config goes in the URL path before
  `/manifest.json` (base64url JSON), the Torrentio/Comet pattern. The pure SDK `serveHTTP`
  model doesn't parse path-encoded config cleanly — **wrap the SDK's `getRouter()` in Express**
  and add middleware that decodes `req.params.config`. Decide this in Phase 3.
- **Cache:** Supabase table `dtdd_cache(imdb_id text primary key, payload jsonb, fetched_at timestamptz)`.
  Cache **negative/no-match** results too (with a shorter TTL) to avoid re-querying dead titles.
  Content warnings rarely change → long TTL (e.g. 30 days) is fine.
- **Deployment decision (flag for Martin):** SDK's `serveHTTP` wants a long-running server
  (Render/Railway/Fly). Martin's existing infra is **Vercel + Supabase**. The addon protocol is
  simple JSON-over-HTTP, so an alternative is hand-rolling the routes as Next.js route handlers on
  Vercel (reuses his stack + deploy muscle memory) and using the SDK only for manifest validation
  and types. **Recommend:** start with SDK + Express on a long-running host for Phase 0–3 speed;
  revisit Vercel/Next port before public launch if he wants it on his existing infra. Don't block
  the build on this.

---

## 5. Series handling

DTDD ratings are **title-level**, not per-episode. For series, return **show-level** flags and
state that limitation plainly in the response text. Strip `:season:episode` from incoming ids.

---

## 6. Manifest (starting point)

```json
{
  "id": "community.sensitivity.dtdd",
  "version": "0.1.0",
  "name": "Sensitivity Notes",
  "description": "Crowdsourced content-sensitivity flags from DoesTheDogDie, shown before you press play. Pin the triggers that matter to you.",
  "logo": "https://your-host/logo.png",
  "background": "https://your-host/bg.jpg",
  "contactEmail": "you@findmylegacy.co.uk",
  "behaviorHints": { "configurable": true, "configurationRequired": false, "adult": false, "p2p": false },
  "types": ["movie", "series"],
  "idPrefixes": ["tt"],
  "resources": [
    { "name": "stream",  "types": ["movie", "series"], "idPrefixes": ["tt"] },
    { "name": "meta",    "types": ["movie", "series"], "idPrefixes": ["tt"] },
    { "name": "catalog", "types": ["movie", "series"] }
  ],
  "catalogs": [
    { "type": "movie",  "id": "dtdd-safe-movies", "name": "Sensitivity-Safe Movies",
      "extra": [ { "name": "search" }, { "name": "genre", "isRequired": false,
        "options": ["No animal death", "No sexual violence", "No suicide", "No flashing lights"] }, { "name": "skip" } ] },
    { "type": "series", "id": "dtdd-safe-series", "name": "Sensitivity-Safe Series",
      "extra": [ { "name": "search" }, { "name": "genre", "isRequired": false,
        "options": ["No animal death", "No sexual violence", "No suicide", "No flashing lights"] }, { "name": "skip" } ] }
  ]
}
```

`configurationRequired: false` assumes we host the DTDD key centrally and default to showing all
triggers, so it works on install; config only personalises. If we go bring-your-own-key, flip the
default and document it.

---

## 7. Suggested file structure

```
/src
  manifest.js          // manifest object + builder
  addon.js             // addonBuilder + handler wiring
  /handlers
    stream.js          // the workhorse label (§2)
    meta.js            // enrich own-catalog items
    catalog.js         // browsable + filtered rows
  /lib
    dtdd.js            // DTDD client: search, media, X-API-KEY, retries
    resolve.js         // ttId -> Cinemeta title/year -> DTDD match
    cache.js           // Supabase get/set, negative caching, TTL
    config.js          // base64url encode/decode of pinned triggers
    topics.js          // TopicId -> { name, category } map
  /config-ui
    configure.html     // pin-your-triggers form -> builds install URL
server.js              // Express + getRouter() + config middleware
topics.json            // confirmed/curated trigger table
.env.example           // DTDD_API_KEY, SUPABASE_URL, SUPABASE_KEY
```

---

## 8. Phased plan

**Phase 0 — DTDD spike (do this first, no Stremio code yet).**
Write a throwaway script that, given a `tt` id, runs the full resolve → search → media flow and
prints the trigger list. Validate against known cases: `Old Yeller` (animal death = yes), a
flashing-lights title, and a clearly clean title. Confirm the TopicId→name mapping situation and
produce `topics.json`. **Exit criterion:** reliable trigger data for 3 known titles from a `tt` id alone.

**Phase 1 — Catalog (the clean win).** Static-ish browsable rows with warnings in each item's
description. Get the addon installing locally and a row rendering in Stremio. Wire the single-trigger
`genre` filter.

**Phase 2 — Stream label (the workhorse).** Stream handler returns the non-playable summary entry
with `externalUrl` to the DTDD page. This is the feature that works on *any* title — prioritise it
once Phase 1 proves the plumbing.

**Phase 3 — Config flow. ✅ DONE.** `configure.html` (dark themed, searchable, category-grouped,
4 quick-pick chips) builds a base64url install URL → `server.js` (Express wrapping the SDK's
`getRouter()`) middleware decodes the leading segment → handlers respect the pinned set:
stream floats pinned triggers first with ★ and a "N pinned" header, catalog excludes any title
carrying a pinned trigger, meta marks pinned triggers with ★ and floats their category up.
Encoding/validation lives in `src/lib/config.js`; manifest is now `configurable: true`
(`configurationRequired: false`, central key — installs without configuring).

**Phase 4 — Caching + politeness.** Supabase cache layer, negative caching, low concurrency,
User-Agent, retry/backoff. Email DTDD.

**Phase 5 — Polish + deploy.** Logo/background, honest description (state the stream-clutter and
title-level-series caveats), error states for no-match titles, deploy. Decide Vercel-vs-long-running
host (§4). Optionally submit to stremio-addons.net.

---

## 9. First task for Claude Code

Start at **Phase 0**. Do **not** scaffold the manifest or handlers until the DTDD resolve flow is
proven end-to-end against the three test titles and `topics.json` exists. Report back the actual
response shapes (especially the TopicId mapping) before moving to Phase 1 — several later decisions
depend on what that data actually looks like.

---

## 10. Open decisions for Martin

1. **Host DTDD key centrally vs. bring-your-own-key?** (Affects `configurationRequired` and your
   rate exposure to DTDD.)
2. **Long-running host vs. Vercel/Next port?** (§4 — recommend defer to Phase 5.)
3. **Public listing on stremio-addons.net, or keep unlisted/personal?**

---

## 11. MVP definition of done

From a fresh Stremio install of the configured addon: browse the addon's catalog and see
sensitivity warnings in item descriptions; open *any* title and see the sensitivity summary in the
Sources list; tap it and land on the correct DTDD page; pinned triggers are highlighted and
filterable. Cached, polite to DTDD, and honest about its limits in the description.

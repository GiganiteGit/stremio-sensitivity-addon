# Deploying to BeamUp

BeamUp is Stremio's free, community-run PaaS for addons (Dokku under the hood, so a
**persistent process** — our in-memory cache and the 2-request concurrency cap to DTDD
both stay effective). This deploys to the **public** service; ignore the self-hosted
`stremio-beamup` server (that one needs Cherryservers + your own domain).

## Repo readiness (already done)

- `Procfile` → `web: node server.js` so BeamUp runs the addon, not the dormant Next app.
- `package.json`: `heroku-postbuild` no-op (suppresses an unwanted `next build`) and
  `engines.node >= 20` (we rely on global `fetch`).
- `server.js` already honours the injected `PORT`.
- Manifest `logo`/`background` come from `ADDON_BASE_URL` (set it in step 5).

## Prerequisites

- Node 20+, a GitHub account, and your **SSH key added to GitHub** (BeamUp auths via it).
- Everything committed and pushed — BeamUp deploys committed code.

## Steps

1. **Install the CLI:** `npm install -g beamup-cli`
2. **Configure once:** `beamup config`
   - Host: `a.baby-beamup.club`
   - Your GitHub username
3. **Deploy:** from the repo root, run `beamup`
   - First run adds a git remote and deploys. Later updates: `git push beamup master`.
   - Note the **slug** and **URL** it prints. The app lands at roughly
     `https://<slug>.baby-beamup.club`, so the manifest is
     `https://<slug>.baby-beamup.club/manifest.json`.
   - Confirm the slug with `git remote -v` (it's in the beamup remote URL).
4. **Set the env vars** (secrets — never commit these). The addon needs:
   `DTDD_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, and
   `ADDON_BASE_URL=https://<slug>.baby-beamup.club`.
   Two documented ways — **confirm the exact one with `beamup --help` before running**:
   - CLI: `beamup secrets <NAME> <VALUE>` (one per var)
   - Dokku over SSH:
     `ssh dokku@deployer.beamup.dev config:set <slug> DTDD_API_KEY=... SUPABASE_URL=... SUPABASE_KEY=... ADDON_BASE_URL=https://<slug>.baby-beamup.club`
   Values come from your local `.env.local` (the Supabase key is the **anon/public** key).
5. **Redeploy if needed** so the app picks up the env (`git push beamup master`, or `beamup`).
6. **Test:**
   - Open `https://<slug>.baby-beamup.club/manifest.json` and `.../configure` in a browser.
   - Install in Stremio via the manifest URL, or use the configure page's **Install** button.
   - Open a title and confirm the "⚠ Sensitivity Notes" entry appears in Sources.

## To confirm at deploy time (specifics drift between CLI versions)

- Exact secrets command (`beamup secrets` vs `ssh dokku@deployer.beamup.dev config:set`)
  and the precise `<slug>` format — check `beamup --help` and the
  [beamup-cli wiki](https://github.com/Stremio/stremio-beamup-cli/wiki).
- The deployed subdomain/host the CLI reports.

## Optional later

- `Stremio/beamup-deploy-action` deploys on every push via GitHub Actions (needs an
  SSH key in repo secrets) — nice once the manual flow works.
- If you outgrow BeamUp or want a custom domain / dashboard, the code is host-agnostic:
  Render or Railway run `node server.js` unchanged.

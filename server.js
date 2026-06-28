// Local dev / self-host server for the Sensitivity Notes addon (Phase 3).
// Run:  node --env-file=.env.local server.js
//
// We wrap the SDK's getRouter() in Express instead of using serveHTTP, so we can:
//   1. serve our own pin-your-triggers configure page, and
//   2. accept the pinned-trigger config as a clean base64url segment in the
//      install URL (the Torrentio pattern). The SDK router only understands
//      JSON-in-URL, so middleware decodes base64url -> JSON before it runs, and
//      the SDK then hands the pinned set to every handler as `args.config`.
'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const { getRouter } = require('stremio-addon-sdk');
const addonInterface = require('./src/addon');
const { decodeConfig } = require('./src/lib/config');
const { record } = require('./src/lib/analytics');
const topics = require('./topics.json');

const port = Number(process.env.PORT) || 7000;
const app = express();
app.disable('x-powered-by');

const CONFIGURE_HTML = fs.readFileSync(
  path.join(__dirname, 'src/config-ui/configure.html'),
  'utf8',
);

// First path segment values that are real addon routes, never a config blob.
const RESERVED = new Set([
  '', 'manifest.json', 'catalog', 'meta', 'stream', 'configure', 'api', 'favicon.ico',
]);

// Usage analytics (privacy-preserving). Runs first so it sees the raw config
// segment and catches /configure before serveConfigure ends the response. Only
// the meaningful kinds are logged; static assets, /api/topics and / are ignored.
app.use((req, _res, next) => {
  try {
    const pathname = req.url.split('?')[0];
    const seg = pathname.split('/')[1];
    const hasConfig = !!(seg && !RESERVED.has(seg) && decodeConfig(seg));
    let kind;
    if (pathname.endsWith('/manifest.json')) kind = 'manifest';
    else if (pathname.includes('/stream/')) kind = 'stream';
    else if (pathname.includes('/catalog/')) kind = 'catalog';
    else if (pathname.includes('/meta/')) kind = 'meta';
    else if (pathname === '/configure' || /^\/[^/]+\/configure$/.test(pathname)) kind = 'configure';
    if (kind) record(kind, req, hasConfig);
  } catch {
    /* analytics must never break a request */
  }
  next();
});

// Configure page — served both bare and with an existing config to edit.
// The page reads its own config out of the URL client-side to pre-tick boxes.
function serveConfigure(_req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(CONFIGURE_HTML);
}
app.get('/configure', serveConfigure);
app.get('/:config/configure', serveConfigure);

// Topic table for the configure page (it groups by category client-side).
app.get('/api/topics', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.json(topics);
});

// Install-button beacon (navigator.sendBeacon) — the funnel-completion signal,
// since the stremio:// hand-off itself isn't observable server-side. ?c=1 means
// the user had pinned at least one trigger.
app.post('/api/installed', (req, res) => {
  record('install', req, req.query.c === '1');
  res.status(204).end();
});

// Static assets (logo.png, background.png, …). Only serves files that exist,
// so it never shadows /manifest.json or the resource routes below.
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));

// Translate a leading base64url config segment into the JSON-in-URL form the
// SDK router expects, so handlers receive the decoded pins as `args.config`.
app.use((req, _res, next) => {
  const [pathname, query] = req.url.split('?');
  const parts = pathname.split('/'); // ['', seg1, ...]
  const seg = parts[1];
  if (seg && !RESERVED.has(seg)) {
    const cfg = decodeConfig(seg);
    if (cfg) {
      parts[1] = encodeURIComponent(JSON.stringify(cfg));
      req.url = parts.join('/') + (query ? `?${query}` : '');
    }
  }
  next();
});

// Keep the manifest fresh at the edge. It changes rarely, but when it does
// (version bump, new assets, ADDON_BASE_URL) we don't want it stuck behind a
// long CDN cache — BeamUp/Cloudflare otherwise pins it for hours.
app.use((req, res, next) => {
  if (req.url.split('?')[0].endsWith('/manifest.json')) {
    res.setHeader('Cache-Control', 'public, max-age=300');
  }
  next();
});

// The SDK router: serves /manifest.json and the catalog/meta/stream resources.
app.use(getRouter(addonInterface));

app.get('/', (_req, res) => res.redirect('/configure'));
app.use((_req, res) => res.status(404).json({ err: 'not found' }));

app.listen(port, () => {
  const base = `http://127.0.0.1:${port}`;
  console.log(`Sensitivity Notes addon listening on ${base}`);
  console.log(`  Configure:  ${base}/configure`);
  console.log(`  Manifest:   ${base}/manifest.json`);
});

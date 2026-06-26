// Local dev server for the Sensitivity Notes addon.
// Run:  node --env-file=.env.local server.js
'use strict';

const { serveHTTP } = require('stremio-addon-sdk');
const addonInterface = require('./src/addon');

const port = Number(process.env.PORT) || 7000;

serveHTTP(addonInterface, { port });
console.log(`Install URL: http://127.0.0.1:${port}/manifest.json`);

// Wire the manifest + handlers into an addon interface.
'use strict';

const { addonBuilder } = require('stremio-addon-sdk');
const manifest = require('./manifest');
const catalogHandler = require('./handlers/catalog');
const metaHandler = require('./handlers/meta');

const builder = new addonBuilder(manifest);
builder.defineCatalogHandler(catalogHandler);
builder.defineMetaHandler(metaHandler);

module.exports = builder.getInterface();

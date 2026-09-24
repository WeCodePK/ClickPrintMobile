// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { FileStore } = require('metro-cache');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.cacheStores = [
  new FileStore({ root: path.join(__dirname, 'node_modules/.cache/metro') }),
];
module.exports = config;
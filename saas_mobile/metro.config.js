const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web support
config.resolver.sourceExts.push('mjs');

// Add support for web platform
config.resolver.platforms = ['ios', 'android', 'web'];

module.exports = config;

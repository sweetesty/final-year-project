const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .mjs to the source extensions to resolve OpenAI SDK issues
config.resolver.sourceExts.push('mjs');

module.exports = config;

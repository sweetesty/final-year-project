const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add .mjs to the source extensions to resolve OpenAI SDK issues
config.resolver.sourceExts.push('mjs');

// When EXPO_GO=1 (set in package.json start:go script), swap react-native-maps
// for a no-op mock so the bundler doesn't crash on the missing native module.
if (process.env.EXPO_GO === '1') {
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'react-native-maps': path.resolve(__dirname, 'src/mocks/react-native-maps.js'),
  };
}

module.exports = config;

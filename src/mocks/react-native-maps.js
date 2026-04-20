/**
 * Mock for react-native-maps used in Expo Go where the native module isn't linked.
 * Metro swaps this in via metro.config.js extraNodeModules when EXPO_GO=1.
 * In a dev build this file is never loaded — the real package is used instead.
 */
const React = require('react');
const { View, Text, StyleSheet } = require('react-native');

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', gap: 8 },
  text: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  sub:  { color: 'rgba(255,255,255,0.25)', fontSize: 11 },
});

function MockMapView({ style, children, ..._ }) {
  return React.createElement(View, { style: [styles.fill, style] },
    React.createElement(Text, { style: styles.text }, '🗺  Map unavailable in Expo Go'),
    React.createElement(Text, { style: styles.sub  }, 'Run: npx expo run:ios'),
  );
}

const noop = () => null;

MockMapView.Animated = MockMapView;

module.exports = MockMapView;
module.exports.default = MockMapView;
module.exports.Marker          = noop;
module.exports.Polyline        = noop;
module.exports.Circle          = noop;
module.exports.Callout         = noop;
module.exports.Polygon         = noop;
module.exports.Overlay         = noop;
module.exports.Heatmap         = noop;
module.exports.Geojson         = noop;
module.exports.UrlTile         = noop;
module.exports.WMSTile         = noop;
module.exports.LocalTile       = noop;
module.exports.AnimatedRegion  = class AnimatedRegion {};
module.exports.PROVIDER_GOOGLE  = 'google';
module.exports.PROVIDER_DEFAULT = undefined;

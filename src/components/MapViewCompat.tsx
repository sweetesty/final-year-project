import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// react-native-maps requires a native module not present in Expo Go.
// We lazy-require it so the crash is caught at runtime, not at import time.
let _MapView: any = null;
let _Marker: any   = null;
let _Circle: any   = null;
let _Polyline: any = null;
let _Callout: any  = null;
let _Polygon: any  = null;
let PROVIDER_GOOGLE: any  = 'google';
let PROVIDER_DEFAULT: any = undefined;

try {
  const RNMaps = require('react-native-maps');
  _MapView        = RNMaps.default ?? RNMaps.MapView ?? null;
  _Marker         = RNMaps.Marker;
  _Circle         = RNMaps.Circle;
  _Polyline       = RNMaps.Polyline;
  _Callout        = RNMaps.Callout;
  _Polygon        = RNMaps.Polygon;
  PROVIDER_GOOGLE  = RNMaps.PROVIDER_GOOGLE;
  PROVIDER_DEFAULT = RNMaps.PROVIDER_DEFAULT;
} catch (_) {
  // Native module not linked — Expo Go
}

// Shown instead of the map in Expo Go
function MapFallback({ style }: { style?: any }) {
  return (
    <View style={[styles.fallback, style]}>
      <Text style={styles.icon}>🗺</Text>
      <Text style={styles.text}>Map unavailable in Expo Go</Text>
      <Text style={styles.sub}>Run: npx expo run:ios</Text>
    </View>
  );
}

// Proxy component — renders the real MapView or the fallback
function MapView({ style, children, ...props }: any) {
  if (!_MapView) return <MapFallback style={style} />;
  return React.createElement(_MapView, { style, ...props }, children);
}

// Proxy all child components — render nothing in Expo Go (safe no-ops)
const noop = () => null;
export const Marker   = _Marker   ?? noop;
export const Circle   = _Circle   ?? noop;
export const Polyline = _Polyline ?? noop;
export const Callout  = _Callout  ?? noop;
export const Polygon  = _Polygon  ?? noop;
export { PROVIDER_GOOGLE, PROVIDER_DEFAULT };

export default MapView;

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  icon: { fontSize: 40 },
  text: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '600' },
  sub:  { color: 'rgba(255,255,255,0.25)', fontSize: 11, fontFamily: 'monospace' },
});

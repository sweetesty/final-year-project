import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

// react-native-maps requires a native build — not available in Expo Go.
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
let Polyline: any = null;
let PROVIDER_DEFAULT: any = undefined;
let mapsAvailable = false;

try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Circle = maps.Circle;
  Polyline = maps.Polyline;
  PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT;
  mapsAvailable = true;
} catch (_) {
  // Running in Expo Go
}

export { Marker, Circle, Polyline, PROVIDER_DEFAULT, mapsAvailable };

export function MapPlaceholder({ label = 'Map unavailable in Expo Go' }: { label?: string }) {
  return (
    <View style={styles.placeholder}>
      <MaterialIcons name="map" size={40} color="rgba(99,102,241,0.4)" />
      <Text style={styles.text}>{label}</Text>
      <Text style={styles.sub}>Run: npx expo run:ios</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0F172A',
    padding: 24,
  },
  text: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: 'monospace' },
});

export default MapView as typeof import('react-native-maps').default | null;

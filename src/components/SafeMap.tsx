import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';

// --- Safe Map Integration ---
let MapView: any, Marker: any, Circle: any, PROVIDER_DEFAULT: any;
let mapsAvailable = false;

try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Circle = Maps.Circle;
  PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
  mapsAvailable = true;
} catch (e) {
  console.warn('[SafeMap] react-native-maps not available in this environment.');
}

export interface SafeMapProps {
  style?: any;
  initialRegion?: any;
  region?: any;
  onRegionChangeComplete?: (region: any) => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  provider?: any;
  children?: React.ReactNode;
  mapRef?: React.RefObject<any>;
}

const SafeMap: React.FC<SafeMapProps> = ({
  style,
  initialRegion,
  region,
  onRegionChangeComplete,
  showsUserLocation,
  showsMyLocationButton,
  provider,
  children,
  mapRef,
}) => {
  if (!mapsAvailable) {
    return (
      <View style={[styles.fallback, style]}>
        <ActivityIndicator size="small" color="#6366F1" />
        <Text style={styles.fallbackText}>Maps unavailable in Expo Go</Text>
      </View>
    );
  }

  return (
    <MapView
      ref={mapRef}
      style={style}
      provider={provider || PROVIDER_DEFAULT}
      initialRegion={initialRegion}
      region={region}
      onRegionChangeComplete={onRegionChangeComplete}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={showsMyLocationButton}
    >
      {children}
    </MapView>
  );
};

export { Marker, Circle, PROVIDER_DEFAULT };
export default SafeMap;

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#161B22',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  fallbackText: {
    color: '#8B949E',
    fontSize: 12,
    fontWeight: '600',
  },
});

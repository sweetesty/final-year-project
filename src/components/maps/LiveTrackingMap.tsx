import React from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export interface LiveTrackingMapProps {
  location: any;
  safeZoneCenter: any;
  SAFE_ZONE_RADIUS: number;
  patientName: string;
  isSelf: boolean;
  sosActive: boolean;
  themeColors: any;
  onMapReady?: () => void;
}

const LiveTrackingMap = React.forwardRef<any, LiveTrackingMapProps>((props, ref) => {
  const {
    location,
    safeZoneCenter,
    SAFE_ZONE_RADIUS,
    patientName,
    isSelf,
    sosActive,
    themeColors,
    onMapReady,
  } = props;

  const [mapComponents, setMapComponents] = React.useState<{ MapView: any, Marker: any, Circle: any, PROVIDER_DEFAULT: any } | null>(null);

  React.useEffect(() => {
    try {
      const Maps = require('react-native-maps');
      setMapComponents({
        MapView: Maps.default,
        Marker: Maps.Marker,
        Circle: Maps.Circle,
        PROVIDER_DEFAULT: Maps.PROVIDER_DEFAULT
      });
    } catch (e) {
      console.warn('[LiveTrackingMap] Maps unavailable.');
    }
  }, []);

  if (!mapComponents?.MapView) {
    return (
      <View style={styles.fallback}>
        <ActivityIndicator size="small" color="#6366F1" />
        <Text style={styles.fallbackText}>Map unavailable</Text>
      </View>
    );
  }

  return (
    <mapComponents.MapView
      ref={ref}
      provider={mapComponents.PROVIDER_DEFAULT}
      style={StyleSheet.absoluteFill}
      initialRegion={{ ...location, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
      showsUserLocation={isSelf}
      showsMyLocationButton={false}
      onMapReady={onMapReady}
    >
      {/* Safe zone circle */}
      {safeZoneCenter && mapComponents.Circle && (
        <>
          <mapComponents.Circle
            center={safeZoneCenter}
            radius={SAFE_ZONE_RADIUS}
            strokeColor="rgba(99,102,241,0.6)"
            fillColor="rgba(99,102,241,0.08)"
            strokeWidth={2}
          />
          <mapComponents.Marker coordinate={safeZoneCenter} title="Safe Zone" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.homeMarker}>
              <MaterialIcons name="home" size={18} color="#6366F1" />
            </View>
          </mapComponents.Marker>
        </>
      )}

      {/* Patient marker */}
      {location && mapComponents.Marker && (
        <mapComponents.Marker coordinate={location} title={patientName} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.markerOuter, { borderColor: sosActive ? '#EF4444' : themeColors.tint }]}>
            <View style={[styles.markerInner, { backgroundColor: sosActive ? '#EF4444' : themeColors.tint }]} />
          </View>
        </mapComponents.Marker>
      )}
    </mapComponents.MapView>
  );
});

export default LiveTrackingMap;

const styles = StyleSheet.create({
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  fallbackText: { color: '#94A3B8', fontSize: 12 },
  markerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  markerInner: { width: 10, height: 10, borderRadius: 5 },
  homeMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
    borderColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

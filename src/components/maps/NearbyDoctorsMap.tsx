import React from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const NearbyDoctorsMap = React.forwardRef<any, NearbyDoctorsMapProps>((props, ref) => {
  const {
    myLocation,
    doctors,
    setSelectedDoctor,
    isOnline,
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
      console.warn('[NearbyDoctorsMap] Maps unavailable.');
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
      style={StyleSheet.absoluteFill}
      provider={mapComponents.PROVIDER_DEFAULT}
      showsUserLocation
      showsMyLocationButton={false}
      onMapReady={props.onMapReady}
      initialRegion={
        myLocation
          ? { ...myLocation, latitudeDelta: 0.08, longitudeDelta: 0.08 }
          : { latitude: 9.0765, longitude: 7.3986, latitudeDelta: 0.5, longitudeDelta: 0.5 }
      }
    >
      {/* 25km search radius */}
      {myLocation && mapComponents.Circle && (
        <mapComponents.Circle
          center={myLocation}
          radius={25000}
          strokeColor="rgba(99,102,241,0.4)"
          fillColor="rgba(99,102,241,0.06)"
          strokeWidth={1.5}
        />
      )}

      {/* Doctor markers */}
      {doctors.map(doc => (
        <mapComponents.Marker
          key={doc.id}
          coordinate={{ latitude: doc.latitude, longitude: doc.longitude }}
          onPress={() => setSelectedDoctor?.(doc)}
        >
          <View style={[styles.doctorMarker, { borderColor: isOnline(doc.last_seen) ? '#10B981' : '#94A3B8' }]}>
            <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.doctorMarkerInner}>
              <MaterialIcons name="medical-services" size={16} color="#fff" />
            </LinearGradient>
            <View style={[styles.markerOnlineDot, { backgroundColor: isOnline(doc.last_seen) ? '#10B981' : '#94A3B8' }]} />
          </View>
        </mapComponents.Marker>
      ))}
    </mapComponents.MapView>
  );
});

export interface NearbyDoctorsMapProps {
  myLocation: any;
  doctors: any[];
  setSelectedDoctor?: (doc: any) => void;
  isOnline: (lastSeen: string | null) => boolean;
  onMapReady?: () => void;
}

export default NearbyDoctorsMap;

const styles = StyleSheet.create({
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  fallbackText: { color: '#94A3B8', fontSize: 12 },
  doctorMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doctorMarkerInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
});

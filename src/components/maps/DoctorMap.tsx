import React from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export interface DoctorMapProps {
  myLocation: any;
  mapDoctors: any[];
  selectedMarker: any;
  focusDoctor: (doc: any) => void;
  isOnline: (lastSeen: string | null) => boolean;
  onMapReady?: () => void;
}

const DoctorMap = React.forwardRef<any, DoctorMapProps>((props, ref) => {
  const {
    myLocation,
    mapDoctors,
    selectedMarker,
    focusDoctor,
    isOnline,
  } = props;

  const [mapComponents, setMapComponents] = React.useState<{ MapView: any, Marker: any, PROVIDER_DEFAULT: any } | null>(null);

  React.useEffect(() => {
    try {
      const Maps = require('react-native-maps');
      setMapComponents({
        MapView: Maps.default,
        Marker: Maps.Marker,
        PROVIDER_DEFAULT: Maps.PROVIDER_DEFAULT
      });
    } catch (e) {
      console.warn('[DoctorMap] Maps unavailable.');
    }
  }, []);

  if (!mapComponents?.MapView) {
    return (
      <View style={styles.fallback}>
        <ActivityIndicator size="small" color="#6366F1" />
        <Text style={styles.fallbackText}>Map unavailable in Expo Go</Text>
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
          ? { ...myLocation, latitudeDelta: 0.12, longitudeDelta: 0.12 }
          : { latitude: 9.0765, longitude: 7.3986, latitudeDelta: 0.5, longitudeDelta: 0.5 }
      }
    >
      {mapDoctors.map((doc: any) => (
        <mapComponents.Marker
          key={doc.id}
          coordinate={{ latitude: doc.latitude, longitude: doc.longitude }}
          onPress={() => focusDoctor(doc)}
        >
          <View style={[
            styles.mapMarker,
            selectedMarker?.id === doc.id && styles.mapMarkerSelected,
            { borderColor: isOnline(doc.last_seen) ? '#10B981' : '#94A3B8' },
          ]}>
            <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.mapMarkerInner}>
              <MaterialIcons name="medical-services" size={14} color="#fff" />
            </LinearGradient>
            {isOnline(doc.last_seen) && <View style={styles.markerOnlineDot} />}
          </View>
        </mapComponents.Marker>
      ))}
    </mapComponents.MapView>
  );
});

export default DoctorMap;

const styles = StyleSheet.create({
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  fallbackText: { color: '#94A3B8', fontSize: 12 },
  mapMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapMarkerSelected: {
    transform: [{ scale: 1.2 }],
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  mapMarkerInner: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
  },
});

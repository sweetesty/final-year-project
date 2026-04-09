import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Stack } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/src/services/SupabaseService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

const { width, height } = Dimensions.get('window');

export default function LiveTrackingScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const { session } = useAuthViewModel();
  const patientId = session?.user?.id ?? '';
  const patientName = session?.user?.user_metadata?.full_name ?? 'Patient';

  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) return;

    // 1. Fetch initial history
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('patient_locations')
        .select('*')
        .eq('patientId', patientId)
        .order('timestamp', { ascending: false })
        .limit(20);

      if (data) setLocations(data.reverse());
      setLoading(false);
    };

    fetchHistory();

    // 2. Subscribe to real-time updates
    const channel = supabase
      .channel(`patient-location-updates-${patientId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'patient_locations',
        filter: `patientId=eq.${patientId}`
      }, (payload) => {
        setLocations(prev => [...prev, payload.new].slice(-20));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const latest = locations[locations.length - 1];

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.tint} />
        <Text style={{ marginTop: 10, color: themeColors.muted }}>Connecting to GPS sync...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Live Location Tracking', headerShown: true }} />
      
      {latest ? (
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: latest.latitude,
            longitude: latest.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          region={{
            latitude: latest.latitude,
            longitude: latest.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
        >
          <Polyline
            coordinates={locations.map(l => ({ latitude: l.latitude, longitude: l.longitude }))}
            strokeColor={themeColors.tint}
            strokeWidth={4}
          />
          <Marker
            coordinate={{ latitude: latest.latitude, longitude: latest.longitude }}
            title="Patient Current Location"
            description={`Accuracy: ${Math.round(latest.accuracy)}m`}
          >
            <View style={[styles.pulseContainer, { backgroundColor: themeColors.tint + '30' }]}>
              <View style={[styles.markerCore, { backgroundColor: themeColors.tint }]} />
            </View>
          </Marker>
        </MapView>
      ) : (
        <View style={[styles.centered, { backgroundColor: themeColors.background }]}>
          <Text style={{ color: themeColors.muted }}>No location data available yet.</Text>
        </View>
      )}

      {latest && (
        <View style={[styles.infoCard, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.patientName, { color: themeColors.text }]}>Patient: {patientName}</Text>
          <Text style={{ color: themeColors.muted }}>Last Updated: {new Date(latest.timestamp).toLocaleTimeString()}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: themeColors.vital }]} />
            <Text style={{ color: themeColors.vital, fontWeight: '700' }}>Live Tracking Active</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: width,
    height: height,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.lg,
    right: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    ...Shadows.medium,
    gap: 4,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '800',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pulseContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#fff',
  },
});

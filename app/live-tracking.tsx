import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  ActivityIndicator, Dimensions, Alert, Linking, ScrollView, Vibration,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import { Stack } from 'expo-router';
import * as Location from 'expo-location';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn, useSharedValue, withRepeat, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/src/services/SupabaseService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { NotificationService } from '@/src/services/NotificationService';

const { width, height } = Dimensions.get('window');
const SAFE_ZONE_RADIUS = 500; // metres

// Haversine distance in metres
function distanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function LiveTrackingScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const { session } = useAuthViewModel();
  const patientId = session?.user?.id ?? '';
  const patientName = session?.user?.user_metadata?.full_name ?? 'Patient';

  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [safeZoneCenter, setSafeZoneCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [insideSafeZone, setInsideSafeZone] = useState<boolean | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  // Pulse animation for SOS
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (sosActive) {
      pulse.value = withRepeat(withTiming(1.25, { duration: 600 }), -1, true);
      Vibration.vibrate([0, 300, 200, 300], true);
    } else {
      pulse.value = withTiming(1);
      Vibration.cancel();
    }
  }, [sosActive]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  // Load emergency contacts
  useEffect(() => {
    if (!patientId) return;
    supabase
      .from('emergency_contacts')
      .select('*')
      .eq('patientid', patientId)
      .then(({ data }) => setEmergencyContacts(data ?? []));
  }, [patientId]);

  // Load saved safe zone
  useEffect(() => {
    if (!patientId) return;
    supabase
      .from('profiles')
      .select('safe_zone_lat, safe_zone_lng')
      .eq('id', patientId)
      .single()
      .then(({ data }) => {
        if (data?.safe_zone_lat && data?.safe_zone_lng) {
          setSafeZoneCenter({ latitude: data.safe_zone_lat, longitude: data.safe_zone_lng });
        }
      });
  }, [patientId]);

  // Get current location once on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLoading(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy ?? 0 };
      setLocation(coords);
      setLoading(false);
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 800);
    })();
  }, []);

  // Check safe zone whenever location changes
  useEffect(() => {
    if (location && safeZoneCenter) {
      const dist = distanceM(location.latitude, location.longitude, safeZoneCenter.latitude, safeZoneCenter.longitude);
      const inside = dist <= SAFE_ZONE_RADIUS;
      setInsideSafeZone(inside);
    }
  }, [location, safeZoneCenter]);

  // Start / stop live tracking
  const toggleTracking = useCallback(async () => {
    if (tracking) {
      locationSub.current?.remove();
      locationSub.current = null;
      setTracking(false);
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    setTracking(true);
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 15000 },
      async (loc) => {
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy ?? 0 };
        setLocation(coords);
        mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
        // Push to Supabase
        await supabase.from('patient_locations').insert({
          patientid: patientId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        });
      }
    );
  }, [tracking, patientId]);

  // Set home safe zone at current location
  const setHomeZone = async () => {
    if (!location) return;
    Alert.alert('Set Safe Zone', `Set your current location as your safe zone (${SAFE_ZONE_RADIUS}m radius)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Set', onPress: async () => {
          await supabase.from('profiles').update({
            safe_zone_lat: location.latitude,
            safe_zone_lng: location.longitude,
          }).eq('id', patientId);
          setSafeZoneCenter({ latitude: location.latitude, longitude: location.longitude });
          Alert.alert('Safe Zone Set', 'You will be alerted when you leave this area.');
        },
      },
    ]);
  };

  // SOS — call primary contact + notify all contacts
  const triggerSOS = () => {
    if (sosActive) {
      Alert.alert('Cancel SOS', 'Are you safe? Cancel the SOS alert?', [
        { text: 'No, keep alert', style: 'cancel' },
        { text: "Yes, I'm safe", onPress: () => setSosActive(false) },
      ]);
      return;
    }

    Alert.alert(
      '🆘 SOS Emergency',
      'This will call your primary emergency contact and send alerts to all contacts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'SEND SOS', style: 'destructive', onPress: async () => {
            setSosActive(true);
            const primary = emergencyContacts.find(c => c.isprimary) ?? emergencyContacts[0];
            if (primary?.phone) {
              Linking.openURL(`tel:${primary.phone}`);
            }
            // Schedule local notification as SOS confirmation
            await NotificationService.showLocalNotification(
              '🆘 SOS Sent',
              `Emergency alert sent. ${patientName} needs help.`,
              { type: 'sos', patientId }
            );
          },
        },
      ]
    );
  };

  // Share location via SMS/link
  const shareLocation = () => {
    if (!location) return;
    const url = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
    Linking.openURL(`sms:?body=I am here: ${url}`);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.tint} />
        <Text style={{ marginTop: 12, color: themeColors.muted }}>Getting your location…</Text>
      </View>
    );
  }

  const safeZoneStatus = insideSafeZone === null ? null : insideSafeZone;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Safety & SOS', headerShown: true }} />

      {/* Map */}
      {location ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={{ ...location, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {/* Safe zone circle */}
          {safeZoneCenter && (
            <>
              <Circle
                center={safeZoneCenter}
                radius={SAFE_ZONE_RADIUS}
                strokeColor="rgba(99,102,241,0.6)"
                fillColor="rgba(99,102,241,0.08)"
                strokeWidth={2}
              />
              <Marker coordinate={safeZoneCenter} title="Safe Zone" anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.homeMarker}>
                  <MaterialIcons name="home" size={18} color="#6366F1" />
                </View>
              </Marker>
            </>
          )}

          {/* Patient marker */}
          <Marker coordinate={location} title={patientName} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.markerOuter, { borderColor: sosActive ? '#EF4444' : themeColors.tint }]}>
              <View style={[styles.markerInner, { backgroundColor: sosActive ? '#EF4444' : themeColors.tint }]} />
            </View>
          </Marker>
        </MapView>
      ) : (
        <View style={[styles.centered, styles.map, { backgroundColor: themeColors.background }]}>
          <MaterialIcons name="location-off" size={48} color={themeColors.muted} />
          <Text style={{ color: themeColors.muted, marginTop: 12 }}>Location unavailable</Text>
        </View>
      )}

      {/* Safe zone status bar */}
      {safeZoneStatus !== null && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[
            styles.safeZoneBar,
            { backgroundColor: safeZoneStatus ? 'rgba(16,185,129,0.92)' : 'rgba(239,68,68,0.92)' },
          ]}
        >
          <MaterialIcons name={safeZoneStatus ? 'verified-user' : 'warning'} size={18} color="#fff" />
          <Text style={styles.safeZoneText}>
            {safeZoneStatus ? 'Inside safe zone' : 'Outside safe zone!'}
          </Text>
        </Animated.View>
      )}

      {/* Bottom panel */}
      <ScrollView
        style={[styles.panel, { backgroundColor: themeColors.background }]}
        contentContainerStyle={styles.panelContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SOS button */}
        <View style={styles.sosRow}>
          <Animated.View style={[pulseStyle]}>
            <TouchableOpacity onPress={triggerSOS} activeOpacity={0.85}>
              <LinearGradient
                colors={sosActive ? ['#DC2626', '#991B1B'] : ['#EF4444', '#DC2626']}
                style={styles.sosBtn}
              >
                <MaterialIcons name={sosActive ? 'cancel' : 'sos'} size={36} color="#fff" />
                <Text style={styles.sosBtnText}>{sosActive ? 'CANCEL SOS' : 'SOS'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.sosActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              onPress={toggleTracking}
            >
              <MaterialIcons
                name={tracking ? 'location-off' : 'my-location'}
                size={22}
                color={tracking ? '#EF4444' : themeColors.tint}
              />
              <Text style={[styles.actionBtnText, { color: tracking ? '#EF4444' : themeColors.tint }]}>
                {tracking ? 'Stop' : 'Track'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              onPress={setHomeZone}
            >
              <MaterialIcons name="home" size={22} color="#6366F1" />
              <Text style={[styles.actionBtnText, { color: '#6366F1' }]}>Safe Zone</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              onPress={shareLocation}
            >
              <MaterialIcons name="share-location" size={22} color="#10B981" />
              <Text style={[styles.actionBtnText, { color: '#10B981' }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status info */}
        {location && (
          <Animated.View entering={FadeInDown.duration(400)} style={[styles.infoCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                <MaterialIcons name="gps-fixed" size={18} color="#6366F1" />
              </View>
              <View>
                <Text style={[styles.infoLabel, { color: themeColors.muted }]}>Accuracy</Text>
                <Text style={[styles.infoValue, { color: themeColors.text }]}>±{Math.round(location.accuracy)}m</Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: tracking ? 'rgba(16,185,129,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <MaterialIcons name="sensors" size={18} color={tracking ? '#10B981' : themeColors.muted} />
              </View>
              <View>
                <Text style={[styles.infoLabel, { color: themeColors.muted }]}>Live Tracking</Text>
                <Text style={[styles.infoValue, { color: tracking ? '#10B981' : themeColors.muted }]}>
                  {tracking ? 'Active — updating every 15s' : 'Off'}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Emergency contacts quick-call */}
        {emergencyContacts.length > 0 && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Emergency Contacts</Text>
            {emergencyContacts.map((c, i) => (
              <TouchableOpacity
                key={c.id ?? i}
                style={[styles.contactCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
                onPress={() => Linking.openURL(`tel:${c.phone}`)}
              >
                <View style={[styles.contactAvatar, { backgroundColor: c.isprimary ? '#EF444420' : themeColors.tint + '15' }]}>
                  <MaterialIcons name="person" size={20} color={c.isprimary ? '#EF4444' : themeColors.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactName, { color: themeColors.text }]}>{c.name}</Text>
                  <Text style={[styles.contactRel, { color: themeColors.muted }]}>{c.relationship} · {c.phone}</Text>
                </View>
                {c.isprimary && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryText}>PRIMARY</Text>
                  </View>
                )}
                <MaterialIcons name="call" size={22} color="#10B981" />
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { width, height: height * 0.42 },

  safeZoneBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  safeZoneText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  panel: { flex: 1 },
  panelContent: { padding: Spacing.md, gap: Spacing.md },

  sosRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  sosBtn: {
    width: 110, height: 110, borderRadius: 55,
    justifyContent: 'center', alignItems: 'center', gap: 4,
    shadowColor: '#EF4444', shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
  },
  sosBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  sosActions: { flex: 1, gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1,
  },
  actionBtnText: { fontWeight: '700', fontSize: 13 },

  infoCard: {
    borderRadius: 16, borderWidth: 1, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 0,
  },
  infoRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  infoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, fontWeight: '700', marginTop: 1 },
  divider: { width: 1, height: 36, marginHorizontal: 12 },

  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8,
  },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  contactName: { fontSize: 15, fontWeight: '700' },
  contactRel: { fontSize: 12, marginTop: 1 },
  primaryBadge: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, marginRight: 4,
  },
  primaryText: { fontSize: 9, fontWeight: '900', color: '#EF4444', letterSpacing: 0.5 },

  markerOuter: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 3, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#fff',
  },
  markerInner: { width: 10, height: 10, borderRadius: 5 },
  homeMarker: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#EEF2FF', borderWidth: 2, borderColor: '#6366F1',
    justifyContent: 'center', alignItems: 'center',
  },
});

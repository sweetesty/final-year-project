import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert, Platform,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT, MapPlaceholder, mapsAvailable } from '@/src/components/MapViewCompat';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { DoctorService } from '@/src/services/DoctorService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

interface NearbyDoctor {
  id: string;
  full_name: string;
  specialization: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
  last_seen: string | null;
}

const HELP_COOLDOWN_MS = 60_000; // 1 minute

export default function NearbyDoctorsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { session } = useAuthViewModel();
  const mapRef = useRef<any>(null);

  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [doctors, setDoctors] = useState<NearbyDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [helpSent, setHelpSent] = useState(false);
  const [helpCooldown, setHelpCooldown] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<NearbyDoctor | null>(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please enable location to find nearby doctors.');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setMyLocation(coords);

      const nearby = await DoctorService.getNearbyDoctors(coords.latitude, coords.longitude, 25);
      setDoctors(nearby as NearbyDoctor[]);

      // Centre map on user
      mapRef.current?.animateToRegion({
        ...coords,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }, 800);
    } catch (e) {
      console.error('[NearbyDoctors] init error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleHelpSignal = async () => {
    if (!myLocation || !session?.user?.id) return;
    if (helpCooldown) {
      Alert.alert('Signal Already Sent', 'Your help signal was already broadcast. Doctors nearby have been notified.');
      return;
    }

    Alert.alert(
      '🚨 Send Help Signal?',
      'This will immediately alert all nearby doctors and your linked doctor. Use only in an emergency.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Now',
          style: 'destructive',
          onPress: async () => {
            try {
              await DoctorService.sendHelpSignal(
                session.user.id,
                myLocation.latitude,
                myLocation.longitude,
              );
              setHelpSent(true);
              setHelpCooldown(true);
              setTimeout(() => setHelpCooldown(false), HELP_COOLDOWN_MS);
            } catch (e) {
              Alert.alert('Error', 'Could not send help signal. Please call emergency services directly.');
            }
          },
        },
      ]
    );
  };

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
  };

  const formatDistance = (km: number) =>
    km < 1 ? `${Math.round(km * 1000)}m away` : `${km.toFixed(1)}km away`;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: '',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <MaterialIcons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Map */}
      {mapsAvailable && MapView ? (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          showsUserLocation
          showsMyLocationButton={false}
          initialRegion={
            myLocation
              ? { ...myLocation, latitudeDelta: 0.08, longitudeDelta: 0.08 }
              : { latitude: 9.0765, longitude: 7.3986, latitudeDelta: 0.5, longitudeDelta: 0.5 }
          }
        >
          {/* 25km search radius */}
          {myLocation && (
            <Circle
              center={myLocation}
              radius={25000}
              strokeColor="rgba(99,102,241,0.4)"
              fillColor="rgba(99,102,241,0.06)"
              strokeWidth={1.5}
            />
          )}

          {/* Doctor markers */}
          {doctors.map(doc => (
            <Marker
              key={doc.id}
              coordinate={{ latitude: doc.latitude, longitude: doc.longitude }}
              onPress={() => setSelectedDoctor(doc)}
            >
              <View style={[styles.doctorMarker, { borderColor: isOnline(doc.last_seen) ? '#10B981' : '#94A3B8' }]}>
                <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.doctorMarkerInner}>
                  <MaterialIcons name="medical-services" size={16} color="#fff" />
                </LinearGradient>
                <View style={[styles.markerOnlineDot, { backgroundColor: isOnline(doc.last_seen) ? '#10B981' : '#94A3B8' }]} />
              </View>
            </Marker>
          ))}
        </MapView>
      ) : (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }]}>
          <MapPlaceholder label="Map requires a dev build" />
        </View>
      )}

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Finding nearby doctors...</Text>
        </View>
      )}

      {/* Help sent banner */}
      {helpSent && (
        <Animated.View entering={FadeIn} style={styles.helpSentBanner}>
          <MaterialIcons name="check-circle" size={20} color="#10B981" />
          <Text style={styles.helpSentText}>Help signal sent — doctors nearby have been notified</Text>
        </Animated.View>
      )}

      {/* Top stats pill */}
      {!loading && (
        <Animated.View entering={FadeInDown.duration(500)} style={styles.statsPill}>
          <MaterialIcons name="location-on" size={16} color="#6366F1" />
          <Text style={styles.statsPillText}>
            {doctors.length === 0
              ? 'No doctors found within 25km'
              : `${doctors.length} doctor${doctors.length > 1 ? 's' : ''} found nearby`}
          </Text>
        </Animated.View>
      )}

      {/* Selected doctor card */}
      {selectedDoctor && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.selectedCard}>
          <TouchableOpacity style={styles.selectedCardClose} onPress={() => setSelectedDoctor(null)}>
            <MaterialIcons name="close" size={18} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
          <View style={styles.selectedCardRow}>
            <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.selectedAvatar}>
              <Text style={styles.selectedAvatarText}>{selectedDoctor.full_name.charAt(0)}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedName}>{selectedDoctor.full_name}</Text>
              <Text style={styles.selectedSpec}>
                {selectedDoctor.specialization || 'Clinical Specialist'}
              </Text>
              <View style={styles.selectedMeta}>
                <View style={[styles.onlineDot, { backgroundColor: isOnline(selectedDoctor.last_seen) ? '#10B981' : '#94A3B8' }]} />
                <Text style={styles.selectedDistance}>{formatDistance(selectedDoctor.distanceKm)}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.chatWithBtn}
            onPress={() => {
              setSelectedDoctor(null);
              router.push({
                pathname: '/doctor-public-profile',
                params: {
                  id: selectedDoctor.id,
                  full_name: selectedDoctor.full_name,
                  specialization: selectedDoctor.specialization || 'Clinical Specialist'
                }
              });
            }}
          >
            <MaterialIcons name="person-search" size={16} color="#fff" />
            <Text style={styles.chatWithBtnText}>View Clinical Profile</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Bottom panel */}
      {!selectedDoctor && (
        <View style={styles.bottomPanel}>
          {/* Help Signal (Bolt) */}
          <TouchableOpacity
            style={[styles.helpBtn, helpCooldown && styles.helpBtnCooldown]}
            onPress={handleHelpSignal}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={helpCooldown ? ['#374151', '#4B5563'] : ['#DC2626', '#EF4444']}
              style={styles.helpBtnGradient}
            >
              <MaterialIcons name="bolt" size={26} color="#fff" />
              <Text style={styles.helpBtnText}>
                {helpCooldown ? 'Signal Sent' : 'Send Help Signal'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Doctor list */}
          {doctors.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.doctorScroll}
            >
              {doctors.map((doc, i) => (
                <Animated.View key={doc.id} entering={FadeInDown.delay(i * 60).duration(400)}>
                  <TouchableOpacity
                    style={styles.docChip}
                    onPress={() => {
                      setSelectedDoctor(doc);
                      mapRef.current?.animateToRegion({
                        latitude: doc.latitude,
                        longitude: doc.longitude,
                        latitudeDelta: 0.02,
                        longitudeDelta: 0.02,
                      }, 600);
                    }}
                  >
                    <View style={[styles.chipOnlineDot, { backgroundColor: isOnline(doc.last_seen) ? '#10B981' : '#94A3B8' }]} />
                    <View>
                      <Text style={styles.docChipName} numberOfLines={1}>{doc.full_name}</Text>
                      <Text style={styles.docChipDist}>{formatDistance(doc.distanceKm)}</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Recenter button */}
      <TouchableOpacity
        style={styles.recenterBtn}
        onPress={() => {
          if (myLocation) {
            mapRef.current?.animateToRegion({ ...myLocation, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 600);
          }
        }}
      >
        <MaterialIcons name="my-location" size={22} color="#6366F1" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A' },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // Doctor markers
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

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,15,26,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Help sent banner
  helpSentBanner: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  helpSentText: { color: '#10B981', fontWeight: '700', fontSize: 13, flex: 1 },

  // Stats pill
  statsPill: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,15,26,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  statsPillText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Selected doctor card
  selectedCard: {
    position: 'absolute',
    bottom: 180,
    left: 16,
    right: 16,
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
    padding: 16,
    gap: 14,
  },
  selectedCardClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  selectedCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedAvatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  selectedName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  selectedSpec: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  selectedMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  selectedDistance: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  chatWithBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4338CA',
    borderRadius: 12,
    padding: 12,
  },
  chatWithBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Bottom panel
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15,15,26,0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: 16,
    paddingBottom: 30,
    gap: 14,
  },
  helpBtn: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  helpBtnCooldown: { opacity: 0.7 },
  helpBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  helpBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  doctorScroll: { paddingHorizontal: 16, gap: 10 },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipOnlineDot: { width: 8, height: 8, borderRadius: 4 },
  docChipName: { color: '#fff', fontWeight: '700', fontSize: 13 },
  docChipDist: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1 },

  // Recenter
  recenterBtn: {
    position: 'absolute',
    right: 16,
    bottom: 195,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15,15,26,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

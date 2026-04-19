import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, Alert, Dimensions, Platform,
} from 'react-native';

import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, Shadows } from '@/src/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/src/services/SupabaseService';
import { DoctorService } from '@/src/services/DoctorService';

const { width, height } = Dimensions.get('window');

// Simple straight-line "route" between two points (no API key needed)
function buildRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) {
  // Interpolate 10 points for a visual line
  return Array.from({ length: 11 }, (_, i) => ({
    latitude: from.latitude + (to.latitude - from.latitude) * (i / 10),
    longitude: from.longitude + (to.longitude - from.longitude) * (i / 10),
  }));
}

function distanceKm(
  lat1: number, lon1: number, lat2: number, lon2: number
) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

export default function EmergencyCaseScreen() {
  const { patientId, patientName, alertId } = useLocalSearchParams<{
    patientId: string;
    patientName: string;
    alertId: string;
  }>();
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const mapRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [doctorLocation, setDoctorLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [patientLocation, setPatientLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [medicalDetails, setMedicalDetails] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any>(null);
  const [resolving, setResolving] = useState(false);
  const [mapComponents, setMapComponents] = useState<{ MapView: any, Marker: any, Polyline: any, PROVIDER_DEFAULT: any } | null>(null);

  // Safe Map Loader
  useEffect(() => {
    try {
      const Maps = require('react-native-maps');
      setMapComponents({
        MapView: Maps.default,
        Marker: Maps.Marker,
        Polyline: Maps.Polyline,
        PROVIDER_DEFAULT: Maps.PROVIDER_DEFAULT
      });
    } catch (e) {
      console.warn('[EmergencyCase] Maps not available in this environment');
    }
  }, []);

  // Load all patient data
  useEffect(() => {
    if (!patientId) return;
    (async () => {
      setLoading(true);

      // Doctor's own location
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setDoctorLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch (_) {}

      // Patient latest location
      const { data: locData } = await supabase
        .from('patient_locations')
        .select('latitude, longitude')
        .eq('patientid', patientId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();
      if (locData) setPatientLocation({ latitude: locData.latitude, longitude: locData.longitude });

      // Profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', patientId)
        .single();
      setProfile(prof);

      // Medical details
      const { data: med } = await supabase
        .from('medical_details')
        .select('*')
        .eq('patientid', patientId)
        .single();
      setMedicalDetails(med);

      // Medications
      const { data: meds } = await supabase
        .from('medications')
        .select('name, dosage, iscritical, instructions')
        .eq('patientid', patientId);
      setMedications(meds ?? []);

      // Emergency contacts
      const { data: contacts } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('patientid', patientId)
        .order('isprimary', { ascending: false });
      setEmergencyContacts(contacts ?? []);

      // Latest vitals
      const ctx = await DoctorService.getPatientClinicalContext(patientId);
      setVitals(ctx?.latestVital ?? null);

      setLoading(false);
    })();
  }, [patientId]);

  // Fit map to show both markers once data loads
  const [hasCentered, setHasCentered] = useState(false);
  useEffect(() => {
    if (!patientLocation || hasCentered) return;
    const coords = [patientLocation];
    if (doctorLocation) coords.push(doctorLocation);
    
    setHasCentered(true);
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }, 600);
  }, [patientLocation, doctorLocation, hasCentered]);

  const openInMaps = () => {
    if (!patientLocation) return;
    const { latitude, longitude } = patientLocation;
    const url = Platform.OS === 'ios'
      ? `maps:?q=${patientName}&ll=${latitude},${longitude}`
      : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${patientName})`;
    Linking.openURL(url);
  };

  const handleResolve = () => {
    Alert.alert('Mark as Resolved', 'Has this emergency been handled?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Resolved', onPress: async () => {
          setResolving(true);
          if (alertId) {
            await supabase.from('fall_events').update({ 
              resolved: true,
              status: 'resolved',
              resolved_at: new Date().toISOString()
            }).eq('id', alertId);
          }
          setResolving(false);
          router.back();
        },
      },
    ]);
  };

  const route = doctorLocation && patientLocation
    ? buildRoute(doctorLocation, patientLocation)
    : null;

  const dist = doctorLocation && patientLocation
    ? distanceKm(doctorLocation.latitude, doctorLocation.longitude, patientLocation.latitude, patientLocation.longitude)
    : null;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#EF4444" />
        <Text style={{ color: themeColors.muted, marginTop: 12 }}>Loading emergency case…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <LinearGradient colors={['#450a0a', '#7f1d1d', '#991b1b']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity 
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} 
            style={styles.backBtn}
          >
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>ACTIVE EMERGENCY</Text>
            <Text style={styles.headerName}>{patientName}</Text>
          </View>
          <View style={styles.sosChip}>
            <View style={styles.sosDot} />
            <Text style={styles.sosChipText}>LIVE</Text>
          </View>
        </View>

        {/* Quick vitals strip */}
        {vitals && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.vitalsStrip}>
            {[
              { label: 'HR', value: `${vitals.heartrate}`, unit: 'bpm', icon: 'favorite', color: '#FCA5A5' },
              { label: 'SpO₂', value: `${vitals.spo2}`, unit: '%', icon: 'air', color: '#93C5FD' },
              { label: 'Steps', value: `${vitals.steps ?? '--'}`, unit: 'today', icon: 'directions-walk', color: '#86EFAC' },
            ].map(v => (
              <View key={v.label} style={styles.vitalChip}>
                <MaterialIcons name={v.icon as any} size={14} color={v.color} />
                <Text style={[styles.vitalVal, { color: v.color }]}>{v.value}</Text>
                <Text style={styles.vitalUnit}>{v.unit}</Text>
              </View>
            ))}
          </Animated.View>
        )}
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Map ── */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.mapCard}>
              {patientLocation && mapComponents?.MapView ? (
                <mapComponents.MapView
                  ref={mapRef}
                  provider={mapComponents.PROVIDER_DEFAULT}
                  style={styles.map}
                  initialRegion={{
                    ...patientLocation,
                    latitudeDelta: 0.04,
                    longitudeDelta: 0.04,
                  }}
                >
                  {/* Route line */}
                  {route && mapComponents.Polyline && (
                    <mapComponents.Polyline
                      coordinates={route}
                      strokeColor="#EF4444"
                      strokeWidth={3}
                      lineDashPattern={[8, 4]}
                    />
                  )}
    
                  {/* Patient marker */}
                  {mapComponents.Marker && (
                    <mapComponents.Marker coordinate={patientLocation} title={`🆘 ${patientName}`} anchor={{ x: 0.5, y: 0.5 }}>
                      <View style={styles.patientMarker}>
                        <MaterialIcons name="person-pin" size={28} color="#EF4444" />
                      </View>
                    </mapComponents.Marker>
                  )}
    
                  {/* Doctor marker */}
                  {doctorLocation && mapComponents.Marker && (
                    <mapComponents.Marker coordinate={doctorLocation} title="Your Location" anchor={{ x: 0.5, y: 0.5 }}>
                      <View style={styles.doctorMarker}>
                        <MaterialIcons name="local-hospital" size={18} color="#fff" />
                      </View>
                    </mapComponents.Marker>
                  )}
                </mapComponents.MapView>
              ) : (
                <View style={[styles.map, styles.noMap]}>
                  <MaterialIcons name="location-off" size={36} color="#64748B" />
                  <Text style={{ color: '#94A3B8', marginTop: 8 }}>
                    {!mapComponents?.MapView ? 'Map initialization skipped (Native maps missing)' : 'Patient location unavailable'}
                  </Text>
                </View>
              )}

          {/* Distance + nav button overlay */}
          {dist && (
            <View style={styles.mapOverlay}>
              <View style={styles.distBadge}>
                <MaterialIcons name="straighten" size={14} color="#fff" />
                <Text style={styles.distText}>{dist} km away</Text>
              </View>
              <TouchableOpacity style={styles.navBtn} onPress={openInMaps}>
                <MaterialIcons name="navigation" size={16} color="#fff" />
                <Text style={styles.navBtnText}>Navigate</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* ── Patient Info ── */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={[styles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Patient Details</Text>
          {[
            { label: 'Full Name', value: profile?.full_name },
            { label: 'Blood Type', value: medicalDetails?.blood_type },
            { label: 'Age', value: medicalDetails?.age ? `${medicalDetails.age} years` : null },
            { label: 'Allergies', value: medicalDetails?.allergies },
            { label: 'Chronic Conditions', value: medicalDetails?.chronic_conditions },
            { label: 'Primary Doctor', value: medicalDetails?.primary_doctor },
          ].filter(r => r.value).map((row, i) => (
            <View key={i} style={[styles.infoRow, { borderTopColor: themeColors.border }]}>
              <Text style={[styles.infoLabel, { color: themeColors.muted }]}>{row.label}</Text>
              <Text style={[styles.infoValue, { color: themeColors.text }]}>{row.value}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── Medications ── */}
        {medications.length > 0 && (
          <Animated.View entering={FadeInDown.delay(140).duration(400)} style={[styles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Current Medications</Text>
            {medications.map((m, i) => (
              <View key={i} style={[styles.medRow, { borderTopColor: themeColors.border }]}>
                <View style={[styles.medIcon, { backgroundColor: m.iscritical ? '#EF444415' : themeColors.tint + '15' }]}>
                  <MaterialIcons name="medication" size={18} color={m.iscritical ? '#EF4444' : themeColors.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.medName, { color: themeColors.text }]}>
                    {m.name} {m.iscritical && <Text style={{ color: '#EF4444' }}>⚠️ CRITICAL</Text>}
                  </Text>
                  <Text style={[styles.medDose, { color: themeColors.muted }]}>{m.dosage} · {m.instructions}</Text>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        {/* ── Emergency Contacts ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={[styles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Emergency Contacts</Text>
          {emergencyContacts.length === 0 ? (
            <Text style={[styles.infoLabel, { color: themeColors.muted, paddingVertical: 8 }]}>No emergency contacts on file</Text>
          ) : (
            emergencyContacts.map((c, i) => (
              <View key={i} style={[styles.contactRow, { borderTopColor: themeColors.border }]}>
                <View style={[styles.contactAvatar, { backgroundColor: c.isprimary ? '#EF444418' : themeColors.tint + '15' }]}>
                  <MaterialIcons name="person" size={20} color={c.isprimary ? '#EF4444' : themeColors.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.contactName, { color: themeColors.text }]}>{c.name}</Text>
                    {c.isprimary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryText}>PRIMARY</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.contactRel, { color: themeColors.muted }]}>{c.relationship} · {c.phone}</Text>
                </View>
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => Linking.openURL(`tel:${c.phone}`)}
                >
                  <MaterialIcons name="call" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </Animated.View>

        {/* ── Emergency Services ── */}
        <Animated.View entering={FadeInDown.delay(260).duration(400)} style={[styles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Emergency Services</Text>
          {[
            { label: 'Ambulance', number: '112', icon: 'local-hospital', color: '#EF4444' },
            { label: 'Police', number: '999', icon: 'local-police', color: '#3B82F6' },
            { label: 'Fire Service', number: '112', icon: 'local-fire-department', color: '#F97316' },
            { label: 'Poison Control', number: '0800-725-5463', icon: 'science', color: '#8B5CF6' },
          ].map((s, i) => (
            <View key={i} style={[styles.contactRow, { borderTopColor: themeColors.border }]}>
              <View style={[styles.contactAvatar, { backgroundColor: s.color + '15' }]}>
                <MaterialIcons name={s.icon as any} size={20} color={s.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactName, { color: themeColors.text }]}>{s.label}</Text>
                <Text style={[styles.contactRel, { color: themeColors.muted }]}>{s.number}</Text>
              </View>
              <TouchableOpacity
                style={[styles.callBtn, { backgroundColor: s.color }]}
                onPress={() => Linking.openURL(`tel:${s.number}`)}
              >
                <MaterialIcons name="call" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </Animated.View>

        {/* ── Actions ── */}
        <Animated.View entering={FadeInDown.delay(320).duration(400)} style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => router.push({ pathname: '/chat-room', params: { partnerId: patientId, partnerName: patientName } })}
          >
            <MaterialIcons name="chat" size={20} color="#fff" />
            <Text style={styles.chatBtnText}>Message Patient</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resolveBtn, { opacity: resolving ? 0.6 : 1 }]}
            onPress={handleResolve}
            disabled={resolving}
          >
            {resolving
              ? <ActivityIndicator color="#10B981" />
              : <>
                  <MaterialIcons name="check-circle" size={20} color="#10B981" />
                  <Text style={styles.resolveBtnText}>Mark Resolved</Text>
                </>
            }
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 20,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerLabel: { color: 'rgba(252,165,165,0.75)', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  headerName: { color: '#fff', fontSize: 20, fontWeight: '900' },
  sosChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(239,68,68,0.25)', borderColor: '#EF4444',
    borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  sosDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444' },
  sosChipText: { color: '#EF4444', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },

  vitalsStrip: { flexDirection: 'row', gap: 8 },
  vitalChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 10,
  },
  vitalVal: { fontSize: 16, fontWeight: '800' },
  vitalUnit: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },

  scroll: { padding: Spacing.md, gap: Spacing.md },

  mapCard: { borderRadius: 20, overflow: 'hidden', ...Shadows.medium },
  map: { width: '100%', height: height * 0.35 },
  noMap: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  mapOverlay: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  distBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  distText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#6366F1', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  navBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  patientMarker: {
    backgroundColor: '#fff', borderRadius: 20, padding: 3,
    shadowColor: '#EF4444', shadowOpacity: 0.6, shadowRadius: 8, elevation: 6,
  },
  doctorMarker: {
    backgroundColor: '#6366F1', borderRadius: 20, padding: 6,
    shadowColor: '#6366F1', shadowOpacity: 0.6, shadowRadius: 8, elevation: 6,
  },

  section: {
    borderRadius: 18, borderWidth: 1, padding: 16, gap: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 8 },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderTopWidth: 1,
  },
  infoLabel: { fontSize: 13, fontWeight: '500' },
  infoValue: { fontSize: 13, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },

  medRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderTopWidth: 1,
  },
  medIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  medName: { fontSize: 14, fontWeight: '700' },
  medDose: { fontSize: 12, marginTop: 2 },

  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderTopWidth: 1,
  },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  contactName: { fontSize: 14, fontWeight: '700' },
  contactRel: { fontSize: 12, marginTop: 1 },
  primaryBadge: {
    backgroundColor: '#EF444418', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  primaryText: { fontSize: 9, fontWeight: '900', color: '#EF4444', letterSpacing: 0.5 },
  callBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center',
  },

  bottomActions: { flexDirection: 'row', gap: 12 },
  chatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#6366F1', borderRadius: 16, paddingVertical: 14,
  },
  chatBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  resolveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#10B98118', borderRadius: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: '#10B981',
  },
  resolveBtnText: { color: '#10B981', fontWeight: '800', fontSize: 15 },
});

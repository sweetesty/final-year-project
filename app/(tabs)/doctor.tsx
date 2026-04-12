import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking, Platform, Dimensions, FlatList } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AdherenceScoreChart, VitalsTrendChart, FallFrequencyChart, ActivityIntensityChart } from '@/src/components/AnalyticsCharts';
import { DoctorService } from '@/src/services/DoctorService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { ConsultationService } from '@/src/services/ConsultationService';
import { useTranslation } from 'react-i18next';
import { useMedicationViewModel } from '@/src/viewmodels/useMedicationViewModel';
import { AnalyticsService } from '@/src/services/AnalyticsService';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';

// ─── Sub-components ──────────────────────────────────────────────────────────

const ClinicalCard = ({ children, title, theme }: any) => (
  <View style={[styles.glassCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
    {title && <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>}
    {children}
  </View>
);

const StatusIndicator = ({ theme }: any) => {
  return (
    <View style={styles.statusRow}>
      <View style={[styles.pulseContainer, { backgroundColor: theme.vital + '20' }]}>
        <View style={[styles.pulseDot, { backgroundColor: theme.vital }]} />
      </View>
      <Text style={[styles.statusText, { color: theme.vital }]}>STABLE</Text>
    </View>
  );
};

// ─── Specialty filter chips ───────────────────────────────────────────────────
const SPECIALTIES = [
  'All',
  'Nearby',
  'General Practitioner',
  'Cardiologist',
  'Geriatrician',
  'Neurologist',
  'Pulmonologist',
  'Endocrinologist',
  'Psychiatrist',
  'Orthopedic',
];

// ─── Patient-facing Find Doctor screen ───────────────────────────────────────
function PatientDoctorView({ allDoctors, linkedDoctor, myCode, session, router, themeColors, isDark, t }: any) {
  const mapRef = useRef<MapView>(null);
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [nearbyDoctors, setNearbyDoctors] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarker, setSelectedMarker] = useState<any | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Derive specialties that actually exist in data
  const availableSpecialties = useMemo(() => {
    const specs = new Set(allDoctors.map((d: any) => d.specialization).filter(Boolean));
    return ['All', 'Nearby', ...Array.from(specs)] as string[];
  }, [allDoctors]);

  const filterChips = availableSpecialties.length > 3 ? availableSpecialties : SPECIALTIES;

  useEffect(() => {
    fetchLocation();
  }, []);

  const fetchLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setMyLocation(coords);
        const nearby = await DoctorService.getNearbyDoctors(coords.latitude, coords.longitude, 25);
        setNearbyDoctors(nearby);
        mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.12, longitudeDelta: 0.12 }, 800);
      }
    } catch (e) {
      console.error('[PatientDoctorView] location error:', e);
    } finally {
      setLocationLoading(false);
    }
  };

  const filteredDoctors = useMemo(() => {
    let list = activeFilter === 'Nearby'
      ? nearbyDoctors
      : activeFilter === 'All'
        ? allDoctors
        : allDoctors.filter((d: any) =>
            d.specialization?.toLowerCase().includes(activeFilter.toLowerCase())
          );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d: any) =>
        d.full_name?.toLowerCase().includes(q) ||
        d.specialization?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allDoctors, nearbyDoctors, activeFilter, searchQuery]);

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
  };

  const formatDist = (km?: number) =>
    km == null ? '' : km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;

  const focusDoctor = (doc: any) => {
    setSelectedMarker(doc);
    if (doc.latitude && doc.longitude) {
      mapRef.current?.animateToRegion({
        latitude: doc.latitude,
        longitude: doc.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }, 500);
    }
  };

  // Always show nearby doctors on the map regardless of which filter is active
  const mapDoctors = nearbyDoctors.filter((d: any) => d.latitude && d.longitude);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Map (top half) ── */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          showsUserLocation
          showsMyLocationButton={false}
          initialRegion={
            myLocation
              ? { ...myLocation, latitudeDelta: 0.12, longitudeDelta: 0.12 }
              : { latitude: 9.0765, longitude: 7.3986, latitudeDelta: 0.5, longitudeDelta: 0.5 }
          }
        >
          {mapDoctors.map((doc: any) => (
            <Marker
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
            </Marker>
          ))}
        </MapView>

        {/* Map header overlay */}
        <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={styles.mapHeaderOverlay}>
          <Text style={styles.mapTitle}>Find a Doctor</Text>
          <Text style={styles.mapSubtitle}>
            {locationLoading ? 'Getting your location…' : `${mapDoctors.length} doctors on map`}
          </Text>
        </LinearGradient>

        {/* Recenter */}
        <TouchableOpacity style={styles.recenterBtn} onPress={fetchLocation}>
          {locationLoading
            ? <ActivityIndicator size="small" color="#6366F1" />
            : <MaterialIcons name="my-location" size={20} color="#6366F1" />
          }
        </TouchableOpacity>

        {/* Selected marker callout */}
        {selectedMarker && (
          <Animated.View entering={FadeInDown.duration(250)} style={styles.mapCallout}>
            <LinearGradient colors={['#1E1B4B', '#312E81']} style={styles.mapCalloutInner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.calloutName} numberOfLines={1}>{selectedMarker.full_name}</Text>
                <Text style={styles.calloutSpec} numberOfLines={1}>
                  {selectedMarker.specialization || 'Clinical Specialist'}
                  {selectedMarker.distanceKm != null ? `  •  ${formatDist(selectedMarker.distanceKm)} away` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.calloutChatBtn}
                onPress={() => router.push({ pathname: '/chat-room', params: { partnerId: selectedMarker.id, partnerName: selectedMarker.full_name } })}
              >
                <MaterialIcons name="chat" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.calloutClose} onPress={() => setSelectedMarker(null)}>
                <MaterialIcons name="close" size={16} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        )}
      </View>

      {/* ── Bottom sheet ── */}
      <View style={[styles.bottomSheet, { backgroundColor: themeColors.background }]}>
        {/* Search bar + filter dropdown trigger */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: themeColors.card, borderColor: themeColors.border, flex: 1 }]}>
            <MaterialIcons name="search" size={20} color={themeColors.muted} />
            <TextInput
              style={[styles.searchInput, { color: themeColors.text }]}
              placeholder="Search by name or specialty…"
              placeholderTextColor={themeColors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={18} color={themeColors.muted} />
              </TouchableOpacity>
            )}
          </View>
          {/* Filter button */}
          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: activeFilter !== 'All' ? themeColors.tint : themeColors.card, borderColor: activeFilter !== 'All' ? themeColors.tint : themeColors.border }]}
            onPress={() => setFilterOpen(o => !o)}
          >
            <MaterialIcons name="tune" size={18} color={activeFilter !== 'All' ? '#fff' : themeColors.text} />
          </TouchableOpacity>
        </View>

        {/* Dropdown menu */}
        {filterOpen && (
          <Animated.View entering={FadeInDown.duration(200)} style={[styles.filterDropdown, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            {filterChips.map(chip => {
              const active = activeFilter === chip;
              return (
                <TouchableOpacity
                  key={chip}
                  style={[styles.filterDropdownItem, active && { backgroundColor: themeColors.tint + '20' }]}
                  onPress={() => { setActiveFilter(chip); setFilterOpen(false); }}
                >
                  <Text style={[styles.filterDropdownText, { color: active ? themeColors.tint : themeColors.text, fontWeight: active ? '700' : '400' }]}>{chip}</Text>
                  {active && <MaterialIcons name="check" size={16} color={themeColors.tint} />}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        )}

        {/* Results count */}
        <Text style={[styles.resultsLabel, { color: themeColors.muted }]}>
          {filteredDoctors.length} {filteredDoctors.length === 1 ? 'doctor' : 'doctors'} found
          {activeFilter !== 'All' ? ` · ${activeFilter}` : ''}
        </Text>

        {/* Doctor list */}
        <FlatList
          data={filteredDoctors}
          keyExtractor={(d: any) => d.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: Spacing.md }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="person-search" size={48} color={themeColors.muted + '50'} />
              <Text style={[styles.emptyText, { color: themeColors.muted }]}>
                {activeFilter === 'Nearby' ? 'No doctors found within 25km' : 'No doctors match your search'}
              </Text>
            </View>
          }
          renderItem={({ item: doc, index }: any) => (
            <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
              <TouchableOpacity
                style={[styles.docCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
                onPress={() => focusDoctor(doc)}
                activeOpacity={0.85}
              >
                {/* Avatar — show profile image if available, else gradient initials */}
                {doc.avatar_url ? (
                  <Image
                    source={{ uri: doc.avatar_url }}
                    style={styles.docAvatarImg}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.docAvatar}>
                    <Text style={styles.docAvatarText}>{doc.full_name.charAt(0)}</Text>
                  </LinearGradient>
                )}

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <View style={styles.docNameRow}>
                    <Text style={[styles.docName, { color: themeColors.text }]} numberOfLines={1}>{doc.full_name}</Text>
                    {isOnline(doc.last_seen) && (
                      <View style={styles.onlinePill}>
                        <View style={styles.onlinePillDot} />
                        <Text style={styles.onlinePillText}>Online</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.docSpec, { color: themeColors.muted }]} numberOfLines={1}>
                    {doc.specialization || 'Clinical Specialist'}
                    {doc.distanceKm != null ? `  ·  ${formatDist(doc.distanceKm)} away` : ''}
                  </Text>
                </View>

                {/* Actions */}
                <TouchableOpacity
                  style={[styles.docChatBtn, { backgroundColor: themeColors.tint }]}
                  onPress={() => router.push({ pathname: '/chat-room', params: { partnerId: doc.id, partnerName: doc.full_name } })}
                >
                  <MaterialIcons name="chat" size={16} color="#fff" />
                </TouchableOpacity>
              </TouchableOpacity>
            </Animated.View>
          )}
        />
      </View>

      {/* Patient link-code card pinned at bottom */}
      {myCode ? (
        <View style={[styles.codeBar, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
          <MaterialIcons name="link" size={16} color={themeColors.tint} />
          <Text style={[styles.codeBarLabel, { color: themeColors.muted }]}>Your code:</Text>
          <Text style={[styles.codeBarValue, { color: themeColors.tint }]}>{myCode}</Text>
          <TouchableOpacity onPress={() => Alert.alert('Patient Code', `Your code is: ${myCode}\n\nShare it with your doctor to link your profile.`)}>
            <MaterialIcons name="info-outline" size={18} color={themeColors.muted} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

export default function DoctorDashboard() {
  console.log('[DoctorDashboard] Component Mounting...');
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { session, role } = useAuthViewModel();
  const { t } = useTranslation();

  const [doctor, setDoctor] = useState<any>(null);
  const [allDoctors, setAllDoctors] = useState<any[]>([]);
  const [linkedPatients, setLinkedPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [healthSummary, setHealthSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Fetch patient meds for clinical review
  const { medications: patientMeds } = useMedicationViewModel(selectedPatient?.id || '');
  const [myCode, setMyCode] = useState<string>(''); // Patient's own link code
  const [linkCode, setLinkCode] = useState<string>(''); // Input field for linking
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      if (role === 'doctor') {
        loadPatients();
      } else {
        loadDoctor();
      }
    }
  }, [session, role]);

  const loadDoctor = async () => {
    setLoading(true);
    try {
      const [d, doctors, code] = await Promise.all([
        DoctorService.getLinkedDoctor(session!.user.id),
        DoctorService.getAllDoctors(),
        DoctorService.ensurePatientCode(session!.user.id),
      ]);
      setDoctor(d);
      setAllDoctors(doctors); // always populate — map needs doctors regardless of link status
      setMyCode(code);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadPatients = async () => {
    setLoading(true);
    try {
      const patients = await DoctorService.getLinkedPatients(session!.user.id);
      setLinkedPatients(patients);
      if (patients.length > 0) setSelectedPatient(patients[0]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkPatient = async () => {
    if (!linkCode) return;
    setLinking(true);
    try {
      await DoctorService.linkPatientWithCode(session!.user.id, linkCode);
      Alert.alert("Success", "Patient linked successfully!");
      setLinkCode('');
      await loadPatients();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLinking(false);
    }
  };

  const startVideoCall = async () => {
    if (!selectedPatient) return;
    await ConsultationService.startVideoCall(session!.user.user_metadata.full_name, selectedPatient.full_name);
  };

  const handleGenerateSummary = async () => {
    if (!selectedPatient) return;
    setGeneratingSummary(true);
    try {
      const summary = await AnalyticsService.generateWeeklySummary(selectedPatient.id);
      setHealthSummary(summary);
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const [history, setHistory] = useState<any[]>([]);
  const [patientContext, setPatientContext] = useState<any>(null);

  useEffect(() => {
    if (selectedPatient) {
      loadPatientDetails();
    }
  }, [selectedPatient]);

  const loadPatientDetails = async () => {
    if (!selectedPatient) return;
    try {
      const [hist, context] = await Promise.all([
        DoctorService.getPatientAlertHistory(selectedPatient.id),
        DoctorService.getPatientClinicalContext(selectedPatient.id)
      ]);
      setHistory(hist);
      setPatientContext(context);
    } catch (e) {
      console.error('[Doctor] Detail load error:', e);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color={themeColors.tint} /></View>;

  // ─── Patient View ──────────────────────────────────────────────────────────
  if (role === 'patient') {
    return (
      <PatientDoctorView
        allDoctors={allDoctors}
        linkedDoctor={doctor}
        myCode={myCode}
        session={session}
        router={router}
        themeColors={themeColors}
        isDark={isDark}
        t={t}
      />
    );
  }

  // ─── Doctor Dashboard ───────────────────────────────────────────────────────

  // If a patient is selected, show their clinical detail
  if (selectedPatient) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
        {/* Custom Premium Header */}
        <View 
          style={[
            styles.premiumHeader, 
            { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)' }
          ]}
        >
          <TouchableOpacity
            style={[styles.miniBackBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
            onPress={() => setSelectedPatient(null)}
          >
            <MaterialIcons name="chevron-left" size={28} color={themeColors.tint} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerPatientName, { color: themeColors.text }]}>{selectedPatient.full_name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
               <View style={[styles.pulseDot, { backgroundColor: patientContext?.isOnline ? '#10B981' : '#94A3B8' }]} />
               <Text style={{ fontSize: 12, color: themeColors.muted, fontWeight: '700' }}>
                  {patientContext?.isOnline ? 'ACTIVE' : 'OFFLINE'}
               </Text>
            </View>
          </View>
          <View style={styles.headerControls}>
             <TouchableOpacity 
                style={[styles.roundIconBtn, { backgroundColor: themeColors.tint }]} 
                onPress={() => Linking.openURL('tel:+123456789')}
              >
                <MaterialIcons name="call" size={20} color="#fff" />
             </TouchableOpacity>
             <TouchableOpacity style={[styles.roundIconBtn, { backgroundColor: themeColors.secondary }]} onPress={startVideoCall}>
                <MaterialIcons name="videocam" size={20} color="#fff" />
             </TouchableOpacity>
             <TouchableOpacity 
                style={[styles.roundIconBtn, { backgroundColor: '#475569' }]} 
                onPress={() => router.push({ pathname: '/chat-room', params: { partnerId: selectedPatient.id, partnerName: selectedPatient.full_name } })}
              >
                <MaterialIcons name="chat-bubble" size={18} color="#fff" />
             </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollWithHeader} showsVerticalScrollIndicator={false}>

          <View style={styles.analyticsSection}>
            <View style={styles.gridRow}>
              <View style={{ flex: 1.2 }}>
                <ClinicalCard title="Vitals & Status" theme={themeColors}>
                   <View style={styles.vitalsGrid}>
                      <View style={styles.vBlock}>
                         <Text style={styles.vBlockLabel}>HR</Text>
                         <Text style={[styles.vBlockValue, { color: themeColors.emergency }]}>{patientContext?.latestVital?.heartrate || '--'}</Text>
                      </View>
                      <View style={styles.vBlock}>
                         <Text style={styles.vBlockLabel}>SpO2</Text>
                         <Text style={[styles.vBlockValue, { color: themeColors.tint }]}>{patientContext?.latestVital?.spo2 || '--'}%</Text>
                      </View>
                   </View>
                </ClinicalCard>
              </View>
              <View style={{ flex: 1, gap: 12 }}>
                <TouchableOpacity style={[styles.statTile, { backgroundColor: themeColors.card, borderColor: themeColors.border }]} onPress={() => router.push({ pathname: '/live-tracking', params: { patientId: selectedPatient.id } })}>
                  <MaterialIcons name="location-on" size={24} color={themeColors.tint} />
                  <Text style={[styles.statTileLabel, { color: themeColors.muted }]}>Live GPS</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.statTile, { backgroundColor: themeColors.card, borderColor: themeColors.border }]} onPress={() => Alert.alert('History', 'Detailed alert logs are shown below.')}>
                  <MaterialIcons name="history" size={24} color={themeColors.emergency} />
                  <Text style={[styles.statTileLabel, { color: themeColors.muted }]}>History</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ClinicalCard title="Heart Rate Trend (24h)" theme={themeColors}>
              <VitalsTrendChart data={[72, 75, 82, 70, 78, 85, 76, 74]} labels={["8a", "10a", "12p", "2p", "4p", "6p", "8p", "10p"]} theme={themeColors} />
            </ClinicalCard>

            {/* NEW: Emergency History Section */}
            <ClinicalCard title="🚨 Emergency History" theme={themeColors}>
               {history.length === 0 ? (
                 <Text style={{ color: themeColors.muted, fontSize: 13, fontStyle: 'italic', paddingVertical: 10 }}>No past emergency events.</Text>
               ) : (
                 history.slice(0, 5).map(h => (
                   <View key={h.id} style={styles.historyItem}>
                      <View style={[styles.historyDot, { backgroundColor: h.status === 'resolved' ? '#10B981' : themeColors.emergency }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.historyType, { color: themeColors.text }]}>{h.source === 'foreground' ? 'Fall Detected' : 'Triggered Alert'}</Text>
                        <Text style={[styles.historyTime, { color: themeColors.muted }]}>{new Date(h.timestamp).toLocaleDateString()} at {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                      <View style={[styles.statusTag, { backgroundColor: h.status === 'resolved' ? '#10B98120' : '#EF444420' }]}>
                         <Text style={{ fontSize: 10, fontWeight: '800', color: h.status === 'resolved' ? '#10B981' : '#EF4444' }}>{h.status?.toUpperCase() || 'UNRESOLVED'}</Text>
                      </View>
                   </View>
                 ))
               )}
            </ClinicalCard>
          </View>

          {/* AI Health Summary */}
          <LinearGradient
            colors={isDark ? ['#1E293B', '#0F172A'] : ['#F0F9FF', '#E0F2FE']}
            style={styles.aiSummaryCard}
          >
            <View style={styles.aiHeader}>
              <View style={styles.aiLabel}>
                <MaterialIcons name="auto-awesome" size={16} color={themeColors.tint} />
                <Text style={[styles.aiLabelText, { color: themeColors.tint }]}>Weekly Health Summary</Text>
              </View>
              <TouchableOpacity onPress={handleGenerateSummary} disabled={generatingSummary} style={styles.refreshBtn}>
                {generatingSummary ? <ActivityIndicator size="small" color={themeColors.tint} /> : <MaterialIcons name="refresh" size={20} color={themeColors.tint} />}
              </TouchableOpacity>
            </View>
            
            {healthSummary ? (
              <Text style={[styles.aiText, { color: themeColors.text }]}>{healthSummary}</Text>
            ) : (
              <TouchableOpacity style={styles.summaryPlaceholder} onPress={handleGenerateSummary}>
                <Text style={{ color: themeColors.muted, fontStyle: 'italic' }}>Tap to generate clinical narrative summary</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>

          {/* Medications Management */}
          <ClinicalCard title={t('common.medication')} theme={themeColors}>
             <View style={styles.sectionHeader}>
                <Text style={{ fontSize: 12, color: themeColors.muted }}>Active Prescriptions</Text>
                <TouchableOpacity
                  style={[styles.prescribeBtn, { backgroundColor: themeColors.vital }]}
                  onPress={() => router.push({ pathname: '/add-medication', params: { mode: 'prescribe', patientId: selectedPatient.id } })}
                >
                  <MaterialIcons name="add" size={14} color="#fff" />
                  <Text style={styles.prescribeBtnText}>{t('common.add_prescription')}</Text>
                </TouchableOpacity>
             </View>
             <View style={styles.medicationList}>
               {patientMeds.length === 0 ? (
                 <Text style={[styles.emptyText, { color: themeColors.muted }]}>No active medications.</Text>
               ) : (
                 patientMeds.map((med) => (
                   <TouchableOpacity 
                    key={med.id} 
                    style={[styles.medItem, { borderBottomColor: themeColors.border }]}
                    onPress={() => router.push({ pathname: '/add-medication', params: { medicationId: med.id, mode: 'edit', patientId: selectedPatient.id } })}
                   >
                     <View style={{ flex: 1 }}>
                       <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                         <Text style={[styles.medNameSmall, { color: themeColors.text }]}>{med.name}</Text>
                         {med.isPrescribed && (
                           <View style={[styles.typeBadge, { backgroundColor: '#DC262615' }]}>
                             <Text style={[styles.typeBadgeText, { color: '#DC2626' }]}>Rx</Text>
                           </View>
                         )}
                       </View>
                       <Text style={[styles.medSub, { color: themeColors.muted }]}>{med.dosage} • {med.times.join(', ')}</Text>
                     </View>
                     <TouchableOpacity 
                        style={[styles.nudgeBtn, { backgroundColor: themeColors.tint + '15' }]}
                        onPress={() => Alert.alert('Nudge Sent', `A medication reminder has been sent to ${selectedPatient.full_name}.`)}
                      >
                        <MaterialIcons name="notifications-active" size={16} color={themeColors.tint} />
                     </TouchableOpacity>
                   </TouchableOpacity>
                 ))
               )}
             </View>
          </ClinicalCard>
        </ScrollView>
      </View>
    );
  }

  // ─── Patient List View (default) ────────────────────────────────────────────
  return (
    <View style={styles.darkContainer}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Premium Header */}
      <LinearGradient colors={['#1E1B4B', '#312E81', '#4338CA']} style={styles.panelHeader}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {[...Array(6)].map((_, i) => (
            <View key={i} style={[styles.panelGridLine, { top: i * 28 }]} />
          ))}
        </View>
        <View style={styles.panelHeaderTop}>
          <View>
            <Text style={styles.panelHeaderLabel}>CLINICAL MONITORING</Text>
            <Text style={styles.panelHeaderTitle}>{t('doctor.panel_title')}</Text>
          </View>
          <View style={styles.panelLiveChip}>
            <View style={styles.panelLiveDot} />
            <Text style={styles.panelLiveText}>LIVE</Text>
          </View>
        </View>
        <View style={styles.panelStatsBar}>
          <View style={styles.panelStatItem}>
            <Text style={styles.panelStatNum}>{linkedPatients.length}</Text>
            <Text style={styles.panelStatLabel}>{t('doctor.active_patients')}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.darkScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Link Another Patient Banner */}
        <TouchableOpacity
          style={styles.linkBannerDark}
          onPress={() => setShowLinkForm(!showLinkForm)}
          activeOpacity={0.8}
        >
          <View style={styles.linkBannerIcon}>
            <MaterialIcons name="person-add" size={18} color="#818CF8" />
          </View>
          <Text style={styles.linkBannerText}>Link Another Patient</Text>
          <MaterialIcons name={showLinkForm ? 'expand-less' : 'expand-more'} size={20} color="#818CF8" />
        </TouchableOpacity>

        {showLinkForm && (
          <View style={styles.linkFormDark}>
            <Text style={styles.linkFormHint}>Enter the 6-digit code from the patient's home screen</Text>
            <TextInput
              style={styles.darkInput}
              placeholder="Enter Patient Code"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={linkCode}
              onChangeText={setLinkCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={styles.linkBtnDark}
              onPress={async () => { await handleLinkPatient(); setShowLinkForm(false); }}
              disabled={linking}
            >
              <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.linkBtnGradient}>
                {linking ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <MaterialIcons name="link" size={18} color="#fff" />
                    <Text style={styles.linkBtnText}>Link Patient</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Patient List */}
        {linkedPatients.length === 0 ? (
          <View style={styles.darkEmptyContainer}>
            <View style={styles.darkEmptyIcon}>
              <MaterialIcons name="people-outline" size={40} color="rgba(99,102,241,0.6)" />
            </View>
            <Text style={styles.darkEmptyTitle}>No Linked Patients</Text>
            <Text style={styles.darkEmptySubtitle}>
              Tap "Link Another Patient" above to begin clinical monitoring.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.darkSectionLabel}>
              YOUR PATIENTS ({linkedPatients.length})
            </Text>
            {linkedPatients.map((patient, index) => (
              <TouchableOpacity
                key={patient.id}
                style={styles.darkPatientCard}
                onPress={() => { setSelectedPatient(patient); setHealthSummary(null); }}
                activeOpacity={0.8}
              >
                <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.darkPatientAvatar}>
                  <Text style={styles.darkPatientAvatarText}>{patient.full_name.charAt(0)}</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.darkPatientName}>{patient.full_name}</Text>
                  <View style={styles.darkPatientStatus}>
                    <View style={styles.darkStatusDot} />
                    <Text style={styles.darkPatientSub}>Active monitoring</Text>
                  </View>
                </View>
                <View style={styles.darkPatientArrow}>
                  <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.4)" />
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  darkContainer: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scrollContent: {
    padding: Spacing.lg
  },
  darkScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Premium Panel Header
  panelHeader: {
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  panelGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  panelHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  panelHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
    marginBottom: 4,
  },
  panelHeaderTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  panelLiveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B98115',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  panelLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  panelLiveText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  panelStatsBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 14,
  },
  panelStatItem: { flex: 1 },
  panelStatNum: { fontSize: 28, fontWeight: '800', color: '#fff' },
  panelStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 2 },

  // Dark link banner
  linkBannerDark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.35)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  linkBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(99,102,241,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkBannerText: {
    flex: 1,
    color: '#818CF8',
    fontWeight: '700',
    fontSize: 14,
  },
  linkFormDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  linkFormHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
  darkInput: {
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  linkBtnDark: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  linkBtnGradient: {
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  linkBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  // Dark patient cards
  darkSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
    marginBottom: 10,
    marginLeft: 4,
  },
  darkPatientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  darkPatientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkPatientAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  darkPatientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  darkPatientStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  darkStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  darkPatientSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  darkPatientArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Dark empty state
  darkEmptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  darkEmptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99,102,241,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkEmptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  darkEmptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  linkContainer: { 
    flex: 1, 
    padding: Spacing.xl, 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 12 
  },
  linkEmoji: { 
    fontSize: 64, 
    marginBottom: 12 
  },
  linkTitle: { 
    fontSize: 24, 
    fontWeight: '800' 
  },
  linkSubtitle: { 
    textAlign: 'center', 
    marginBottom: 24 
  },
  input: { 
    height: 60, 
    width: '100%', 
    borderRadius: BorderRadius.lg, 
    paddingHorizontal: 20, 
    borderWidth: 1, 
    fontSize: 24, 
    textAlign: 'center', 
    fontWeight: '800' 
  },
  linkButton: { 
    height: 60, 
    width: '100%', 
    borderRadius: BorderRadius.lg, 
    justifyContent: 'center', 
    alignItems: 'center', 
    ...Shadows.medium 
  },
  linkButtonText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '800' 
  },
  patientHeader: { 
    padding: Spacing.md, 
    borderRadius: BorderRadius.xl, 
    borderWidth: 1, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  patientInfo: { 
    gap: 4 
  },
  patientName: { 
    fontSize: 18, 
    fontWeight: '800' 
  },
  badgeRow: { 
    flexDirection: 'row', 
    gap: 6 
  },
  statusBadge: { 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6 
  },
  headerActions: { 
    flexDirection: 'row', 
    gap: 10 
  },
  actionIcon: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center', 
    ...Shadows.light 
  },
  analyticsSection: { 
    gap: 16, 
    marginBottom: 24 
  },
  wideAction: { 
    height: 56, 
    borderRadius: BorderRadius.lg, 
    justifyContent: 'center', 
    alignItems: 'center', 
    ...Shadows.light 
  },
  wideActionText: { 
    color: '#fff', 
    fontWeight: '800' 
  },
  linkBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    margin: 16, 
    marginBottom: 8, 
    padding: 14, 
    borderRadius: 14, 
    borderWidth: 1.5 
  },
  linkFormInline: { 
    marginHorizontal: 16, 
    marginBottom: 12, 
    padding: 16, 
    borderRadius: 16, 
    borderWidth: 1 
  },
  patientTab: { 
    paddingHorizontal: 18, 
    paddingVertical: 8, 
    borderRadius: 20, 
    borderWidth: 1, 
    marginRight: 8 
  },
  backBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: 16, 
    marginTop: 12, 
    marginBottom: 8, 
    padding: 12, 
    borderRadius: 12, 
    borderWidth: 1 
  },
  patientListCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: 16, 
    marginBottom: 10, 
    padding: 16, 
    borderRadius: 16, 
    borderWidth: 1, 
    gap: 12, 
    ...Shadows.light 
  },
  patientListAvatar: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  // Patient view styles
  profileCard: { 
    marginVertical: 20, 
    padding: 30, 
    borderRadius: 24, 
    alignItems: 'center', 
    borderWidth: 1, 
    ...Shadows.medium 
  },
  avatarLarge: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: '#6366F1', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  avatarText: { 
    color: '#fff', 
    fontSize: 32, 
    fontWeight: '800' 
  },
  doctorNameLarge: { 
    fontSize: 22, 
    fontWeight: '900', 
    marginBottom: 4 
  },
  doctorTitle: { 
    fontSize: 14, 
    fontWeight: '700', 
    marginBottom: 20 
  },
  statsRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    width: '100%', 
    justifyContent: 'space-around' 
  },
  statItem: { 
    alignItems: 'center' 
  },
  statValue: { 
    fontSize: 16, 
    fontWeight: '800' 
  },
  statLabel: { 
    fontSize: 11, 
    marginTop: 2 
  },
  statDivider: { 
    width: 1, 
    height: 24, 
    backgroundColor: 'rgba(0,0,0,0.05)' 
  },
  infoSection: { 
    marginBottom: 24 
  },
  infoTitle: { 
    fontSize: 14, 
    fontWeight: '800', 
    marginBottom: 8 
  },
  infoText: { 
    fontSize: 14, 
    lineHeight: 22 
  },
  buttonGrid: { 
    flexDirection: 'row', 
    gap: 12, 
    marginBottom: 12 
  },
  actionBtn: { 
    flex: 1, 
    height: 70, 
    borderRadius: 16, 
    borderWidth: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 4 
  },
  actionBtnText: { 
    fontSize: 12, 
    fontWeight: '700' 
  },
  mainChatBtn: { 
    height: 60, 
    borderRadius: 16, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    ...Shadows.light 
  },
  mainChatBtnText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '800' 
  },

  // Demo styles
  demoBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F0F9FF', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 10, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#BAE6FD', 
    gap: 6 
  },
  demoBadgeText: { 
    color: '#0369A1', 
    fontSize: 12, 
    fontWeight: '600' 
  },
  clinicalSection: { 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 24, 
    borderWidth: 1 
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '800' 
  },
  prescribeBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 8 
  },
  prescribeBtnText: { 
    color: '#fff', 
    fontSize: 11, 
    fontWeight: '700' 
  },
  medicationList: { 
    gap: 12 
  },
  medItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingBottom: 12, 
    borderBottomWidth: 1 
  },
  medNameSmall: { 
    fontSize: 14, 
    fontWeight: '700' 
  },
  medSub: { 
    fontSize: 12, 
    marginTop: 2 
  },
  typeBadge: { 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4 
  },
  typeBadgeText: { 
    fontSize: 8, 
    fontWeight: '800' 
  },
  emptyText: { 
    textAlign: 'center', 
    fontSize: 12, 
    fontStyle: 'italic' 
  },
  insightTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    marginTop: 12, 
    marginBottom: 8 
  },
  summaryText: { 
    fontSize: 14, 
    lineHeight: 22, 
    fontWeight: '500' 
  },
  summaryPlaceholder: { 
    padding: 20, 
    alignItems: 'center', 
    borderStyle: 'dashed', 
    borderWidth: 1, 
    borderColor: '#ccc', 
    borderRadius: 12 
  },

  // Premium Redesign Styles
  premiumHeader: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    zIndex: 100, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingTop: Platform.OS === 'ios' ? 54 : 44, 
    paddingBottom: 16,
  },
  miniBackBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerInfo: { 
    flex: 1, 
    marginHorizontal: 12 
  },
  headerPatientName: { 
    fontSize: 18, 
    fontWeight: '900', 
    letterSpacing: -0.5 
  },
  headerControls: { 
    flexDirection: 'row', 
    gap: 10 
  },
  roundIconBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    ...Shadows.light 
  },
  scrollWithHeader: { 
    padding: 20, 
    paddingTop: Platform.OS === 'ios' ? 120 : 110, 
    paddingBottom: 40 
  },
  glassCard: { 
    borderRadius: 24, 
    padding: 16, 
    marginBottom: 20, 
    borderWidth: 1, 
    ...Shadows.light 
  },
  cardTitle: { 
    fontSize: 14, 
    fontWeight: '800', 
    marginBottom: 12, 
    opacity: 0.8, 
    letterSpacing: 0.5, 
    textTransform: 'uppercase' 
  },
  statusRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginTop: 2 
  },
  pulseContainer: { 
    width: 14, 
    height: 14, 
    borderRadius: 7, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  pulseDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3 
  },
  statusText: { 
    fontSize: 11, 
    fontWeight: '800', 
    letterSpacing: 0.2 
  },
  gridRow: { 
    flexDirection: 'row', 
    gap: 16, 
    marginBottom: 20 
  },
  statTile: { 
    flex: 1, 
    padding: 16, 
    borderRadius: 20, 
    borderWidth: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    ...Shadows.light 
  },
  statTileLabel: { 
    fontSize: 12, 
    fontWeight: '700' 
  },
  aiSummaryCard: { 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 24, 
    ...Shadows.medium 
  },
  aiHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  aiLabel: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12 
  },
  aiLabelText: { 
    fontSize: 12, 
    fontWeight: '800' 
  },
  aiText: { 
    fontSize: 15, 
    lineHeight: 24, 
    fontWeight: '500' 
  },
  refreshBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  // Connectivity Card Styles
  connectivityCard: { 
    borderRadius: 24, 
    padding: 20, 
    marginTop: 10, 
    marginBottom: 30, 
    borderWidth: 2, 
    borderStyle: 'dashed', 
    alignItems: 'center' 
  },
  connectivityHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 12 
  },
  connectivityTitle: { 
    fontSize: 16, 
    fontWeight: '800' 
  },
  connectivitySubtitle: { 
    fontSize: 13, 
    textAlign: 'center', 
    lineHeight: 20, 
    marginBottom: 20 
  },
  codeDisplay: { 
    paddingHorizontal: 30, 
    paddingVertical: 12, 
    borderRadius: 16, 
    borderWidth: 1, 
    marginBottom: 12 
  },
  codeText: { 
    fontSize: 32, 
    fontWeight: '900', 
    letterSpacing: 4 
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  // Clinical Detail Specialized Styles
  vitalsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  vBlock: {
    alignItems: 'center',
  },
  vBlockLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 4,
  },
  vBlockValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  historyType: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyTime: {
    fontSize: 12,
    marginTop: 2,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nudgeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  // ── PatientDoctorView styles ──────────────────────────────────────────────
  mapContainer: {
    height: Math.round(Dimensions.get('window').height * 0.38),
    position: 'relative',
  },
  mapHeaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  mapTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  mapSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 2,
  },
  recenterBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.light,
  },
  mapMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  mapMarkerSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.18 }],
  },
  mapMarkerInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  mapCallout: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 56,
  },
  mapCalloutInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  calloutName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  calloutSpec: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 2,
  },
  calloutChatBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#4338CA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calloutClose: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheet: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -16,
    paddingTop: 16,
    overflow: 'hidden',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    marginBottom: 10,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDropdown: {
    marginHorizontal: Spacing.md,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  filterDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterDropdownText: {
    fontSize: 14,
  },
  resultsLabel: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: Spacing.md,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
    ...Shadows.light,
  },
  docAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  docAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  docNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  docName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  docSpec: {
    fontSize: 12,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B98118',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  onlinePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  onlinePillText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  docChatBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  codeBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  codeBarLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  codeBarValue: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    letterSpacing: 2,
  },
});

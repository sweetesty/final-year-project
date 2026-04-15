import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Dimensions } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { useTranslation } from 'react-i18next';
import { useMedicationViewModel } from '@/src/viewmodels/useMedicationViewModel';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeInRight, withRepeat, withTiming, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { CaregiverService } from '@/src/services/CaregiverService';
import { supabase } from '@/src/services/SupabaseService';

const { width } = Dimensions.get('window');

const ClinicalCard = ({ children, title, theme }: any) => (
  <View style={[styles.glassCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
    {title && <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>}
    {children}
  </View>
);

const StatMini = ({ label, value, color, icon }: any) => (
  <View style={styles.statMini}>
    <View style={[styles.statMiniIcon, { backgroundColor: color + '15' }]}>
      <MaterialIcons name={icon} size={14} color={color} />
    </View>
    <View>
      <Text style={[styles.statMiniVal]}>{value}</Text>
      <Text style={styles.statMiniLabel}>{label}</Text>
    </View>
  </View>
);

export default function CaregiverDashboard() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { session, role } = useAuthViewModel();
  const { t } = useTranslation();

  const [linkedPatients, setLinkedPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [activeAlerts, setActiveAlerts] = useState<string[]>([]);
  
  const { medications: patientMeds, summary: medSummary } = useMedicationViewModel(selectedPatient?.id || '', selectedPatient?.full_name);
  const [linkCode, setLinkCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // Pulse animation for emergency cases
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.05, { duration: 800 }), -1, true);
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    borderColor: '#EF4444',
    borderWidth: 2,
  }));

  useEffect(() => {
    if (session?.user?.id && role === 'caregiver') {
      loadPatients();
      const interval = setInterval(loadPatients, 30000); // Polling every 30s
      return () => clearInterval(interval);
    }
  }, [session, role]);

  useEffect(() => {
    if (selectedPatient) fetchFallHistory();
  }, [selectedPatient]);

  const loadPatients = async () => {
    if (!session?.user?.id) return;
    try {
      const patients = await CaregiverService.getLinkedPatients(session.user.id);
      setLinkedPatients(patients);
      
      if (patients.length > 0) {
        const ids = patients.map(p => p.id);
        const alerts = await CaregiverService.getActiveAlerts(ids);
        setActiveAlerts(alerts.map(a => a.patientid));
      }
    } catch (error) {
      console.error('[CaregiverDashboard] Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkPatient = async () => {
    if (!linkCode) return;
    setLinking(true);
    try {
      await CaregiverService.linkPatientWithCode(session!.user.id, linkCode);
      Alert.alert("Success", "Patient linked successfully!");
      setLinkCode('');
      setShowLinkForm(false);
      await loadPatients();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLinking(false);
    }
  };

  const fetchFallHistory = async () => {
    if (!selectedPatient) return;
    const { data } = await supabase
      .from('fall_events')
      .select('*')
      .eq('patientid', selectedPatient.id)
      .order('timestamp', { ascending: false })
      .limit(10);
    setHistory(data || []);
  };

  const navigateToTracking = () => {
    if (!selectedPatient) return;
    router.push({
      pathname: '/live-tracking',
      params: { patientId: selectedPatient.id, patientName: selectedPatient.full_name }
    });
  };

  // If a patient is selected, show their specific details
  if (selectedPatient) {
    const isEmergency = activeAlerts.includes(selectedPatient.id);

    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
        <View style={[styles.headerPane, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={() => setSelectedPatient(null)} style={styles.backBtn}>
            <MaterialIcons name="arrow-back-ios" size={20} color={themeColors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>{selectedPatient.full_name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={[styles.statusDot, { backgroundColor: isEmergency ? '#EF4444' : '#10B981' }]} />
              <Text style={{ fontSize: 12, color: isEmergency ? '#EF4444' : themeColors.muted, fontWeight: '800' }}>
                {isEmergency ? '⚠️ FALL DETECTED' : 'MONITORING'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={navigateToTracking} style={styles.mapBtn}>
            <MaterialIcons name="map" size={22} color={themeColors.tint} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {isEmergency && (
            <Animated.View entering={FadeInUp} style={styles.emergencyBanner}>
              <MaterialIcons name="warning" size={20} color="#fff" />
              <Text style={styles.emergencyText}>Unresolved Fall Detected! Verification In-Progress.</Text>
            </Animated.View>
          )}

          {/* Quick Actions */}
          <View style={styles.actionRow}>
             <TouchableOpacity style={[styles.subAction, { backgroundColor: themeColors.card }]} onPress={navigateToTracking}>
                <MaterialIcons name="my-location" size={24} color="#6366F1" />
                <Text style={[styles.subActionText, { color: themeColors.text }]}>Live Tracking</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.subAction, { backgroundColor: themeColors.card }]} onPress={() => router.push({ pathname: '/emergency-contacts', params: { patientId: selectedPatient.id } })}>
                <MaterialIcons name="contact-phone" size={24} color="#EF4444" />
                <Text style={[styles.subActionText, { color: themeColors.text }]}>Contacts</Text>
             </TouchableOpacity>
          </View>

          {/* Medication Compliance Summary */}
          <ClinicalCard title="📊 Daily Compliance" theme={themeColors}>
             <View style={styles.medSummaryGrid}>
                <View style={[styles.medSummaryMain, { borderRightColor: themeColors.border }]}>
                   <Text style={[styles.sectionLabel, { color: themeColors.muted }]}>NEXT DUE</Text>
                   {medSummary.upcomingDose ? (
                     <>
                       <Text style={[styles.upcomingTime, { color: themeColors.tint }]}>{medSummary.upcomingDose.time}</Text>
                       <Text style={[styles.upcomingMed, { color: themeColors.text }]} numberOfLines={1}>{medSummary.upcomingDose.name}</Text>
                     </>
                   ) : (
                     <>
                       <Text style={[styles.upcomingTime, { color: '#10B981' }]}>Done</Text>
                       <Text style={[styles.upcomingMed, { color: themeColors.muted }]}>All doses taken</Text>
                     </>
                   )}
                </View>
                <View style={styles.medSummaryStats}>
                   <StatMini label="Taken" value={medSummary.takenCount} color="#10B981" icon="check-circle" />
                   <StatMini label="Missed" value={medSummary.missedCount} color="#EF4444" icon="cancel" />
                   <StatMini label="Left" value={medSummary.pendingCount} color="#6366F1" icon="schedule" />
                </View>
             </View>
             
             {medSummary.totalToday > 0 && (
               <View style={styles.progressTrack}>
                  <View style={[styles.progressBar, { width: `${(medSummary.takenCount / medSummary.totalToday) * 100}%`, backgroundColor: '#10B981' }]} />
               </View>
             )}
          </ClinicalCard>

          {/* Emergency History */}
          <ClinicalCard title="🚨 Emergency Alerts" theme={themeColors}>
             {history.length === 0 ? (
               <Text style={{ color: themeColors.muted, fontSize: 13, fontStyle: 'italic', paddingVertical: 10 }}>No past emergency events.</Text>
             ) : (
               history.slice(0, 5).map(h => (
                 <View key={h.id} style={styles.historyItem}>
                    <View style={[styles.historyDot, { backgroundColor: h.status === 'resolved' ? '#10B981' : '#EF4444' }]} />
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

          {/* Full Schedule List */}
          <ClinicalCard title="💊 Medication Schedule" theme={themeColors}>
             <View style={styles.medicationList}>
               {patientMeds.length === 0 ? (
                 <Text style={[styles.emptyText, { color: themeColors.muted }]}>No active medications.</Text>
               ) : (
                 medSummary.fullSchedule.map((item, idx) => (
                   <View key={`${item.medId}-${idx}`} style={[styles.medItem, { borderBottomColor: themeColors.border }]}>
                     <View style={{ flex: 1 }}>
                       <Text style={[styles.medNameSmall, { color: themeColors.text }]}>{item.name}</Text>
                       <Text style={[styles.medSub, { color: themeColors.muted }]}>{item.time} • Daily</Text>
                     </View>
                     <View style={[styles.statusTag, { backgroundColor: item.status === 'taken' ? '#10B98115' : 'rgba(0,0,0,0.05)' }]}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: item.status === 'taken' ? '#10B981' : themeColors.muted }}>
                          {item.status.toUpperCase()}
                        </Text>
                     </View>
                   </View>
                 ))
               )}
             </View>
          </ClinicalCard>
        </ScrollView>
      </View>
    );
  }

  // Caregiver Patient List View
  return (
    <View style={styles.darkContainer}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={['#0F172A', '#1E293B', '#334155']} style={styles.panelHeader}>
        <View style={styles.panelHeaderTop}>
          <View>
            <Text style={styles.panelHeaderLabel}>CAREGIVER DASHBOARD</Text>
            <Text style={styles.panelHeaderTitle}>Your Loved Ones</Text>
          </View>
        </View>
        <View style={styles.panelStatsBar}>
          <View style={styles.panelStatItem}>
            <Text style={styles.panelStatNum}>{linkedPatients.length}</Text>
            <Text style={styles.panelStatLabel}>Monitored Patients</Text>
          </View>
          <View style={[styles.panelStatItem, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingLeft: 15 }]}>
            <Text style={[styles.panelStatNum, { color: activeAlerts.length > 0 ? '#EF4444' : '#10B981' }]}>{activeAlerts.length}</Text>
            <Text style={styles.panelStatLabel}>Active Alerts</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.darkScrollContent} showsVerticalScrollIndicator={false}>
        {/* Link Another Patient Banner */}
        <TouchableOpacity
          style={styles.linkBannerDark}
          onPress={() => setShowLinkForm(!showLinkForm)}
          activeOpacity={0.8}
        >
          <View style={styles.linkBannerIcon}>
            <MaterialIcons name="person-add" size={18} color="#818CF8" />
          </View>
          <Text style={styles.linkBannerText}>Link Patient Profile</Text>
          <MaterialIcons name={showLinkForm ? 'expand-less' : 'expand-more'} size={20} color="#818CF8" />
        </TouchableOpacity>

        {showLinkForm && (
          <View style={styles.linkFormDark}>
            <Text style={styles.linkFormHint}>Enter the 6-digit code from the patient's home screen</Text>
            <TextInput
              style={styles.darkInput}
              placeholder="000000"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={linkCode}
              onChangeText={setLinkCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={styles.linkBtnDark}
              onPress={handleLinkPatient}
              disabled={linking}
            >
              <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.linkBtnGradient}>
                {linking ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <MaterialIcons name="link" size={18} color="#fff" />
                    <Text style={styles.linkBtnText}>Connect Patient</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 40 }} />
        ) : linkedPatients.length === 0 ? (
          <View style={styles.darkEmptyContainer}>
            <View style={styles.darkEmptyIcon}>
              <MaterialIcons name="family-restroom" size={40} color="rgba(99,102,241,0.6)" />
            </View>
            <Text style={styles.darkEmptyTitle}>No Linked Patients</Text>
            <Text style={styles.darkEmptySubtitle}>
              Tap "Link Patient Profile" above to start monitoring.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.darkSectionLabel}>MONITORING ({linkedPatients.length})</Text>
            {linkedPatients.map((patient, i) => {
              const isEmergency = activeAlerts.includes(patient.id);
              
              return (
                <Animated.View key={patient.id} entering={FadeInRight.delay(i * 100)} style={isEmergency ? pulseStyle : null}>
                  <TouchableOpacity
                    style={[styles.darkPatientCard, isEmergency && { borderColor: '#EF4444' }]}
                    onPress={() => setSelectedPatient(patient)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient colors={isEmergency ? ['#EF4444', '#B91C1C'] : ['#3B82F6', '#8B5CF6']} style={styles.darkPatientAvatar}>
                      <Text style={styles.darkPatientAvatarText}>
                        {isEmergency ? '⚠️' : patient.full_name.charAt(0)}
                      </Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.darkPatientName}>{patient.full_name}</Text>
                      <View style={styles.darkPatientStatus}>
                         <View style={[styles.statusDot, { backgroundColor: isEmergency ? '#EF4444' : '#10B981' }]} />
                         <Text style={[styles.darkPatientSub, isEmergency && { color: '#EF4444', fontWeight: '800' }]}>
                           {isEmergency ? 'FALL DETECTED' : 'Active'}
                         </Text>
                      </View>
                    </View>
                    <View style={styles.darkPatientArrow}>
                      <MaterialIcons name="chevron-right" size={20} color={isEmergency ? '#EF4444' : "rgba(255,255,255,0.4)"} />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  darkContainer: { flex: 1, backgroundColor: '#0F172A' },
  scrollContent: { padding: 16 },
  darkScrollContent: { padding: 16, paddingBottom: 40 },
  
  glassCard: { borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 1 },
  cardTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 1, marginBottom: 16 },
  
  headerPane: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 50, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(150,150,150,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  mapBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(99,102,241,0.1)', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  
  emergencyBanner: { backgroundColor: '#EF4444', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, marginBottom: 16 },
  emergencyText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  subAction: { flex: 1, padding: 16, borderRadius: 20, alignItems: 'center', gap: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  subActionText: { fontSize: 12, fontWeight: '700' },

  // Summary Grid
  medSummaryGrid: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  medSummaryMain: { flex: 1.2, paddingRight: 16, borderRightWidth: 1 },
  upcomingTime: { fontSize: 28, fontWeight: '900', letterSpacing: -1, marginBottom: 2 },
  upcomingMed: { fontSize: 15, fontWeight: '700' },
  medSummaryStats: { flex: 1, paddingLeft: 16, gap: 12 },
  statMini: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statMiniIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  statMiniVal: { fontSize: 16, fontWeight: '800', lineHeight: 16 },
  statMiniLabel: { fontSize: 10, color: 'rgba(150,150,150,0.6)', fontWeight: '700' },
  
  progressTrack: { height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 3 },

  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyType: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  historyTime: { fontSize: 13 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  
  medicationList: { gap: 12 },
  medItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  medNameSmall: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  medSub: { fontSize: 13 },
  emptyText: { fontStyle: 'italic', paddingVertical: 10 },
  
  panelHeader: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  panelHeaderTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  panelHeaderLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 2, marginBottom: 4 },
  panelHeaderTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  panelStatsBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 },
  panelStatItem: { flex: 1 },
  panelStatNum: { fontSize: 28, fontWeight: '800', color: '#fff' },
  panelStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 2 },

  linkBannerDark: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(99,102,241,0.12)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.35)', borderRadius: 14, padding: 14, marginBottom: 10 },
  linkBannerIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.2)', justifyContent: 'center', alignItems: 'center' },
  linkBannerText: { flex: 1, color: '#818CF8', fontWeight: '700', fontSize: 14 },
  linkFormDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, marginBottom: 12, gap: 12 },
  linkFormHint: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  darkInput: { height: 60, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  linkBtnDark: { borderRadius: 14, overflow: 'hidden' },
  linkBtnGradient: { height: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  linkBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  darkSectionLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 10, marginLeft: 4 },
  darkPatientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 14, marginBottom: 10, gap: 12 },
  darkPatientAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  darkPatientAvatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  darkPatientName: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
  darkPatientStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  darkPatientSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  darkPatientArrow: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },

  darkEmptyContainer: { alignItems: 'center', paddingTop: 60, gap: 12 },
  darkEmptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(99,102,241,0.1)', justifyContent: 'center', alignItems: 'center' },
  darkEmptyTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  darkEmptySubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
});

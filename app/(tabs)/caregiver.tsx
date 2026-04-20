import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Dimensions } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing, HeaderGradient } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { useTranslation } from 'react-i18next';
import { useMedicationViewModel } from '@/src/viewmodels/useMedicationViewModel';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeInRight, withRepeat, withTiming, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { CaregiverService } from '@/src/services/CaregiverService';
import { supabase } from '@/src/services/SupabaseService';

const { width } = Dimensions.get('window');

export default function CaregiverDashboard() {
  const colorScheme = useColorScheme() ?? 'light';
  const C = Colors[colorScheme as 'light' | 'dark'];
  const isDark = colorScheme === 'dark';
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
      const interval = setInterval(loadPatients, 30000);
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
        const ids = patients.map((p: any) => p.id);
        const alerts = await CaregiverService.getActiveAlerts(ids);
        setActiveAlerts(alerts.map((a: any) => a.patientid));
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
      Alert.alert('Success', 'Patient linked successfully!');
      setLinkCode('');
      setShowLinkForm(false);
      await loadPatients();
    } catch (error: any) {
      Alert.alert('Error', error.message);
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
      params: { patientId: selectedPatient.id, patientName: selectedPatient.full_name },
    });
  };

  // ── Patient detail view ──────────────────────────────────────────────────────
  if (selectedPatient) {
    const isEmergency = activeAlerts.includes(selectedPatient.id);
    const adherencePct = medSummary.totalToday > 0
      ? Math.round((medSummary.takenCount / medSummary.totalToday) * 100)
      : 100;

    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <Stack.Screen options={{ headerShown: false }} />

        <LinearGradient
          colors={isEmergency ? ['#7f1d1d', '#450a0a'] : HeaderGradient}
          style={styles.detailHeader}
        >
          <TouchableOpacity onPress={() => setSelectedPatient(null)} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.detailHeaderName}>{selectedPatient.full_name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.statusDot, { backgroundColor: isEmergency ? '#FCA5A5' : '#34D399' }]} />
              <Text style={[styles.detailHeaderStatus, { color: isEmergency ? '#FCA5A5' : '#34D399' }]}>
                {isEmergency ? 'FALL DETECTED' : 'MONITORING ACTIVE'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={navigateToTracking} style={styles.mapBtn}>
            <MaterialIcons name="my-location" size={20} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {isEmergency && (
            <Animated.View entering={FadeInUp} style={styles.emergencyBanner}>
              <MaterialIcons name="warning" size={18} color="#fff" />
              <Text style={styles.emergencyText}>Unresolved fall! Please check on them immediately.</Text>
            </Animated.View>
          )}

          {/* Quick action tiles */}
          <View style={styles.actionRow}>
            {[
              { label: 'Live GPS',  icon: 'my-location',      color: '#2563EB', bg: isDark ? '#1E3A5F' : '#EFF6FF', border: isDark ? '#2563EB40' : '#BFDBFE', onPress: navigateToTracking },
              { label: 'Message',  icon: 'chat-bubble-outline', color: '#EA580C', bg: isDark ? '#3B1F0F' : '#FFF7ED', border: isDark ? '#EA580C40' : '#FED7AA', onPress: () => router.push({ pathname: '/chat-room', params: { partnerId: selectedPatient.id, partnerName: selectedPatient.full_name } }) },
              { label: 'Contacts', icon: 'contact-phone',      color: '#DC2626', bg: isDark ? '#3B0F0F' : '#FEF2F2', border: isDark ? '#DC262640' : '#FECACA', onPress: () => router.push({ pathname: '/emergency-contacts', params: { patientId: selectedPatient.id } }) },
            ].map((tile) => (
              <TouchableOpacity
                key={tile.label}
                style={[styles.actionTile, { backgroundColor: tile.bg, borderColor: tile.border }]}
                onPress={tile.onPress}
                activeOpacity={0.8}
              >
                <View style={[styles.actionTileIcon, { backgroundColor: tile.color + '25' }]}>
                  <MaterialIcons name={tile.icon as any} size={22} color={tile.color} />
                </View>
                <Text style={[styles.actionTileLabel, { color: tile.color }]}>{tile.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Medication compliance card */}
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBadge, { backgroundColor: C.tint + '20' }]}>
                <MaterialIcons name="medication" size={16} color={C.tint} />
              </View>
              <Text style={[styles.cardHeading, { color: C.text }]}>Daily Compliance</Text>
              <View style={[styles.pctBadge, { backgroundColor: adherencePct >= 80 ? '#D1FAE5' : '#FEF3C7' }]}>
                <Text style={[styles.pctBadgeText, { color: adherencePct >= 80 ? '#065F46' : '#92400E' }]}>{adherencePct}%</Text>
              </View>
            </View>

            <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', marginBottom: 16 }]}>
              <View style={[styles.progressBar, {
                width: `${adherencePct}%`,
                backgroundColor: adherencePct >= 80 ? '#10B981' : '#F59E0B',
              }]} />
            </View>

            <View style={styles.statsRow}>
              {[
                { label: 'Taken',   value: medSummary.takenCount,   color: '#10B981', bg: isDark ? '#10B98120' : '#D1FAE5', icon: 'check-circle' },
                { label: 'Missed',  value: medSummary.missedCount,  color: '#EF4444', bg: isDark ? '#EF444420' : '#FEE2E2', icon: 'cancel' },
                { label: 'Pending', value: medSummary.pendingCount, color: C.tint,    bg: isDark ? C.tint + '20' : '#E0E7FF', icon: 'schedule' },
              ].map(s => (
                <View key={s.label} style={[styles.statChip, { backgroundColor: s.bg }]}>
                  <MaterialIcons name={s.icon as any} size={16} color={s.color} />
                  <Text style={[styles.statChipNum, { color: s.color }]}>{s.value}</Text>
                  <Text style={[styles.statChipLabel, { color: s.color }]}>{s.label}</Text>
                </View>
              ))}
            </View>

            {medSummary.upcomingDose && (
              <View style={[styles.nextDoseRow, { backgroundColor: C.background, borderColor: C.border }]}>
                <MaterialIcons name="alarm" size={16} color={C.tint} />
                <Text style={[styles.nextDoseText, { color: C.text }]}>
                  Next: <Text style={{ fontWeight: '800', color: C.tint }}>{medSummary.upcomingDose.name}</Text> at {medSummary.upcomingDose.time}
                </Text>
              </View>
            )}
          </View>

          {/* Emergency history */}
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBadge, { backgroundColor: isDark ? '#EF444420' : '#FEE2E2' }]}>
                <MaterialIcons name="warning" size={16} color="#EF4444" />
              </View>
              <Text style={[styles.cardHeading, { color: C.text }]}>Emergency Alerts</Text>
              <View style={[styles.pctBadge, { backgroundColor: history.length > 0 ? (isDark ? '#EF444420' : '#FEE2E2') : (isDark ? '#10B98120' : '#D1FAE5') }]}>
                <Text style={[styles.pctBadgeText, { color: history.length > 0 ? '#EF4444' : '#10B981' }]}>{history.length}</Text>
              </View>
            </View>
            {history.length === 0 ? (
              <View style={styles.emptyStateRow}>
                <MaterialIcons name="check-circle-outline" size={28} color="#10B981" />
                <Text style={[styles.emptyStateText, { color: C.muted }]}>No past emergency events</Text>
              </View>
            ) : (
              history.slice(0, 5).map((h, i) => {
                const resolved = h.status === 'resolved';
                return (
                  <View key={h.id} style={[styles.historyItem, { borderBottomColor: C.border }, i === history.slice(0, 5).length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={[styles.historyIconWrap, { backgroundColor: resolved ? (isDark ? '#10B98120' : '#D1FAE5') : (isDark ? '#EF444420' : '#FEE2E2') }]}>
                      <MaterialIcons name={resolved ? 'check' : 'warning'} size={14} color={resolved ? '#10B981' : '#EF4444'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.historyType, { color: C.text }]}>
                        {h.source === 'foreground' ? 'Fall Detected' : 'Triggered Alert'}
                      </Text>
                      <Text style={[styles.historyTime, { color: C.muted }]}>
                        {new Date(h.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={[styles.statusTag, { backgroundColor: resolved ? (isDark ? '#10B98120' : '#D1FAE5') : (isDark ? '#EF444420' : '#FEE2E2') }]}>
                      <Text style={{ fontSize: 9, fontWeight: '900', color: resolved ? '#10B981' : '#EF4444' }}>
                        {resolved ? 'RESOLVED' : 'OPEN'}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Medication schedule */}
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, marginBottom: 40 }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBadge, { backgroundColor: C.tint + '20' }]}>
                <MaterialIcons name="medication" size={16} color={C.tint} />
              </View>
              <Text style={[styles.cardHeading, { color: C.text }]}>Medication Schedule</Text>
            </View>
            {patientMeds.length === 0 ? (
              <View style={styles.emptyStateRow}>
                <MaterialIcons name="info-outline" size={24} color={C.muted} />
                <Text style={[styles.emptyStateText, { color: C.muted }]}>No active medications</Text>
              </View>
            ) : (
              medSummary.fullSchedule.map((item, idx) => {
                const taken = item.status === 'taken';
                const missed = item.status === 'missed';
                return (
                  <View key={`${item.medId}-${idx}`} style={[styles.medItem, { borderBottomColor: C.border }, idx === medSummary.fullSchedule.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={[styles.medDot, { backgroundColor: taken ? '#10B981' : missed ? '#EF4444' : C.muted }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.medNameSmall, { color: C.text }]}>{item.name}</Text>
                      <Text style={[styles.medSub, { color: C.muted }]}>{item.time}</Text>
                    </View>
                    <View style={[styles.statusTag, {
                      backgroundColor: taken ? (isDark ? '#10B98120' : '#D1FAE5') : missed ? (isDark ? '#EF444420' : '#FEE2E2') : (isDark ? 'rgba(255,255,255,0.06)' : C.background),
                    }]}>
                      <Text style={{ fontSize: 9, fontWeight: '900', color: taken ? '#10B981' : missed ? '#EF4444' : C.muted }}>
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

        </ScrollView>
      </View>
    );
  }

  // ── Patient list view ────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={HeaderGradient}
        style={styles.panelHeader}
      >
        <View style={styles.panelHeaderTop}>
          <View>
            <Text style={styles.panelHeaderLabel}>CAREGIVER DASHBOARD</Text>
            <Text style={styles.panelHeaderTitle}>Your Loved Ones</Text>
          </View>
        </View>
        <View style={[styles.panelStatsBar, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
          <View style={styles.panelStatItem}>
            <Text style={styles.panelStatNum}>{linkedPatients.length}</Text>
            <Text style={styles.panelStatLabel}>Monitored Patients</Text>
          </View>
          <View style={[styles.panelStatItem, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.2)', paddingLeft: 15 }]}>
            <Text style={[styles.panelStatNum, { color: activeAlerts.length > 0 ? '#FCA5A5' : '#6EE7B7' }]}>{activeAlerts.length}</Text>
            <Text style={styles.panelStatLabel}>Active Alerts</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>

        {/* Link patient banner */}
        <TouchableOpacity
          style={[styles.linkBanner, { backgroundColor: C.tint + '15', borderColor: C.tint + '50' }]}
          onPress={() => setShowLinkForm(!showLinkForm)}
          activeOpacity={0.8}
        >
          <View style={[styles.linkBannerIcon, { backgroundColor: C.tint + '20' }]}>
            <MaterialIcons name="person-add" size={18} color={C.tint} />
          </View>
          <Text style={[styles.linkBannerText, { color: C.tint }]}>Link Patient Profile</Text>
          <MaterialIcons name={showLinkForm ? 'expand-less' : 'expand-more'} size={20} color={C.tint} />
        </TouchableOpacity>

        {showLinkForm && (
          <View style={[styles.linkForm, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.linkFormHint, { color: C.muted }]}>Enter the 6-digit code from the patient's home screen</Text>
            <TextInput
              style={[styles.linkInput, { backgroundColor: C.background, borderColor: C.border, color: C.text }]}
              placeholder="000000"
              placeholderTextColor={C.muted}
              value={linkCode}
              onChangeText={setLinkCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity style={styles.linkBtnWrap} onPress={handleLinkPatient} disabled={linking}>
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
          <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 40 }} />
        ) : linkedPatients.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: C.tint + '15' }]}>
              <MaterialIcons name="family-restroom" size={40} color={C.tint} />
            </View>
            <Text style={[styles.emptyTitle, { color: C.text }]}>No Linked Patients</Text>
            <Text style={[styles.emptySubtitle, { color: C.muted }]}>
              Tap "Link Patient Profile" above to start monitoring.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: C.muted }]}>MONITORING ({linkedPatients.length})</Text>
            {linkedPatients.map((patient, i) => {
              const isEmergency = activeAlerts.includes(patient.id);
              return (
                <Animated.View key={patient.id} entering={FadeInRight.delay(i * 100)} style={isEmergency ? pulseStyle : null}>
                  <TouchableOpacity
                    style={[styles.patientCard, { backgroundColor: C.card, borderColor: isEmergency ? '#EF4444' : C.border }]}
                    onPress={() => setSelectedPatient(patient)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={isEmergency ? ['#EF4444', '#B91C1C'] : [C.tint, isDark ? '#818CF8' : '#A78BFA']}
                      style={styles.patientAvatar}
                    >
                      <Text style={styles.patientAvatarText}>
                        {isEmergency ? '⚠️' : patient.full_name.charAt(0)}
                      </Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.patientName, { color: C.text }]}>{patient.full_name}</Text>
                      <View style={styles.patientStatusRow}>
                        <View style={[styles.statusDot, { backgroundColor: isEmergency ? '#EF4444' : '#10B981' }]} />
                        <Text style={[styles.patientSub, { color: isEmergency ? '#EF4444' : C.muted, fontWeight: isEmergency ? '800' : '500' }]}>
                          {isEmergency ? 'FALL DETECTED' : 'Active'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.patientArrow, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : C.tint + '12' }]}>
                      <MaterialIcons name="chevron-right" size={20} color={isEmergency ? '#EF4444' : C.tint} />
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
  scrollContent: { padding: 16 },

  statusDot: { width: 8, height: 8, borderRadius: 4 },

  // Detail header
  detailHeader: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailHeaderName: { fontSize: 20, fontWeight: '900', color: '#fff' },
  detailHeaderStatus: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  mapBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitleWrap: { flex: 1 },

  emergencyBanner: { backgroundColor: '#EF4444', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, marginBottom: 16 },
  emergencyText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Action tiles
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  actionTile: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 12, alignItems: 'center', gap: 8 },
  actionTileIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionTileLabel: { fontSize: 12, fontWeight: '700' },

  // Cards
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardIconBadge: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardHeading: { flex: 1, fontSize: 15, fontWeight: '800' },

  pctBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pctBadgeText: { fontSize: 13, fontWeight: '900' },

  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 3 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, padding: 10, borderRadius: 12 },
  statChipNum: { fontSize: 16, fontWeight: '900' },
  statChipLabel: { fontSize: 11, fontWeight: '700' },

  nextDoseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  nextDoseText: { flex: 1, fontSize: 13, fontWeight: '600' },

  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  historyType: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  historyTime: { fontSize: 13 },
  historyIconWrap: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },

  medItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  medNameSmall: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  medSub: { fontSize: 13 },
  medDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },

  emptyStateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, justifyContent: 'center' },
  emptyStateText: { fontSize: 14, fontWeight: '600' },

  // Patient list header
  panelHeader: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  panelHeaderTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  panelHeaderLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.65)', letterSpacing: 2, marginBottom: 4 },
  panelHeaderTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  panelStatsBar: { flexDirection: 'row', borderRadius: 12, padding: 14 },
  panelStatItem: { flex: 1 },
  panelStatNum: { fontSize: 28, fontWeight: '800', color: '#fff' },
  panelStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 2 },

  // Link patient
  linkBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  linkBannerIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  linkBannerText: { flex: 1, fontWeight: '700', fontSize: 14 },
  linkForm: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12, gap: 12 },
  linkFormHint: { fontSize: 13 },
  linkInput: { height: 60, borderRadius: 14, borderWidth: 1, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  linkBtnWrap: { borderRadius: 14, overflow: 'hidden' },
  linkBtnGradient: { height: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  linkBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Patient cards
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 10, marginLeft: 4 },
  patientCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10, gap: 12 },
  patientAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  patientAvatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  patientName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  patientStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  patientSub: { fontSize: 12 },
  patientArrow: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
});

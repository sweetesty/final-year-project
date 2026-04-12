import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, Alert, Linking, Platform,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Colors, Spacing, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { supabase } from '@/src/services/SupabaseService';
import { DoctorService } from '@/src/services/DoctorService';
import { OfflineSyncService } from '@/src/services/OfflineSyncService';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

// ── Pulsing dot for live indicator ─────────────────────────────────────────
function PulseDot({ color = '#10B981' }: { color?: string }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(withSequence(withTiming(1.5, { duration: 600 }), withTiming(1, { duration: 600 })), -1);
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, style]} />;
}

export default function DoctorHomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { session } = useAuthViewModel();
  const router = useRouter();
  const { t } = useTranslation();

  const [stats, setStats] = useState({ patients: 0, alerts: 0 });
  const [linkedPatients, setLinkedPatients] = useState<any[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const doctorName = session?.user?.user_metadata?.full_name || 'Doctor';
  const firstName = doctorName.split(' ')[0];

  const h = new Date().getHours();
  const greeting = h < 12 ? t('home.welcome') : h < 17 ? t('home.good_afternoon') : t('home.good_evening');

  const load = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const patients = await DoctorService.getLinkedPatients(session.user.id);
      const enhanced = await Promise.all(
        patients.map(async (p) => {
          const ctx = await DoctorService.getPatientClinicalContext(p.id);
          return { ...p, ...ctx };
        })
      );
      setLinkedPatients(enhanced);
      const alerts = await DoctorService.getUnresolvedAlerts(session.user.id);
      setActiveAlerts(alerts);
      setStats({ patients: patients.length, alerts: alerts.length });
    } catch (e) {
      console.error('[DoctorHome]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase.channel('doctor-home-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fall_events' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, load]);

  useEffect(() => { load(); }, [load]);

  const handleAcceptAlert = async (alertId: string) => {
    try {
      await DoctorService.acceptAlert(alertId, session!.user.id);
      Alert.alert('Case Accepted', 'You have been assigned. Contact the patient immediately.');
      load();
    } catch { Alert.alert('Error', 'Could not accept alert.'); }
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: isDark ? '#080C18' : '#F0F4FF' }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6366F1" />}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#1E1B4B', '#312E81', '#4338CA']}
        style={styles.header}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        {/* grid overlay */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={[styles.gridLine, { top: i * 32 }]} />
          ))}
        </View>

        <Animated.View entering={FadeIn.duration(500)} style={styles.headerTop}>
          <View>
            <Text style={styles.headerGreeting}>{greeting}</Text>
            <Text style={styles.headerName}>Dr. {firstName}</Text>
            <View style={styles.livePill}>
              <PulseDot color="#34D399" />
              <Text style={styles.livePillText}>Clinical Dashboard</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/clinical-alerts')} activeOpacity={0.8}>
              <MaterialIcons name="notifications-none" size={22} color="#fff" />
              {stats.alerts > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{stats.alerts}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => OfflineSyncService.clearQueue().catch(() => {})} activeOpacity={0.8}>
              <MaterialIcons name="cleaning-services" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Stat cards */}
        <Animated.View entering={FadeInDown.delay(150).duration(450)} style={styles.statsRow}>
          {[
            { label: t('doctor.active_patients'), value: stats.patients, icon: 'people', color: '#818CF8' },
            { label: t('doctor.recent_alerts'), value: stats.alerts, icon: 'notification-important', color: stats.alerts > 0 ? '#F87171' : '#34D399' },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: s.color + '25' }]}>
                <MaterialIcons name={s.icon as any} size={18} color={s.color} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>
      </LinearGradient>

      <View style={styles.body}>

        {/* ── Active Emergencies ──────────────────────────────────── */}
        {activeAlerts.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <PulseDot color="#EF4444" />
                <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>
                  {t('doctor.active_emergencies').toUpperCase()}
                </Text>
              </View>
            </View>
            {activeAlerts.map((alert, i) => (
              <Animated.View key={alert.id} entering={FadeInDown.delay(i * 60).duration(350)}>
                <LinearGradient colors={['#450a0a', '#7f1d1d']} style={styles.emergencyCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <View style={styles.emergencyTop}>
                    <View style={styles.emergencyIconWrap}>
                      <MaterialIcons name="warning" size={22} color="#FCA5A5" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.emergencyPatient}>{alert.profiles?.full_name ?? 'Unknown Patient'}</Text>
                      <Text style={styles.emergencyCondition}>Fall Detected · {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    <View style={styles.emergencyPulseDot}>
                      <PulseDot color="#FCA5A5" />
                    </View>
                  </View>
                  <View style={styles.emergencyActions}>
                    <TouchableOpacity style={[styles.emergencyBtn, { backgroundColor: '#DC2626' }]} onPress={() => handleAcceptAlert(alert.id)}>
                      <MaterialIcons name="check-circle" size={16} color="#fff" />
                      <Text style={styles.emergencyBtnText}>{t('doctor.accept_case')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.emergencyBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]} onPress={() => Linking.openURL('tel:+000000000')}>
                      <MaterialIcons name="call" size={16} color="#fff" />
                      <Text style={styles.emergencyBtnText}>{t('common.call')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.emergencyBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]} onPress={() => router.push({ pathname: '/chat-room', params: { partnerId: alert.patientid, partnerName: alert.profiles?.full_name } })}>
                      <MaterialIcons name="chat" size={16} color="#fff" />
                      <Text style={styles.emergencyBtnText}>{t('common.message')}</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </Animated.View>
            ))}
          </Animated.View>
        )}

        {/* ── Patient Monitor ─────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <MaterialIcons name="monitor-heart" size={18} color="#6366F1" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
              {t('doctor.clinical_monitoring')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/doctor')} style={styles.seeAllBtn}>
            <Text style={styles.seeAllText}>Manage</Text>
            <MaterialIcons name="chevron-right" size={16} color="#6366F1" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#6366F1" style={{ marginVertical: 32 }} />
        ) : linkedPatients.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(400)} style={[styles.emptyCard, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            <LinearGradient colors={['#6366F115', '#818CF815']} style={styles.emptyIconWrap}>
              <MaterialIcons name="people-outline" size={36} color="#6366F1" />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>No Linked Patients</Text>
            <Text style={[styles.emptySubtitle, { color: isDark ? '#64748B' : '#94A3B8' }]}>{t('doctor.no_patients')}</Text>
            <TouchableOpacity style={styles.linkPatientBtn} onPress={() => router.push('/(tabs)/doctor')}>
              <MaterialIcons name="person-add" size={18} color="#fff" />
              <Text style={styles.linkPatientBtnText}>Link Patient</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          linkedPatients.map((p, i) => {
            const isSelected = selectedPatient?.id === p.id;
            const riskColor = p.riskLevel === 'High' ? '#EF4444' : p.riskLevel === 'Medium' ? '#F59E0B' : '#10B981';
            return (
              <Animated.View key={p.id} entering={FadeInDown.delay(i * 60).duration(380)}>
                <TouchableOpacity
                  style={[styles.patientCard, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isSelected ? '#6366F1' : isDark ? '#334155' : '#E2E8F0' }]}
                  onPress={() => setSelectedPatient(isSelected ? null : p)}
                  activeOpacity={0.85}
                >
                  <View style={styles.patientCardTop}>
                    <View style={styles.patientAvatarWrap}>
                      <LinearGradient colors={['#6366F1', '#818CF8']} style={styles.patientAvatar}>
                        <Text style={styles.patientInitial}>{(p.full_name || 'P').charAt(0)}</Text>
                      </LinearGradient>
                      <View style={[styles.onlineDot, { backgroundColor: p.isOnline ? '#10B981' : '#64748B' }]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.patientName, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>{p.full_name}</Text>
                      <View style={styles.patientMeta}>
                        <View style={[styles.riskBadge, { backgroundColor: riskColor + '18' }]}>
                          <Text style={[styles.riskText, { color: riskColor }]}>{(p.riskLevel || 'Low').toUpperCase()}</Text>
                        </View>
                        <Text style={[styles.patientStatus, { color: isDark ? '#64748B' : '#94A3B8' }]}>
                          {p.isOnline ? t('common.active_now') : t('common.offline')}
                        </Text>
                      </View>
                    </View>
                    <MaterialIcons name={isSelected ? 'expand-less' : 'expand-more'} size={22} color={isDark ? '#64748B' : '#94A3B8'} />
                  </View>

                  {isSelected && (
                    <View style={[styles.patientExpanded, { borderTopColor: isDark ? '#334155' : '#F1F5F9' }]}>
                      <View style={styles.vitalsRow}>
                        {[
                          { label: 'Heart Rate', value: p.latestVital?.heartrate ?? '--', unit: 'bpm', color: '#EF4444', icon: 'favorite' },
                          { label: 'SpO₂', value: p.latestVital?.spo2 ?? '--', unit: '%', color: '#3B82F6', icon: 'air' },
                        ].map((v) => (
                          <View key={v.label} style={[styles.vitalMini, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
                            <MaterialIcons name={v.icon as any} size={14} color={v.color} />
                            <Text style={[styles.vitalMiniValue, { color: v.color }]}>{v.value}</Text>
                            <Text style={[styles.vitalMiniUnit, { color: isDark ? '#64748B' : '#94A3B8' }]}>{v.unit}</Text>
                            <Text style={[styles.vitalMiniLabel, { color: isDark ? '#64748B' : '#94A3B8' }]}>{v.label}</Text>
                          </View>
                        ))}
                      </View>
                      <TouchableOpacity
                        style={styles.viewProfileBtn}
                        onPress={() => router.push({ pathname: '/(tabs)/doctor', params: { patientId: p.id } })}
                      >
                        <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.viewProfileBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                          <MaterialIcons name="open-in-new" size={16} color="#fff" />
                          <Text style={styles.viewProfileBtnText}>{t('doctor.view_clinical_profile')}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })
        )}

        {/* ── Quick Actions ───────────────────────────────────────── */}
        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <View style={styles.sectionTitleRow}>
            <MaterialIcons name="bolt" size={18} color="#6366F1" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>Quick Actions</Text>
          </View>
        </View>

        <View style={styles.quickGrid}>
          {[
            { icon: 'person-add', label: 'Link Patient', color: '#6366F1', onPress: () => router.push('/(tabs)/doctor') },
            { icon: 'notification-important', label: 'View Alerts', color: '#EF4444', onPress: () => router.push('/(tabs)/clinical-alerts') },
            { icon: 'chat', label: 'Messages', color: '#10B981', onPress: () => router.push('/(tabs)/clinical-messages') },
            { icon: 'account-circle', label: 'My Profile', color: '#F59E0B', onPress: () => router.push('/(tabs)/clinical-profile') },
          ].map((a, i) => (
            <Animated.View key={a.label} entering={FadeInDown.delay(300 + i * 50).duration(350)} style={{ width: (width - Spacing.lg * 2 - 12) / 2 }}>
              <TouchableOpacity
                style={[styles.quickCard, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#E2E8F0' }]}
                onPress={a.onPress}
                activeOpacity={0.8}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: a.color + '18' }]}>
                  <MaterialIcons name={a.icon as any} size={24} color={a.color} />
                </View>
                <Text style={[styles.quickLabel, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>{a.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: { paddingTop: Platform.OS === 'ios' ? 58 : 44, paddingHorizontal: Spacing.lg, paddingBottom: 28, overflow: 'hidden' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  headerGreeting: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500', marginBottom: 2 },
  headerName: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.3 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, alignSelf: 'flex-start' },
  livePillText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 10 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  notifBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#1E1B4B' },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 14, gap: 4 },
  statIconWrap: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },

  // Body
  body: { padding: Spacing.lg, paddingTop: 20 },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, marginTop: 8 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { color: '#6366F1', fontSize: 13, fontWeight: '700' },

  // Emergency
  emergencyCard: { borderRadius: 20, padding: 18, marginBottom: 12, ...Shadows.medium },
  emergencyTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  emergencyIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(252,165,165,0.15)', justifyContent: 'center', alignItems: 'center' },
  emergencyPatient: { color: '#fff', fontSize: 16, fontWeight: '800' },
  emergencyCondition: { color: 'rgba(252,165,165,0.85)', fontSize: 12, fontWeight: '500', marginTop: 2 },
  emergencyPulseDot: { padding: 4 },
  emergencyActions: { flexDirection: 'row', gap: 8 },
  emergencyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  emergencyBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Empty
  emptyCard: { borderRadius: 20, padding: 32, alignItems: 'center', marginBottom: 16, ...Shadows.light },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  linkPatientBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#6366F1', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  linkPatientBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Patient card
  patientCard: { borderRadius: 18, borderWidth: 1.5, padding: 14, marginBottom: 12, ...Shadows.light },
  patientCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  patientAvatarWrap: { position: 'relative' },
  patientAvatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  patientInitial: { color: '#fff', fontSize: 18, fontWeight: '900' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
  patientName: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  patientMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  riskText: { fontSize: 10, fontWeight: '800' },
  patientStatus: { fontSize: 11 },
  patientExpanded: { marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
  vitalsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  vitalMini: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 2 },
  vitalMiniValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  vitalMiniUnit: { fontSize: 10, fontWeight: '600' },
  vitalMiniLabel: { fontSize: 10, marginTop: 2 },
  viewProfileBtn: { borderRadius: 14, overflow: 'hidden' },
  viewProfileBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  viewProfileBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Quick actions
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 40 },
  quickCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 10, alignItems: 'flex-start', ...Shadows.light },
  quickIconWrap: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  quickLabel: { fontSize: 14, fontWeight: '700' },
});

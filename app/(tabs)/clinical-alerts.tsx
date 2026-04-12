import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/src/services/SupabaseService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { DoctorService } from '@/src/services/DoctorService';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface AlertEvent {
  id: string;
  type: 'fall' | 'vitals';
  title: string;
  patientName: string;
  patientId: string;
  timestamp: string;
  severity: 'critical' | 'warning';
  data: string;
}

export default function ClinicalAlertsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const { session } = useAuthViewModel();
  const { t } = useTranslation();
  const router = useRouter();

  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAlerts = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const patientsProfiles = await DoctorService.getLinkedPatients(session.user.id);
      if (!patientsProfiles || patientsProfiles.length === 0) {
        setAlerts([]);
        return;
      }
      const patientIds = patientsProfiles.map(p => p.id);
      const patientMap = patientsProfiles.reduce((acc: any, curr: any) => {
        acc[curr.id] = curr.full_name || 'Unknown Patient';
        return acc;
      }, {});

      const { data: falls } = await supabase
        .from('fall_events').select('*').in('patientid', patientIds)
        .order('timestamp', { ascending: false }).limit(10);

      const fallAlerts: AlertEvent[] = (falls || []).map(f => ({
        id: `fall-${f.id}`,
        type: 'fall',
        title: 'Fall Detected',
        patientName: patientMap[f.patientid],
        patientId: f.patientid,
        timestamp: f.timestamp,
        severity: 'critical',
        data: 'Immediate response required.',
      }));

      const { data: vitals } = await supabase
        .from('vitals').select('*').in('patientid', patientIds)
        .or('heartrate.gt.120,heartrate.lt.50')
        .order('timestamp', { ascending: false }).limit(10);

      const vitalsAlerts: AlertEvent[] = (vitals || []).map(v => ({
        id: `vitals-${v.id}`,
        type: 'vitals',
        title: 'Abnormal Vitals',
        patientName: patientMap[v.patientid],
        patientId: v.patientid,
        timestamp: v.timestamp,
        severity: v.heartrate > 150 ? 'critical' : 'warning',
        data: `HR: ${v.heartrate} BPM | SpO2: ${v.spo2}%`,
      }));

      const combined = [...fallAlerts, ...vitalsAlerts].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setAlerts(combined);
    } catch (e) {
      console.error('[Alerts] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);
  const onRefresh = () => { setRefreshing(true); loadAlerts(); };

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  const renderItem = ({ item, index }: { item: AlertEvent; index: number }) => {
    const isCritical = item.severity === 'critical';
    const isFall = item.type === 'fall';
    const timeStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });

    return (
      <Animated.View entering={FadeInDown.delay(index * 80).duration(400)}>
        <TouchableOpacity
          style={styles.alertCard}
          onPress={() => router.push('/doctor')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={isCritical ? ['#1a0a0a', '#2d0f0f'] : ['#1a1400', '#2d2200']}
            style={styles.alertGradient}
          >
            {/* Left accent bar */}
            <View style={[styles.accentBar, { backgroundColor: isCritical ? '#EF4444' : '#F59E0B' }]} />

            <View style={styles.alertBody}>
              {/* Header row */}
              <View style={styles.alertHeaderRow}>
                <View style={[styles.alertIconBox, { backgroundColor: isCritical ? '#EF444420' : '#F59E0B20' }]}>
                  <MaterialIcons
                    name={isFall ? 'warning' : 'favorite'}
                    size={22}
                    color={isCritical ? '#EF4444' : '#F59E0B'}
                  />
                </View>
                <View style={styles.alertTitleBlock}>
                  <Text style={styles.alertTitle}>{item.title}</Text>
                  <Text style={styles.alertPatient}>{item.patientName}</Text>
                </View>
                <View style={styles.alertTimestamp}>
                  <View style={[styles.severityBadge, { backgroundColor: isCritical ? '#EF444430' : '#F59E0B30', borderColor: isCritical ? '#EF4444' : '#F59E0B' }]}>
                    <Text style={[styles.severityText, { color: isCritical ? '#EF4444' : '#F59E0B' }]}>
                      {isCritical ? t('doctor.critical').toUpperCase() : 'WARNING'}
                    </Text>
                  </View>
                  <Text style={styles.timeText}>{timeStr}</Text>
                  <Text style={styles.dateText}>{dateStr}</Text>
                </View>
              </View>

              {/* Data strip */}
              <View style={[styles.dataStrip, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                <MaterialIcons name="info-outline" size={14} color="rgba(255,255,255,0.4)" />
                <Text style={styles.dataText}>{item.data}</Text>
              </View>

              {/* Action row */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.reviewBtn} onPress={() => router.push('/doctor')}>
                  <Text style={styles.reviewBtnText}>Review Patient →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Premium Header */}
      <LinearGradient colors={['#1E1B4B', '#312E81', '#4338CA']} style={styles.header}>
        {/* Grid overlay */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {[...Array(6)].map((_, i) => (
            <View key={i} style={[styles.gridLine, { top: i * 28 }]} />
          ))}
        </View>

        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerLabel}>CLINICAL MONITORING</Text>
            <Text style={styles.headerTitle}>{t('doctor.alerts_title')}</Text>
          </View>
          <View style={[styles.liveChip, { backgroundColor: '#EF444420', borderColor: '#EF4444' }]}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Stat row */}
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#EF4444' }]}>{criticalCount}</Text>
            <Text style={styles.statDesc}>{t('doctor.critical')}</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{warningCount}</Text>
            <Text style={styles.statDesc}>{t('doctor.warnings')}</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#10B981' }]}>{alerts.length}</Text>
            <Text style={styles.statDesc}>Total</Text>
          </View>
        </View>
      </LinearGradient>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <MaterialIcons name="check-circle" size={40} color="#10B981" />
              </View>
              <Text style={styles.emptyTitle}>{t('doctor.no_alerts')}</Text>
              <Text style={styles.emptySubtitle}>{t('doctor.no_alerts_sub')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A' },
  header: {
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statCard: { flex: 1, alignItems: 'center' },
  statSep: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.15)' },
  statNumber: { fontSize: 28, fontWeight: '800' },
  statDesc: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 2 },
  list: { padding: 16, paddingBottom: 40 },
  alertCard: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  alertGradient: { flexDirection: 'row', borderRadius: 16 },
  accentBar: { width: 4, borderRadius: 4 },
  alertBody: { flex: 1, padding: 16, gap: 10 },
  alertHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  alertIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTitleBlock: { flex: 1 },
  alertTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  alertPatient: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  alertTimestamp: { alignItems: 'flex-end', gap: 4 },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  severityText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  timeText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  dateText: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  dataStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  dataText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500', flex: 1 },
  actionRow: { alignItems: 'flex-end' },
  reviewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(99,102,241,0.2)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.4)',
  },
  reviewBtnText: { color: '#818CF8', fontSize: 12, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B98115',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

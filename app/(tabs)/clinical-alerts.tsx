import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/src/services/SupabaseService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

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
      // 1. Get linked patients
      const { data: links } = await supabase
        .from('doctor_patient_links')
        .select('patient_id, patient:profiles!doctor_patient_links_patient_id_fkey(full_name)')
        .eq('doctor_id', session.user.id);

      if (!links || links.length === 0) {
        setAlerts([]);
        return;
      }

      const patientIds = links.map(l => l.patient_id);
      const patientMap = links.reduce((acc: any, curr: any) => {
        acc[curr.patient_id] = curr.patient?.full_name || 'Unknown Patient';
        return acc;
      }, {});

      // 2. Fetch Falls
      const { data: falls } = await supabase
        .from('fall_events')
        .select('*')
        .in('patientid', patientIds)
        .order('timestamp', { ascending: false })
        .limit(10);

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

      // 3. Fetch Critical Vitals (HR > 120 or < 50)
      const { data: vitals } = await supabase
        .from('vitals')
        .select('*')
        .in('patientid', patientIds)
        .or('heartrate.gt.120,heartrate.lt.50')
        .order('timestamp', { ascending: false })
        .limit(10);

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

      // 4. Combine and Sort
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

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAlerts();
  };

  const renderItem = ({ item }: { item: AlertEvent }) => {
    const isCritical = item.severity === 'critical';
    
    return (
      <TouchableOpacity 
        style={[styles.alertCard, { backgroundColor: themeColors.card }]}
        onPress={() => router.push('/doctor')} // In a real app, pass the patientId to the dashboard
      >
        <LinearGradient 
          colors={isCritical ? ['#FEF2F2', '#FFF1F2'] : ['#FFFBEB', '#FFFDF2']}
          style={[styles.alertHeader, { borderLeftColor: isCritical ? '#EF4444' : '#F59E0B' }]}
        >
          <View style={[styles.iconContainer, { backgroundColor: isCritical ? '#FEE2E2' : '#FEF3C7' }]}>
            <MaterialIcons 
              name={item.type === 'fall' ? 'warning' : 'favorite'} 
              size={24} 
              color={isCritical ? '#EF4444' : '#D97706'} 
            />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.alertTitle, { color: themeColors.text }]}>{item.title}</Text>
            <Text style={[styles.patientName, { color: themeColors.muted }]}>{item.patientName}</Text>
          </View>
          <View style={styles.timeContainer}>
            <Text style={[styles.timestamp, { color: themeColors.muted }]}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </LinearGradient>
        
        <View style={styles.alertContent}>
          <Text style={[styles.alertData, { color: themeColors.text }]}>{item.data}</Text>
          <View style={styles.actionContainer}>
            <Text style={[styles.actionText, { color: themeColors.tint }]}>Review Patient Profile →</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ title: 'Clinical Alerts', headerShown: true }} />
      
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#EF4444' }]}>{alerts.filter(a => a.severity === 'critical').length}</Text>
          <Text style={[styles.statLabel, { color: themeColors.muted }]}>{t('doctor.critical')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#F59E0B' }]}>{alerts.filter(a => a.severity === 'warning').length}</Text>
          <Text style={[styles.statLabel, { color: themeColors.muted }]}>{t('doctor.warnings')}</Text>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeColors.tint} />
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.tint} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="check-circle" size={64} color="#10B981" />
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>{t('doctor.no_alerts')}</Text>
              <Text style={[styles.emptySubtitle, { color: themeColors.muted }]}>{t('doctor.no_alerts_sub')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: Spacing.md,
  },
  statsStrip: {
    flexDirection: 'row',
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  alertCard: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    ...Shadows.light,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderLeftWidth: 4,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  patientName: {
    fontSize: 14,
  },
  timeContainer: {
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '500',
  },
  alertContent: {
    padding: Spacing.md,
    paddingTop: 0,
  },
  alertData: {
    fontSize: 14,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  actionContainer: {
    alignItems: 'flex-end',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: 40,
  },
});

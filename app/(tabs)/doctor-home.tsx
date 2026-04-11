import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Dimensions, TextInput, Alert, Linking } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { supabase } from '@/src/services/SupabaseService';
import { DoctorService } from '@/src/services/DoctorService';
import { OfflineSyncService } from '@/src/services/OfflineSyncService';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { VitalsTrendChart } from '@/src/components/AnalyticsCharts';

const { width } = Dimensions.get('window');

export default function DoctorHomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const { session } = useAuthViewModel();
  const router = useRouter();
  const { t } = useTranslation();

  const [stats, setStats] = useState({ patients: 0, alerts: 0 });
  const [linkedPatients, setLinkedPatients] = useState<any[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [selectedMonitorPatient, setSelectedMonitorPatient] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [patientCode, setPatientCode] = useState('');
  const [linking, setLinking] = useState(false);

  const doctorName = session?.user?.user_metadata?.full_name || 'Doctor';

  const loadDashboardData = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      // 1. Get linked patients with profile info
      const patients = await DoctorService.getLinkedPatients(session.user.id);
      
      // Enhance patients with real-time clinical context
      const enhancedPatients = await Promise.all(
        patients.map(async (p) => {
          const context = await DoctorService.getPatientClinicalContext(p.id);
          return { ...p, ...context };
        })
      );
      setLinkedPatients(enhancedPatients);

      // 2. Get active unresolved alerts
      const currentAlerts = await DoctorService.getUnresolvedAlerts(session.user.id);
      setActiveAlerts(currentAlerts);

      setStats({ patients: patients.length, alerts: currentAlerts.length });
    } catch (e) {
      console.error('[DoctorHome] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  // --- Real-time Subscription ---
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fall_events' },
        (payload) => {
          console.log('[Realtime] Fall event detected:', payload);
          loadDashboardData(); // Refresh list on any change
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session, loadDashboardData]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleAcceptAlert = async (alertId: string) => {
    try {
      await DoctorService.acceptAlert(alertId, session!.user.id);
      Alert.alert('Case Accepted', 'You have been assigned to this emergency. Please contact the patient immediately.');
      loadDashboardData();
    } catch (e) {
      Alert.alert('Error', 'Could not accept alert.');
    }
  };

  const handleClearQueue = async () => {
    try {
      await OfflineSyncService.clearQueue();
      Alert.alert('Success', 'Offline sync queue has been cleared. Zombie errors should stop now.');
    } catch (e) {
      Alert.alert('Error', 'Could not clear queue.');
    }
  };

  const EmergencyAlertPanel = () => {
    if (activeAlerts.length === 0) return null;

    return (
      <View style={styles.emergencyContainer}>
        <View style={styles.emergencyHeader}>
          <Text style={styles.emergencyTitle}>🚨 {t('doctor.active_emergencies').toUpperCase()}</Text>
          <View style={styles.emergencyPulse} />
        </View>

        {activeAlerts.map(alert => (
          <View key={alert.id} style={[styles.emergencyCard, { backgroundColor: themeColors.card, borderColor: themeColors.emergency }]}>
            <View style={styles.emergencyInfo}>
              <View style={styles.emergencyRow}>
                <Text style={[styles.emergencyLabel, { color: themeColors.muted }]}>{t('common.patient')}:</Text>
                <Text style={[styles.emergencyValue, { color: themeColors.text }]}>{alert.profiles?.full_name}</Text>
              </View>
              <View style={styles.emergencyRow}>
                <Text style={[styles.emergencyLabel, { color: themeColors.muted }]}>{t('doctor.condition')}:</Text>
                <Text style={[styles.emergencyValue, { color: themeColors.emergency, fontWeight: '800' }]}>Fall Detected</Text>
              </View>
              <View style={styles.emergencyRow}>
                <Text style={[styles.emergencyLabel, { color: themeColors.muted }]}>{t('common.time')}:</Text>
                <Text style={[styles.emergencyValue, { color: themeColors.text }]}>
                  {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>

            <View style={styles.alertActions}>
              <TouchableOpacity 
                style={[styles.alertActionBtn, { backgroundColor: themeColors.emergency }]}
                onPress={() => handleAcceptAlert(alert.id)}
              >
                <MaterialIcons name="check-circle" size={18} color="#fff" />
                <Text style={styles.alertActionText}>{t('doctor.accept_case')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.alertActionBtn, { backgroundColor: themeColors.tint }]}
                onPress={() => Linking.openURL('tel:+123456789')} // Needs real patient phone
              >
                <MaterialIcons name="call" size={18} color="#fff" />
                <Text style={styles.alertActionText}>{t('common.call')}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.alertActionBtn, { backgroundColor: '#475569' }]}
                onPress={() => router.push({ pathname: '/chat-room', params: { partnerId: alert.patientid, partnerName: alert.profiles?.full_name } })}
              >
                <MaterialIcons name="chat" size={18} color="#fff" />
                <Text style={styles.alertActionText}>{t('common.message')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const PatientListCard = ({ patient }: { patient: any }) => {
    const isSelected = selectedMonitorPatient?.id === patient.id;
    const riskColor = 
      patient.riskLevel === 'High' ? themeColors.emergency : 
      patient.riskLevel === 'Medium' ? '#F59E0B' : '#10B981';

    return (
      <View style={[styles.patientMonitorCard, { backgroundColor: themeColors.card, borderColor: isSelected ? themeColors.tint : themeColors.border }]}>
        <TouchableOpacity
          onPress={() => setSelectedMonitorPatient(isSelected ? null : patient)}
          activeOpacity={0.85}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.avatarContainer}>
              <View style={[styles.patientAvatar, { backgroundColor: themeColors.tint + '20' }]}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: themeColors.tint }}>
                  {(patient.full_name || 'P').charAt(0)}
                </Text>
              </View>
              <View style={[styles.onlineIndicator, { backgroundColor: patient.isOnline ? '#10B981' : '#94A3B8' }]} />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.text }}>{patient.full_name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                 <View style={[styles.riskBadge, { backgroundColor: riskColor + '15' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: riskColor }}>{patient.riskLevel.toUpperCase()}</Text>
                 </View>
                 <Text style={{ fontSize: 11, color: themeColors.muted }}>
                    {patient.isOnline ? t('common.active') : `${t('common.offline')}`}
                 </Text>
              </View>
            </View>
          </View>
          <MaterialIcons 
            name={isSelected ? 'expand-less' : 'expand-more'} 
            size={24} color={themeColors.muted} 
          />
        </TouchableOpacity>

        {isSelected && (
          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: themeColors.border }}>
            <View style={styles.quickVitals}>
               <View style={styles.vStat}>
                  <Text style={styles.vLabel}>HR</Text>
                  <Text style={[styles.vValue, { color: themeColors.emergency }]}>{patient.latestVital?.heartrate || '--'} <Text style={styles.vUnit}>bpm</Text></Text>
               </View>
               <View style={styles.vStat}>
                  <Text style={styles.vLabel}>SpO2</Text>
                  <Text style={[styles.vValue, { color: themeColors.tint }]}>{patient.latestVital?.spo2 || '--'}<Text style={styles.vUnit}>%</Text></Text>
               </View>
            </View>
            <TouchableOpacity
              style={[styles.viewFullBtn, { backgroundColor: themeColors.tint }]}
              onPress={() => router.push({ pathname: '/doctor', params: { patientId: patient.id } })}
            >
              <MaterialIcons name="open-in-new" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>{t('doctor.view_clinical_profile')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const QuickAction = ({ icon, label, color, onPress }: any) => (
    <TouchableOpacity 
      style={[styles.actionCard, { backgroundColor: themeColors.card }]}
      onPress={onPress}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + '15' }]}>
        <MaterialIcons name={icon} size={28} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color: themeColors.text }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: themeColors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.tint} />}
    >
      <Stack.Screen options={{ title: t('doctor.home_title'), headerShown: false }} />
      
      <LinearGradient colors={[themeColors.tint, themeColors.tint + 'CC']} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{t('home.good_afternoon')},</Text>
            <Text style={styles.drName}>Dr. {doctorName.split(' ')[0]}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity 
              style={[styles.notifBtn, { backgroundColor: 'rgba(239,68,68,0.3)' }]} 
              onPress={handleClearQueue}
              activeOpacity={0.7}
            >
              <MaterialIcons name="cleaning-services" size={24} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/clinical-alerts')}>
              <MaterialIcons name="notifications-none" size={26} color="#fff" />
              {stats.alerts > 0 && <View style={styles.notifBadge} />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.patients}</Text>
            <Text style={styles.statLabel}>{t('doctor.active_patients')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, stats.alerts > 0 && { color: '#FECACA' }]}>{stats.alerts}</Text>
            <Text style={styles.statLabel}>{t('doctor.recent_alerts')}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <EmergencyAlertPanel />

        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{t('doctor.clinical_monitoring')}</Text>

        {loading ? (
          <ActivityIndicator color={themeColors.tint} style={{ marginVertical: 24 }} />
        ) : linkedPatients.length === 0 ? (
          <View style={[styles.chartContainer, { backgroundColor: themeColors.card, alignItems: 'center', padding: 32 }]}>
            <MaterialIcons name="people-outline" size={48} color={themeColors.muted} />
            <Text style={{ color: themeColors.muted, marginTop: 12, textAlign: 'center' }}>{t('doctor.no_patients')}</Text>
          </View>
        ) : (
          linkedPatients.map((patient: any) => (
            <PatientListCard key={patient.id} patient={patient} />
          ))
        )}

        <Text style={[styles.sectionTitle, { color: themeColors.text, marginTop: 16 }]}>Quick Commands</Text>
        <View style={styles.actionsGrid}>
          <QuickAction 
            icon="report-problem" 
            label="Simulate Fall" 
            color={themeColors.emergency} 
            onPress={async () => {
               if (linkedPatients.length > 0) {
                 const { error } = await supabase.from('fall_events').insert({
                   patientid: linkedPatients[0].id,
                   status: 'unresolved'
                 });
                 if (error) Alert.alert('Error', error.message);
                 else Alert.alert('Simulated', 'A fall has been registered for ' + linkedPatients[0].full_name);
               }
            }} 
          />
          <QuickAction 
            icon="person-add" 
            label="Link Patient" 
            color="#3B82F6" 
            onPress={() => router.push('/doctor')} 
          />
          <QuickAction 
            icon="campaign" 
            label="Broadcast" 
            color="#ec4899" 
            onPress={() => {}} 
          />
          <QuickAction 
            icon="assignment" 
            label="Reporting" 
            color="#10B981" 
            onPress={() => {}} 
          />
          <QuickAction 
            icon="event" 
            label="Schedule" 
            color="#F59E0B" 
            onPress={() => {}} 
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  greeting: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '500',
  },
  drName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  statValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  content: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: Spacing.md,
    marginTop: Spacing.xl,
    paddingHorizontal: 4,
  },
  chartContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.light,
    marginBottom: Spacing.lg,
  },
  chartNote: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  actionCard: {
    width: (width - Spacing.lg * 2 - Spacing.md) / 2,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    ...Shadows.light,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  patientMonitorCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.light,
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
  },
  linkBtn: {
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Emergency Panel Styles
  emergencyContainer: {
    marginBottom: Spacing.xl,
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: 10,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#EF4444',
  },
  emergencyPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  emergencyCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    ...Shadows.medium,
    marginBottom: Spacing.md,
  },
  emergencyInfo: {
    marginBottom: Spacing.lg,
    gap: 8,
  },
  emergencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emergencyLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  emergencyValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
  },
  alertActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    gap: 6,
  },
  alertActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  // Enhanced Patient Card Styles
  avatarContainer: {
    position: 'relative',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  quickVitals: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.md,
  },
  vStat: {
    alignItems: 'center',
  },
  vLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 2,
  },
  vValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  vUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
});

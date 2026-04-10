import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Dimensions, TextInput, Alert } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { supabase } from '@/src/services/SupabaseService';
import { LinearGradient } from 'expo-linear-gradient';
import { VitalsTrendChart } from '@/src/components/AnalyticsCharts';

const { width } = Dimensions.get('window');

export default function DoctorHomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const { session } = useAuthViewModel();
  const router = useRouter();

  const [stats, setStats] = useState({ patients: 0, alerts: 0 });
  const [linkedPatients, setLinkedPatients] = useState<any[]>([]);
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
      const { data: links } = await supabase
        .from('doctor_patient_links')
        .select('patient_id, profiles:patient_id(id, full_name, patient_code)')
        .eq('doctor_id', session.user.id);

      const patients = (links || []).map((l: any) => l.profiles).filter(Boolean);
      setLinkedPatients(patients);

      // 2. Get active alerts (last 24h)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const patientIds = patients.map((p: any) => p.id);
      
      let alertCount = 0;
      if (patientIds.length > 0) {
        const { count: fallCount } = await supabase
          .from('fall_events')
          .select('*', { count: 'exact', head: true })
          .in('patientid', patientIds)
          .gte('timestamp', yesterday);
        alertCount = fallCount || 0;
      }

      setStats({ patients: patients.length, alerts: alertCount });
    } catch (e) {
      console.error('[DoctorHome] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleLinkPatient = async () => {
    if (!patientCode || patientCode.length < 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit patient code.');
      return;
    }
    setLinking(true);
    try {
      const { data: patient, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('patient_code', patientCode)
        .single();
      if (error || !patient) throw new Error('Patient code not found.');
      await supabase.from('doctor_patient_links').upsert({
        doctor_id: session!.user.id,
        patient_id: patient.id,
      }, { onConflict: 'doctor_id,patient_id', ignoreDuplicates: true });
      Alert.alert('Linked!', `${patient.full_name} has been added to your panel.`);
      setPatientCode('');
      setShowLinkForm(false);
      loadDashboardData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLinking(false);
    }
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
      <Stack.Screen options={{ title: 'Clinical Home', headerShown: false }} />
      
      <LinearGradient colors={[themeColors.tint, themeColors.tint + 'CC']} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Good Day,</Text>
            <Text style={styles.drName}>Dr. {doctorName.split(' ')[0]}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <MaterialIcons name="notifications-none" size={26} color="#fff" />
            {stats.alerts > 0 && <View style={styles.notifBadge} />}
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.patients}</Text>
            <Text style={styles.statLabel}>Active Patients</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, stats.alerts > 0 && { color: '#FECACA' }]}>{stats.alerts}</Text>
            <Text style={styles.statLabel}>Recent Alerts</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Clinical Monitoring</Text>

        {loading ? (
          <ActivityIndicator color={themeColors.tint} style={{ marginVertical: 24 }} />
        ) : linkedPatients.length === 0 ? (
          <View style={[styles.chartContainer, { backgroundColor: themeColors.card, alignItems: 'center', padding: 32 }]}>
            <MaterialIcons name="people-outline" size={48} color={themeColors.muted} />
            <Text style={{ color: themeColors.muted, marginTop: 12, textAlign: 'center' }}>No linked patients yet.{'\n'}Go to the Clinical Panel tab to link a patient.</Text>
          </View>
        ) : (
          linkedPatients.map((patient: any) => (
            <TouchableOpacity
              key={patient.id}
              onPress={() => setSelectedMonitorPatient(selectedMonitorPatient?.id === patient.id ? null : patient)}
              style={[styles.patientMonitorCard, { backgroundColor: themeColors.card, borderColor: selectedMonitorPatient?.id === patient.id ? themeColors.tint : themeColors.border }]}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.patientAvatar, { backgroundColor: themeColors.tint + '20' }]}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: themeColors.tint }}>
                      {(patient.full_name || 'P').charAt(0)}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.text }}>{patient.full_name}</Text>
                    <Text style={{ fontSize: 12, color: themeColors.muted }}>Code: {patient.patient_code || '------'}</Text>
                  </View>
                </View>
                <MaterialIcons 
                  name={selectedMonitorPatient?.id === patient.id ? 'expand-less' : 'expand-more'} 
                  size={24} color={themeColors.muted} 
                />
              </View>

              {selectedMonitorPatient?.id === patient.id && (
                <View style={{ marginTop: 16 }}>
                  <Text style={[styles.chartNote, { color: themeColors.muted, marginBottom: 8 }]}>7-Day Vitals Overview</Text>
                  <VitalsTrendChart 
                    labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
                    data={[72, 75, 71, 78, 74, 72, 73]}
                    theme={{ ...themeColors, vital: '#10B981' }} 
                  />
                  <TouchableOpacity
                    style={[styles.viewFullBtn, { backgroundColor: themeColors.tint }]}
                    onPress={() => router.push({ pathname: '/doctor', params: { patientId: patient.id } })}
                  >
                    <MaterialIcons name="open-in-new" size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>Full Clinical Profile</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}

        <Text style={[styles.sectionTitle, { color: themeColors.text, marginTop: 16 }]}>Quick Commands</Text>
        <View style={styles.actionsGrid}>
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
  linkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  linkFormInline: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  linkInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  linkBtn: {
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

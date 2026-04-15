import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Dimensions, ScrollView, Alert } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/src/services/SupabaseService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { DoctorService } from '@/src/services/DoctorService';
import { CaregiverService } from '@/src/services/CaregiverService';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

type EventType = 'all' | 'falls' | 'meds' | 'symptoms';

interface TimelineEvent {
  id: string;
  type: 'fall' | 'med' | 'symptom';
  title: string;
  patientName: string;
  patientId: string;
  timestamp: string;
  description: string;
  status?: string;
  severity: 'critical' | 'warning' | 'normal' | 'info';
  icon: any;
  color: string;
}

const CATEGORIES: { id: EventType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'falls', label: 'Falls' },
  { id: 'meds', label: 'Meds' },
  { id: 'symptoms', label: 'Symptoms' },
];

export default function HealthHistoryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const { session, role } = useAuthViewModel();
  const { t } = useTranslation();
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState<EventType>('all');
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!session?.user?.id || !role) return;
    setLoading(true);
    try {
      // 1. Fetch patients based on role
      let patientsProfiles: any[] = [];
      if (role === 'doctor') {
        patientsProfiles = await DoctorService.getLinkedPatients(session.user.id);
      } else if (role === 'caregiver') {
        patientsProfiles = await CaregiverService.getLinkedPatients(session.user.id);
      }

      if (!patientsProfiles || patientsProfiles.length === 0) {
        setEvents([]);
        return;
      }

      const patientIds = patientsProfiles.map(p => p.id);
      const patientMap = patientsProfiles.reduce((acc: any, curr: any) => {
        acc[curr.id] = curr.full_name || 'Unknown Patient';
        return acc;
      }, {});

      // 2. Fetch Falls
      const { data: falls } = await supabase
        .from('fall_events').select('*').in('patientid', patientIds)
        .order('timestamp', { ascending: false }).limit(20);

      // 3. Fetch Medication Logs
      const { data: meds } = await supabase
        .from('medication_logs')
        .select('*, medications(name, dosage)')
        .in('patientid', patientIds)
        .order('takenat', { ascending: false }).limit(20);

      // 4. Fetch Symptom Logs (The "Popup Answers")
      const { data: symptoms } = await supabase
        .from('symptom_logs')
        .select('*')
        .in('patientid', patientIds)
        .order('timestamp', { ascending: false }).limit(20);

      const timeline: TimelineEvent[] = [];

      // Map Falls
      (falls || []).forEach(f => {
        const pName = patientMap[f.patientid || f.patient_id] || 'Patient';
        timeline.push({
          id: `fall-${f.id}`,
          type: 'fall',
          title: 'Fall Detected',
          patientName: pName,
          patientId: f.patientid || f.patient_id,
          timestamp: f.timestamp,
          description: f.status === 'resolved' ? 'Alert resolved by clinician.' : 'Emergency escalation sent to caregivers.',
          severity: f.status === 'resolved' ? 'info' : 'critical',
          icon: 'error',
          color: '#EF4444',
        });
      });

      // Map Meds
      (meds || []).forEach(m => {
        const medData = Array.isArray(m.medications) ? m.medications[0] : m.medications;
        const pName = patientMap[m.patientid || m.patient_id] || 'Patient';
        timeline.push({
          id: `med-${m.id}`,
          type: 'med',
          title: m.status === 'taken' ? 'Medication Taken' : 'Medication Missed',
          patientName: pName,
          patientId: m.patientid || m.patient_id,
          timestamp: m.takenat || m.timestamp,
          description: `${medData?.name || 'Medication'} ${medData?.dosage || ''} ${m.status === 'taken' ? 'confirmed taken.' : 'not confirmed. Caregiver alerted.'}`,
          severity: m.status === 'taken' ? 'normal' : 'warning',
          icon: m.status === 'taken' ? 'check-circle' : 'cancel',
          color: m.status === 'taken' ? '#10B981' : '#F59E0B',
        });
      });

      // Map Symptoms (Popup Answers)
      (symptoms || []).forEach(s => {
        const pName = patientMap[s.patientid || s.patient_id] || 'Patient';
        timeline.push({
          id: `symptom-${s.id}`,
          type: 'symptom',
          title: 'Symptom Reported',
          patientName: pName,
          patientId: s.patientid || s.patient_id,
          timestamp: s.timestamp,
          description: `${s.type}: ${s.notes || 'No notes provided.'} (${s.severity || 'moderate'})`,
          severity: 'info',
          icon: 'psychology',
          color: '#8B5CF6',
        });
      });

      const combined = timeline.sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return dateB - dateA;
      });
      setEvents(combined);
    } catch (e) {
      console.error('[History] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, role]);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  const onRefresh = () => { setRefreshing(true); loadHistory(); };

  const filteredEvents = useMemo(() => {
    if (activeCategory === 'all') return events;
    return events.filter(e => {
        if (activeCategory === 'falls') return e.type === 'fall';
        if (activeCategory === 'meds') return e.type === 'med';
        if (activeCategory === 'symptoms') return e.type === 'symptom';
        return true;
    });
  }, [events, activeCategory]);

  const renderItem = ({ item, index }: { item: TimelineEvent; index: number }) => {
    const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown';
    const isToday = item.timestamp ? new Date(item.timestamp).toDateString() === new Date().toDateString() : false;
    const dateStr = isToday ? 'Today' : (item.timestamp ? new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '');

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
        <TouchableOpacity
          style={styles.eventCard}
          onPress={() => {
            const path = role === 'doctor' ? '/doctor' : '/caregiver';
            router.push({ pathname: path, params: { patientId: item.patientId } });
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
            <MaterialIcons name={item.icon} size={22} color={item.color} />
          </View>
          <View style={styles.eventBody}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventTitle}>{item.title}</Text>
              <Text style={styles.eventTime}>{dateStr}, {timeStr}</Text>
            </View>
            <Text style={styles.eventPatient}>{item.patientName}</Text>
            <Text style={styles.eventDesc} numberOfLines={2}>{item.description}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const isCaregiver = role === 'caregiver';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={isCaregiver ? ['#0369a1', '#075985'] : ['#1E1B4B', '#312E81']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>{isCaregiver ? 'Daily History' : 'Health History'}</Text>
            <Text style={styles.headerSubtitle}>Safety & Compliance</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
             {CATEGORIES.map(cat => {
               const active = activeCategory === cat.id;
               return (
                 <TouchableOpacity
                   key={cat.id}
                   onPress={() => setActiveCategory(cat.id)}
                   style={[styles.catChip, active ? styles.catChipActive : null]}
                 >
                   <Text style={[styles.catChipText, active ? styles.catChipTextActive : null]}>{cat.label}</Text>
                 </TouchableOpacity>
               );
             })}
          </ScrollView>
        </View>
      </LinearGradient>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={isCaregiver ? '#0369a1' : '#6366F1'} />
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isCaregiver ? '#0369a1' : '#6366F1'} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="history" size={60} color={colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
              <Text style={[styles.emptyTitle, { color: themeColors.muted }]}>No History Recorded</Text>
              <Text style={[styles.emptySubtitle, { color: themeColors.muted + '80' }]}>Monitoring is active for linked patients.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: 50, paddingBottom: 16 },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  
  categoryRow: { paddingHorizontal: 16, gap: 8 },
  catChip: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  catChipActive: { backgroundColor: '#10B981' },
  catChipText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '700' },
  catChipTextActive: { color: '#fff' },

  list: { padding: 16, paddingBottom: 40 },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  iconContainer: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  eventBody: { flex: 1 },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  eventTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  eventTime: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  eventPatient: { fontSize: 13, color: '#6366f1', fontWeight: '700', marginBottom: 4 },
  eventDesc: { fontSize: 13, color: '#475569', lineHeight: 18 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', paddingTop: 100, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});

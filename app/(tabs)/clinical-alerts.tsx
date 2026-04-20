import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView, Alert, Platform,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/src/services/SupabaseService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, HeaderGradient } from '@/constants/theme';
import { DoctorService } from '@/src/services/DoctorService';
import { CaregiverService } from '@/src/services/CaregiverService';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

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

const CATEGORIES: { id: EventType; label: string; icon: string }[] = [
  { id: 'all',      label: 'All',      icon: 'dashboard'        },
  { id: 'falls',    label: 'Falls',    icon: 'warning'          },
  { id: 'meds',     label: 'Meds',     icon: 'medication'       },
  { id: 'symptoms', label: 'Symptoms', icon: 'psychology'       },
];

const SEVERITY_CONFIG = {
  critical: { bg: '#FEF2F2', border: '#FECACA', badge: '#EF4444', badgeText: '#fff', label: 'CRITICAL' },
  warning:  { bg: '#FFFBEB', border: '#FDE68A', badge: '#F59E0B', badgeText: '#fff', label: 'WARNING'  },
  normal:   { bg: '#F0FDF4', border: '#BBF7D0', badge: '#10B981', badgeText: '#fff', label: 'OK'       },
  info:     { bg: '#EFF6FF', border: '#BFDBFE', badge: '#3B82F6', badgeText: '#fff', label: 'INFO'     },
};

export default function ClinicalAlertsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { session, role } = useAuthViewModel();
  const { t } = useTranslation();
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState<EventType>('all');
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isCaregiver = role === 'caregiver';
  const C = Colors[colorScheme as 'light' | 'dark'];
  const accentColor = C.tint;

  const loadHistory = useCallback(async () => {
    if (!session?.user?.id || !role) return;
    setLoading(true);
    try {
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

      const [{ data: falls }, { data: meds }, { data: symptoms }] = await Promise.all([
        supabase.from('fall_events').select('*').in('patientid', patientIds).order('timestamp', { ascending: false }).limit(20),
        supabase.from('medication_logs').select('*, medications(name, dosage)').in('patientid', patientIds).order('takenat', { ascending: false }).limit(20),
        supabase.from('symptom_logs').select('*').in('patientid', patientIds).order('timestamp', { ascending: false }).limit(20),
      ]);

      const timeline: TimelineEvent[] = [];

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
          status: f.status,
          severity: f.status === 'resolved' ? 'info' : 'critical',
          icon: 'warning',
          color: '#EF4444',
        });
      });

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
          description: `${medData?.name || 'Medication'} ${medData?.dosage || ''} ${m.status === 'taken' ? '— confirmed taken.' : '— not confirmed. Caregiver alerted.'}`,
          status: m.status,
          severity: m.status === 'taken' ? 'normal' : 'warning',
          icon: m.status === 'taken' ? 'check-circle' : 'cancel',
          color: m.status === 'taken' ? '#10B981' : '#F59E0B',
        });
      });

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

      setEvents(timeline.sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return dateB - dateA;
      }));
    } catch (e) {
      console.error('[Alerts] Load error:', e);
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

  // Summary counts for header badges
  const counts = useMemo(() => ({
    critical: events.filter(e => e.severity === 'critical').length,
    warning: events.filter(e => e.severity === 'warning').length,
    falls: events.filter(e => e.type === 'fall').length,
    meds: events.filter(e => e.type === 'med').length,
    symptoms: events.filter(e => e.type === 'symptom').length,
  }), [events]);

  const formatTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    const isToday = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${time}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
  };

  const renderItem = ({ item, index }: { item: TimelineEvent; index: number }) => {
    const sev = SEVERITY_CONFIG[item.severity];
    const cardBg = isDark
      ? item.severity === 'critical' ? '#2D1414' : item.severity === 'warning' ? '#2D2008' : item.severity === 'normal' ? '#0D2318' : '#0D1A2D'
      : sev.bg;
    const cardBorder = isDark
      ? item.color + '40'
      : sev.border;

    return (
      <Animated.View entering={FadeInDown.delay(index * 45).duration(380)}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={() => {
            const path = role === 'doctor' ? '/doctor' : '/caregiver';
            router.push({ pathname: path as any, params: { patientId: item.patientId } });
          }}
          activeOpacity={0.75}
        >
          {/* Left accent bar */}
          <View style={[styles.cardAccent, { backgroundColor: item.color }]} />

          <View style={styles.cardInner}>
            {/* Top row: icon + title + badge + time */}
            <View style={styles.cardTop}>
              <View style={[styles.cardIconWrap, { backgroundColor: item.color + '20' }]}>
                <MaterialIcons name={item.icon} size={20} color={item.color} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, { color: isDark ? '#F1F5F9' : '#0F172A' }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={[styles.severityBadge, { backgroundColor: sev.badge }]}>
                    <Text style={[styles.severityBadgeText, { color: sev.badgeText }]}>{sev.label}</Text>
                  </View>
                </View>
                <Text style={[styles.cardTime, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  {formatTime(item.timestamp)}
                </Text>
              </View>
            </View>

            {/* Patient name pill */}
            <View style={styles.patientRow}>
              <MaterialIcons name="person" size={12} color={accentColor} />
              <Text style={[styles.patientName, { color: accentColor }]}>{item.patientName}</Text>
            </View>

            {/* Description */}
            <Text style={[styles.cardDesc, { color: isDark ? '#94A3B8' : '#475569' }]} numberOfLines={2}>
              {item.description}
            </Text>

            {/* Action row */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: accentColor + '15', borderColor: accentColor + '30' }]}
                onPress={() => {
                  const path = role === 'doctor' ? '/doctor' : '/caregiver';
                  router.push({ pathname: path as any, params: { patientId: item.patientId } });
                }}
              >
                <MaterialIcons name="open-in-new" size={13} color={accentColor} />
                <Text style={[styles.actionBtnText, { color: accentColor }]}>View Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]}
                onPress={() => router.push({ pathname: '/chat-room' as any, params: { partnerId: item.patientId, partnerName: item.patientName } })}
              >
                <MaterialIcons name="chat-bubble-outline" size={13} color="#10B981" />
                <Text style={[styles.actionBtnText, { color: '#10B981' }]}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#080C18' : '#F1F5F9' }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <LinearGradient colors={HeaderGradient} style={styles.header}>
        {/* decorative grid */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {[0,1,2,3,4].map(i => (
            <View key={i} style={[styles.gridLine, { top: i * 32 }]} />
          ))}
        </View>

        <Animated.View entering={FadeIn.duration(400)} style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>{isCaregiver ? 'Daily History' : 'Clinical Alerts'}</Text>
            <Text style={styles.headerSubtitle}>Safety & Compliance Overview</Text>
          </View>
          {counts.critical > 0 && (
            <View style={styles.criticalBadge}>
              <MaterialIcons name="warning" size={12} color="#fff" />
              <Text style={styles.criticalBadgeText}>{counts.critical} Critical</Text>
            </View>
          )}
        </Animated.View>

        {/* Summary stat row */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.summaryRow}>
          {[
            { label: 'Falls',    value: counts.falls,    color: '#FCA5A5' },
            { label: 'Med',      value: counts.meds,     color: '#FDE68A' },
            { label: 'Symptoms', value: counts.symptoms, color: '#C4B5FD' },
            { label: 'Total',    value: events.length,   color: '#93C5FD' },
          ].map(s => (
            <View key={s.label} style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.summaryLabel}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setActiveCategory(cat.id)}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.75}
              >
                <MaterialIcons
                  name={cat.icon as any}
                  size={13}
                  color={active ? '#fff' : 'rgba(255,255,255,0.55)'}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {/* ── List ── */}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={[styles.loadingText, { color: isDark ? '#64748B' : '#94A3B8' }]}>Loading alerts…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />
          }
          ListHeaderComponent={
            filteredEvents.length > 0 ? (
              <Text style={[styles.resultsLabel, { color: isDark ? '#64748B' : '#94A3B8' }]}>
                {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}{activeCategory !== 'all' ? ` · ${CATEGORIES.find(c => c.id === activeCategory)?.label}` : ''}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIconWrap, { backgroundColor: accentColor + '12' }]}>
                <MaterialIcons name="check-circle-outline" size={44} color={accentColor + '80'} />
              </View>
              <Text style={[styles.emptyTitle, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>All Clear</Text>
              <Text style={[styles.emptySubtitle, { color: isDark ? '#64748B' : '#94A3B8' }]}>
                No events recorded for the active filter. Monitoring is active.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { paddingTop: Platform.OS === 'ios' ? 56 : 44, paddingBottom: 16, overflow: 'hidden' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  headerSubtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600', marginTop: 1 },
  criticalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  criticalBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  summaryRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, paddingVertical: 12 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  summaryLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },

  chipsRow: { paddingHorizontal: 16, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  chipActive: { backgroundColor: '#10B981' },
  chipText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#fff' },

  // List
  list: { padding: 16, paddingBottom: 48 },
  resultsLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginLeft: 4 },

  // Card
  card: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1.5,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  cardAccent: { width: 4, borderRadius: 2 },
  cardInner: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardIconWrap: { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontSize: 15, fontWeight: '800', flex: 1 },
  cardTime: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexShrink: 0 },
  severityBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },

  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  patientName: { fontSize: 12, fontWeight: '800' },

  cardDesc: { fontSize: 13, lineHeight: 19, marginBottom: 12 },

  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  actionBtnText: { fontSize: 12, fontWeight: '700' },

  // States
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 14 },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
});

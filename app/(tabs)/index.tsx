import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  FadeIn,
  FadeInDown,
  FadeInRight,
} from 'react-native-reanimated';
import { Colors, Spacing, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SpeechService } from '@/src/services/SpeechService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { useFallDetectionViewModel } from '@/src/viewmodels/useFallDetectionViewModel';
import { DoctorService } from '@/src/services/DoctorService';
import { VitalsService } from '@/src/services/VitalsService';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

type Vitals = { heartRate: number; spo2: number; steps: number; activeMin: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hour() { return new Date().getHours(); }
function greeting() {
  const h = hour();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function hrZone(hr: number): { label: string; color: string; bg: string } {
  if (hr < 60) return { label: 'Low',    color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' };
  if (hr > 100) return { label: 'High',  color: '#EF4444', bg: 'rgba(239,68,68,0.15)' };
  return          { label: 'Normal',     color: '#10B981', bg: 'rgba(16,185,129,0.15)' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LiveDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(0.3, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }, style]} />;
}

function VitalTile({
  icon, value, unit, label, color, delay,
}: { icon: string; value: string | number; unit: string; label: string; color: string; delay: number }) {
  const isDark = useColorScheme() === 'dark';
  return (
    <Animated.View entering={FadeInRight.delay(delay).duration(420)} style={[styles.vitalTile, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}>
      <View style={[styles.vitalTileIcon, { backgroundColor: color + '18' }]}>
        <MaterialIcons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.vitalTileValue, { color: isDark ? '#F8FAFC' : '#1E293B' }]}>{value}</Text>
      <Text style={[styles.vitalTileUnit, { color: color }]}>{unit}</Text>
      <Text style={[styles.vitalTileLabel, { color: isDark ? '#64748B' : '#94A3B8' }]}>{label}</Text>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { session } = useAuthViewModel();

  const patientId   = session?.user?.id ?? '';
  const patientName = session?.user?.user_metadata?.full_name ?? 'Patient';
  const firstName   = patientName.split(' ')[0];

  const { state: fallState, cancelAlert, isUserActive } = useFallDetectionViewModel(patientId, patientName);

  const [patientCode, setPatientCode] = useState('––– –––');
  const [vitals, setVitals] = useState<Vitals>({ heartRate: 72, spo2: 98, steps: 1240, activeMin: 42 });

  // Fall alert spring
  const alertY = useSharedValue(900);
  useEffect(() => {
    alertY.value = fallState === 'user_response_window'
      ? withSpring(0, { damping: 18 })
      : withTiming(900, { duration: 300 });
  }, [fallState]);
  const alertStyle = useAnimatedStyle(() => ({ transform: [{ translateY: alertY.value }] }));

  // Patient code
  useEffect(() => {
    if (!patientId) return;
    DoctorService.ensurePatientCode(patientId)
      .then(c => { if (c) setPatientCode(c.replace(/(\d{3})(\d{3})/, '$1 $2')); })
      .catch(console.error);
  }, [patientId]);

  // Vitals simulation
  useEffect(() => {
    let steps = vitals.steps;
    let mins  = vitals.activeMin;
    const id  = setInterval(() => {
      const hr   = 68 + Math.floor(Math.random() * 16);
      const spo2 = 96 + Math.floor(Math.random() * 4);
      steps += Math.floor(Math.random() * 18);
      mins  += 1;
      setVitals({ heartRate: hr, spo2, steps, activeMin: mins });
      if (hr > 95) SpeechService.speak(`${firstName}, your heart rate is ${hr} BPM. Please rest.`);
      if (patientId) VitalsService.logVitals({ patientId, heartRate: hr, spo2, steps, timestamp: new Date().toISOString() }).catch(console.error);
    }, 15000);
    return () => clearInterval(id);
  }, [patientId, firstName]);

  const zone = hrZone(vitals.heartRate);

  // ─── Layout ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#080C18' : '#F4F7FE' }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Fall Alert Sheet (slides up from bottom) ──────────────────── */}
      <Animated.View style={[styles.fallSheet, alertStyle]}>
        <LinearGradient colors={['#7F1D1D', '#DC2626']} style={styles.fallSheetInner}>
          <View style={styles.fallSheetTop}>
            <MaterialIcons name="warning" size={32} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.fallSheetTitle}>Fall Detected</Text>
              <Text style={styles.fallSheetSub}>Emergency alert in 20 seconds</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.fallCancelBtn} onPress={cancelAlert}>
            <Text style={styles.fallCancelText}>I'm OK — Cancel Alert</Text>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ═══════════════════════════════════════════════════════════════
            HEADER  — dark card with gradient, name, time, status
        ════════════════════════════════════════════════════════════════ */}
        <LinearGradient
          colors={isDark ? ['#0F1729', '#1A2744'] : ['#1D4ED8', '#2563EB']}
          style={styles.headerCard}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          {/* Subtle grid pattern overlay */}
          <View style={styles.headerGrid} pointerEvents="none">
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={[styles.headerGridLine, { top: i * 28 }]} />
            ))}
          </View>

          <Animated.View entering={FadeIn.delay(50).duration(500)} style={styles.headerTop}>
            <View>
              <Text style={styles.headerGreeting}>{greeting()}</Text>
              <Text style={styles.headerName}>{firstName}</Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.monitorBadge}>
                <LiveDot color={isUserActive ? '#FCD34D' : '#34D399'} />
                <Text style={styles.monitorBadgeText}>
                  {isUserActive ? 'Active' : 'Monitoring'}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Heart rate highlight row inside header */}
          <Animated.View entering={FadeInDown.delay(150).duration(450)} style={styles.headerHR}>
            <View style={styles.headerHRLeft}>
              <MaterialIcons name="favorite" size={16} color="rgba(255,255,255,0.7)" />
              <Text style={styles.headerHRLabel}>Heart Rate</Text>
              <View style={[styles.headerHRBadge, { backgroundColor: zone.bg }]}>
                <Text style={[styles.headerHRBadgeText, { color: zone.color }]}>{zone.label}</Text>
              </View>
            </View>
            <View style={styles.headerHRValue}>
              <Text style={styles.headerHRNumber}>{vitals.heartRate}</Text>
              <Text style={styles.headerHRUnit}>BPM</Text>
            </View>
          </Animated.View>

          {/* Patient code strip */}
          <Animated.View entering={FadeInDown.delay(220).duration(450)} style={styles.codeStrip}>
            <View style={styles.codeStripLeft}>
              <Text style={styles.codeStripLabel}>PATIENT CODE</Text>
              <Text style={styles.codeStripValue}>{patientCode}</Text>
            </View>
            <TouchableOpacity
              style={styles.codeStripBtn}
              onPress={() => router.push({ pathname: '/chat-room', params: { partnerId: 'doc-123', partnerName: 'Doctor' } })}
            >
              <MaterialIcons name="chat" size={16} color="#fff" />
              <Text style={styles.codeStripBtnText}>Message Doctor</Text>
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>

        {/* ═══════════════════════════════════════════════════════════════
            VITALS ROW  — horizontal scroll of 4 tiles
        ════════════════════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>Live Vitals</Text>
            <View style={styles.sectionLive}>
              <LiveDot color="#10B981" />
              <Text style={[styles.sectionLiveText, { color: C.muted }]}>Real-time</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vitalsRow}>
            <VitalTile icon="favorite"       value={vitals.heartRate} unit="BPM"  label="Heart Rate"   color="#EF4444" delay={0}   />
            <VitalTile icon="air"            value={`${vitals.spo2}%`} unit="SpO2" label="Blood Oxygen"  color="#3B82F6" delay={60}  />
            <VitalTile icon="directions-walk" value={vitals.steps.toLocaleString()} unit="steps" label="Steps Today" color="#10B981" delay={120} />
            <VitalTile icon="timer"          value={`${vitals.activeMin}m`} unit="active" label="Active Time"  color="#8B5CF6" delay={180} />
          </ScrollView>
        </View>

        {/* ═══════════════════════════════════════════════════════════════
            AI COMPANION  — full-width banner, not a circle
        ════════════════════════════════════════════════════════════════ */}
        <Animated.View entering={FadeInDown.delay(300).duration(450)} style={styles.section}>
          <TouchableOpacity onPress={() => router.push('/ai-chat')} activeOpacity={0.88}>
            <LinearGradient
              colors={isDark ? ['#1E1B4B', '#312E81'] : ['#4F46E5', '#6D28D9']}
              style={styles.aiBanner}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <View style={styles.aiBannerLeft}>
                <View style={styles.aiBannerIconWrap}>
                  <MaterialIcons name="smart-toy" size={26} color="#fff" />
                </View>
                <View>
                  <Text style={styles.aiBannerTitle}>AI Health Companion</Text>
                  <Text style={styles.aiBannerSub}>Ask anything about your health</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ═══════════════════════════════════════════════════════════════
            QUICK ACTIONS  — 2 × 2 with labels below, no emoji
        ════════════════════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>Quick Access</Text>
          <View style={styles.actionsGrid}>
            {[
              { icon: 'location-on',    label: 'Live Map',     sub: 'Track location',  color: '#6366F1', route: '/live-tracking' },
              { icon: 'medication',     label: 'Medications',  sub: 'Schedule & doses', color: '#EC4899', route: '/medication' },
              { icon: 'phone-in-talk',  label: 'Emergency',   sub: 'SOS contacts',    color: '#EF4444', route: '/emergency-contacts' },
              { icon: 'local-hospital', label: 'My Doctor',   sub: 'View profile',    color: '#10B981', route: '/(tabs)/doctor' },
            ].map((a, i) => (
              <Animated.View key={a.label} entering={FadeInDown.delay(360 + i * 50).duration(380)} style={{ width: (width - Spacing.lg * 2 - 12) / 2 }}>
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}
                  onPress={() => router.push(a.route as any)}
                  activeOpacity={0.78}
                >
                  <View style={[styles.actionIcon, { backgroundColor: a.color + '15' }]}>
                    <MaterialIcons name={a.icon as any} size={22} color={a.color} />
                  </View>
                  <Text style={[styles.actionLabel, { color: C.text }]}>{a.label}</Text>
                  <Text style={[styles.actionSub, { color: C.muted }]}>{a.sub}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════
            HEALTH SUMMARY  — clinical row with 3 key numbers
        ════════════════════════════════════════════════════════════════ */}
        <Animated.View entering={FadeInDown.delay(560).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>Today's Summary</Text>
          <View style={[styles.summaryCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}>
            {[
              { label: 'Resting HR',  value: `${vitals.heartRate} bpm`, icon: 'favorite',       color: '#EF4444' },
              { label: 'Blood O₂',   value: `${vitals.spo2}%`,         icon: 'bubble-chart',   color: '#3B82F6' },
              { label: 'Steps',      value: vitals.steps.toLocaleString(), icon: 'show-chart',  color: '#10B981' },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                <View style={styles.summaryItem}>
                  <MaterialIcons name={s.icon as any} size={18} color={s.color} />
                  <Text style={[styles.summaryValue, { color: C.text }]}>{s.value}</Text>
                  <Text style={[styles.summaryLabel, { color: C.muted }]}>{s.label}</Text>
                </View>
                {i < 2 && <View style={[styles.summaryDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]} />}
              </React.Fragment>
            ))}
          </View>
        </Animated.View>

        {/* ═══════════════════════════════════════════════════════════════
            INSIGHT STRIP  — one line, dynamic
        ════════════════════════════════════════════════════════════════ */}
        <Animated.View entering={FadeInDown.delay(640).duration(400)} style={[styles.section, { marginBottom: 8 }]}>
          <View style={[styles.insightStrip, { backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.08)', borderColor: isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.2)' }]}>
            <MaterialIcons name="tips-and-updates" size={18} color="#3B82F6" />
            <Text style={[styles.insightText, { color: isDark ? '#93C5FD' : '#1D4ED8' }]}>
              {vitals.heartRate < 80
                ? `Heart rate stable at ${vitals.heartRate} bpm — you're doing well today.`
                : `Heart rate is elevated at ${vitals.heartRate} bpm — consider resting.`}
            </Text>
          </View>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Header card
  headerCard: {
    paddingTop: Platform.OS === 'ios' ? 58 : 44,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    overflow: 'hidden',
  },
  headerGrid: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  headerGridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  headerGreeting: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500', marginBottom: 2 },
  headerName: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  headerRight: { alignItems: 'flex-end' },
  monitorBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  monitorBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // HR row inside header
  headerHR: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerHRLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerHRLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
  headerHRBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  headerHRBadgeText: { fontSize: 11, fontWeight: '700' },
  headerHRValue: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  headerHRNumber: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  headerHRUnit: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },

  // Code strip
  codeStrip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  codeStripLeft: {},
  codeStripLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '700', letterSpacing: 1.2, marginBottom: 2 },
  codeStripValue: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 3 },
  codeStripBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  codeStripBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Section
  section: { paddingHorizontal: Spacing.lg, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  sectionLive: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sectionLiveText: { fontSize: 12 },

  // Vitals tiles
  vitalsRow: { gap: 10, paddingRight: Spacing.lg },
  vitalTile: { width: 100, borderRadius: 16, padding: 14, alignItems: 'flex-start', ...Shadows.light },
  vitalTileIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  vitalTileValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  vitalTileUnit: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  vitalTileLabel: { fontSize: 11, marginTop: 4 },

  // AI banner
  aiBanner: { borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aiBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  aiBannerIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  aiBannerTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  aiBannerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },

  // Actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 4, ...Shadows.light },
  actionIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  actionLabel: { fontSize: 14, fontWeight: '700' },
  actionSub: { fontSize: 11 },

  // Summary card
  summaryCard: { borderRadius: 16, borderWidth: 1, flexDirection: 'row', overflow: 'hidden', ...Shadows.light },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 4 },
  summaryValue: { fontSize: 15, fontWeight: '800' },
  summaryLabel: { fontSize: 11 },
  summaryDivider: { width: 1, marginVertical: 14 },

  // Insight
  insightStrip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  insightText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },

  // Fall alert
  fallSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 999, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  fallSheetInner: { padding: Spacing.lg, gap: 16 },
  fallSheetTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  fallSheetTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  fallSheetSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
  fallCancelBtn: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  fallCancelText: { color: '#DC2626', fontSize: 16, fontWeight: '800' },
});

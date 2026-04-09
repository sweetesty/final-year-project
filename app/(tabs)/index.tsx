import React, { useState, useEffect, useRef } from 'react';
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  interpolate,
  Extrapolate,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SpeechService } from '@/src/services/SpeechService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { useFallDetectionViewModel } from '@/src/viewmodels/useFallDetectionViewModel';
import { DoctorService } from '@/src/services/DoctorService';
import { VitalsService } from '@/src/services/VitalsService';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.lg * 2 - Spacing.md) / 2;

// ─── Vitals card data ────────────────────────────────────────────────────────
type VitalKey = 'heartRate' | 'spo2' | 'steps' | 'activeTime';

const VITAL_META: Record<VitalKey, { label: string; unit: string; icon: string; gradientLight: [string, string]; gradientDark: [string, string] }> = {
  heartRate: { label: 'Heart Rate', unit: 'BPM', icon: '♥', gradientLight: ['#FF6B8A', '#FF4757'], gradientDark: ['#FF6B8A', '#C0392B'] },
  spo2:      { label: 'Blood Oxygen', unit: '%', icon: '◉', gradientLight: ['#4FACFE', '#00F2FE'], gradientDark: ['#2C7BE5', '#00C6FB'] },
  steps:     { label: 'Steps', unit: 'steps', icon: '◈', gradientLight: ['#43E97B', '#38F9D7'], gradientDark: ['#11998E', '#38EF7D'] },
  activeTime:{ label: 'Active Time', unit: '', icon: '◆', gradientLight: ['#FA709A', '#FEE140'], gradientDark: ['#F5AF19', '#F12711'] },
};

// ─── Quick-action items ───────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: '🗺️', label: 'Live Map', route: '/live-tracking', color: '#6C63FF' },
  { icon: '💊', label: 'Meds', route: '/medication', color: '#FF6B8A' },
  { icon: '🚨', label: 'Emergency', route: '/emergency-contacts', color: '#FF4757' },
  { icon: '⚕️', label: 'My Doctor', route: '/(tabs)/doctor', color: '#43E97B' },
];

export default function Dashboard() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { session } = useAuthViewModel();
  const patientId = session?.user?.id ?? '';
  const patientName = session?.user?.user_metadata?.full_name ?? 'there';
  const firstName = patientName.split(' ')[0];

  const { state: fallState, cancelAlert, isUserActive } = useFallDetectionViewModel(patientId, patientName);

  const [patientCode, setPatientCode] = useState('------');
  const [vitals, setVitals] = useState({ heartRate: 72, spo2: 98, steps: 1240, activeTime: '2h 15m' });

  // Animations
  const orbScale = useSharedValue(1);
  const orbOpacity = useSharedValue(0.6);
  const statusPulse = useSharedValue(1);
  const heartBeat = useSharedValue(1);
  const alertScale = useSharedValue(0);

  // Orb ambient pulse
  useEffect(() => {
    orbScale.value = withRepeat(withSequence(withTiming(1.15, { duration: 2000 }), withTiming(1, { duration: 2000 })), -1, true);
    orbOpacity.value = withRepeat(withSequence(withTiming(1, { duration: 2000 }), withTiming(0.5, { duration: 2000 })), -1, true);
    statusPulse.value = withRepeat(withSequence(withTiming(1.05, { duration: 800 }), withTiming(1, { duration: 800 })), -1, true);
    heartBeat.value = withRepeat(withSequence(withTiming(1.2, { duration: 300 }), withTiming(1, { duration: 300 }), withTiming(1.1, { duration: 200 }), withTiming(1, { duration: 700 })), -1, true);
  }, []);

  // Fall alert scale animation
  useEffect(() => {
    alertScale.value = fallState === 'user_response_window'
      ? withSpring(1, { damping: 12 })
      : withTiming(0, { duration: 200 });
  }, [fallState]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
    opacity: orbOpacity.value,
  }));
  const orbInnerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(orbScale.value, [1, 1.15], [1, 0.95], Extrapolate.CLAMP) }],
  }));
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartBeat.value }] }));
  const alertStyle = useAnimatedStyle(() => ({ transform: [{ scale: alertScale.value }] }));

  // Patient code
  useEffect(() => {
    if (patientId) {
      DoctorService.ensurePatientCode(patientId)
        .then(code => { if (code) setPatientCode(code.replace(/(\d{3})(\d{3})/, '$1 $2')); })
        .catch(console.error);
    }
  }, [patientId]);

  // Vitals simulation + persistence
  useEffect(() => {
    let stepAcc = vitals.steps;
    const interval = setInterval(() => {
      const newHr = 68 + Math.floor(Math.random() * 14);
      const newSpo2 = 96 + Math.floor(Math.random() * 4);
      stepAcc += Math.floor(Math.random() * 20);
      setVitals(prev => ({ ...prev, heartRate: newHr, spo2: newSpo2, steps: stepAcc }));
      if (newHr > 95) {
        SpeechService.speak(`${firstName}, your heart rate is ${newHr} BPM. Please rest.`);
      }
      if (patientId) {
        VitalsService.logVitals({ patientId, heartRate: newHr, spo2: newSpo2, steps: stepAcc, timestamp: new Date().toISOString() }).catch(console.error);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [patientId, firstName]);

  const getHrStatus = (hr: number) => hr < 60 ? { label: 'Low', color: '#FAAD14' } : hr > 100 ? { label: 'High', color: '#FF4757' } : { label: 'Normal', color: '#43E97B' };
  const hrStatus = getHrStatus(vitals.heartRate);

  // ─── Background gradient colours ────────────────────────────────────────────
  const bgGrad: [string, string, string] = isDark
    ? ['#0A0E1A', '#0F1729', '#0A0E1A']
    : ['#EEF4FF', '#F8FAFF', '#EEF4FF'];

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <LinearGradient colors={bgGrad} style={StyleSheet.absoluteFill} />

      {/* ── Fall Alert Overlay ─────────────────────────────────────── */}
      {fallState === 'user_response_window' && (
        <Animated.View style={[styles.fallOverlay, alertStyle]}>
          <LinearGradient colors={['#C0392B', '#E74C3C']} style={styles.fallGradient}>
            <Text style={styles.fallIcon}>⚠</Text>
            <Text style={styles.fallTitle}>Fall Detected</Text>
            <Text style={styles.fallSubtitle}>Are you okay? Emergency alert in{'\n'}20 seconds if no response.</Text>
            <TouchableOpacity style={styles.fallCancelBtn} onPress={cancelAlert}>
              <Text style={styles.fallCancelText}>I'm OK — Cancel Alert</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: Platform.OS === 'ios' ? 60 : 48 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(0).duration(500)} style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: isDark ? '#94A3B8' : '#64748B' }]}>Good {getTimeOfDay()}</Text>
            <Text style={[styles.name, { color: themeColors.text }]}>{firstName} 👋</Text>
          </View>
          <Animated.View style={[styles.statusBadge, { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)' }, { transform: [{ scale: statusPulse }] }]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusBadgeText}>Active</Text>
          </Animated.View>
        </Animated.View>

        {/* ── Central AI Orb ──────────────────────────────────────── */}
        <Animated.View entering={ZoomIn.delay(100).duration(600)} style={styles.orbSection}>
          {/* Outer glow rings */}
          <Animated.View style={[styles.orbRing3, { borderColor: themeColors.tint + '15' }, orbStyle]} />
          <Animated.View style={[styles.orbRing2, { borderColor: themeColors.tint + '25' }, orbStyle]} />
          <Animated.View style={[styles.orbRing1, { borderColor: themeColors.tint + '40' }, orbStyle]} />

          {/* Main orb */}
          <TouchableOpacity onPress={() => router.push('/ai-chat')} activeOpacity={0.9}>
            <Animated.View style={orbInnerStyle}>
              <LinearGradient
                colors={isDark ? ['#1E40AF', '#3B82F6', '#60A5FA'] : ['#1D4ED8', '#3B82F6', '#60A5FA']}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.orb}
              >
                <Text style={styles.orbEmoji}>🤖</Text>
                <Text style={styles.orbLabel}>AI Companion</Text>
                <Text style={styles.orbSub}>Tap to chat</Text>
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>

          {/* Monitoring status chip */}
          <View style={[styles.monitorChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
            <View style={[styles.monitorDot, { backgroundColor: isUserActive ? '#FA709A' : '#43E97B' }]} />
            <Text style={[styles.monitorText, { color: themeColors.muted }]}>
              {isUserActive ? 'Active mode — elevated threshold' : 'Fall detection active'}
            </Text>
          </View>
        </Animated.View>

        {/* ── Vitals ──────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Live Vitals</Text>
          <View style={styles.vitalsGrid}>
            {(Object.entries(vitals) as [VitalKey, number | string][]).map(([key, value], i) => {
              const meta = VITAL_META[key];
              const gradColors = isDark ? meta.gradientDark : meta.gradientLight;
              return (
                <Animated.View key={key} entering={ZoomIn.delay(250 + i * 60).duration(400)}>
                  <LinearGradient colors={gradColors as [string, string]} style={styles.vitalCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    {key === 'heartRate' ? (
                      <Animated.Text style={[styles.vitalIcon, heartStyle]}>{meta.icon}</Animated.Text>
                    ) : (
                      <Text style={styles.vitalIcon}>{meta.icon}</Text>
                    )}
                    <Text style={styles.vitalValue}>{value}</Text>
                    <Text style={styles.vitalUnit}>{meta.unit || meta.label}</Text>
                    {key === 'heartRate' && (
                      <View style={[styles.vitalStatus, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                        <Text style={styles.vitalStatusText}>{hrStatus.label}</Text>
                      </View>
                    )}
                  </LinearGradient>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Patient Code Card ────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(350).duration(500)} style={styles.codeCardWrap}>
          <LinearGradient
            colors={isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F1F5FF']}
            style={[styles.codeCard, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(59,130,246,0.15)' }]}
          >
            <View style={styles.codeLeft}>
              <View style={[styles.codeIconWrap, { backgroundColor: themeColors.tint + '20' }]}>
                <Text style={styles.codeIcon}>🏥</Text>
              </View>
              <View>
                <Text style={[styles.codeLabel, { color: themeColors.muted }]}>YOUR PATIENT CODE</Text>
                <Text style={[styles.codeValue, { color: themeColors.tint }]}>{patientCode}</Text>
                <Text style={[styles.codeHint, { color: themeColors.muted }]}>Share with your doctor</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.chatBtn, { backgroundColor: themeColors.tint }]}
              onPress={() => router.push({ pathname: '/chat-room', params: { partnerId: 'doc-123', partnerName: 'Dr. Smith' } })}
            >
              <Text style={styles.chatBtnText}>💬</Text>
              <Text style={styles.chatBtnLabel}>Doctor</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>

        {/* ── Quick Actions ────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(450).duration(500)}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((action, i) => (
              <Animated.View key={action.label} entering={ZoomIn.delay(500 + i * 50).duration(350)}>
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : action.color + '30' }]}
                  onPress={() => router.push(action.route as Parameters<typeof router.push>[0])}
                  activeOpacity={0.75}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: action.color + '18' }]}>
                    <Text style={styles.actionIcon}>{action.icon}</Text>
                  </View>
                  <Text style={[styles.actionLabel, { color: themeColors.text }]}>{action.label}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* ── Health Insight Banner ────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(550).duration(500)} style={styles.insightWrap}>
          <LinearGradient colors={isDark ? ['#1E293B', '#0F172A'] : ['#EFF6FF', '#DBEAFE']} style={[styles.insightCard, { borderColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.3)' }]}>
            <Text style={styles.insightEmoji}>💡</Text>
            <View style={styles.insightText}>
              <Text style={[styles.insightTitle, { color: themeColors.text }]}>Daily Insight</Text>
              <Text style={[styles.insightBody, { color: themeColors.muted }]}>
                Your heart rate has been {vitals.heartRate < 80 ? 'stable and healthy' : 'slightly elevated'} today. {vitals.steps > 1000 ? `Great work — ${vitals.steps.toLocaleString()} steps!` : 'Try a short walk to boost circulation.'}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning,';
  if (h < 17) return 'afternoon,';
  return 'evening,';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 32 },
  bottomPad: { height: 24 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  greeting: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  name: { fontSize: 28, fontWeight: '800' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  statusBadgeText: { fontSize: 13, fontWeight: '700', color: '#10B981' },

  // Orb
  orbSection: { alignItems: 'center', marginBottom: Spacing.xl },
  orbRing1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1.5 },
  orbRing2: { position: 'absolute', width: 270, height: 270, borderRadius: 135, borderWidth: 1 },
  orbRing3: { position: 'absolute', width: 320, height: 320, borderRadius: 160, borderWidth: 0.5 },
  orb: { width: 170, height: 170, borderRadius: 85, justifyContent: 'center', alignItems: 'center', ...Shadows.medium },
  orbEmoji: { fontSize: 52, marginBottom: 4 },
  orbLabel: { color: '#fff', fontWeight: '800', fontSize: 15 },
  orbSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  monitorChip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.xl + 20, paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full },
  monitorDot: { width: 7, height: 7, borderRadius: 4 },
  monitorText: { fontSize: 13 },

  // Vitals
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: Spacing.md },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl },
  vitalCard: { width: CARD_WIDTH, borderRadius: 20, padding: Spacing.md, minHeight: 130, justifyContent: 'center', ...Shadows.medium },
  vitalIcon: { fontSize: 22, color: 'rgba(255,255,255,0.9)', marginBottom: 4 },
  vitalValue: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  vitalUnit: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginTop: 2 },
  vitalStatus: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  vitalStatusText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Patient code card
  codeCardWrap: { marginBottom: Spacing.xl },
  codeCard: { borderRadius: 20, borderWidth: 1, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...Shadows.light },
  codeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  codeIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  codeIcon: { fontSize: 22 },
  codeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  codeValue: { fontSize: 22, fontWeight: '900', letterSpacing: 3, marginVertical: 2 },
  codeHint: { fontSize: 10 },
  chatBtn: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', ...Shadows.light },
  chatBtnText: { fontSize: 20 },
  chatBtnLabel: { color: '#fff', fontWeight: '700', fontSize: 11, marginTop: 2 },

  // Quick actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl },
  actionCard: { width: CARD_WIDTH, borderRadius: 18, borderWidth: 1, padding: Spacing.md, alignItems: 'center', gap: 10, ...Shadows.light },
  actionIconWrap: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  actionIcon: { fontSize: 26 },
  actionLabel: { fontSize: 13, fontWeight: '700' },

  // Insight
  insightWrap: { marginBottom: Spacing.lg },
  insightCard: { borderRadius: 20, borderWidth: 1, padding: Spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  insightEmoji: { fontSize: 28, marginTop: 2 },
  insightText: { flex: 1 },
  insightTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  insightBody: { fontSize: 13, lineHeight: 20 },

  // Fall overlay
  fallOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, justifyContent: 'center', alignItems: 'center' },
  fallGradient: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, gap: Spacing.lg },
  fallIcon: { fontSize: 72, color: '#fff' },
  fallTitle: { fontSize: 36, fontWeight: '900', color: '#fff' },
  fallSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 24 },
  fallCancelBtn: { backgroundColor: '#fff', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing.sm, ...Shadows.medium },
  fallCancelText: { color: '#C0392B', fontWeight: '900', fontSize: 16 },
});

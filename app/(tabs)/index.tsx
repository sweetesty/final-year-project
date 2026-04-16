import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
  Platform,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRef } from 'react';
import { useRouter, useFocusEffect, Stack, useRootNavigationState } from 'expo-router';
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
import { PedometerService } from '@/src/services/PedometerService';
import { BarChart } from 'react-native-chart-kit';
import { useTranslation } from 'react-i18next';
import { SymptomLogModal } from '@/src/components/SymptomLogModal';
import { useMedicationViewModel } from '@/src/viewmodels/useMedicationViewModel';
import { useSymptomViewModel } from '@/src/viewmodels/useSymptomViewModel';
import { useVitalsViewModel } from '@/src/viewmodels/useVitalsViewModel';
import { VitalsTrendChart } from '@/src/components/AnalyticsCharts';
import { supabase } from '@/src/services/SupabaseService';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

type Vitals = { heartrate: number; spo2: number; steps: number; activeMin: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hour() { return new Date().getHours(); }
function greeting(t: any) {
  const h = hour();
  if (h < 12) return t('home.welcome');
  if (h < 17) return t('home.good_afternoon');
  return t('home.good_evening');
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
  icon, value, unit, label, color, delay, onAction,
}: { icon: string; value: string | number; unit: string; label: string; color: string; delay: number; onAction?: () => void }) {
  const isDark = useColorScheme() === 'dark';
  return (
    <Animated.View entering={FadeInRight.delay(delay).duration(420)} style={[styles.vitalTile, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}>
      <View style={styles.tileHeader}>
        <View style={[styles.vitalTileIcon, { backgroundColor: color + '18' }]}>
          <MaterialIcons name={icon as any} size={20} color={color} />
        </View>
        {onAction && (
          <TouchableOpacity onPress={onAction} style={styles.tileAction}>
            <MaterialIcons name="assessment" size={18} color={color} />
          </TouchableOpacity>
        )}
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
  const { session, role } = useAuthViewModel();
  const { t, i18n } = useTranslation();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [symptomModalVisible, setSymptomModalVisible] = useState(false);
  
  const patientid   = session?.user?.id ?? '';
  const patientName = session?.user?.user_metadata?.full_name ?? 'Patient';

  const rootNavigationState = useRootNavigationState();
  const isNavReady = !!rootNavigationState?.key;

  // --- Role Shield & Redirect ---
  useEffect(() => {
    if (isNavReady && role) {
      // Small timeout to ensure the navigator is fully settled
      const timeout = setTimeout(() => {
        if (role === 'doctor') {
          router.replace('/(tabs)/doctor-home');
        } else if (role === 'caregiver') {
          router.replace('/(tabs)/caregiver');
        }
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [role, isNavReady, router]);

  const { medications, refresh: refreshMeds } = useMedicationViewModel(patientid, patientName);
  const { logSymptom } = useSymptomViewModel(patientid, patientName);
  const { chartData, fetchHistory } = useVitalsViewModel(patientid);

  // Refresh data whenever dashboard becomes focused (after adding a med)
  useFocusEffect(
    useCallback(() => {
      if (patientid) {
        refreshMeds();
        fetchHistory();
      }
    }, [patientid, refreshMeds, fetchHistory])
  );
  const firstName   = patientName.split(' ')[0];

  const { state: fallState, cancelAlert, countdown, isUserActive } = useFallDetectionViewModel(patientid, patientName);

  const [patientCode, setPatientCode] = useState('––– –––');
  const [vitals, setVitals] = useState<Vitals>({ heartrate: 72, spo2: 98, steps: 1240, activeMin: 42 });

  // Symptom Prompt & Diagnostic Logging
  useEffect(() => {
    console.log('[Auth] Current User ID:', patientid || 'NOT_LOGGED_IN');
    console.log('[Auth] Current Role:', role || 'NO_ROLE');

    if (role !== 'patient') return;
    // For this demo, we show it 2 seconds after mount to simulate a proactive prompt
    const timer = setTimeout(() => {
      setSymptomModalVisible(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [role, patientid]);

  // History state
  const [historyVisible, setHistoryVisible] = useState(false);
  const [stepHistory, setStepHistory] = useState<{ date: string; steps: number }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);


  // Doctor state
  const [doctor, setDoctor] = useState<any>(null);
  
  // Date change tracker
  const lastDateRef = useRef(new Date().getDate());

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
    if (!patientid) return;
    DoctorService.ensurePatientCode(patientid)
      .then(c => { if (c) setPatientCode(c); })
      .catch(console.error);

    DoctorService.getLinkedDoctor(patientid)
      .then(setDoctor)
      .catch(console.error);
  }, [patientid]);

  // Physical step counting
  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    async function startPedometer() {
      const isAvailable = await PedometerService.isAvailableAsync();
      if (!isAvailable) {
        console.warn('[Home] Pedometer not available on this device');
        return;
      }

      const granted = await PedometerService.requestPermissionsAsync();
      if (!granted) {
        console.warn('[Home] Pedometer permission denied');
        return;
      }

      // 1. Get steps already taken today
      const midnight = PedometerService.getTodayMidnight();
      const initialTotalSteps = await PedometerService.getStepCountAsync(midnight, new Date());
      setVitals(prev => ({ ...prev, steps: initialTotalSteps }));

      // 2. Watch for steps taken from NOW on
      subscription = PedometerService.watchStepCount(stepsSinceStarted => {
        setVitals(prev => ({ ...prev, steps: initialTotalSteps + stepsSinceStarted }));
      });
    }

    startPedometer().catch(err => console.error('[Home] Pedometer error:', err));
    return () => subscription?.remove();
  }, []);

  const refreshPedometer = async () => {
    const midnightResource = PedometerService.getTodayMidnight();
    const steps = await PedometerService.getStepCountAsync(midnightResource, new Date());
    setVitals(prev => ({ ...prev, steps }));
  };

  const showHistory = async () => {
    setLoadingHistory(true);
    setHistoryVisible(true);
    try {
      const data = await PedometerService.getStepHistoryAsync(7);
      setStepHistory(data);
    } catch (e) {
      console.error('[Home] History error:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Vitals simulation (HR, SpO2, Active Time)
  useEffect(() => {
    const id = setInterval(() => {
      const hr   = 68 + Math.floor(Math.random() * 16);
      const spo2 = 96 + Math.floor(Math.random() * 4);
      
      setVitals(prev => {
        const nextSteps = prev.steps; // steps are now handled by pedometer
        const nextMins  = prev.activeMin + 1;
        
        // Auto-reset check
        const now = new Date();
        if (now.getDate() !== lastDateRef.current) {
          lastDateRef.current = now.getDate();
          refreshPedometer(); // Sync steps for the new day
        }

        if (patientid && patientid !== '') {
          VitalsService.logVitals({ 
            patientid: patientid, 
            heartrate: hr, 
            spo2, 
            steps: nextSteps, 
            timestamp: new Date().toISOString() 
          }).catch(err => console.error('[VitalsService] simulation error:', err));
        }

        return { ...prev, heartrate: hr, spo2, activeMin: nextMins };
      });

      if (hr > 95) SpeechService.speak(`${firstName}, your heart rate is ${hr} BPM. Please rest.`, i18n.language);
    }, 15000);
    return () => clearInterval(id);
  }, [patientid, firstName, i18n.language]);

  const handleLogSymptom = async (type: string) => {
    try {
      if (patientid) {
        await logSymptom(type, 'Logged via Home quick-log modal', 'moderate');
        // Optional: show a confirmation
        Alert.alert('Status Sent', 'Your doctor has been notified of how you are feeling.');
      }
      setSymptomModalVisible(false);
    } catch (e) {
      console.error('[Symptom] Failed to notify doctor:', e);
      Alert.alert('Error', 'Failed to send symptom report. Please try again.');
      setSymptomModalVisible(false);
    }
  };

  const zone = hrZone(vitals.heartrate);

  const startAudioBriefing = async () => {
    if (speaking) {
      SpeechService.stop();
      setSpeaking(false);
      return;
    }

    const lng = i18n.language;
    const hrText = t('common.hr_is', { hr: vitals.heartrate });
    const statusText = t('common.status_is', { status: zone.label });
    const stepText = vitals.steps > 0 ? t('common.steps_today', { steps: vitals.steps }) : '';
    const nextMed = medications.length > 0 ? medications[0] : null;
    const medText = nextMed
      ? t('common.next_med_at', { name: nextMed.name, time: nextMed.times[0] })
      : t('common.no_more_meds');
    const fullText = `${greeting(t)}, ${firstName}. ${hrText} ${statusText} ${stepText} ${medText}`;

    setSpeaking(true);
    try {
      await SpeechService.speak(fullText, lng);
    } finally {
      setSpeaking(false);
    }
  };

  // Prevent UI flicker for non-patients before redirect
  if (role !== 'patient' && role !== null) {
    return (
      <View style={{ flex: 1, backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.tint} />
      </View>
    );
  }

  // ─── Layout ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#080C18' : '#F4F7FE' }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── AI Companion FAB ─────────────────────────────────────────── */}
      {role === 'patient' && (
        <Animated.View entering={FadeIn.delay(600).duration(400)} style={styles.fab} pointerEvents="box-none">
          <TouchableOpacity onPress={() => router.push('/ai-chat')} activeOpacity={0.85}>
            <LinearGradient colors={['#4F46E5', '#6D28D9']} style={styles.fabGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <MaterialIcons name="smart-toy" size={26} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Fall Alert Sheet — PATIENTS ONLY (slides up from bottom) ──── */}
      {role === 'patient' && (
        <Animated.View style={[styles.fallSheet, alertStyle]}>
          <LinearGradient colors={['#7F1D1D', '#DC2626']} style={styles.fallSheetInner}>
            <View style={styles.fallSheetTop}>
              <MaterialIcons name="warning" size={32} color="#fff" />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.fallSheetTitle}>{t('home.fall_detected')}</Text>
                  <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>{countdown}s</Text>
                </View>
                <Text style={styles.fallSheetSub}>{t('home.fall_alert_sub')}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.fallCancelBtn} onPress={cancelAlert}>
              <Text style={styles.fallCancelText}>{t('home.fall_cancel')}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      )}

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
              <Text style={styles.headerGreeting}>{greeting(t)}</Text>
              <Text style={styles.headerName}>{firstName}</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[styles.audioBriefBtn, { backgroundColor: speaking ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)' }]}
                onPress={startAudioBriefing}
                disabled={false}
              >
                {speaking
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <MaterialIcons name="volume-up" size={20} color="#fff" />}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.monitorBadge, { marginBottom: 8 }]}
                onPress={() => setLangModalVisible(true)}
              >
                <MaterialIcons name="language" size={14} color="#fff" />
                <Text style={styles.monitorBadgeText}>{i18n.language.toUpperCase()}</Text>
              </TouchableOpacity>
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
              <Text style={styles.headerHRNumber}>{vitals.heartrate}</Text>
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
              onPress={() => router.push('/(tabs)/clinical-messages')}
            >
              <MaterialIcons name="chat" size={16} color="#fff" />
              <Text style={styles.codeStripBtnText}>{t('common.messages')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.codeStripBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
              onPress={() => router.push('/my-requests')}
            >
              <MaterialIcons name="history" size={16} color="#fff" />
              <Text style={styles.codeStripBtnText}>Status</Text>
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>

        {/* ═══════════════════════════════════════════════════════════════
            VITALS ROW  — horizontal scroll of 4 tiles
        ════════════════════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>{t('common.vitals')}</Text>
            <View style={styles.sectionLive}>
              <LiveDot color="#10B981" />
              <Text style={[styles.sectionLiveText, { color: C.muted }]}>{t('home.real_time')}</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vitalsRow}>
            <VitalTile icon="favorite"       value={vitals.heartrate} unit="BPM"  label={t('home.heart_rate')}   color="#EF4444" delay={0}   />
            <VitalTile icon="air"            value={`${vitals.spo2}%`} unit="SpO2" label={t('home.blood_oxygen')}  color="#3B82F6" delay={60}  />
            <VitalTile icon="directions-walk" value={vitals.steps.toLocaleString()} unit={t('common.steps_today').split(' ')[0]} label={t('home.steps_today')} color="#10B981" delay={120} onAction={showHistory} />
            <VitalTile icon="timer"          value={`${vitals.activeMin}m`} unit="active" label={t('home.active_time')}  color="#8B5CF6" delay={180} />
          </ScrollView>
        </View>

        {/* ═══════════════════════════════════════════════════════════════
            TREND CHART  — Heart rate over 24 hours
        ════════════════════════════════════════════════════════════════ */}
        <Animated.View entering={FadeInDown.delay(240).duration(450)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>24-Hour Heart Rate</Text>
            <TouchableOpacity onPress={() => fetchHistory()}>
               <MaterialIcons name="refresh" size={16} color={C.tint} />
            </TouchableOpacity>
          </View>
          <View style={[styles.chartCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}>
             <VitalsTrendChart 
                data={chartData.heartRate.data} 
                labels={chartData.heartRate.labels} 
                theme={{ vital: '#EF4444' }} 
             />
             <Text style={[styles.chartHint, { color: C.muted }]}>
                Real-time trend captured via background monitoring.
             </Text>
          </View>
        </Animated.View>

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
                  <Text style={styles.aiBannerTitle}>{t('home.ai_companion')}</Text>
                  <Text style={styles.aiBannerSub}>{t('home.ai_companion_sub')}</Text>
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
          <Text style={[styles.sectionTitle, { color: C.text }]}>{t('home.actions')}</Text>
          <View style={styles.actionsGrid}>
            {[
              { icon: 'location-on',    label: t('home.live_map'),       sub: t('home.track_location'),  color: '#6366F1', route: '/live-tracking' },
              { icon: 'medication',     label: t('common.medication'),   sub: t('home.schedule_doses'),  color: '#EC4899', route: '/medication' },
              { icon: 'phone-in-talk',  label: t('common.emergency'),    sub: t('home.sos_contacts'),    color: '#EF4444', route: '/emergency-contacts' },
              { icon: 'local-hospital', label: t('common.doctor'),       sub: doctor ? 'Dr. ' + doctor.full_name.split(' ').pop() : 'Find a doctor', color: '#10B981', route: '/(tabs)/doctor' },
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
          <Text style={[styles.sectionTitle, { color: C.text }]}>{t('home.todays_summary')}</Text>
          <View style={[styles.summaryCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}>
            {[
              { label: t('home.heart_rate'),  value: `${vitals.heartrate} bpm`, icon: 'favorite',       color: '#EF4444' },
              { label: t('home.blood_oxygen'),   value: `${vitals.spo2}%`,         icon: 'bubble-chart',   color: '#3B82F6' },
              { label: t('home.steps_today'),      value: vitals.steps.toLocaleString(), icon: 'show-chart',  color: '#10B981' },
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
              {vitals.heartrate < 80
                ? t('home.hr_stable', { hr: vitals.heartrate })
                : t('home.hr_elevated', { hr: vitals.heartrate })}
            </Text>
          </View>
        </Animated.View>

      </ScrollView>

      {/* ── Step History Modal ────────────────────────────────────── */}
      <Modal visible={historyVisible} animationType="fade" transparent onRequestClose={() => setHistoryVisible(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setHistoryVisible(false)} />
          <Animated.View entering={FadeInDown.duration(300)} style={[styles.historySheet, { backgroundColor: isDark ? '#0F172A' : '#fff' }]}>
            <View style={styles.historyHeader}>
              <Text style={[styles.historyTitle, { color: C.text }]}>{t('home.step_history')}</Text>
              <TouchableOpacity onPress={() => setHistoryVisible(false)} style={styles.historyClose}>
                <MaterialIcons name="close" size={24} color={C.muted} />
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <View style={styles.historyLoading}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={[styles.historyLoadingText, { color: C.muted }]}>{t('home.fetching_history')}</Text>
              </View>
            ) : (
              <View style={styles.historyContent}>
                <View style={styles.chartWrap}>
                  <BarChart
                    data={{
                      labels: stepHistory.map(h => h.date),
                      datasets: [{ data: stepHistory.map(h => h.steps) }]
                    }}
                    width={width - 48}
                    height={220}
                    yAxisLabel=""
                    yAxisSuffix=""
                    chartConfig={{
                      backgroundColor: isDark ? '#0F172A' : '#fff',
                      backgroundGradientFrom: isDark ? '#0F172A' : '#fff',
                      backgroundGradientTo: isDark ? '#0F172A' : '#fff',
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                      labelColor: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity * 0.5})` : `rgba(0, 0, 0, ${opacity * 0.5})`,
                      propsForBackgroundLines: { strokeDasharray: "" },
                      style: { borderRadius: 16 },
                    }}
                    style={{ marginVertical: 8, borderRadius: 16 }}
                    verticalLabelRotation={0}
                    fromZero={true}
                    showValuesOnTopOfBars={true}
                  />
                </View>

                {/* Legend / Stats */}
                <View style={styles.historyList}>
                  {stepHistory.slice().reverse().map((h, i) => (
                    <View key={i} style={[styles.historyRow, i < stepHistory.length - 1 && { borderBottomWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                      <Text style={[styles.historyLabel, { color: C.text }]}>{h.date}</Text>
                      <Text style={[styles.historyValue, { color: '#10B981' }]}>{h.steps.toLocaleString()} <Text style={{ fontSize: 11, color: C.muted }}>steps</Text></Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* ── Language Selection Modal ────────────────────────────────── */}
      <Modal visible={langModalVisible} animationType="slide" transparent onRequestClose={() => setLangModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setLangModalVisible(false)} />
          <Animated.View entering={FadeInDown.duration(300)} style={[styles.historySheet, { backgroundColor: isDark ? '#0F172A' : '#fff' }]}>
            <View style={styles.historyHeader}>
              <Text style={[styles.historyTitle, { color: C.text }]}>{t('common.language')}</Text>
              <TouchableOpacity onPress={() => setLangModalVisible(false)} style={styles.historyClose}>
                <MaterialIcons name="close" size={24} color={C.muted} />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 12 }}>
              {[
                { id: 'en', name: 'English', flag: '🇬🇧' },
                { id: 'yo', name: 'Yorùbá', flag: '🇳🇬' },
                { id: 'ig', name: 'Igbo', flag: '🇳🇬' },
                { id: 'ha', name: 'Hausa', flag: '🇳🇬' },
              ].map((lang) => (
                <TouchableOpacity
                  key={lang.id}
                  style={[
                    styles.historyRow, 
                    { paddingVertical: 16, borderBottomWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
                    i18n.language === lang.id && { backgroundColor: C.tint + '10' }
                  ]}
                  onPress={() => {
                    i18n.changeLanguage(lang.id);
                    setLangModalVisible(false);
                  }}
                >
                  <Text style={[styles.historyLabel, { color: C.text }]}>{lang.flag}  {lang.name}</Text>
                  {i18n.language === lang.id && <MaterialIcons name="check" size={20} color={C.tint} />}
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Symptom Modal */}
      <SymptomLogModal
        visible={symptomModalVisible}
        onClose={() => setSymptomModalVisible(false)}
        onLog={handleLogSymptom}
        theme={C}
        userName={firstName}
      />
    </View>
  );
}

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
  vitalTile: { width: 115, borderRadius: 16, padding: 14, alignItems: 'flex-start', ...Shadows.light },
  tileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 },
  vitalTileIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  tileAction: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.03)', justifyContent: 'center', alignItems: 'center' },
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

  // FAB
  fab: { position: 'absolute', bottom: 88, right: 20, zIndex: 100 },
  fabGradient: { width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },

  // Fall alert
  fallSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 999, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  fallSheetInner: { padding: Spacing.lg, gap: 16 },
  fallSheetTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  fallSheetTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  fallSheetSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
  fallCancelBtn: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  fallCancelText: { color: '#DC2626', fontSize: 16, fontWeight: '800' },

  // Modal Backdrop
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },

  // History Sheet
  historySheet: { width: width - 24, borderRadius: 24, padding: 24, ...Shadows.medium },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  historyTitle: { fontSize: 20, fontWeight: '900' },
  historyClose: { padding: 4 },
  historyLoading: { paddingVertical: 40, alignItems: 'center', gap: 12 },
  historyLoadingText: { fontSize: 14 },
  historyContent: {},
  chartWrap: { alignItems: 'center', marginBottom: 12 },
  chartHint: { fontSize: 11, textAlign: 'center', marginTop: -4, fontStyle: 'italic', paddingHorizontal: 20 },
  chartCard: { borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', marginBottom: 12 },
  historyList: { marginTop: 8 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  historyLabel: { fontSize: 15, fontWeight: '600' },
  historyValue: { fontSize: 15, fontWeight: '800' },
  audioBriefBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
});

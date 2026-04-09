import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, Shadows, GlassFilters } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SpeechService } from '@/src/services/SpeechService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { useFallDetectionViewModel } from '@/src/viewmodels/useFallDetectionViewModel';
import { DoctorService } from '@/src/services/DoctorService';
import { VitalsService } from '@/src/services/VitalsService';

const { width } = Dimensions.get('window');

export default function IntelligenceHub() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const glassStyle = GlassFilters[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { session } = useAuthViewModel();
  const patientId = session?.user?.id ?? '';
  const patientName = session?.user?.user_metadata?.full_name ?? 'there';
  const firstName = patientName.split(' ')[0];

  const { state: fallState, cancelAlert, isUserActive } = useFallDetectionViewModel(patientId, patientName);

  const [patientCode, setPatientCode] = useState<string>('------');

  // State for mocked vitals
  const [vitals, setVitals] = useState({
    heartRate: 72,
    spo2: 98,
    steps: 1240,
    activeTime: '2h 15m'
  });

  // Load patient code from Supabase (creates one if it doesn't exist)
  useEffect(() => {
    if (patientId) {
      DoctorService.ensurePatientCode(patientId).then(code => {
        if (code) setPatientCode(code.replace(/(\d{3})(\d{3})/, '$1 $2'));
      }).catch(console.error);
    }
  }, [patientId]);

  // Pulse animation for AI Button
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const aiButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    shadowOpacity: interpolate(pulse.value, [1, 1.1], [0.3, 0.6], Extrapolate.CLAMP),
  }));

  // Proactive Monitoring Logic + Vitals Persistence
  useEffect(() => {
    let stepAccumulator = vitals.steps;

    const interval = setInterval(() => {
      // Simulate vitals fluctuations
      const newHr = 70 + Math.floor(Math.random() * 10);
      const newSpo2 = 96 + Math.floor(Math.random() * 4);
      stepAccumulator += Math.floor(Math.random() * 20);

      setVitals(prev => ({ ...prev, heartRate: newHr, spo2: newSpo2, steps: stepAccumulator }));

      // Proactive Check: Simulated Tachycardia for demo
      if (newHr > 95) {
        SpeechService.speak(`${firstName}, I noticed your heart rate is increasing to ${newHr} beats per minute. Please consider sitting down and taking a deep breath.`);
      }

      // Persist vitals to Supabase every 60s (4 × 15s intervals)
      if (patientId) {
        VitalsService.logVitals({
          patientId,
          heartRate: newHr,
          spo2: newSpo2,
          steps: stepAccumulator,
          timestamp: new Date().toISOString(),
        }).catch(console.error);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [patientId, firstName]);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Fall Detection Alert Overlay */}
      {fallState === 'user_response_window' && (
        <View style={[styles.fallAlert, { backgroundColor: themeColors.emergency }]}>
          <Text style={styles.fallAlertTitle}>⚠️ Fall Detected</Text>
          <Text style={styles.fallAlertText}>Are you okay? Emergency alert in 20 seconds.</Text>
          <TouchableOpacity style={styles.fallAlertButton} onPress={cancelAlert}>
            <Text style={styles.fallAlertButtonText}>I'm OK — Cancel Alert</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Intelligence Status Header */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: themeColors.text }]}>Welcome back, {firstName}</Text>
          <View style={[styles.statusBanner, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={[styles.pulseDot, { backgroundColor: themeColors.vital }]} />
            <Text style={[styles.statusText, { color: themeColors.muted }]}>System Status: <Text style={{ color: themeColors.vital, fontWeight: '700' }}>OPTIMIZED</Text></Text>
          </View>
        </View>

        {/* Central Intelligence Hub (Large AI Button) */}
        <View style={styles.hubContainer}>
          <Animated.View style={[styles.aiPulseCircle, aiButtonStyle, { backgroundColor: themeColors.tint + '20' }]} />
          <TouchableOpacity 
            style={[styles.aiMainButton, { backgroundColor: themeColors.tint }]}
            onPress={() => router.push('/ai-chat')}
          >
            <Text style={styles.aiIcon}>🤖</Text>
            <Text style={styles.aiLabel}>Talk to Companion</Text>
          </TouchableOpacity>
          <View style={styles.hubOverlay}>
             <Text style={[styles.aiStatus, { color: themeColors.muted }]}>
               {isUserActive ? '🏃 Active movement detected — threshold raised' : '🛡️ Fall detection active — monitoring movement'}
             </Text>
          </View>
        </View>

        {/* Vitals Grid with Glassmorphism */}
        <View style={styles.vitalsGrid}>
          <View style={[styles.vitalsCard, glassStyle]}>
            <Text style={styles.vitalsEmoji}>❤️</Text>
            <Text style={[styles.vitalsValue, { color: themeColors.text }]}>{vitals.heartRate}</Text>
            <Text style={[styles.vitalsLabel, { color: themeColors.muted }]}>BPM</Text>
          </View>
          
          <View style={[styles.vitalsCard, glassStyle]}>
            <Text style={styles.vitalsEmoji}>🫁</Text>
            <Text style={[styles.vitalsValue, { color: themeColors.text }]}>{vitals.spo2}%</Text>
            <Text style={[styles.vitalsLabel, { color: themeColors.muted }]}>SpO2</Text>
          </View>

          <View style={[styles.vitalsCard, glassStyle]}>
            <Text style={styles.vitalsEmoji}>🔥</Text>
            <Text style={[styles.vitalsValue, { color: themeColors.text }]}>{vitals.steps}</Text>
            <Text style={[styles.vitalsLabel, { color: themeColors.muted }]}>Steps</Text>
          </View>

          <View style={[styles.vitalsCard, glassStyle]}>
            <Text style={styles.vitalsEmoji}>⚡</Text>
            <Text style={[styles.vitalsValue, { color: themeColors.text }]}>{vitals.activeTime}</Text>
            <Text style={[styles.vitalsLabel, { color: themeColors.muted }]}>Active</Text>
          </View>
        </View>

        {/* Clinical Intelligence Hub (Patient Code & Doctor) */}
        <View style={styles.actionSection}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Clinical Bridge</Text>
          <View style={[styles.clinicalCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View>
              <Text style={{ color: themeColors.muted, fontSize: 12 }}>YOUR PATIENT CODE</Text>
              <Text style={[styles.patientCodeText, { color: themeColors.tint }]}>{patientCode}</Text>
              <Text style={{ color: themeColors.muted, fontSize: 10 }}>Share this with your doctor</Text>
            </View>
            <TouchableOpacity 
              style={[styles.smallChatButton, { backgroundColor: themeColors.secondary }]}
              onPress={() => router.push({ pathname: '/chat-room', params: { partnerId: 'doc-123', partnerName: 'Dr. Smith' } })}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>My Doctor 💬</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Intelligence Actions */}
        <View style={styles.actionSection}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Safe Intelligence</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.actionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              onPress={() => router.push('/live-tracking')}
            >
              <Text style={{ fontSize: 24 }}>🌍</Text>
              <Text style={{ color: themeColors.text, fontWeight: '700' }}>Live Map</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              onPress={() => router.push('/medication')}
            >
              <Text style={{ fontSize: 24 }}>💊</Text>
              <Text style={{ color: themeColors.text, fontWeight: '700' }}>Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
  },
  hubContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  aiMainButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.medium,
    zIndex: 2,
  },
  aiIcon: {
    fontSize: 64,
  },
  aiLabel: {
    color: '#fff',
    fontWeight: '800',
    marginTop: 8,
    fontSize: 14,
  },
  aiPulseCircle: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    zIndex: 1,
  },
  hubOverlay: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  aiStatus: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  vitalsCard: {
    width: (width - Spacing.lg * 2 - Spacing.md) / 2,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.light,
  },
  vitalsEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  vitalsValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  vitalsLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionSection: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  clinicalCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Shadows.light,
  },
  patientCodeText: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    marginVertical: 4,
  },
  smallChatButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionCard: {
    flex: 1,
    height: 100,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    ...Shadows.light,
  },
  fallAlert: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  fallAlertTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
  },
  fallAlertText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  fallAlertButton: {
    backgroundColor: '#fff',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
    ...Shadows.medium,
  },
  fallAlertButtonText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 16,
  },
});

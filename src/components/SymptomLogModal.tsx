import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Shadows } from '@/constants/theme';
import { useTranslation } from 'react-i18next';
import { SpeechService } from '../services/SpeechService';

const { width } = Dimensions.get('window');

interface SymptomLogModalProps {
  visible: boolean;
  onClose: () => void;
  onLog: (type: string) => void;
  theme: any;
  userName: string;
}

const SYMPTOMS = [
  { id: 'dizziness', icon: 'sync',          label: 'Dizzy',      color: '#F59E0B' },
  { id: 'headache',  icon: 'psychology',     label: 'Headache',   color: '#EF4444' },
  { id: 'pain',      icon: 'warning',        label: 'Pain',       color: '#EC4899' },
  { id: 'nausea',    icon: 'sick',           label: 'Nausea',     color: '#8B5CF6' },
  { id: 'fatigue',   icon: 'battery-alert',  label: 'Tired',      color: '#6366F1' },
  { id: 'shortness', icon: 'air',            label: 'Breathless', color: '#3B82F6' },
];

export const SymptomLogModal = ({ visible, onClose, onLog, theme, userName }: SymptomLogModalProps) => {
  const { t, i18n } = useTranslation();
  const isDark = theme?.background === '#0F172A';

  const handleSelect = (id: string) => {
    SpeechService.speak(`${t('common.noted')}. ${t('common.info_shared')}`, i18n.language);
    onLog(id);
  };

  const handleWellness = () => {
    SpeechService.speak(`Great to hear, ${userName}. Keep it up!`, i18n.language);
    onClose();
  };

  React.useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        const greeting = `${t('home.welcome')}, ${userName}. ${t('common.how_are_you')}`;
        SpeechService.speak(greeting, i18n.language);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View entering={FadeInDown.duration(380)} style={styles.sheet}>

          {/* ── Header gradient ─────────────────────────────────── */}
          <LinearGradient
            colors={['#1D4ED8', '#2563EB']}
            style={styles.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Subtle grid overlay */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {Array.from({ length: 4 }).map((_, i) => (
                <View key={i} style={[styles.gridLine, { top: i * 28 }]} />
              ))}
            </View>

            <View style={styles.headerIcon}>
              <MaterialIcons name="health-and-safety" size={28} color="#fff" />
            </View>
            <Text style={styles.headerTitle}>Daily Check-in</Text>
            <Text style={styles.headerSub}>How are you feeling today, {userName}?</Text>
          </LinearGradient>

          {/* ── Body ────────────────────────────────────────────── */}
          <View style={[styles.body, { backgroundColor: isDark ? '#0F172A' : '#fff' }]}>

            <Text style={[styles.sectionLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              TAP IF YOU ARE EXPERIENCING
            </Text>

            {/* Symptom grid — 3 columns */}
            <View style={styles.grid}>
              {SYMPTOMS.map((s, i) => (
                <Animated.View key={s.id} entering={FadeInDown.delay(i * 50).duration(300)}>
                  <TouchableOpacity
                    style={[
                      styles.symptomCard,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC' },
                    ]}
                    onPress={() => handleSelect(s.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.symptomIcon, { backgroundColor: s.color + '20' }]}>
                      <MaterialIcons name={s.icon as any} size={22} color={s.color} />
                    </View>
                    <Text style={[styles.symptomLabel, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>

            {/* I'm feeling well button */}
            <TouchableOpacity style={styles.wellnessBtn} onPress={handleWellness} activeOpacity={0.82}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.wellnessBtnInner}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <MaterialIcons name="check-circle" size={20} color="#fff" />
                <Text style={styles.wellnessBtnText}>I'm Feeling Well</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Skip */}
            <TouchableOpacity onPress={onClose} style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: isDark ? '#64748B' : '#94A3B8' }]}>
                Skip for now
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    ...Shadows.medium,
  },

  // Header
  header: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 6,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Body
  body: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 14,
    textAlign: 'center',
  },

  // Symptom grid — 3 columns
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 20,
  },
  symptomCard: {
    width: (width - 40 - 20) / 3,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
  },
  symptomIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  symptomLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Wellness button
  wellnessBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  wellnessBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  wellnessBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  // Skip
  skipBtn: {
    alignSelf: 'center',
    padding: 10,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useTranslation } from 'react-i18next';
import { SpeechService } from '../services/SpeechService';

interface SymptomLogModalProps {
  visible: boolean;
  onClose: () => void;
  onLog: (type: string) => void;
  theme: any;
  userName: string;
}

const SYMPTOMS = [
  { id: 'dizziness', icon: 'sync', label: 'Dizzy' },
  { id: 'headache', icon: 'psychology', label: 'Headache' },
  { id: 'pain', icon: 'warning', label: 'Pain' },
  { id: 'nausea', icon: 'sick', label: 'Nausea' },
  { id: 'fatigue', icon: 'battery-alert', label: 'Tired' },
];

export const SymptomLogModal = ({ visible, onClose, onLog, theme, userName }: SymptomLogModalProps) => {
  const { t, i18n } = useTranslation();

  const handleSelect = (id: string, label: string) => {
    SpeechService.speak(`${t('common.noted')}. ${t('common.info_shared')}`, i18n.language);
    onLog(id);
  };

  React.useEffect(() => {
    if (visible) {
      // Small delay to allow audio channel to stabilize after modal transition
      const timer = setTimeout(() => {
        const greeting = `${t('home.welcome')}, ${userName}. ${t('common.how_are_you')}`;
        SpeechService.speak(greeting, i18n.language);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.content, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>{t('common.how_are_you')}</Text>
          
          <View style={styles.grid}>
            {SYMPTOMS.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.item, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => handleSelect(s.id, s.label)}
              >
                <MaterialIcons name={s.icon as any} size={32} color={Colors.light.tint} />
                <Text style={[styles.label, { color: theme.text }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={{ color: Colors.light.tint, fontWeight: '800' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  content: { width: '90%', borderRadius: 24, padding: 24, ...Shadows.medium },
  title: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  item: { width: '45%', aspectRatio: 1, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  label: { fontSize: 16, fontWeight: '700' },
  closeBtn: { marginTop: 24, alignSelf: 'center', padding: 12 },
});

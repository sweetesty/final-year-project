import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Switch, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMedicationViewModel } from '@/src/viewmodels/useMedicationViewModel';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

export default function AddMedicationScreen() {
  const { mode, patientId: targetId } = useLocalSearchParams<{ mode?: string; patientId?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuthViewModel();
  
  const activePatientId = targetId || session?.user?.id || '';
  const { addMedication } = useMedicationViewModel(activePatientId);

  const isPrescribing = mode === 'prescribe';

  const [form, setForm] = useState({
    name: '',
    dosage: '',
    instructions: '',
    isCritical: false,
    frequency: 'daily' as 'daily' | 'weekly',
  });

  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.dosage) {
      alert('Please fill in required fields');
      return;
    }

    const timeString = `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}`;

    try {
      await addMedication({
        name: form.name,
        dosage: form.dosage,
        instructions: form.instructions,
        isCritical: form.isCritical,
        frequency: form.frequency,
        times: [timeString],
        isPrescribed: isPrescribing,
        prescribedBy: isPrescribing ? (session?.user?.user_metadata?.full_name || 'Dr. Wilson') : undefined
      });

      Alert.alert(
        t('common.success') === 'common.success' ? "Success" : t('common.success'),
        isPrescribing ? "Prescription added successfully!" : "Medication added to your schedule!",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save medication.");
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <Stack.Screen options={{ 
        title: isPrescribing ? t('common.add_prescription') : t('med.add'), 
        headerShown: true 
      }} />
      
      <ScrollView contentContainerStyle={styles.scrollInner}>
        <View style={styles.section}>
          <Text style={[styles.label, { color: themeColors.text }]}>{t('med.name')} *</Text>
          <TextInput
            style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
            placeholder="e.g. Aspirin"
            placeholderTextColor={themeColors.muted}
            value={form.name}
            onChangeText={(v) => setForm({...form, name: v})}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: themeColors.text }]}>{t('med.dosage')} *</Text>
          <TextInput
            style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
            placeholder="e.g. 500mg, 1 tablet"
            placeholderTextColor={themeColors.muted}
            value={form.dosage}
            onChangeText={(v) => setForm({...form, dosage: v})}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: themeColors.text }]}>{t('med.time')}</Text>
          <TouchableOpacity 
            style={[styles.timeSelector, { borderColor: themeColors.border, backgroundColor: themeColors.card }]}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={{ fontSize: 24, fontWeight: '800', color: themeColors.tint }}>
              {selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={{ color: themeColors.muted }}>{t('common.language') === 'Èdè' ? 'Fọwọ́tẹ̀ ẹ́ láti yí i padà' : 'Tap to change'}</Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={selectedTime}
              mode="time"
              is24Hour={true}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowTimePicker(Platform.OS === 'ios');
                if (date) setSelectedTime(date);
              }}
            />
          )}
        </View>

        <View style={[styles.toggleRow, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <View>
            <Text style={[styles.toggleLabel, { color: themeColors.text }]}>{t('med.critical')}</Text>
            <Text style={{ color: themeColors.muted, fontSize: 12 }}>{isPrescribing ? 'Mark as clinical priority' : 'High-priority alarm sound'}</Text>
          </View>
          <Switch
            value={form.isCritical}
            onValueChange={(v) => setForm({...form, isCritical: v})}
            trackColor={{ false: '#CBD5E0', true: themeColors.emergency }}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: themeColors.text }]}>Additional Instructions</Text>
          <TextInput
            style={[styles.input, { height: 80, borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
            placeholder="e.g. Take after meal"
            placeholderTextColor={themeColors.muted}
            value={form.instructions}
            onChangeText={(v) => setForm({...form, instructions: v})}
            multiline
          />
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: themeColors.tint }]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>{isPrescribing ? t('common.add_prescription') : t('med.add')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollInner: {
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  timeSelector: {
    height: 100,
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    height: 60,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xxl,
    ...Shadows.medium,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
});

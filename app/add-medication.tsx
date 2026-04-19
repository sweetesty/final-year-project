import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ScrollView, Switch, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors, Spacing, BorderRadius, Shadows } from '@/src/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMedicationViewModel } from '@/src/viewmodels/useMedicationViewModel';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

const DURATION_PRESETS = [3, 5, 7, 14, 30];

export default function AddMedicationScreen() {
  const { mode, patientId: targetId, medicationId } = useLocalSearchParams<{ 
    mode?: string; 
    patientId?: string; 
    medicationId?: string; 
  }>();
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuthViewModel();

  const activePatientId = targetId || session?.user?.id || '';
  const { addMedication, updateMedication, deleteMedication, medications, loading } = useMedicationViewModel(activePatientId);

  const isPrescribing = mode === 'prescribe';
  const isEditing = mode === 'edit' && !!medicationId;

  const [form, setForm] = useState({
    name: '',
    dosage: '',
    instructions: '',
    isCritical: false,
    frequency: 'daily' as 'daily' | 'weekly',
  });

  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Duration
  const [durationEnabled, setDurationEnabled] = useState(false);
  const [durationDays, setDurationDays] = useState(7);
  const [customDuration, setCustomDuration] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load existing data for Edit Mode
  React.useEffect(() => {
    if (isEditing && medications.length > 0 && !hasLoaded) {
      const med = medications.find(m => m.id === medicationId);
      if (med) {
        setForm({
          name: med.name,
          dosage: med.dosage,
          instructions: med.instructions || '',
          isCritical: med.isCritical || false,
          frequency: (med.frequency as any) || 'daily',
        });
        
        if (med.times && med.times.length > 0) {
          const [h, m] = med.times[0].split(':').map(Number);
          const d = new Date();
          d.setHours(h, m, 0, 0);
          setSelectedTime(d);
        }

        if (med.durationDays) {
          setDurationEnabled(true);
          if (DURATION_PRESETS.includes(med.durationDays)) {
            setDurationDays(med.durationDays);
          } else {
            setUseCustom(true);
            setCustomDuration(med.durationDays.toString());
          }
        }
        setHasLoaded(true);
      }
    }
  }, [isEditing, medications, medicationId, hasLoaded]);

  const effectiveDuration = useCustom
    ? parseInt(customDuration, 10) || 0
    : durationDays;

  const endDatePreview = () => {
    if (!durationEnabled || effectiveDuration < 1) return null;
    const d = new Date();
    d.setDate(d.getDate() + effectiveDuration - 1);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleSave = async () => {
    if (!form.name || !form.dosage) {
      Alert.alert('Required', 'Please fill in medication name and dosage.');
      return;
    }
    if (durationEnabled && effectiveDuration < 1) {
      Alert.alert('Invalid Duration', 'Please enter a valid number of days.');
      return;
    }

    const timeString = `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}`;

    try {
      if (isEditing) {
        await updateMedication(medicationId!, {
          name: form.name,
          dosage: form.dosage,
          instructions: form.instructions,
          isCritical: form.isCritical,
          frequency: form.frequency,
          times: [timeString],
        });
      } else {
        await addMedication({
          name: form.name,
          dosage: form.dosage,
          instructions: form.instructions,
          isCritical: form.isCritical,
          frequency: form.frequency,
          times: [timeString],
          isPrescribed: isPrescribing,
          prescribedBy: isPrescribing
            ? (session?.user?.user_metadata?.full_name || 'Doctor')
            : undefined,
          durationDays: durationEnabled ? effectiveDuration : undefined,
          startDate: new Date().toISOString().split('T')[0],
        });
      }

      Alert.alert(
        'Saved',
        isEditing 
          ? 'Medication updated successfully'
          : durationEnabled
          ? `Reminders set for ${effectiveDuration} day${effectiveDuration > 1 ? 's' : ''} at ${timeString}.`
          : isPrescribing
          ? 'Prescription added successfully!'
          : 'Medication added to your schedule!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save medication.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Medication',
      'Are you sure you want to remove this medication from the profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            await deleteMedication(medicationId!);
            router.back();
          } 
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <Stack.Screen options={{
        title: isEditing ? 'Edit Medication' : isPrescribing ? t('common.add_prescription') : t('med.add'),
        headerShown: true,
      }} />

      <ScrollView contentContainerStyle={styles.scrollInner} keyboardShouldPersistTaps="handled">

        {/* Name */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: themeColors.text }]}>{t('med.name')} *</Text>
          <TextInput
            style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
            placeholder="e.g. Aspirin"
            placeholderTextColor={themeColors.muted}
            value={form.name}
            onChangeText={(v) => setForm({ ...form, name: v })}
          />
        </View>

        {/* Dosage */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: themeColors.text }]}>{t('med.dosage')} *</Text>
          <TextInput
            style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
            placeholder="e.g. 500mg, 1 tablet"
            placeholderTextColor={themeColors.muted}
            value={form.dosage}
            onChangeText={(v) => setForm({ ...form, dosage: v })}
          />
        </View>

        {/* Time */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: themeColors.text }]}>{t('med.time')}</Text>
          <TouchableOpacity
            style={[styles.timeSelector, { borderColor: themeColors.border, backgroundColor: themeColors.card }]}
            onPress={() => setShowTimePicker(true)}
          >
            <MaterialIcons name="access-time" size={22} color={themeColors.tint} />
            <Text style={{ fontSize: 28, fontWeight: '800', color: themeColors.tint }}>
              {selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={{ color: themeColors.muted, fontSize: 13 }}>Tap to change</Text>
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

        {/* ── Duration ── */}
        <View style={[styles.durationCard, { backgroundColor: themeColors.card, borderColor: durationEnabled ? themeColors.tint : themeColors.border }]}>
          <View style={styles.durationHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: themeColors.text }]}>Set Duration</Text>
              <Text style={{ color: themeColors.muted, fontSize: 12, marginTop: 2 }}>
                {durationEnabled
                  ? `Reminders for ${effectiveDuration} day${effectiveDuration !== 1 ? 's' : ''}`
                  : 'Remind me indefinitely'}
              </Text>
            </View>
            <Switch
              value={durationEnabled}
              onValueChange={setDurationEnabled}
              trackColor={{ false: themeColors.border, true: themeColors.tint + '88' }}
              thumbColor={durationEnabled ? themeColors.tint : themeColors.muted}
            />
          </View>

          {durationEnabled && (
            <>
              {/* Preset chips */}
              <View style={styles.presetRow}>
                {DURATION_PRESETS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: (!useCustom && durationDays === d) ? themeColors.tint : themeColors.background,
                        borderColor: (!useCustom && durationDays === d) ? themeColors.tint : themeColors.border,
                      },
                    ]}
                    onPress={() => { setDurationDays(d); setUseCustom(false); }}
                  >
                    <Text style={[
                      styles.presetChipText,
                      { color: (!useCustom && durationDays === d) ? '#fff' : themeColors.text },
                    ]}>
                      {d}d
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: useCustom ? themeColors.tint : themeColors.background,
                      borderColor: useCustom ? themeColors.tint : themeColors.border,
                    },
                  ]}
                  onPress={() => setUseCustom(true)}
                >
                  <Text style={[styles.presetChipText, { color: useCustom ? '#fff' : themeColors.text }]}>
                    Custom
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Custom input */}
              {useCustom && (
                <View style={styles.customRow}>
                  <TextInput
                    style={[styles.customInput, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.background }]}
                    placeholder="Number of days"
                    placeholderTextColor={themeColors.muted}
                    value={customDuration}
                    onChangeText={setCustomDuration}
                    keyboardType="number-pad"
                  />
                  <Text style={[{ color: themeColors.muted, fontSize: 15 }]}>days</Text>
                </View>
              )}

              {/* End date preview */}
              {effectiveDuration > 0 && endDatePreview() && (
                <View style={[styles.endDateBadge, { backgroundColor: themeColors.tint + '12' }]}>
                  <MaterialIcons name="event" size={16} color={themeColors.tint} />
                  <Text style={{ color: themeColors.tint, fontSize: 13, fontWeight: '600' }}>
                    Ends {endDatePreview()} · {effectiveDuration} reminder{effectiveDuration > 1 ? 's' : ''} will be scheduled
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Critical toggle */}
        <View style={[styles.toggleRow, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <View>
            <Text style={[styles.toggleLabel, { color: themeColors.text }]}>{t('med.critical')}</Text>
            <Text style={{ color: themeColors.muted, fontSize: 12 }}>
              {isPrescribing ? 'Mark as clinical priority' : 'High-priority alarm sound'}
            </Text>
          </View>
          <Switch
            value={form.isCritical}
            onValueChange={(v) => setForm({ ...form, isCritical: v })}
            trackColor={{ false: '#CBD5E0', true: themeColors.emergency }}
            thumbColor={form.isCritical ? themeColors.emergency : themeColors.muted}
          />
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: themeColors.text }]}>Additional Instructions</Text>
          <TextInput
            style={[styles.input, { height: 80, borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
            placeholder="e.g. Take after meal"
            placeholderTextColor={themeColors.muted}
            value={form.instructions}
            onChangeText={(v) => setForm({ ...form, instructions: v })}
            multiline
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: themeColors.tint }]}
          onPress={handleSave}
        >
          <MaterialIcons name="check-circle" size={22} color="#fff" />
          <Text style={styles.saveButtonText}>
            {isEditing ? 'Update Medication' : isPrescribing ? t('common.add_prescription') : t('med.add')}
          </Text>
        </TouchableOpacity>

        {isEditing && (
          <TouchableOpacity
            style={[styles.deleteButton, { borderColor: themeColors.emergency }]}
            onPress={handleDelete}
          >
            <MaterialIcons name="delete-outline" size={20} color={themeColors.emergency} />
            <Text style={[styles.deleteButtonText, { color: themeColors.emergency }]}>Delete Medication</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollInner: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: 60 },
  section: { gap: Spacing.xs },
  label: { fontSize: 16, fontWeight: '700' },
  input: {
    height: 52, borderWidth: 1, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, fontSize: 16,
  },
  timeSelector: {
    height: 100, borderWidth: 1, borderRadius: BorderRadius.xl,
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },

  // Duration card
  durationCard: {
    borderWidth: 1, borderRadius: BorderRadius.xl,
    padding: Spacing.md, gap: 14,
  },
  durationHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  presetChipText: { fontSize: 13, fontWeight: '700' },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customInput: {
    flex: 1, height: 44, borderWidth: 1, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, fontSize: 16,
  },
  endDateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 10, borderRadius: 10,
  },

  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1,
  },
  toggleLabel: { fontSize: 16, fontWeight: '700' },
  saveButton: {
    height: 60, borderRadius: BorderRadius.full,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 10, marginTop: Spacing.md, marginBottom: Spacing.xxl, ...Shadows.medium,
  },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  deleteButton: {
    height: 56, borderRadius: BorderRadius.full,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 10, marginTop: -Spacing.md, marginBottom: Spacing.xxl,
    borderWidth: 1.5,
  },
  deleteButtonText: { fontSize: 16, fontWeight: '700' },
});

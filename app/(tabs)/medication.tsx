import React, { useCallback, useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Modal, TextInput, Alert, Switch,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, Stack, useRouter, useRootNavigationState } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMedicationViewModel } from '@/src/viewmodels/useMedicationViewModel';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { useTranslation } from 'react-i18next';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SpeechService } from '@/src/services/SpeechService';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function MedicationDashboard() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { session, role } = useAuthViewModel();
  const { t, i18n } = useTranslation();

  const navigationState = useRootNavigationState();
  const isNavReady = navigationState?.key;

  useEffect(() => {
    if (isNavReady && role === 'doctor') router.replace('/doctor-home');
  }, [role, isNavReady]);

  const [selectedMed, setSelectedMed] = useState<any>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', dosage: '', instructions: '', isCritical: false });

  const patientId = session?.user?.id ?? '';
  const { 
    medications, todayLogs, loading, refreshing,
    logDose, deleteMedication, updateMedication, refresh: refreshMeds 
  } = useMedicationViewModel(patientId);

  useFocusEffect(
    useCallback(() => {
      if (patientId) refreshMeds(true); // Silent refresh on focus
    }, [patientId, refreshMeds])
  );

  const onRefresh = useCallback(() => {
    refreshMeds(true);
  }, [refreshMeds]);

  const handleSpeak = (item: any) => {
    SpeechService.speak(`${item.name}. ${item.dosage}. ${item.instructions}.`, i18n.language);
  };

  const openDetails = (item: any) => {
    setSelectedMed(item);
    setDetailVisible(true);
  };

  const openEdit = (item: any) => {
    setSelectedMed(item);
    setEditForm({
      name: item.name,
      dosage: item.dosage,
      instructions: item.instructions || '',
      isCritical: item.isCritical ?? false,
    });
    setDetailVisible(false);
    setEditVisible(true);
  };

  const handleDelete = (item: any) => {
    if (item.isPrescribed) {
      Alert.alert(
        'Locked Medication',
        'This is a doctor-prescribed medication. Only your clinical team can remove it from your schedule for your safety.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Delete Medication',
      `Are you sure you want to delete "${item.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDetailVisible(false);
            await deleteMedication(item.id);
          },
        },
      ]
    );
  };

  const handleSaveEdit = async () => {
    if (!editForm.name.trim() || !editForm.dosage.trim()) {
      Alert.alert('Required', 'Name and dosage are required.');
      return;
    }
    await updateMedication(selectedMed.id, {
      name: editForm.name.trim(),
      dosage: editForm.dosage.trim(),
      instructions: editForm.instructions.trim(),
      isCritical: editForm.isCritical,
      times: selectedMed.times,
      frequency: selectedMed.frequency,
    });
    setEditVisible(false);
  };

  const todaySchedule = medications.flatMap(med =>
    med.times.map(time => ({
      ...med,
      scheduledTime: time,
      status: todayLogs.find(l => 
        (l.medicationid === med.id || l.medicationId === med.id) && 
        (l.scheduledtime === time || l.scheduledTime === time)
      )?.status || 'pending',
    }))
  ).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  if (role === 'doctor') {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={themeColors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ title: t('med.schedule'), headerShown: true }} />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.tint} />
        }
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text }]}>{t('med.schedule')}</Text>
          <Text style={[styles.subtitle, { color: themeColors.muted }]}>{t('home.status')}</Text>
        </View>

        {loading && medications.length === 0 ? (
          <View style={{ height: 300, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={themeColors.tint} />
          </View>
        ) : (
          <View style={styles.listContainer}>
            {todaySchedule.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 50 }}>💊</Text>
                <Text style={[styles.emptyText, { color: themeColors.muted }]}>No medications scheduled for today.</Text>
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: themeColors.tint }]}
                  onPress={() => router.push('/add-medication')}
                >
                  <Text style={styles.addButtonText}>{t('med.add')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              todaySchedule.map((item, index) => (
                <Animated.View key={`${item.id}-${index}`} entering={FadeInDown.delay(index * 60).duration(350)}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => openDetails(item)}
                    style={[
                      styles.medCard,
                      { backgroundColor: themeColors.card, borderColor: item.status === 'taken' ? themeColors.vital : themeColors.border },
                    ]}
                  >
                    <View style={styles.medHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <Text style={[styles.timeText, { color: themeColors.tint }]}>{item.scheduledTime}</Text>
                        {item.isPrescribed && (
                          <View style={[styles.verifiedBadge, { backgroundColor: '#4F46E5' }]}>
                            <MaterialIcons name="local-pharmacy" size={12} color="#fff" />
                            <Text style={styles.verifiedText}>DR. PRESCRIBED</Text>
                          </View>
                        )}
                        {item.isCritical && (
                          <View style={[styles.verifiedBadge, { backgroundColor: '#DC2626' }]}>
                            <MaterialIcons name="warning" size={12} color="#fff" />
                            <Text style={styles.verifiedText}>CRITICAL</Text>
                          </View>
                        )}
                      </View>

                      {/* Action buttons */}
                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={[styles.cardActionBtn, { backgroundColor: themeColors.tint + '15' }]}
                          onPress={() => handleSpeak(item)}
                        >
                          <MaterialIcons name="volume-up" size={16} color={themeColors.tint} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.cardActionBtn, { backgroundColor: 'rgba(99,102,241,0.1)' }]}
                          onPress={() => openEdit(item)}
                        >
                          <MaterialIcons name="edit" size={16} color="#6366F1" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.cardActionBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]}
                          onPress={() => handleDelete(item)}
                        >
                          <MaterialIcons name="delete-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.medInfo}>
                      <Text style={[styles.medName, { color: themeColors.text }]}>{item.name}</Text>
                      <Text style={[styles.medDosage, { color: themeColors.muted }]}>
                        {item.dosage} • {item.instructions}
                      </Text>
                      {item.prescribedBy && (
                        <Text style={[styles.prescribedByText, { color: themeColors.muted }]}>
                          Prescribed by Dr. {item.prescribedBy}
                        </Text>
                      )}
                      {item.durationDays && item.endDate && (
                        <View style={styles.durationTag}>
                          <MaterialIcons name="event" size={12} color={themeColors.tint} />
                          <Text style={[styles.durationText, { color: themeColors.tint }]}>
                            {item.durationDays}-day course · ends {new Date(item.endDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.actions}>
                      {item.status === 'pending' ? (
                        <>
                          <TouchableOpacity
                            style={[styles.logButton, { backgroundColor: themeColors.vital }]}
                            onPress={() => logDose(item.id, item.scheduledTime, 'taken')}
                          >
                            <Text style={styles.logButtonText}>{t('common.take').toUpperCase()}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.skipButton, { borderColor: themeColors.muted }]}
                            onPress={() => logDose(item.id, item.scheduledTime, 'skipped')}
                          >
                            <Text style={[styles.skipButtonText, { color: themeColors.muted }]}>{t('common.skip')}</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <View style={[styles.statusBadge, { backgroundColor: item.status === 'taken' ? themeColors.vital + '20' : '#E2E8F0' }]}>
                          <Text style={{ color: item.status === 'taken' ? themeColors.vital : '#718096', fontWeight: '800' }}>
                            {item.status.toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))
            )}
          </View>
        )}

        {todaySchedule.length > 0 && (
          <TouchableOpacity
            style={[styles.floatingAddButton, { backgroundColor: themeColors.tint }]}
            onPress={() => router.push('/add-medication')}
          >
            <Text style={styles.addButtonText}>+ {t('med.add')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Detail Modal ── */}
      <Modal animationType="slide" transparent visible={detailVisible} onRequestClose={() => setDetailVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setDetailVisible(false)} />
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <View style={styles.modalHeaderClose}>
              <View style={[styles.iconBox, { backgroundColor: themeColors.tint + '15' }]}>
                <MaterialIcons name="medication" size={32} color={themeColors.tint} />
              </View>
              <View style={styles.modalHeaderBtns}>
                <TouchableOpacity
                  style={[styles.modalHeaderAction, { backgroundColor: 'rgba(99,102,241,0.1)' }]}
                  onPress={() => openEdit(selectedMed)}
                >
                  <MaterialIcons name="edit" size={18} color="#6366F1" />
                  <Text style={[styles.modalHeaderActionText, { color: '#6366F1' }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalHeaderAction, { backgroundColor: 'rgba(239,68,68,0.1)' }]}
                  onPress={() => handleDelete(selectedMed)}
                >
                  <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                  <Text style={[styles.modalHeaderActionText, { color: '#EF4444' }]}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDetailVisible(false)} style={styles.closeBtn}>
                  <MaterialIcons name="close" size={24} color={themeColors.muted} />
                </TouchableOpacity>
              </View>
            </View>

            {selectedMed && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalTitle, { color: themeColors.text }]}>{selectedMed.name}</Text>
                <Text style={[styles.modalSubtitle, { color: themeColors.tint }]}>{selectedMed.dosage}</Text>

                <View style={[styles.infoSection, { borderColor: themeColors.border }]}>
                  <Text style={[styles.sectionLabel, { color: themeColors.muted }]}>INSTRUCTIONS & NOTES</Text>
                  <Text style={[styles.sectionText, { color: themeColors.text }]}>
                    {selectedMed.instructions || 'No specific instructions provided.'}
                  </Text>
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={[styles.sectionLabel, { color: themeColors.muted }]}>SCHEDULED TIME</Text>
                    <Text style={[styles.detailValue, { color: themeColors.text }]}>{selectedMed.scheduledTime}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={[styles.sectionLabel, { color: themeColors.muted }]}>STATUS</Text>
                    <View style={[styles.statusTag, { backgroundColor: selectedMed.status === 'taken' ? themeColors.vital + '15' : 'rgba(0,0,0,0.05)' }]}>
                      <Text style={{ color: selectedMed.status === 'taken' ? themeColors.vital : themeColors.muted, fontWeight: '800', fontSize: 12 }}>
                        {selectedMed.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ height: 32 }} />

                {selectedMed.status === 'pending' && (
                  <TouchableOpacity
                    style={[styles.modalActionButton, { backgroundColor: themeColors.vital }]}
                    onPress={async () => {
                      await logDose(selectedMed.id, selectedMed.scheduledTime, 'taken');
                      setDetailVisible(false);
                    }}
                  >
                    <MaterialIcons name="check-circle" size={20} color="#fff" />
                    <Text style={styles.modalActionText}>{t('common.take').toUpperCase()}</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal animationType="slide" transparent visible={editVisible} onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setEditVisible(false)} />
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <View style={styles.modalHeaderClose}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Edit Medication</Text>
              <TouchableOpacity onPress={() => setEditVisible(false)} style={styles.closeBtn}>
                <MaterialIcons name="close" size={24} color={themeColors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.fieldLabel, { color: themeColors.muted }]}>MEDICATION NAME *</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: themeColors.background, color: themeColors.text, borderColor: themeColors.border }]}
                value={editForm.name}
                onChangeText={v => setEditForm(f => ({ ...f, name: v }))}
                placeholder="e.g. Paracetamol"
                placeholderTextColor={themeColors.muted}
              />

              <Text style={[styles.fieldLabel, { color: themeColors.muted }]}>DOSAGE *</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: themeColors.background, color: themeColors.text, borderColor: themeColors.border }]}
                value={editForm.dosage}
                onChangeText={v => setEditForm(f => ({ ...f, dosage: v }))}
                placeholder="e.g. 500mg"
                placeholderTextColor={themeColors.muted}
              />

              <Text style={[styles.fieldLabel, { color: themeColors.muted }]}>INSTRUCTIONS</Text>
              <TextInput
                style={[styles.editInput, styles.editInputMulti, { backgroundColor: themeColors.background, color: themeColors.text, borderColor: themeColors.border }]}
                value={editForm.instructions}
                onChangeText={v => setEditForm(f => ({ ...f, instructions: v }))}
                placeholder="e.g. Take after food"
                placeholderTextColor={themeColors.muted}
                multiline
                numberOfLines={3}
              />

              <View style={styles.criticalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: themeColors.muted, marginBottom: 2 }]}>MARK AS CRITICAL</Text>
                  <Text style={[{ color: themeColors.muted, fontSize: 12 }]}>Critical meds trigger urgent reminders</Text>
                </View>
                <Switch
                  value={editForm.isCritical}
                  onValueChange={v => setEditForm(f => ({ ...f, isCritical: v }))}
                  trackColor={{ false: themeColors.border, true: themeColors.tint + '88' }}
                  thumbColor={editForm.isCritical ? themeColors.tint : themeColors.muted}
                />
              </View>

              <View style={{ height: 20 }} />

              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: themeColors.tint }]}
                onPress={handleSaveEdit}
              >
                <MaterialIcons name="save" size={20} color="#fff" />
                <Text style={styles.modalActionText}>SAVE CHANGES</Text>
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl * 3 },
  header: { marginBottom: Spacing.xl },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 16 },
  listContainer: { gap: Spacing.md },

  medCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    ...Shadows.light,
  },
  medHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  timeText: { fontSize: 20, fontWeight: '800' },
  cardActions: { flexDirection: 'row', gap: 6 },
  cardActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  medInfo: { marginBottom: Spacing.md },
  medName: { fontSize: 18, fontWeight: '700' },
  medDosage: { fontSize: 14 },
  durationTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  durationText: { fontSize: 12, fontWeight: '600' },

  actions: { flexDirection: 'row', gap: Spacing.md },
  logButton: {
    flex: 2, height: 48, borderRadius: BorderRadius.lg,
    justifyContent: 'center', alignItems: 'center',
  },
  logButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  skipButton: {
    flex: 1, height: 48, borderRadius: BorderRadius.lg,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center',
  },
  skipButtonText: { fontWeight: '600' },
  statusBadge: {
    flex: 1, height: 40, borderRadius: BorderRadius.md,
    justifyContent: 'center', alignItems: 'center',
  },

  emptyState: { alignItems: 'center', marginTop: Spacing.xxl, gap: Spacing.md },
  emptyText: { textAlign: 'center', fontSize: 16, paddingHorizontal: Spacing.xl },
  addButton: {
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full, marginTop: Spacing.md,
  },
  addButtonText: { color: '#fff', fontWeight: '700' },
  floatingAddButton: {
    height: 56, borderRadius: BorderRadius.full,
    justifyContent: 'center', alignItems: 'center',
    marginTop: Spacing.xxl, ...Shadows.medium,
  },

  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  verifiedText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5, color: '#fff' },
  prescribedByText: { fontSize: 11, fontStyle: 'italic', marginTop: 2 },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, paddingBottom: 40, maxHeight: '88%',
  },
  modalHeaderClose: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  modalHeaderBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalHeaderAction: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  modalHeaderActionText: { fontSize: 13, fontWeight: '700' },
  iconBox: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  closeBtn: { padding: 8, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.05)' },
  modalTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
  modalSubtitle: { fontSize: 18, fontWeight: '700', marginBottom: 24 },
  infoSection: { paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, marginBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  sectionText: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  detailGrid: { flexDirection: 'row', gap: 24, marginBottom: 24 },
  detailItem: { flex: 1 },
  detailValue: { fontSize: 18, fontWeight: '800' },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  modalActionButton: {
    flexDirection: 'row', height: 60, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', gap: 12, ...Shadows.medium,
  },
  modalActionText: { color: '#fff', fontSize: 18, fontWeight: '800' },

  // Edit form
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6, marginTop: 16 },
  editInput: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 16,
  },
  editInputMulti: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },
  criticalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
});

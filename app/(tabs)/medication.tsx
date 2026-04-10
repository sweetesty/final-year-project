import React, { useCallback, useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, Modal } from 'react-native';
import { useFocusEffect, Stack, useRouter, useRootNavigationState } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMedicationViewModel } from '@/src/viewmodels/useMedicationViewModel';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { useTranslation } from 'react-i18next';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SpeechService } from '@/src/services/SpeechService';

export default function MedicationDashboard() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { session, role } = useAuthViewModel();
  const { t, i18n } = useTranslation();

  const navigationState = useRootNavigationState();
  const isNavReady = navigationState?.key;

  // --- Doctor Shield & Redirect ---
  useEffect(() => {
    if (isNavReady && role === 'doctor') {
      router.replace('/doctor-home');
    }
  }, [role, isNavReady]);

  const [selectedMed, setSelectedMed] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const patientId = session?.user?.id ?? '';
  const { medications, todayLogs, loading, logDose, refresh: refreshMeds } = useMedicationViewModel(patientId);

  // Refresh data whenever dashboard becomes focused (after adding a med)
  useFocusEffect(
    useCallback(() => {
      if (patientId) refreshMeds();
    }, [patientId, refreshMeds])
  );

  const handleSpeak = (item: any) => {
    const text = `${item.name}. ${item.dosage}. ${item.instructions}.`;
    SpeechService.speak(text, i18n.language);
  };

  const openDetails = (item: any) => {
    setSelectedMed(item);
    setModalVisible(true);
  };

  // Logic to determine which doses are due today
  const todaySchedule = medications.flatMap(med => {
    // Basic logic: if daily, show all times. In a real app, check specificDays.
    return med.times.map(time => ({
      ...med,
      scheduledTime: time,
      status: todayLogs.find(l => l.medicationid === med.id && l.scheduledtime === time)?.status || 'pending'
    }));
  }).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  // Prevent UI flicker for doctors before redirect
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
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text }]}>{t('med.schedule')}</Text>
          <Text style={[styles.subtitle, { color: themeColors.muted }]}>{t('home.status')}</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={themeColors.tint} />
        ) : (
          <View style={styles.listContainer}>
            {todaySchedule.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 50 }}>💊</Text>
                <Text style={[styles.emptyText, { color: themeColors.muted }]}>{t('common.loading') === 'Loading...' ? 'No medications scheduled for today.' : t('common.loading')}</Text>
                <TouchableOpacity 
                  style={[styles.addButton, { backgroundColor: themeColors.tint }]}
                  onPress={() => router.push('/add-medication')}
                >
                  <Text style={styles.addButtonText}>{t('med.add')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              todaySchedule.map((item, index) => (
                <TouchableOpacity 
                  key={`${item.id}-${index}`} 
                  activeOpacity={0.8}
                  onPress={() => openDetails(item)}
                  style={[
                    styles.medCard, 
                    { backgroundColor: themeColors.card, borderColor: item.status === 'taken' ? themeColors.vital : themeColors.border }
                  ]}
                >
                  <View style={styles.medHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.timeText, { color: themeColors.tint }]}>{item.scheduledTime}</Text>
                      {item.isPrescribed && (
                        <View style={[styles.verifiedBadge, { backgroundColor: '#DC2626' }]}>
                          <MaterialIcons name="local-pharmacy" size={12} color="#fff" />
                          <Text style={[styles.verifiedText, { color: '#fff', fontWeight: '800' }]}>DR. PRESCRIBED</Text>
                        </View>
                      )}
                    </View>
                    {item.isCritical && (
                      <View style={[styles.criticalBadge, { backgroundColor: themeColors.emergency }]}>
                        <Text style={styles.criticalText}>{t('med.critical').toUpperCase()}</Text>
                      </View>
                    )}
                    <TouchableOpacity 
                      style={[styles.smallSpeakerBtn, { backgroundColor: themeColors.tint + '15' }]}
                      onPress={() => handleSpeak(item)}
                    >
                      <MaterialIcons name="volume-up" size={16} color={themeColors.tint} />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.medInfo}>
                    <Text style={[styles.medName, { color: themeColors.text }]}>{item.name}</Text>
                    <Text style={[styles.medDosage, { color: themeColors.muted }]}>
                      {item.dosage} • {item.instructions}
                    </Text>
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

      {/* --- Medication Detail Modal --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <View style={styles.modalHeaderClose}>
              <View style={[styles.iconBox, { backgroundColor: themeColors.tint + '15' }]}>
                <MaterialIcons name="medication" size={32} color={themeColors.tint} />
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <MaterialIcons name="close" size={24} color={themeColors.muted} />
              </TouchableOpacity>
            </View>

            {selectedMed && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalTitle, { color: themeColors.text }]}>{selectedMed.name}</Text>
                <Text style={[styles.modalSubtitle, { color: themeColors.tint }]}>{selectedMed.dosage}</Text>
                
                <View style={[styles.infoSection, { borderColor: themeColors.border }]}>
                  <Text style={[styles.sectionLabel, { color: themeColors.muted }]}>INSTRUCTIONS & NOTES</Text>
                  <Text style={[styles.sectionText, { color: themeColors.text }]}>
                    {selectedMed.instructions || "No specific instructions provided."}
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
                        {selectedMed.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                {selectedMed.isPrescribed && (
                  <View style={[styles.prescribedSection, { backgroundColor: themeColors.tint + '08' }]}>
                    <MaterialIcons name="verified-user" size={20} color={themeColors.tint} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.prescribedTitle, { color: themeColors.tint }]}>Verified Prescription</Text>
                      <Text style={[styles.prescribedDoctor, { color: themeColors.text }]}>
                        {t('common.prescribed_by', { doctor: selectedMed.prescribedby || "Your Physician" })}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={{ height: 32 }} />

                {selectedMed.status === 'pending' && (
                  <TouchableOpacity 
                    style={[styles.modalActionButton, { backgroundColor: themeColors.vital }]}
                    onPress={async () => {
                      await logDose(selectedMed.id, selectedMed.scheduledTime, 'taken');
                      setModalVisible(false);
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl * 3,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 16,
  },
  listContainer: {
    gap: Spacing.md,
  },
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
  timeText: {
    fontSize: 20,
    fontWeight: '800',
  },
  medInfo: {
    marginBottom: Spacing.md,
  },
  medName: {
    fontSize: 18,
    fontWeight: '700',
  },
  medDosage: {
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  logButton: {
    flex: 2,
    height: 48,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  skipButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButtonText: {
    fontWeight: '600',
  },
  statusBadge: {
    flex: 1,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  criticalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  criticalText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    paddingHorizontal: Spacing.xl,
  },
  addButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  floatingAddButton: {
    height: 56,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xxl,
    ...Shadows.medium,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  prescribedBy: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    fontStyle: 'italic',
  },
  smallSpeakerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeaderClose: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    padding: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 24,
  },
  infoSection: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  sectionText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
  },
  detailItem: {
    flex: 1,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  prescribedSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 16,
  },
  prescribedTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  prescribedDoctor: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalActionButton: {
    flexDirection: 'row',
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    ...Shadows.medium,
  },
  modalActionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
});

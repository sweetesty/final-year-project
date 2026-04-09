import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMedicationViewModel } from '@/src/viewmodels/useMedicationViewModel';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

export default function MedicationDashboard() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { session } = useAuthViewModel();

  const { medications, todayLogs, loading, logDose } = useMedicationViewModel(session?.user?.id ?? '');

  // Logic to determine which doses are due today
  const todaySchedule = medications.flatMap(med => {
    // Basic logic: if daily, show all times. In a real app, check specificDays.
    return med.times.map(time => ({
      ...med,
      scheduledTime: time,
      status: todayLogs.find(l => l.medicationId === med.id && l.scheduledTime === time)?.status || 'pending'
    }));
  }).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ title: 'Today\'s Medication', headerShown: true }} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text }]}>Daily Schedule</Text>
          <Text style={[styles.subtitle, { color: themeColors.muted }]}>Track and log your doses</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={themeColors.tint} />
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
                  <Text style={styles.addButtonText}>Add Medication</Text>
                </TouchableOpacity>
              </View>
            ) : (
              todaySchedule.map((item, index) => (
                <View 
                  key={`${item.id}-${index}`} 
                  style={[
                    styles.medCard, 
                    { backgroundColor: themeColors.card, borderColor: item.status === 'taken' ? themeColors.vital : themeColors.border }
                  ]}
                >
                  <View style={styles.medHeader}>
                    <Text style={[styles.timeText, { color: themeColors.tint }]}>{item.scheduledTime}</Text>
                    {item.isCritical && (
                      <View style={[styles.criticalBadge, { backgroundColor: themeColors.emergency }]}>
                        <Text style={styles.criticalText}>CRITICAL</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.medInfo}>
                    <Text style={[styles.medName, { color: themeColors.text }]}>{item.name}</Text>
                    <Text style={[styles.medDosage, { color: themeColors.muted }]}>{item.dosage} • {item.instructions}</Text>
                  </View>

                  <View style={styles.actions}>
                    {item.status === 'pending' ? (
                      <>
                        <TouchableOpacity 
                          style={[styles.logButton, { backgroundColor: themeColors.vital }]}
                          onPress={() => logDose(item.id, item.scheduledTime, 'taken')}
                        >
                          <Text style={styles.logButtonText}>Take</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.skipButton, { borderColor: themeColors.muted }]}
                          onPress={() => logDose(item.id, item.scheduledTime, 'skipped')}
                        >
                          <Text style={[styles.skipButtonText, { color: themeColors.muted }]}>Skip</Text>
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
                </View>
              ))
            )}
          </View>
        )}

        {todaySchedule.length > 0 && (
          <TouchableOpacity 
            style={[styles.floatingAddButton, { backgroundColor: themeColors.tint }]}
            onPress={() => router.push('/add-medication')}
          >
            <Text style={styles.addButtonText}>+ Add New</Text>
          </TouchableOpacity>
        )}
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
});

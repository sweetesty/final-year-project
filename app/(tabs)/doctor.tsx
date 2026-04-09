import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { VitalsTrendChart, AdherenceScoreChart } from '@/src/components/AnalyticsCharts';
import { DoctorService } from '@/src/services/DoctorService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { ConsultationService } from '@/src/services/ConsultationService';

export default function DoctorDashboard() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { session } = useAuthViewModel();

  const [linkedPatients, setLinkedPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientCode, setPatientCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      loadPatients();
    }
  }, [session]);

  const loadPatients = async () => {
    setLoading(true);
    try {
      const patients = await DoctorService.getLinkedPatients(session!.user.id);
      setLinkedPatients(patients);
      if (patients.length > 0) setSelectedPatient(patients[0]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkPatient = async () => {
    if (!patientCode) return;
    setLinking(true);
    try {
      await DoctorService.linkPatientWithCode(session!.user.id, patientCode);
      Alert.alert("Success", "Patient linked successfully!");
      setPatientCode('');
      await loadPatients();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLinking(false);
    }
  };

  const startVideoCall = async () => {
    if (!selectedPatient) return;
    await ConsultationService.startVideoCall(session!.user.user_metadata.full_name, selectedPatient.full_name);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color={themeColors.tint} /></View>;

  if (linkedPatients.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ title: 'Clinical Panel', headerShown: true }} />
        <View style={styles.linkContainer}>
          <Text style={styles.linkEmoji}>👨‍⚕️</Text>
          <Text style={[styles.linkTitle, { color: themeColors.text }]}>No Linked Patients</Text>
          <Text style={[styles.linkSubtitle, { color: themeColors.muted }]}>Enter the 6-digit patient code to begin clinical monitoring.</Text>
          
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
            placeholder="Enter Patient Code"
            placeholderTextColor={themeColors.muted}
            value={patientCode}
            onChangeText={setPatientCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          
          <TouchableOpacity 
            style={[styles.linkButton, { backgroundColor: themeColors.tint }]}
            onPress={handleLinkPatient}
            disabled={linking}
          >
            {linking ? <ActivityIndicator color="#fff" /> : <Text style={styles.linkButtonText}>Link Patient</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ title: 'Clinical Monitoring', headerShown: true }} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Patient Selection Header (Basic for MVP) */}
        <View style={[styles.patientHeader, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <View style={styles.patientInfo}>
            <Text style={[styles.patientName, { color: themeColors.text }]}>{selectedPatient.full_name}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.statusBadge, { backgroundColor: themeColors.vital + '20' }]}>
                <Text style={{ color: themeColors.vital, fontSize: 10, fontWeight: '700' }}>STABLE</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
             <TouchableOpacity style={[styles.actionIcon, { backgroundColor: themeColors.tint }]} onPress={startVideoCall}>
                <Text style={{ fontSize: 16 }}>📹</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.actionIcon, { backgroundColor: themeColors.secondary }]} onPress={() => router.push({ pathname: '/chat-room', params: { partnerId: selectedPatient.id, partnerName: selectedPatient.full_name } })}>
                <Text style={{ fontSize: 16 }}>💬</Text>
             </TouchableOpacity>
          </View>
        </View>

        {/* Analytics Section */}
        <View style={styles.analyticsSection}>
          <VitalsTrendChart data={[72, 75, 82, 70, 78, 85, 76, 74]} labels={["8am", "10am", "12pm", "2pm", "4pm", "6pm", "8pm", "10pm"]} theme={themeColors} />
          <AdherenceScoreChart score={0.88} theme={themeColors} />
        </View>

        <TouchableOpacity 
          style={[styles.wideAction, { backgroundColor: themeColors.tint }]}
          onPress={() => router.push('/live-tracking')}
        >
          <Text style={styles.wideActionText}>🌍 Open Live GPS Tracker</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.wideAction, { backgroundColor: themeColors.emergency, marginTop: 12 }]}
          onPress={() => alert('Emergency alert broadcasted!')}
        >
          <Text style={styles.wideActionText}>🚀 Broadcast Emergency Alert</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: Spacing.lg },
  linkContainer: { flex: 1, padding: Spacing.xl, justifyContent: 'center', alignItems: 'center', gap: 12 },
  linkEmoji: { fontSize: 64, marginBottom: 12 },
  linkTitle: { fontSize: 24, fontWeight: '800' },
  linkSubtitle: { textAlign: 'center', marginBottom: 24 },
  input: { height: 60, width: '100%', borderRadius: BorderRadius.lg, paddingHorizontal: 20, borderWidth: 1, fontSize: 24, textAlign: 'center', fontWeight: '800' },
  linkButton: { height: 60, width: '100%', borderRadius: BorderRadius.lg, justifyContent: 'center', alignItems: 'center', ...Shadows.medium },
  linkButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  patientHeader: { padding: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  patientInfo: { gap: 4 },
  patientName: { fontSize: 18, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', gap: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  headerActions: { flexDirection: 'row', gap: 10 },
  actionIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', ...Shadows.light },
  analyticsSection: { gap: 16, marginBottom: 24 },
  wideAction: { height: 56, borderRadius: BorderRadius.lg, justifyContent: 'center', alignItems: 'center', ...Shadows.light },
  wideActionText: { color: '#fff', fontWeight: '800' },
});

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking, Platform, Dimensions } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AdherenceScoreChart, VitalsTrendChart, FallFrequencyChart, ActivityIntensityChart } from '@/src/components/AnalyticsCharts';
import { DoctorService } from '@/src/services/DoctorService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { ConsultationService } from '@/src/services/ConsultationService';
import { useTranslation } from 'react-i18next';
import { useMedicationViewModel } from '@/src/viewmodels/useMedicationViewModel';
import { AnalyticsService } from '@/src/services/AnalyticsService';
import { LinearGradient } from 'expo-linear-gradient';

const DEMO_DOCTOR = {
  id: 'demo-doctor-001',
  full_name: 'Dr. Sarah Wilson',
  specialization: 'Senior Medical Officer',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const ClinicalCard = ({ children, title, theme }: any) => (
  <View style={[styles.glassCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
    {title && <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>}
    {children}
  </View>
);

const StatusIndicator = ({ theme }: any) => {
  return (
    <View style={styles.statusRow}>
      <View style={[styles.pulseContainer, { backgroundColor: theme.vital + '20' }]}>
        <View style={[styles.pulseDot, { backgroundColor: theme.vital }]} />
      </View>
      <Text style={[styles.statusText, { color: theme.vital }]}>STABLE</Text>
    </View>
  );
};

export default function DoctorDashboard() {
  console.log('[DoctorDashboard] Component Mounting...');
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { session, role } = useAuthViewModel();
  const { t } = useTranslation();

  const [doctor, setDoctor] = useState<any>(null);
  const [linkedPatients, setLinkedPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [healthSummary, setHealthSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Fetch patient meds for clinical review
  const { medications: patientMeds } = useMedicationViewModel(selectedPatient?.id || '');
  const [myCode, setMyCode] = useState<string>(''); // Patient's own link code
  const [linkCode, setLinkCode] = useState<string>(''); // Input field for linking
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      if (role === 'doctor') {
        loadPatients();
      } else {
        loadDoctor();
      }
    }
  }, [session, role]);

  const loadDoctor = async () => {
    setLoading(true);
    try {
      const d = await DoctorService.getLinkedDoctor(session!.user.id);
      setDoctor(d);
      
      // Also fetch my own link code so I can share it
      const code = await DoctorService.ensurePatientCode(session!.user.id);
      setMyCode(code);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
    if (!linkCode) return;
    setLinking(true);
    try {
      await DoctorService.linkPatientWithCode(session!.user.id, linkCode);
      Alert.alert("Success", "Patient linked successfully!");
      setLinkCode('');
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

  const handleGenerateSummary = async () => {
    if (!selectedPatient) return;
    setGeneratingSummary(true);
    try {
      const summary = await AnalyticsService.generateWeeklySummary(selectedPatient.id);
      setHealthSummary(summary);
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const [history, setHistory] = useState<any[]>([]);
  const [patientContext, setPatientContext] = useState<any>(null);

  useEffect(() => {
    if (selectedPatient) {
      loadPatientDetails();
    }
  }, [selectedPatient]);

  const loadPatientDetails = async () => {
    if (!selectedPatient) return;
    try {
      const [hist, context] = await Promise.all([
        DoctorService.getPatientAlertHistory(selectedPatient.id),
        DoctorService.getPatientClinicalContext(selectedPatient.id)
      ]);
      setHistory(hist);
      setPatientContext(context);
    } catch (e) {
      console.error('[Doctor] Detail load error:', e);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color={themeColors.tint} /></View>;

  // ─── Patient View ──────────────────────────────────────────────────────────
  if (role === 'patient') {
    const currentDoctor = doctor || DEMO_DOCTOR;
    const isDemo = !doctor;

    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ 
          title: 'Doctor Profile', 
          headerShown: true 
        }} />
        <ScrollView contentContainerStyle={styles.scrollContent}>

          <View style={[styles.profileCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>{currentDoctor.full_name.charAt(0)}</Text>
            </View>
            <Text style={[styles.doctorNameLarge, { color: themeColors.text }]}>{currentDoctor.full_name}</Text>
            <Text style={[styles.doctorTitle, { color: themeColors.tint }]}>{currentDoctor.specialization || 'Clinical Specialist'}</Text>
            
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: themeColors.text }]}>120+</Text>
                <Text style={[styles.statLabel, { color: themeColors.muted }]}>Patients</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: themeColors.text }]}>15y</Text>
                <Text style={[styles.statLabel, { color: themeColors.muted }]}>Exp.</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: themeColors.text }]}>4.9/5</Text>
                <Text style={[styles.statLabel, { color: themeColors.muted }]}>Rating</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoSection}>
            <Text style={[styles.infoTitle, { color: themeColors.text }]}>Specialization</Text>
            <Text style={[styles.infoText, { color: themeColors.muted }]}>General Medicine, Geriatrics, and Chronic Condition Management.</Text>
          </View>

          <View style={styles.infoSection}>
            <Text style={[styles.infoTitle, { color: themeColors.text }]}>Direct Actions</Text>
            <View style={styles.buttonGrid}>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
                onPress={() => Linking.openURL(`tel:${isDemo ? '+123456789' : '+234800000000'}`)}
              >
                <Text style={{ fontSize: 20 }}>📞</Text>
                <Text style={[styles.actionBtnText, { color: '#475569' }]}>Voice Call</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}
                onPress={() => Alert.alert("Video", "Connecting to secure consultation server...")}
              >
                <Text style={{ fontSize: 20 }}>📹</Text>
                <Text style={[styles.actionBtnText, { color: '#0369A1' }]}>Video Call</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={[styles.mainChatBtn, { backgroundColor: themeColors.tint }]}
              onPress={() => {
                const targetId = currentDoctor?.id || 'demo-doctor-001';
                const targetName = currentDoctor?.full_name || 'Dr. Sarah Wilson';
                router.push({ pathname: '/chat-room', params: { partnerId: targetId, partnerName: targetName } });
              }}
            >
              <Text style={{ fontSize: 18, marginRight: 8 }}>💬</Text>
              <Text style={styles.mainChatBtnText}>Message Doctor</Text>
            </TouchableOpacity>
          </View>

          {/* NEW: Connectivity Card for Patients */}
          <View style={[styles.connectivityCard, { backgroundColor: themeColors.card, borderColor: themeColors.tint + '30' }]}>
             <View style={styles.connectivityHeader}>
                <MaterialIcons name="link" size={20} color={themeColors.tint} />
                <Text style={[styles.connectivityTitle, { color: themeColors.text }]}>Clinical Connection</Text>
             </View>
             <Text style={[styles.connectivitySubtitle, { color: themeColors.muted }]}>
                Share this code with Dr. Shola to link your medical profiles for remote monitoring.
             </Text>
             <View style={[styles.codeDisplay, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                <Text style={[styles.codeText, { color: themeColors.tint }]}>{myCode || '------'}</Text>
             </View>
             <TouchableOpacity style={styles.copyBtn} onPress={() => { Alert.alert("Copied", "Your patient code has been copied to clipboard."); }}>
                <MaterialIcons name="content-copy" size={14} color={themeColors.muted} />
                <Text style={{ fontSize: 12, color: themeColors.muted, fontWeight: '600' }}>Copy My Code</Text>
             </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Doctor Dashboard ───────────────────────────────────────────────────────

  // If a patient is selected, show their clinical detail
  if (selectedPatient) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
        {/* Custom Premium Header */}
        <View 
          style={[
            styles.premiumHeader, 
            { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)' }
          ]}
        >
          <TouchableOpacity
            style={[styles.miniBackBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
            onPress={() => setSelectedPatient(null)}
          >
            <MaterialIcons name="chevron-left" size={28} color={themeColors.tint} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerPatientName, { color: themeColors.text }]}>{selectedPatient.full_name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
               <View style={[styles.pulseDot, { backgroundColor: patientContext?.isOnline ? '#10B981' : '#94A3B8' }]} />
               <Text style={{ fontSize: 12, color: themeColors.muted, fontWeight: '700' }}>
                  {patientContext?.isOnline ? 'ACTIVE' : 'OFFLINE'}
               </Text>
            </View>
          </View>
          <View style={styles.headerControls}>
             <TouchableOpacity 
                style={[styles.roundIconBtn, { backgroundColor: themeColors.tint }]} 
                onPress={() => Linking.openURL('tel:+123456789')}
              >
                <MaterialIcons name="call" size={20} color="#fff" />
             </TouchableOpacity>
             <TouchableOpacity style={[styles.roundIconBtn, { backgroundColor: themeColors.secondary }]} onPress={startVideoCall}>
                <MaterialIcons name="videocam" size={20} color="#fff" />
             </TouchableOpacity>
             <TouchableOpacity 
                style={[styles.roundIconBtn, { backgroundColor: '#475569' }]} 
                onPress={() => router.push({ pathname: '/chat-room', params: { partnerId: selectedPatient.id, partnerName: selectedPatient.full_name } })}
              >
                <MaterialIcons name="chat-bubble" size={18} color="#fff" />
             </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollWithHeader} showsVerticalScrollIndicator={false}>

          <View style={styles.analyticsSection}>
            <View style={styles.gridRow}>
              <View style={{ flex: 1.2 }}>
                <ClinicalCard title="Vitals & Status" theme={themeColors}>
                   <View style={styles.vitalsGrid}>
                      <View style={styles.vBlock}>
                         <Text style={styles.vBlockLabel}>HR</Text>
                         <Text style={[styles.vBlockValue, { color: themeColors.emergency }]}>{patientContext?.latestVital?.heartrate || '--'}</Text>
                      </View>
                      <View style={styles.vBlock}>
                         <Text style={styles.vBlockLabel}>SpO2</Text>
                         <Text style={[styles.vBlockValue, { color: themeColors.tint }]}>{patientContext?.latestVital?.spo2 || '--'}%</Text>
                      </View>
                   </View>
                </ClinicalCard>
              </View>
              <View style={{ flex: 1, gap: 12 }}>
                <TouchableOpacity style={[styles.statTile, { backgroundColor: themeColors.card, borderColor: themeColors.border }]} onPress={() => router.push({ pathname: '/live-tracking', params: { patientId: selectedPatient.id } })}>
                  <MaterialIcons name="location-on" size={24} color={themeColors.tint} />
                  <Text style={[styles.statTileLabel, { color: themeColors.muted }]}>Live GPS</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.statTile, { backgroundColor: themeColors.card, borderColor: themeColors.border }]} onPress={() => Alert.alert('History', 'Detailed alert logs are shown below.')}>
                  <MaterialIcons name="history" size={24} color={themeColors.emergency} />
                  <Text style={[styles.statTileLabel, { color: themeColors.muted }]}>History</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ClinicalCard title="Heart Rate Trend (24h)" theme={themeColors}>
              <VitalsTrendChart data={[72, 75, 82, 70, 78, 85, 76, 74]} labels={["8a", "10a", "12p", "2p", "4p", "6p", "8p", "10p"]} theme={themeColors} />
            </ClinicalCard>

            {/* NEW: Emergency History Section */}
            <ClinicalCard title="🚨 Emergency History" theme={themeColors}>
               {history.length === 0 ? (
                 <Text style={{ color: themeColors.muted, fontSize: 13, fontStyle: 'italic', paddingVertical: 10 }}>No past emergency events.</Text>
               ) : (
                 history.slice(0, 5).map(h => (
                   <View key={h.id} style={styles.historyItem}>
                      <View style={[styles.historyDot, { backgroundColor: h.status === 'resolved' ? '#10B981' : themeColors.emergency }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.historyType, { color: themeColors.text }]}>{h.source === 'foreground' ? 'Fall Detected' : 'Triggered Alert'}</Text>
                        <Text style={[styles.historyTime, { color: themeColors.muted }]}>{new Date(h.timestamp).toLocaleDateString()} at {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                      <View style={[styles.statusTag, { backgroundColor: h.status === 'resolved' ? '#10B98120' : '#EF444420' }]}>
                         <Text style={{ fontSize: 10, fontWeight: '800', color: h.status === 'resolved' ? '#10B981' : '#EF4444' }}>{h.status?.toUpperCase() || 'UNRESOLVED'}</Text>
                      </View>
                   </View>
                 ))
               )}
            </ClinicalCard>
          </View>

          {/* AI Health Summary */}
          <LinearGradient
            colors={isDark ? ['#1E293B', '#0F172A'] : ['#F0F9FF', '#E0F2FE']}
            style={styles.aiSummaryCard}
          >
            <View style={styles.aiHeader}>
              <View style={styles.aiLabel}>
                <MaterialIcons name="auto-awesome" size={16} color={themeColors.tint} />
                <Text style={[styles.aiLabelText, { color: themeColors.tint }]}>Weekly Health Summary</Text>
              </View>
              <TouchableOpacity onPress={handleGenerateSummary} disabled={generatingSummary} style={styles.refreshBtn}>
                {generatingSummary ? <ActivityIndicator size="small" color={themeColors.tint} /> : <MaterialIcons name="refresh" size={20} color={themeColors.tint} />}
              </TouchableOpacity>
            </View>
            
            {healthSummary ? (
              <Text style={[styles.aiText, { color: themeColors.text }]}>{healthSummary}</Text>
            ) : (
              <TouchableOpacity style={styles.summaryPlaceholder} onPress={handleGenerateSummary}>
                <Text style={{ color: themeColors.muted, fontStyle: 'italic' }}>Tap to generate clinical narrative summary</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>

          {/* Medications Management */}
          <ClinicalCard title={t('common.medication')} theme={themeColors}>
             <View style={styles.sectionHeader}>
                <Text style={{ fontSize: 12, color: themeColors.muted }}>Active Prescriptions</Text>
                <TouchableOpacity
                  style={[styles.prescribeBtn, { backgroundColor: themeColors.vital }]}
                  onPress={() => router.push({ pathname: '/add-medication', params: { mode: 'prescribe', patientId: selectedPatient.id } })}
                >
                  <MaterialIcons name="add" size={14} color="#fff" />
                  <Text style={styles.prescribeBtnText}>{t('common.add_prescription')}</Text>
                </TouchableOpacity>
             </View>
             <View style={styles.medicationList}>
               {patientMeds.length === 0 ? (
                 <Text style={[styles.emptyText, { color: themeColors.muted }]}>No active medications.</Text>
               ) : (
                 patientMeds.map((med) => (
                   <TouchableOpacity 
                    key={med.id} 
                    style={[styles.medItem, { borderBottomColor: themeColors.border }]}
                    onPress={() => router.push({ pathname: '/add-medication', params: { medicationId: med.id, mode: 'edit', patientId: selectedPatient.id } })}
                   >
                     <View style={{ flex: 1 }}>
                       <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                         <Text style={[styles.medNameSmall, { color: themeColors.text }]}>{med.name}</Text>
                         {med.isPrescribed && (
                           <View style={[styles.typeBadge, { backgroundColor: '#DC262615' }]}>
                             <Text style={[styles.typeBadgeText, { color: '#DC2626' }]}>Rx</Text>
                           </View>
                         )}
                       </View>
                       <Text style={[styles.medSub, { color: themeColors.muted }]}>{med.dosage} • {med.times.join(', ')}</Text>
                     </View>
                     <TouchableOpacity 
                        style={[styles.nudgeBtn, { backgroundColor: themeColors.tint + '15' }]}
                        onPress={() => Alert.alert('Nudge Sent', `A medication reminder has been sent to ${selectedPatient.full_name}.`)}
                      >
                        <MaterialIcons name="notifications-active" size={16} color={themeColors.tint} />
                     </TouchableOpacity>
                   </TouchableOpacity>
                 ))
               )}
             </View>
          </ClinicalCard>
        </ScrollView>
      </View>
    );
  }

  // ─── Patient List View (default) ────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ title: 'Clinical Panel', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Link Another Patient */}
        <TouchableOpacity
          style={[styles.linkBanner, { backgroundColor: themeColors.tint + '12', borderColor: themeColors.tint + '40' }]}
          onPress={() => setShowLinkForm(!showLinkForm)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="person-add" size={20} color={themeColors.tint} />
          <Text style={{ flex: 1, color: themeColors.tint, fontWeight: '700', marginLeft: 8 }}>Link Another Patient</Text>
          <MaterialIcons name={showLinkForm ? 'expand-less' : 'expand-more'} size={20} color={themeColors.tint} />
        </TouchableOpacity>

        {showLinkForm && (
          <View style={[styles.linkFormInline, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={{ color: themeColors.muted, fontSize: 13, marginBottom: 8 }}>Enter the 6-digit code from the patient's home screen</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.background, color: themeColors.text, borderColor: themeColors.border }]}
              placeholder="Enter Patient Code"
              placeholderTextColor={themeColors.muted}
              value={linkCode}
              onChangeText={setLinkCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.linkButton, { backgroundColor: themeColors.tint, marginTop: 10 }]}
              onPress={async () => { await handleLinkPatient(); setShowLinkForm(false); }}
              disabled={linking}
            >
              {linking ? <ActivityIndicator color="#fff" /> : <Text style={styles.linkButtonText}>Link Patient</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Patient List */}
        {linkedPatients.length === 0 ? (
          <View style={styles.linkContainer}>
            <Text style={styles.linkEmoji}>👨‍⚕️</Text>
            <Text style={[styles.linkTitle, { color: themeColors.text }]}>No Linked Patients</Text>
            <Text style={[styles.linkSubtitle, { color: themeColors.muted }]}>Tap "Link Another Patient" above to begin clinical monitoring.</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: themeColors.text, paddingHorizontal: 4, marginBottom: 8 }]}>
              Your Patients ({linkedPatients.length})
            </Text>
            {linkedPatients.map((patient) => (
              <TouchableOpacity
                key={patient.id}
                style={[styles.patientListCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
                onPress={() => { setSelectedPatient(patient); setHealthSummary(null); }}
                activeOpacity={0.8}
              >
                <View style={[styles.patientListAvatar, { backgroundColor: themeColors.tint + '20' }]}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: themeColors.tint }}>{patient.full_name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.text }}>{patient.full_name}</Text>
                  <Text style={{ fontSize: 12, color: themeColors.muted, marginTop: 2 }}>Tap to view clinical profile →</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={themeColors.muted} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  scrollContent: { 
    padding: Spacing.lg 
  },
  linkContainer: { 
    flex: 1, 
    padding: Spacing.xl, 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 12 
  },
  linkEmoji: { 
    fontSize: 64, 
    marginBottom: 12 
  },
  linkTitle: { 
    fontSize: 24, 
    fontWeight: '800' 
  },
  linkSubtitle: { 
    textAlign: 'center', 
    marginBottom: 24 
  },
  input: { 
    height: 60, 
    width: '100%', 
    borderRadius: BorderRadius.lg, 
    paddingHorizontal: 20, 
    borderWidth: 1, 
    fontSize: 24, 
    textAlign: 'center', 
    fontWeight: '800' 
  },
  linkButton: { 
    height: 60, 
    width: '100%', 
    borderRadius: BorderRadius.lg, 
    justifyContent: 'center', 
    alignItems: 'center', 
    ...Shadows.medium 
  },
  linkButtonText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '800' 
  },
  patientHeader: { 
    padding: Spacing.md, 
    borderRadius: BorderRadius.xl, 
    borderWidth: 1, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  patientInfo: { 
    gap: 4 
  },
  patientName: { 
    fontSize: 18, 
    fontWeight: '800' 
  },
  badgeRow: { 
    flexDirection: 'row', 
    gap: 6 
  },
  statusBadge: { 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6 
  },
  headerActions: { 
    flexDirection: 'row', 
    gap: 10 
  },
  actionIcon: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center', 
    ...Shadows.light 
  },
  analyticsSection: { 
    gap: 16, 
    marginBottom: 24 
  },
  wideAction: { 
    height: 56, 
    borderRadius: BorderRadius.lg, 
    justifyContent: 'center', 
    alignItems: 'center', 
    ...Shadows.light 
  },
  wideActionText: { 
    color: '#fff', 
    fontWeight: '800' 
  },
  linkBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    margin: 16, 
    marginBottom: 8, 
    padding: 14, 
    borderRadius: 14, 
    borderWidth: 1.5 
  },
  linkFormInline: { 
    marginHorizontal: 16, 
    marginBottom: 12, 
    padding: 16, 
    borderRadius: 16, 
    borderWidth: 1 
  },
  patientTab: { 
    paddingHorizontal: 18, 
    paddingVertical: 8, 
    borderRadius: 20, 
    borderWidth: 1, 
    marginRight: 8 
  },
  backBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: 16, 
    marginTop: 12, 
    marginBottom: 8, 
    padding: 12, 
    borderRadius: 12, 
    borderWidth: 1 
  },
  patientListCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: 16, 
    marginBottom: 10, 
    padding: 16, 
    borderRadius: 16, 
    borderWidth: 1, 
    gap: 12, 
    ...Shadows.light 
  },
  patientListAvatar: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  // Patient view styles
  profileCard: { 
    marginVertical: 20, 
    padding: 30, 
    borderRadius: 24, 
    alignItems: 'center', 
    borderWidth: 1, 
    ...Shadows.medium 
  },
  avatarLarge: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: '#6366F1', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  avatarText: { 
    color: '#fff', 
    fontSize: 32, 
    fontWeight: '800' 
  },
  doctorNameLarge: { 
    fontSize: 22, 
    fontWeight: '900', 
    marginBottom: 4 
  },
  doctorTitle: { 
    fontSize: 14, 
    fontWeight: '700', 
    marginBottom: 20 
  },
  statsRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    width: '100%', 
    justifyContent: 'space-around' 
  },
  statItem: { 
    alignItems: 'center' 
  },
  statValue: { 
    fontSize: 16, 
    fontWeight: '800' 
  },
  statLabel: { 
    fontSize: 11, 
    marginTop: 2 
  },
  statDivider: { 
    width: 1, 
    height: 24, 
    backgroundColor: 'rgba(0,0,0,0.05)' 
  },
  infoSection: { 
    marginBottom: 24 
  },
  infoTitle: { 
    fontSize: 14, 
    fontWeight: '800', 
    marginBottom: 8 
  },
  infoText: { 
    fontSize: 14, 
    lineHeight: 22 
  },
  buttonGrid: { 
    flexDirection: 'row', 
    gap: 12, 
    marginBottom: 12 
  },
  actionBtn: { 
    flex: 1, 
    height: 70, 
    borderRadius: 16, 
    borderWidth: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 4 
  },
  actionBtnText: { 
    fontSize: 12, 
    fontWeight: '700' 
  },
  mainChatBtn: { 
    height: 60, 
    borderRadius: 16, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    ...Shadows.light 
  },
  mainChatBtnText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '800' 
  },

  // Demo styles
  demoBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F0F9FF', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 10, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#BAE6FD', 
    gap: 6 
  },
  demoBadgeText: { 
    color: '#0369A1', 
    fontSize: 12, 
    fontWeight: '600' 
  },
  clinicalSection: { 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 24, 
    borderWidth: 1 
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '800' 
  },
  prescribeBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 8 
  },
  prescribeBtnText: { 
    color: '#fff', 
    fontSize: 11, 
    fontWeight: '700' 
  },
  medicationList: { 
    gap: 12 
  },
  medItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingBottom: 12, 
    borderBottomWidth: 1 
  },
  medNameSmall: { 
    fontSize: 14, 
    fontWeight: '700' 
  },
  medSub: { 
    fontSize: 12, 
    marginTop: 2 
  },
  typeBadge: { 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4 
  },
  typeBadgeText: { 
    fontSize: 8, 
    fontWeight: '800' 
  },
  emptyText: { 
    textAlign: 'center', 
    fontSize: 12, 
    fontStyle: 'italic' 
  },
  insightTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    marginTop: 12, 
    marginBottom: 8 
  },
  summaryText: { 
    fontSize: 14, 
    lineHeight: 22, 
    fontWeight: '500' 
  },
  summaryPlaceholder: { 
    padding: 20, 
    alignItems: 'center', 
    borderStyle: 'dashed', 
    borderWidth: 1, 
    borderColor: '#ccc', 
    borderRadius: 12 
  },

  // Premium Redesign Styles
  premiumHeader: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    zIndex: 100, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingTop: Platform.OS === 'ios' ? 54 : 44, 
    paddingBottom: 16,
  },
  miniBackBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerInfo: { 
    flex: 1, 
    marginHorizontal: 12 
  },
  headerPatientName: { 
    fontSize: 18, 
    fontWeight: '900', 
    letterSpacing: -0.5 
  },
  headerControls: { 
    flexDirection: 'row', 
    gap: 10 
  },
  roundIconBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    ...Shadows.light 
  },
  scrollWithHeader: { 
    padding: 20, 
    paddingTop: Platform.OS === 'ios' ? 120 : 110, 
    paddingBottom: 40 
  },
  glassCard: { 
    borderRadius: 24, 
    padding: 16, 
    marginBottom: 20, 
    borderWidth: 1, 
    ...Shadows.light 
  },
  cardTitle: { 
    fontSize: 14, 
    fontWeight: '800', 
    marginBottom: 12, 
    opacity: 0.8, 
    letterSpacing: 0.5, 
    textTransform: 'uppercase' 
  },
  statusRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginTop: 2 
  },
  pulseContainer: { 
    width: 14, 
    height: 14, 
    borderRadius: 7, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  pulseDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3 
  },
  statusText: { 
    fontSize: 11, 
    fontWeight: '800', 
    letterSpacing: 0.2 
  },
  gridRow: { 
    flexDirection: 'row', 
    gap: 16, 
    marginBottom: 20 
  },
  statTile: { 
    flex: 1, 
    padding: 16, 
    borderRadius: 20, 
    borderWidth: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    ...Shadows.light 
  },
  statTileLabel: { 
    fontSize: 12, 
    fontWeight: '700' 
  },
  aiSummaryCard: { 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 24, 
    ...Shadows.medium 
  },
  aiHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  aiLabel: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12 
  },
  aiLabelText: { 
    fontSize: 12, 
    fontWeight: '800' 
  },
  aiText: { 
    fontSize: 15, 
    lineHeight: 24, 
    fontWeight: '500' 
  },
  refreshBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  // Connectivity Card Styles
  connectivityCard: { 
    borderRadius: 24, 
    padding: 20, 
    marginTop: 10, 
    marginBottom: 30, 
    borderWidth: 2, 
    borderStyle: 'dashed', 
    alignItems: 'center' 
  },
  connectivityHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 12 
  },
  connectivityTitle: { 
    fontSize: 16, 
    fontWeight: '800' 
  },
  connectivitySubtitle: { 
    fontSize: 13, 
    textAlign: 'center', 
    lineHeight: 20, 
    marginBottom: 20 
  },
  codeDisplay: { 
    paddingHorizontal: 30, 
    paddingVertical: 12, 
    borderRadius: 16, 
    borderWidth: 1, 
    marginBottom: 12 
  },
  codeText: { 
    fontSize: 32, 
    fontWeight: '900', 
    letterSpacing: 4 
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  // Clinical Detail Specialized Styles
  vitalsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  vBlock: {
    alignItems: 'center',
  },
  vBlockLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 4,
  },
  vBlockValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  historyType: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyTime: {
    fontSize: 12,
    marginTop: 2,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nudgeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

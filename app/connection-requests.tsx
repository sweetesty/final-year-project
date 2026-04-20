import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Colors, Shadows, Spacing, HeaderGradient } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DoctorService, DoctorRequest } from '@/src/services/DoctorService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

export default function ConnectionRequestsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme as 'light' | 'dark'];
  const { session } = useAuthViewModel();

  const [requests, setRequests] = useState<DoctorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<DoctorRequest | null>(null);
  const [medicalSnapshot, setMedicalSnapshot] = useState<any>(null);

  useEffect(() => {
    if (session?.user?.id) {
      loadRequests();
    } else {
      const timer = setTimeout(() => {
        if (!session?.user?.id) setLoading(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (reviewing) {
      fetchMedicalSnapshot(reviewing.patient_id);
    } else {
      setMedicalSnapshot(null);
    }
  }, [reviewing]);

  const fetchMedicalSnapshot = async (patientId: string) => {
    try {
      const data = await DoctorService.getPatientMedicalSnapshot(patientId);
      setMedicalSnapshot(data);
    } catch (e) {
      console.error('[Requests] Snapshot fetch error:', e);
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await DoctorService.getPendingRequests(session!.user.id);
      setRequests(data);
    } catch (e: any) {
      console.error('[Requests] Load error:', e);
      setError(e.message || 'Could not load requests. Please ensure you have run the database migration.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId: string, status: 'accepted' | 'rejected', patientName: string) => {
    setProcessing(requestId);
    try {
      await DoctorService.updateRequestStatus(requestId, status);
      const req = requests.find(r => r.id === requestId);
      
      setRequests(prev => prev.filter(r => r.id !== requestId));
      
      if (status === 'accepted' && req) {
        // --- Auto-onboarding message ---
        try {
          const chatId = [session!.user.id, req.patient_id].sort().join('_');
          await supabase.from('direct_messages').insert({
            chat_id: chatId,
            sender_id: session!.user.id,
            receiver_id: req.patient_id,
            message_text: `Hello ${patientName?.split(' ')[0] || 'Patient'}, I've accepted your connection request. Please share your 6-digit Patient Code so I can begin monitoring your health records.`
          });
        } catch (msgError) {
          console.warn('[Requests] Failed to send auto-message:', msgError);
        }

        Alert.alert(
          'Request Accepted',
          `You are now connected with ${patientName}. An introductory message has been sent to help begin the setup.`,
          [
            { text: 'Later', style: 'cancel' },
            { 
              text: 'Open Chat', 
              onPress: () => router.push({ pathname: '/chat-room', params: { partnerId: req.patient_id, partnerName: req.profiles?.full_name } }) 
            }
          ]
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Could not update request status.');
    } finally {
      setProcessing(null);
      setReviewing(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <LinearGradient
        colors={HeaderGradient}
        style={styles.header}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Clinical Requests</Text>
        <Text style={styles.headerSubtitle}>Review and manage incoming patient connections</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="error-outline" size={64} color="#EF4444" />
            <Text style={[styles.emptyTitle, { color: '#EF4444' }]}>Query Failed</Text>
            <Text style={[styles.emptySubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadRequests}>
              <Text style={styles.retryBtnText}>Retry Fetch</Text>
            </TouchableOpacity>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="fact-check" size={64} color={isDark ? '#334155' : '#E2E8F0'} />
            <Text style={[styles.emptyTitle, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>All Caught Up!</Text>
            <Text style={[styles.emptySubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>No pending patient requests at the moment.</Text>
          </View>
        ) : (
          requests.map((req, i) => (
            <Animated.View key={req.id} entering={FadeInDown.delay(i * 100).duration(400)} exiting={FadeOut}>
              <View style={[styles.requestCard, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.patientAvatar}>
                    <Text style={styles.avatarText}>{req.profiles?.full_name?.charAt(0) || 'P'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.patientName, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>{req.profiles?.full_name}</Text>
                    <View style={styles.typeRow}>
                      <MaterialIcons 
                        name={req.type === 'connection' ? 'link' : 'chat-bubble-outline'} 
                        size={14} 
                        color="#6366F1" 
                      />
                      <Text style={styles.typeText}>{req.type === 'connection' ? 'Clinical Connection' : 'Message Request'}</Text>
                    </View>
                  </View>
                  <Text style={styles.timeText}>{new Date(req.created_at).toLocaleDateString()}</Text>
                </View>

                {req.message && (
                  <View style={[styles.messageBox, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
                    <Text style={[styles.messageText, { color: isDark ? '#94A3B8' : '#64748B' }]}>"{req.message}"</Text>
                  </View>
                )}

                <View style={styles.actionRow}>
                  <TouchableOpacity 
                    style={[styles.btnSecondary, { borderColor: isDark ? '#334155' : '#E2E8F0' }]}
                    onPress={() => setReviewing(req)}
                  >
                    <Text style={[styles.btnSecondaryText, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>Review Profile</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.mainActions}>
                    <TouchableOpacity 
                      style={styles.btnReject}
                      onPress={() => handleAction(req.id, 'rejected', req.profiles?.full_name || 'Patient')}
                    >
                      <MaterialIcons name="close" size={20} color="#EF4444" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.btnAccept}
                      onPress={() => handleAction(req.id, 'accepted', req.profiles?.full_name || 'Patient')}
                    >
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        style={styles.btnAcceptGradient}
                      >
                        <MaterialIcons name="check" size={20} color="#fff" />
                        <Text style={styles.btnAcceptText}>Accept</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>

      {/* --- Review Modal Payload --- */}
      {reviewing && (
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInDown} style={[styles.modalContent, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>Patient Snapshot</Text>
              <TouchableOpacity onPress={() => setReviewing(null)}>
                <MaterialIcons name="close" size={24} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <View style={styles.reviewerTop}>
              <View style={[styles.reviewerAvatar, { backgroundColor: '#6366F1' }]}>
                <Text style={styles.reviewerAvatarText}>{reviewing.profiles?.full_name?.charAt(0)}</Text>
              </View>
              <Text style={[styles.reviewerName, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>{reviewing.profiles?.full_name}</Text>
              <View style={styles.onlineStatus}>
                <View style={[styles.statusDot, { backgroundColor: '#34D399' }]} />
                <Text style={styles.statusLabel}>Physical Health Profile Loaded</Text>
              </View>
            </View>

            <View style={styles.snapshotGrid}>
              <View style={[styles.snapshotItem, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
                <Text style={styles.snapshotLabel}>Blood Type</Text>
                <Text style={[styles.snapshotVal, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>{medicalSnapshot?.bloodtype || 'N/A'}</Text>
              </View>
              <View style={[styles.snapshotItem, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
                <Text style={styles.snapshotLabel}>Allergies</Text>
                <Text style={[styles.snapshotVal, { color: medicalSnapshot?.allergies ? '#EF4444' : (isDark ? '#F1F5F9' : '#1E293B') }]} numberOfLines={1}>
                  {medicalSnapshot?.allergies || 'None'}
                </Text>
              </View>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Medical Conditions & History</Text>
              <Text style={[styles.infoVal, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                {medicalSnapshot?.chronicconditions || 'No chronic conditions reported.'}
              </Text>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Current Medications</Text>
              <Text style={[styles.infoVal, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                {medicalSnapshot?.currentmedications || 'No active medications registered.'}
              </Text>
            </View>

            <View style={styles.securitySeal}>
              <MaterialIcons name="lock-outline" size={16} color="#94A3B8" />
              <Text style={styles.securityText}>Vitals Monitoring (Pulse/SPO2) remains hidden until connection is finalized via Patient Code.</Text>
            </View>

            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setReviewing(null)}
            >
              <Text style={styles.modalCloseBtnText}>Close Review</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4, fontWeight: '500' },
  scrollContent: { padding: 24, gap: 20 },
  requestCard: { borderRadius: 24, padding: 20, gap: 16, ...Shadows.medium },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  patientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  patientName: { fontSize: 16, fontWeight: '700' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  typeText: { fontSize: 12, color: '#6366F1', fontWeight: '600' },
  timeText: { fontSize: 10, color: '#94A3B8', fontWeight: '500' },
  messageBox: { padding: 12, borderRadius: 14, borderStyle: 'italic' },
  messageText: { fontSize: 13, lineHeight: 20 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  btnSecondary: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  btnSecondaryText: { fontSize: 13, fontWeight: '700' },
  mainActions: { flexDirection: 'row', gap: 10 },
  btnReject: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#EF444420', backgroundColor: '#EF444410', justifyContent: 'center', alignItems: 'center' },
  btnAccept: { borderRadius: 12, overflow: 'hidden' },
  btnAcceptGradient: { height: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnAcceptText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  emptyState: { paddingVertical: 80, alignItems: 'center', gap: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', zIndex: 100 },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, gap: 20, paddingBottom: Platform.OS === 'ios' ? 50 : 32 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  reviewerTop: { alignItems: 'center', gap: 12 },
  reviewerAvatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  reviewerAvatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  reviewerName: { fontSize: 20, fontWeight: '800' },
  onlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  snapshotGrid: { flexDirection: 'row', gap: 12 },
  snapshotItem: { flex: 1, padding: 16, borderRadius: 16, gap: 6 },
  snapshotLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: '#6366F1' },
  snapshotVal: { fontSize: 16, fontWeight: '800' },
  infoSection: { gap: 6 },
  infoLabel: { fontSize: 12, fontWeight: '800', color: '#6366F1', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoVal: { fontSize: 14, lineHeight: 22, fontWeight: '500' },
  securitySeal: { flexDirection: 'row', gap: 12, backgroundColor: 'rgba(148,163,184,0.08)', padding: 16, borderRadius: 16, alignItems: 'center' },
  securityText: { flex: 1, color: '#94A3B8', fontSize: 11, fontStyle: 'italic', lineHeight: 18 },
  modalCloseBtn: { height: 56, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  modalCloseBtnText: { color: '#475569', fontSize: 16, fontWeight: '800' },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: '#EF4444' },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});

import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/src/services/SupabaseService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

export default function MyRequestsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme as 'light' | 'dark'];
  const { session } = useAuthViewModel();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (session?.user?.id) fetchRequests();
  }, [session?.user?.id]);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('doctor_requests')
        .select(`
          *,
          doctor:doctor_id (
            full_name,
            specialization,
            avatar_url
          )
        `)
        .eq('patient_id', session?.user?.id)
        .neq('status', 'accepted')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (e) {
      console.error('[MyRequests] Fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return '#10B981';
      case 'rejected': return '#EF4444';
      default: return '#6366F1';
    }
  };

  const cleanName = (name: string) => {
    if (!name) return '';
    return name.replace(/^(Doctor|Dr\.?)\s+/i, '').trim();
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
        colors={['#1E1B4B', '#312E81', '#4F46E5']}
        style={styles.header}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connection Status</Text>
        <Text style={styles.headerSubtitle}>Track your pending clinical requests</Text>
      </LinearGradient>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
      >
        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="history" size={64} color={isDark ? '#334155' : '#E2E8F0'} />
            <Text style={[styles.emptyTitle, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>No Requests Yet</Text>
            <Text style={[styles.emptySubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>When you reach out to a doctor, your connection status will appear here.</Text>
            <TouchableOpacity style={styles.findBtn} onPress={() => router.push('/(tabs)/doctor')}>
              <Text style={styles.findBtnText}>Find a Doctor</Text>
            </TouchableOpacity>
          </View>
        ) : (
          requests.map((req, i) => (
            <Animated.View key={req.id} entering={FadeInDown.delay(i * 100).duration(400)}>
              <TouchableOpacity 
                style={[styles.requestCard, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}
                onPress={() => router.push({ 
                  pathname: '/doctor-public-profile', 
                  params: { id: req.doctor_id, full_name: req.doctor?.full_name } 
                })}
              >
                <View style={styles.cardTop}>
                  <View style={styles.doctorInfo}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{req.doctor?.full_name?.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={[styles.doctorName, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>Dr. {cleanName(req.doctor?.full_name)}</Text>
                      <Text style={styles.doctorSpec}>{req.doctor?.specialization || 'Clinical Specialist'}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(req.status) + '15' }]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(req.status) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(req.status) }]}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.cardDivider, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} />

                <View style={styles.cardBottom}>
                  <View style={styles.detailRow}>
                    <MaterialIcons name={req.type === 'connection' ? 'link' : 'chat-bubble-outline'} size={14} color="#6366F1" />
                    <Text style={[styles.detailText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      {req.type === 'connection' ? 'Clinical Link' : 'Message Inquiry'}
                    </Text>
                  </View>
                  <Text style={styles.dateText}>{new Date(req.created_at).toLocaleDateString()}</Text>
                </View>

                {req.status === 'accepted' && (
                  <TouchableOpacity 
                    style={styles.chatShortcut}
                    onPress={() => router.push({ 
                      pathname: '/chat-room', 
                      params: { partnerId: req.doctor_id, partnerName: req.doctor?.full_name } 
                    })}
                  >
                    <MaterialIcons name="chat" size={16} color="#6366F1" />
                    <Text style={styles.chatShortcutText}>Open Conversation</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </Animated.View>
          ))
        )}
      </ScrollView>
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
  scrollContent: { padding: 24, gap: 16 },
  requestCard: { borderRadius: 24, padding: 20, gap: 12, ...Shadows.medium },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  doctorInfo: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  doctorName: { fontSize: 16, fontWeight: '800' },
  doctorSpec: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  cardDivider: { height: 1, width: '100%', marginVertical: 4 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, fontWeight: '600' },
  dateText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  chatShortcut: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: 'rgba(99,102,241,0.08)', 
    padding: 12, 
    borderRadius: 14, 
    justifyContent: 'center',
    marginTop: 4
  },
  chatShortcutText: { color: '#6366F1', fontSize: 13, fontWeight: '800' },
  emptyState: { paddingVertical: 80, alignItems: 'center', gap: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  findBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, backgroundColor: '#6366F1' },
  findBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

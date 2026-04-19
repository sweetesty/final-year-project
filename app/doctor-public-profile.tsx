import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Colors, Shadows, Spacing } from '@/src/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/src/services/SupabaseService';
import { DoctorService } from '@/src/services/DoctorService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

export default function DoctorPublicProfile() {
  const router = useRouter();
  const { id, full_name, specialization } = useLocalSearchParams<{ id: string, full_name: string, specialization: string }>();
  
  // Helper to ensure we don't double up on "Dr."
  const cleanName = (name: string) => {
    if (!name) return '';
    return name.replace(/^(Doctor|Dr\.?)\s+/i, '').trim();
  };

  const displayName = cleanName(full_name || '');

  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme as 'light' | 'dark'];
  const { session } = useAuthViewModel();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{ connection: string, message: string }>({ connection: 'none', message: 'none' });

  useEffect(() => {
    fetchDoctorProfile();
  }, [id, session?.user?.id]);

  const fetchDoctorProfile = async () => {
    try {
      // 1. Fetch Profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      setProfile(data);

      // 2. Fetch Connection Status if logged in
      if (session?.user?.id) {
        const status = await DoctorService.getRequestStatus(session.user.id, id);
        setConnectionStatus(status as any);
      }
    } catch (e) {
      console.error('[DoctorPublicProfile] Fetch error:', e);
      Alert.alert('Error', 'Could not load doctor details.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (type: 'connection' | 'message') => {
    if (!session?.user?.id) {
      Alert.alert('Auth Required', 'Please log in to contact this doctor.');
      return;
    }

    setRequesting(type);
    try {
      await DoctorService.sendConnectionRequest(session.user.id, id, type);
      setConnectionStatus(prev => ({ ...prev, [type]: 'pending' }));
      Alert.alert(
        'Request Sent',
        `Your ${type} request has been sent to Dr. ${displayName}. You will be notified once they review it.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Request Failed', error.message || 'Could not send request.');
    } finally {
      setRequesting(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const isConnected = connectionStatus.connection === 'accepted';
  const isPending = connectionStatus.connection === 'pending';
  const isMsgPending = connectionStatus.message === 'pending';
  const isMsgAccepted = connectionStatus.message === 'accepted';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* --- Premium Header Section --- */}
        <LinearGradient
          colors={['#1E1B4B', '#312E81', '#4F46E5']}
          style={styles.header}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <Animated.View entering={FadeInUp.duration(600)} style={styles.headerInfo}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>{displayName.charAt(0)}</Text>
            </View>
            <Text style={styles.headerName}>Dr. {displayName}</Text>
            <Text style={styles.headerSpec}>{specialization || profile?.specialization || 'Clinical Specialist'}</Text>
            
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <MaterialIcons name="verified" size={14} color="#34D399" />
                <Text style={styles.badgeText}>Verified Provider</Text>
              </View>
              {profile?.facility && (
                <View style={styles.badge}>
                  <MaterialIcons name="apartment" size={14} color="#818CF8" />
                  <Text style={styles.badgeText}>{profile.facility}</Text>
                </View>
              )}
            </View>
          </Animated.View>
        </LinearGradient>

        <View style={styles.content}>
          {/* --- Bio Section --- */}
          <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.card}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>Professional Bio</Text>
            <Text style={[styles.bioText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {profile?.bio 
                ? profile.bio.replace(/^(Doctor|Dr\.?)\s+(Doctor|Dr\.?)\s+/i, '$1 ').trim()
                : `Dr. ${displayName} is a dedicated clinical professional providing expert care through the Kainos Platform.`
              }
            </Text>
          </Animated.View>

          {/* --- Stats/Info Section --- */}
          <View style={styles.statsGrid}>
            <View style={[styles.statItem, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
              <MaterialIcons name="workspace-premium" size={22} color="#6366F1" />
              <Text style={[styles.statLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Experience</Text>
              <Text style={[styles.statVal, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>Senior</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
              <MaterialIcons name="assignment-ind" size={22} color="#10B981" />
              <Text style={[styles.statLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Identity</Text>
              <Text style={[styles.statVal, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>{profile?.medical_id || 'ID Verified'}</Text>
            </View>
          </View>

          {/* --- Action Buttons --- */}
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={[
                styles.primaryAction, 
                (isConnected || isPending || requesting !== null) && { opacity: 0.8 }
              ]} 
              onPress={() => handleRequest('connection')}
              disabled={isConnected || isPending || requesting !== null}
            >
              <LinearGradient
                colors={isConnected ? ['#10B981', '#059669'] : ['#4F46E5', '#6366F1']}
                style={styles.actionGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {requesting === 'connection' ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <MaterialIcons 
                      name={isConnected ? 'verified-user' : (isPending ? 'hourglass-empty' : 'person-add')} 
                      size={20} 
                      color="#fff" 
                    />
                    <Text style={styles.actionText}>
                      {isConnected ? 'Clinical Connection Active' : (isPending ? 'Connection Pending Review' : 'Request Clinical Connection')}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.secondaryAction, 
                { borderColor: isDark ? '#334155' : '#E2E8F0', backgroundColor: isDark ? 'transparent' : '#fff' },
                (isMsgPending || isMsgAccepted || isConnected || requesting !== null) && { opacity: 0.6 }
              ]} 
              onPress={() => {
                if (isConnected || isMsgAccepted) {
                  router.push({ pathname: '/chat-room', params: { partnerId: id, partnerName: full_name } });
                } else {
                  handleRequest('message');
                }
              }}
              disabled={requesting !== null || isMsgPending}
            >
              {requesting === 'message' ? <ActivityIndicator color="#6366F1" /> : (
                <>
                  <MaterialIcons 
                    name={(isConnected || isMsgAccepted) ? 'chat' : 'chat-bubble-outline'} 
                    size={20} 
                    color="#6366F1" 
                  />
                  <Text style={[styles.secondaryActionText, { color: '#6366F1' }]}>
                    {(isConnected || isMsgAccepted) ? 'Open Direct Chat' : (isMsgPending ? 'Inquiry Pending' : 'Send Message Request')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.tipBox}>
            <MaterialIcons name="info-outline" size={16} color="#94A3B8" />
            <Text style={styles.tipText}>
              Connection requests allow doctors to monitor your vitals. Message requests enable direct communication for clinical inquiries.
            </Text>
          </View>
        </View>
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
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    alignItems: 'center',
  },
  backBtn: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerInfo: { alignItems: 'center' },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  headerName: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  headerSpec: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: '600', marginBottom: 16 },
  badgeRow: { flexDirection: 'row', gap: 10 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  content: { padding: 24, gap: 24 },
  card: { gap: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  bioText: { fontSize: 15, lineHeight: 24, fontWeight: '500' },
  statsGrid: { flexDirection: 'row', gap: 16 },
  statItem: { flex: 1, padding: 16, borderRadius: 20, gap: 6, ...Shadows.light },
  statLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  statVal: { fontSize: 15, fontWeight: '800' },
  actionContainer: { gap: 14, marginTop: 12 },
  primaryAction: { borderRadius: 18, overflow: 'hidden', ...Shadows.medium },
  actionGradient: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryAction: {
    height: 60,
    borderRadius: 18,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryActionText: { fontSize: 16, fontWeight: '800' },
  tipBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(148,163,184,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.1)',
  },
  tipText: { flex: 1, color: '#94A3B8', fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
});

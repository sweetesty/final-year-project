import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing, Shadows, BorderRadius } from '@/src/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/src/services/SupabaseService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

export default function ProfessionalDetailsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme as 'light' | 'dark'];
  const { session } = useAuthViewModel();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [details, setDetails] = useState({
    specialization: '',
    facility: '',
    medicalId: '',
    bio: '',
  });

  useEffect(() => {
    if (userId) fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      // Fetch the whole profile to avoid explicit column errors if they aren't created yet
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        let generatedId = data.medical_id;
        
        // Auto-generate if missing
        if (!generatedId) {
          const part1 = Math.floor(100 + Math.random() * 900);
          const part2 = Math.floor(100 + Math.random() * 900);
          generatedId = `KNS-${part1}-${part2}`;
          
          // Silently persist the new ID
          await supabase.from('profiles').update({ medical_id: generatedId }).eq('id', userId);
        }

        setDetails({
          specialization: data.specialization || '',
          facility: data.facility || '',
          medicalId: generatedId || '',
          bio: data.bio || '',
        });
      }
    } catch (e) {
      console.warn('[ProfessionalDetails] Fetch error (defensive handling):', e);
      // Fallback: Generate a temporary ID if fetch fails completely (e.g. column missing)
      const part1 = Math.floor(100 + Math.random() * 900);
      const part2 = Math.floor(100 + Math.random() * 900);
      setDetails(prev => ({ ...prev, medicalId: `KNS-${part1}-${part2}` }));
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          specialization: details.specialization,
          facility: details.facility,
          medical_id: details.medicalId,
          bio: details.bio,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      Alert.alert(
        'Portfolio Updated',
        'Your professional credentials have been successfully updated.',
        [{ text: 'Great', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('[ProfessionalDetails] Save error:', error);
      Alert.alert('Update Failed', error.message || 'Could not save details.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      <LinearGradient
        colors={['#1E1B4B', '#312E81', '#4F46E5']}
        style={styles.header}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Professional Portfolio</Text>
        <Text style={styles.headerSubtitle}>Manage your clinical credentials & bio</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(600)} style={styles.card}>
          <View style={[styles.innerCard, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: isDark ? '#94A3B8' : '#64748B' }]}>Specialization</Text>
              <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                <MaterialIcons name="workspace-premium" size={20} color={isDark ? '#475569' : '#94A3B8'} />
                <TextInput
                  style={[styles.input, { color: isDark ? '#fff' : '#000' }]}
                  placeholder="e.g. Cardiologist"
                  placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                  value={details.specialization}
                  onChangeText={(t) => setDetails({ ...details, specialization: t })}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: isDark ? '#94A3B8' : '#64748B' }]}>Medical ID</Text>
                  <View style={styles.systemBadge}>
                    <Text style={styles.systemBadgeText}>System Generated</Text>
                  </View>
                </View>
                <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0', opacity: 0.7 }]}>
                  <MaterialIcons name="badge" size={20} color={isDark ? '#475569' : '#94A3B8'} />
                  <TextInput
                    style={[styles.input, { color: isDark ? '#94A3B8' : '#64748B' }]}
                    placeholder="Reg No."
                    placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                    value={details.medicalId}
                    editable={false}
                  />
                  <MaterialIcons name="lock" size={16} color={isDark ? '#475569' : '#94A3B8'} />
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: isDark ? '#94A3B8' : '#64748B' }]}>Primary Facility</Text>
              <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                <MaterialIcons name="apartment" size={20} color={isDark ? '#475569' : '#94A3B8'} />
                <TextInput
                  style={[styles.input, { color: isDark ? '#fff' : '#000' }]}
                  placeholder="e.g. City General Hospital"
                  placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                  value={details.facility}
                  onChangeText={(t) => setDetails({ ...details, facility: t })}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: isDark ? '#94A3B8' : '#64748B' }]}>Professional Bio</Text>
              <View style={[styles.textAreaWrapper, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                <TextInput
                  style={[styles.textArea, { color: isDark ? '#fff' : '#000' }]}
                  placeholder="Tell patients about your clinical experience..."
                  placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                  multiline
                  numberOfLines={4}
                  value={details.bio}
                  onChangeText={(t) => setDetails({ ...details, bio: t })}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#4F46E5', '#6366F1']}
                style={styles.saveBtnGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <MaterialIcons name="check" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Portfolio</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
        
        <View style={styles.tipBox}>
          <MaterialIcons name="lightbulb-outline" size={18} color="#94A3B8" />
          <Text style={styles.tipText}>
            Your specialization and bio are visible to patients searching for nearby medical assistance.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4, fontWeight: '500' },
  scrollContent: { padding: 24, paddingTop: 32 },
  card: { borderRadius: 24, ...Shadows.medium },
  innerCard: { borderRadius: 24, padding: 24, gap: 18 },
  row: { flexDirection: 'row', gap: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  systemBadge: { backgroundColor: 'rgba(99,102,241,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
  systemBadgeText: { color: '#6366F1', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  inputGroup: { gap: 8 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginLeft: 4 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    gap: 12,
  },
  input: { flex: 1, fontSize: 16, fontWeight: '600' },
  textAreaWrapper: { borderRadius: 16, borderWidth: 1, padding: 12, minHeight: 120 },
  textArea: { flex: 1, fontSize: 16, fontWeight: '600', textAlignVertical: 'top' },
  saveBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 12, ...Shadows.light },
  saveBtnGradient: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  tipBox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 32, paddingHorizontal: 16 },
  tipText: { flex: 1, color: '#94A3B8', fontSize: 12, lineHeight: 18 },
});

import React, { useState } from 'react';
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

export default function ChangePasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme as 'light' | 'dark'];

  const { session } = useAuthViewModel();
  const [fullName, setFullName] = useState(session?.user?.user_metadata?.full_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const handleUpdate = async () => {
    if (!fullName) {
      Alert.alert('Error', 'Display name cannot be empty.');
      return;
    }

    setLoading(true);
    try {
      const updatePayload: any = {
        data: { full_name: fullName }
      };

      if (newPassword) {
        if (newPassword !== confirmPassword) {
          Alert.alert('Error', 'New passwords do not match.');
          setLoading(false);
          return;
        }
        if (newPassword.length < 6) {
          Alert.alert('Error', 'Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        updatePayload.password = newPassword;
      }

      const { error } = await supabase.auth.updateUser(updatePayload);

      if (error) throw error;

      Alert.alert(
        'Success',
        'Your profile has been updated successfully.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('[AccountSettings] Update error:', error);
      Alert.alert('Update Failed', error.message || 'Could not update account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* --- Premium Header --- */}
      <LinearGradient
        colors={['#1E1B4B', '#312E81', '#4338CA']}
        style={styles.header}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
        <Text style={styles.headerSubtitle}>Manage your clinical identity & security</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(600)} style={styles.card}>
          <View style={[styles.innerCard, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            <View style={styles.titleRow}>
              <MaterialIcons name="person-outline" size={22} color={C.tint} />
              <Text style={[styles.cardTitle, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>Profile Identity</Text>
            </View>
            <Text style={[styles.cardDesc, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              Update how your name appears to colleagues and patients across the platform.
            </Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: isDark ? '#94A3B8' : '#64748B' }]}>Full Name</Text>
                <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                  <MaterialIcons name="person" size={20} color={isDark ? '#475569' : '#94A3B8'} />
                  <TextInput
                    style={[styles.input, { color: isDark ? '#fff' : '#000' }]}
                    placeholder="Enter your full name"
                    placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: isDark ? '#334155' : '#E2E8F0', marginVertical: 8 }} />

              <View style={styles.titleRow}>
                <MaterialIcons name="lock-outline" size={22} color={C.tint} />
                <Text style={[styles.cardTitle, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>Security Keys</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: isDark ? '#94A3B8' : '#64748B' }]}>New Password (Optional)</Text>
                <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                  <MaterialIcons name="vpn-key" size={20} color={isDark ? '#475569' : '#94A3B8'} />
                  <TextInput
                    style={[styles.input, { color: isDark ? '#fff' : '#000' }]}
                    placeholder="Leave blank to keep current"
                    placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                    secureTextEntry={!showPasswords}
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: isDark ? '#94A3B8' : '#64748B' }]}>Confirm New Password</Text>
                <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                  <MaterialIcons name="check-circle-outline" size={20} color={isDark ? '#475569' : '#94A3B8'} />
                  <TextInput
                    style={[styles.input, { color: isDark ? '#fff' : '#000' }]}
                    placeholder="Repeat new password"
                    placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                    secureTextEntry={!showPasswords}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPasswords(!showPasswords)}>
                    <MaterialIcons 
                      name={showPasswords ? "visibility" : "visibility-off"} 
                      size={20} 
                      color={isDark ? '#475569' : '#94A3B8'} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.updateBtn} 
                onPress={handleUpdate}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#4338CA', '#6366F1']}
                  style={styles.updateBtnGradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="save" size={20} color="#fff" />
                      <Text style={styles.updateBtnText}>Save Changes</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={18} color="#94A3B8" />
          <Text style={styles.infoText}>
            Updating your password will sync across all your logged-in scientific and clinical devices.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    marginTop: 4,
    fontWeight: '500',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 32,
  },
  card: {
    borderRadius: 24,
    ...Shadows.medium,
  },
  innerCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  updateBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 12,
    ...Shadows.light,
  },
  updateBtnGradient: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  updateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 32,
    paddingHorizontal: 16,
    opacity: 0.8,
  },
  infoText: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});

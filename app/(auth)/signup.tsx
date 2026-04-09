import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthService } from '@/src/services/SupabaseService';

export default function SignupScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !fullName) {
      alert('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await AuthService.signUp(email, password, fullName, role);
      alert('Account created! Please log in.');
      router.replace('/login');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <Stack.Screen options={{ title: 'Create Clinical Account', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text }]}>Join Vitals Fusion</Text>
          <Text style={[styles.subtitle, { color: themeColors.muted }]}>Select your role to begin</Text>
        </View>

        {/* Role Selection */}
        <View style={styles.roleContainer}>
          <TouchableOpacity 
            style={[
              styles.roleCard, 
              { backgroundColor: themeColors.card, borderColor: role === 'patient' ? themeColors.tint : themeColors.border }
            ]}
            onPress={() => setRole('patient')}
          >
            <Text style={styles.roleEmoji}>🏠</Text>
            <Text style={[styles.roleLabel, { color: themeColors.text }]}>I'm a Patient</Text>
            {role === 'patient' && <View style={[styles.radioActive, { backgroundColor: themeColors.tint }]} />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.roleCard, 
              { backgroundColor: themeColors.card, borderColor: role === 'doctor' ? themeColors.tint : themeColors.border }
            ]}
            onPress={() => setRole('doctor')}
          >
            <Text style={styles.roleEmoji}>👨‍⚕️</Text>
            <Text style={[styles.roleLabel, { color: themeColors.text }]}>I'm a Doctor</Text>
            {role === 'doctor' && <View style={[styles.radioActive, { backgroundColor: themeColors.tint }]} />}
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
            placeholder="Full Name"
            placeholderTextColor={themeColors.muted}
            value={fullName}
            onChangeText={setFullName}
          />
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
            placeholder="Email Address"
            placeholderTextColor={themeColors.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
            placeholder="Password"
            placeholderTextColor={themeColors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: themeColors.tint }]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign Up</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={[styles.footerText, { color: themeColors.muted }]}>Already have an account? <Text style={{ color: themeColors.tint }}>Log In</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  header: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  roleCard: {
    flex: 1,
    height: 120,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...Shadows.light,
  },
  roleEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  roleLabel: {
    fontWeight: '700',
  },
  radioActive: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  form: {
    gap: Spacing.md,
  },
  input: {
    height: 56,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    fontSize: 16,
  },
  button: {
    height: 56,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    ...Shadows.medium,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  footerText: {
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});

import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, Link } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

export default function RegisterScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const { signUp } = useAuthViewModel();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      alert('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, fullName, role);
      alert('Account created! You are now logged in.');
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
      <Stack.Screen options={{ title: 'Create Account', headerShown: false }} />
      
      <ScrollView contentContainerStyle={styles.scrollInner}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text }]}>Join Vitals Fusion</Text>
          <Text style={[styles.subtitle, { color: themeColors.muted }]}>Create your secure healthcare account</Text>
        </View>

        <View style={styles.roleContainer}>
          <TouchableOpacity 
            style={[styles.roleButton, role === 'patient' && { backgroundColor: themeColors.tint, borderColor: themeColors.tint }]}
            onPress={() => setRole('patient')}
          >
            <Text style={[styles.roleText, role === 'patient' && { color: '#fff' }]}>Patient</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.roleButton, role === 'doctor' && { backgroundColor: themeColors.tint, borderColor: themeColors.tint }]}
            onPress={() => setRole('doctor')}
          >
            <Text style={[styles.roleText, role === 'doctor' && { color: '#fff' }]}>Doctor</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: themeColors.text }]}>Full Name</Text>
            <TextInput
              style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
              placeholder="Your full name"
              placeholderTextColor={themeColors.muted}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: themeColors.text }]}>Email</Text>
            <TextInput
              style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
              placeholder="name@example.com"
              placeholderTextColor={themeColors.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: themeColors.text }]}>Password</Text>
            <TextInput
              style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
              placeholder="Min. 8 characters"
              placeholderTextColor={themeColors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: themeColors.text }]}>Confirm Password</Text>
            <TextInput
              style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
              placeholder="Repeat your password"
              placeholderTextColor={themeColors.muted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: themeColors.tint }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Get Started</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={{ color: themeColors.muted }}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={{ color: themeColors.tint, fontWeight: '700' }}>Login</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollInner: {
    padding: Spacing.xl,
    paddingTop: Spacing.xxl * 2,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 18,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  roleButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleText: {
    fontWeight: '700',
  },
  form: {
    gap: Spacing.lg,
  },
  inputContainer: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  button: {
    height: 56,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    ...Shadows.medium,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xxl,
  },
});

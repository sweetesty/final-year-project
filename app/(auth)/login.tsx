import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { AuthService } from '@/src/services/SupabaseService';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await AuthService.signIn(email.trim(), password);
      // _layout.tsx handles redirect on session change
    } catch (e: any) {
      setError(e.message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Full-screen gradient background */}
      <LinearGradient colors={['#0F0F1A', '#1E1B4B', '#0F0F1A']} style={StyleSheet.absoluteFill} />

      {/* Decorative orbs */}
      <View style={[styles.orb, styles.orb1]} />
      <View style={[styles.orb, styles.orb2]} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / brand */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.brand}>
          <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.logoBox}>
            <MaterialIcons name="favorite" size={32} color="#fff" />
          </LinearGradient>
          <Text style={styles.brandName}>Vitals Fusion</Text>
          <Text style={styles.brandTagline}>Your intelligent health companion</Text>
        </Animated.View>

        {/* Card */}
        <Animated.View entering={FadeInDown.delay(250).duration(600)} style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSub}>Sign in to continue</Text>

          {/* Error banner */}
          {error ? (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={16} color="#FCA5A5" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={styles.inputWrap}>
            <MaterialIcons name="email" size={18} color="rgba(255,255,255,0.35)" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <View style={styles.inputWrap}>
            <MaterialIcons name="lock" size={18} color="rgba(255,255,255,0.35)" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
              <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={18} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>
          </View>

          {/* Sign in button */}
          <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.btn}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Text style={styles.btnText}>Sign In</Text>
                    <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Don't have an account?</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() => router.push('/signup')}
            activeOpacity={0.8}
          >
            <Text style={styles.outlineBtnText}>Create account</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Footer */}
        <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.footer}>
          <MaterialIcons name="lock" size={12} color="rgba(255,255,255,0.2)" />
          <Text style={styles.footerText}>Secured with end-to-end encryption</Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0F1A' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 60 },

  // Decorative
  orb: { position: 'absolute', borderRadius: 999, opacity: 0.12 },
  orb1: { width: 320, height: 320, backgroundColor: '#6366F1', top: -80, right: -100 },
  orb2: { width: 240, height: 240, backgroundColor: '#4338CA', bottom: 60, left: -80 },

  // Brand
  brand: { alignItems: 'center', marginBottom: 40, gap: 10 },
  logoBox: {
    width: 72, height: 72, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6366F1', shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
  },
  brandName: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  brandTagline: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },

  // Card
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 28,
    gap: 16,
  },
  cardTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  cardSub: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: -8 },

  // Error
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10, padding: 12,
  },
  errorText: { color: '#FCA5A5', fontSize: 13, flex: 1 },

  // Inputs
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, height: 52, paddingHorizontal: 14, gap: 10,
  },
  inputIcon: { width: 20 },
  input: { flex: 1, color: '#fff', fontSize: 15 },
  eyeBtn: { padding: 4 },

  // Buttons
  btn: {
    height: 54, borderRadius: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    shadowColor: '#6366F1', shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  outlineBtn: {
    height: 50, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  outlineBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 32 },
  footerText: { fontSize: 12, color: 'rgba(255,255,255,0.2)' },
});

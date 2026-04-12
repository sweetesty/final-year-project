import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

type Role = 'patient' | 'doctor';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuthViewModel();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [role, setRole] = useState<Role>('patient');
  const [specialization, setSpecialization] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'fetching' | 'granted' | 'denied'>('idle');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState('');

  const requestLocation = async () => {
    setLocationStatus('fetching');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setLocationStatus('granted');
    } catch {
      setLocationStatus('denied');
    }
  };

  const handleRegister = async () => {
    setError('');
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (role === 'doctor' && !specialization.trim()) {
      setError('Please enter your medical specialization.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, fullName.trim(), role, coords ?? undefined, specialization.trim() || undefined);
      Alert.alert('Account Created', 'Welcome to Vitals Fusion!');
    } catch (e: any) {
      setError(e.message ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({
    icon, placeholder, value, onChangeText, secure, showToggle, onToggle, keyboardType, autoCapitalize,
  }: any) => (
    <View style={styles.inputWrap}>
      <MaterialIcons name={icon} size={18} color="rgba(255,255,255,0.35)" style={styles.inputIcon} />
      <TextInput
        style={[styles.input, { flex: 1 }]}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.3)"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
      />
      {showToggle !== undefined && (
        <TouchableOpacity onPress={onToggle} style={styles.eyeBtn}>
          <MaterialIcons name={showToggle ? 'visibility-off' : 'visibility'} size={18} color="rgba(255,255,255,0.35)" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={['#0F0F1A', '#1E1B4B', '#0F0F1A']} style={StyleSheet.absoluteFill} />
      <View style={[styles.orb, styles.orb1]} />
      <View style={[styles.orb, styles.orb2]} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <Animated.View entering={FadeInDown.delay(80).duration(500)} style={styles.brand}>
          <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.logoBox}>
            <MaterialIcons name="favorite" size={28} color="#fff" />
          </LinearGradient>
          <Text style={styles.brandName}>Vitals Fusion</Text>
        </Animated.View>

        {/* Card */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.card}>
          <Text style={styles.cardTitle}>Create account</Text>
          <Text style={styles.cardSub}>Join your healthcare network</Text>

          {/* Role selector */}
          <View style={styles.roleRow}>
            {(['patient', 'doctor'] as Role[]).map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                onPress={() => setRole(r)}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={r === 'patient' ? 'personal-injury' : 'medical-services'}
                  size={16}
                  color={role === r ? '#fff' : 'rgba(255,255,255,0.4)'}
                />
                <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                  {r === 'patient' ? 'Patient' : 'Doctor'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={15} color="#FCA5A5" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Fields */}
          <Field icon="person" placeholder="Full name" value={fullName} onChangeText={setFullName} />

          {role === 'doctor' && (
            <Field
              icon="local-hospital"
              placeholder="Specialization (e.g. Cardiologist)"
              value={specialization}
              onChangeText={setSpecialization}
            />
          )}

          <Field
            icon="email"
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Field
            icon="lock"
            placeholder="Password (min. 6 characters)"
            value={password}
            onChangeText={setPassword}
            secure={!showPassword}
            showToggle={showPassword}
            onToggle={() => setShowPassword(p => !p)}
            autoCapitalize="none"
          />

          <Field
            icon="lock-outline"
            placeholder="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secure={!showConfirm}
            showToggle={showConfirm}
            onToggle={() => setShowConfirm(p => !p)}
            autoCapitalize="none"
          />

          {/* Location */}
          <TouchableOpacity
            style={[
              styles.locationRow,
              locationStatus === 'granted' && styles.locationGranted,
              locationStatus === 'denied' && styles.locationDenied,
            ]}
            onPress={requestLocation}
            disabled={locationStatus === 'fetching'}
            activeOpacity={0.8}
          >
            {locationStatus === 'fetching' ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <MaterialIcons
                name={locationStatus === 'granted' ? 'location-on' : 'location-off'}
                size={20}
                color={
                  locationStatus === 'granted' ? '#10B981' :
                  locationStatus === 'denied' ? '#EF4444' :
                  'rgba(255,255,255,0.5)'
                }
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.locationTitle}>
                {role === 'doctor' ? 'Clinic Location' : 'Your Location'}
              </Text>
              <Text style={styles.locationSub}>
                {locationStatus === 'granted' ? 'Location captured ✓' :
                 locationStatus === 'denied' ? 'Denied — tap to retry' :
                 locationStatus === 'fetching' ? 'Getting your location…' :
                 'Enables nearby doctor matching'}
              </Text>
            </View>
            {locationStatus !== 'granted' && locationStatus !== 'fetching' && (
              <Text style={styles.locationCta}>Enable</Text>
            )}
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
            <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.btn}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Text style={styles.btnText}>Create Account</Text>
                    <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>

          {/* Login link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.loginLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={styles.footer}>
          <MaterialIcons name="lock" size={12} color="rgba(255,255,255,0.2)" />
          <Text style={styles.footerText}>Secured with end-to-end encryption</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0F1A' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },

  orb: { position: 'absolute', borderRadius: 999, opacity: 0.10 },
  orb1: { width: 300, height: 300, backgroundColor: '#6366F1', top: -60, right: -80 },
  orb2: { width: 220, height: 220, backgroundColor: '#4338CA', bottom: 40, left: -60 },

  brand: { alignItems: 'center', marginBottom: 28, gap: 8 },
  logoBox: {
    width: 60, height: 60, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6366F1', shadowOpacity: 0.5, shadowRadius: 16, elevation: 8,
  },
  brandName: { fontSize: 22, fontWeight: '800', color: '#fff' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24, gap: 14,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  cardSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: -6 },

  // Role
  roleRow: { flexDirection: 'row', gap: 10 },
  roleBtn: {
    flex: 1, height: 44, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  roleBtnActive: {
    backgroundColor: '#4338CA',
    borderColor: '#6366F1',
  },
  roleBtnText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  roleBtnTextActive: { color: '#fff' },

  // Error
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 10, padding: 11,
  },
  errorText: { color: '#FCA5A5', fontSize: 13, flex: 1 },

  // Inputs
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 13, height: 50, paddingHorizontal: 14, gap: 10,
  },
  inputIcon: { width: 20 },
  input: { color: '#fff', fontSize: 15 },
  eyeBtn: { padding: 4 },

  // Location
  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 13, padding: 14,
  },
  locationGranted: { borderColor: 'rgba(16,185,129,0.4)', backgroundColor: 'rgba(16,185,129,0.07)' },
  locationDenied: { borderColor: 'rgba(239,68,68,0.35)', backgroundColor: 'rgba(239,68,68,0.06)' },
  locationTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
  locationSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  locationCta: { fontSize: 13, fontWeight: '700', color: '#6366F1' },

  // Button
  btn: {
    height: 52, borderRadius: 13,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    shadowColor: '#6366F1', shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Login link
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  loginText: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  loginLink: { fontSize: 13, fontWeight: '700', color: '#6366F1' },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 },
  footerText: { fontSize: 12, color: 'rgba(255,255,255,0.2)' },
});

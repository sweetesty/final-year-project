import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Stack, Link } from 'expo-router';
import * as Location from 'expo-location';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
  const [specialization, setSpecialization] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'fetching' | 'granted' | 'denied'>('idle');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const requestLocation = async () => {
    setLocationStatus('fetching');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('denied');
        Alert.alert(
          'Location Needed',
          'Your location helps connect you with nearby doctors. You can still sign up, but nearby features won\'t work.'
        );
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
    if (!fullName || !email || !password) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', "Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (role === 'doctor' && !specialization.trim()) {
      Alert.alert('Specialization Required', 'Please enter your medical specialization.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, fullName, role, coords ?? undefined, specialization.trim() || undefined);
      Alert.alert('Welcome!', 'Your account has been created.');
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const locationColor =
    locationStatus === 'granted' ? '#10B981' :
    locationStatus === 'denied' ? '#EF4444' :
    locationStatus === 'fetching' ? themeColors.tint :
    themeColors.muted;

  const locationLabel =
    locationStatus === 'granted' ? 'Location captured' :
    locationStatus === 'denied' ? 'Location denied — tap to retry' :
    locationStatus === 'fetching' ? 'Getting location...' :
    'Tap to enable location access';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <Stack.Screen options={{ title: 'Create Account', headerShown: false }} />

      <ScrollView contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text }]}>Join Vitals Fusion</Text>
          <Text style={[styles.subtitle, { color: themeColors.muted }]}>Create your secure healthcare account</Text>
        </View>

        {/* Role Selector */}
        <View style={styles.roleContainer}>
          {(['patient', 'doctor'] as const).map(r => (
            <TouchableOpacity
              key={r}
              style={[
                styles.roleButton,
                { borderColor: themeColors.border },
                role === r && { backgroundColor: themeColors.tint, borderColor: themeColors.tint },
              ]}
              onPress={() => setRole(r)}
            >
              <MaterialIcons
                name={r === 'patient' ? 'personal-injury' : 'medical-services'}
                size={18}
                color={role === r ? '#fff' : themeColors.muted}
              />
              <Text style={[styles.roleText, { color: role === r ? '#fff' : themeColors.muted }]}>
                {r === 'patient' ? 'Patient' : 'Doctor'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.form}>
          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: themeColors.text }]}>Full Name</Text>
            <TextInput
              style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
              placeholder="Your full name"
              placeholderTextColor={themeColors.muted}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          {/* Doctor Specialization */}
          {role === 'doctor' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: themeColors.text }]}>Specialization</Text>
              <TextInput
                style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
                placeholder="e.g. General Practitioner, Cardiologist"
                placeholderTextColor={themeColors.muted}
                value={specialization}
                onChangeText={setSpecialization}
              />
            </View>
          )}

          {/* Email */}
          <View style={styles.inputGroup}>
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

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: themeColors.text }]}>Password</Text>
            <TextInput
              style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
              placeholder="Min. 6 characters"
              placeholderTextColor={themeColors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
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

          {/* Location */}
          <TouchableOpacity
            style={[styles.locationRow, { backgroundColor: themeColors.card, borderColor: locationColor + '60' }]}
            onPress={requestLocation}
            disabled={locationStatus === 'fetching'}
          >
            {locationStatus === 'fetching' ? (
              <ActivityIndicator size="small" color={themeColors.tint} />
            ) : (
              <MaterialIcons
                name={locationStatus === 'granted' ? 'location-on' : 'location-off'}
                size={22}
                color={locationColor}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.locationTitle, { color: themeColors.text }]}>
                {role === 'doctor' ? 'Clinic Location' : 'Your Location'}
              </Text>
              <Text style={[styles.locationSub, { color: locationColor }]}>{locationLabel}</Text>
            </View>
            {locationStatus !== 'granted' && locationStatus !== 'fetching' && (
              <Text style={[styles.locationAction, { color: themeColors.tint }]}>Enable</Text>
            )}
            {locationStatus === 'granted' && (
              <MaterialIcons name="check-circle" size={20} color="#10B981" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: themeColors.tint }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Get Started</Text>
            }
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
  container: { flex: 1 },
  scrollInner: { padding: Spacing.xl, paddingTop: Spacing.xxl * 2 },
  header: { marginBottom: Spacing.xl },
  title: { fontSize: 32, fontWeight: '800', marginBottom: Spacing.xs },
  subtitle: { fontSize: 16 },
  roleContainer: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  roleButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  roleText: { fontWeight: '700', fontSize: 15 },
  form: { gap: Spacing.lg },
  inputGroup: { gap: Spacing.xs },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  locationTitle: { fontSize: 14, fontWeight: '700' },
  locationSub: { fontSize: 12, marginTop: 1 },
  locationAction: { fontSize: 13, fontWeight: '700' },
  button: {
    height: 56,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    ...Shadows.medium,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xxl,
  },
});

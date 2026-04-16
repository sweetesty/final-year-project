import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
  Dimensions, Image,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, {
  FadeInDown, FadeInUp,
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

const { width: SW, height: SH } = Dimensions.get('window');
type Role = 'patient' | 'doctor' | 'caregiver';

// ─── Floating icon bubbles (same as login) ────────────────────────────────────
type IconName =
  | 'favorite' | 'medical-services' | 'monitor-heart' | 'vaccines'
  | 'local-hospital' | 'healing' | 'psychology' | 'bloodtype';

interface BubbleConfig {
  icon: IconName; size: number; x: number; y: number;
  delay: number; duration: number; color: string; bg: string; amplitude: number;
}

const BUBBLES: BubbleConfig[] = [
  { icon: 'favorite',         size: 20, x: 0.06, y: 0.03, delay: 0,    duration: 3200, color: '#F87171', bg: 'rgba(248,113,113,0.16)', amplitude: 13 },
  { icon: 'monitor-heart',    size: 18, x: 0.82, y: 0.08, delay: 500,  duration: 2800, color: '#818CF8', bg: 'rgba(129,140,248,0.16)', amplitude: 17 },
  { icon: 'medical-services', size: 20, x: 0.50, y: 0.02, delay: 200,  duration: 3600, color: '#34D399', bg: 'rgba(52,211,153,0.16)',  amplitude: 11 },
  { icon: 'vaccines',         size: 16, x: 0.28, y: 0.26, delay: 900,  duration: 2600, color: '#FBBF24', bg: 'rgba(251,191,36,0.16)',  amplitude: 15 },
  { icon: 'healing',          size: 18, x: 0.91, y: 0.46, delay: 300,  duration: 3000, color: '#60A5FA', bg: 'rgba(96,165,250,0.16)',  amplitude: 10 },
  { icon: 'bloodtype',        size: 16, x: 0.44, y: 0.54, delay: 700,  duration: 3400, color: '#F472B6', bg: 'rgba(244,114,182,0.16)', amplitude: 18 },
  { icon: 'psychology',       size: 20, x: 0.64, y: 0.70, delay: 1100, duration: 2900, color: '#A78BFA', bg: 'rgba(167,139,250,0.16)', amplitude: 13 },
  { icon: 'local-hospital',   size: 18, x: 0.14, y: 0.58, delay: 600,  duration: 3100, color: '#6EE7B7', bg: 'rgba(110,231,183,0.16)', amplitude: 15 },
  { icon: 'healing',          size: 16, x: 0.36, y: 0.85, delay: 400,  duration: 2700, color: '#FCD34D', bg: 'rgba(252,211,77,0.16)',  amplitude: 12 },
  { icon: 'favorite',         size: 14, x: 0.72, y: 0.90, delay: 850,  duration: 3300, color: '#F87171', bg: 'rgba(248,113,113,0.14)', amplitude: 10 },
];

function FloatingBubble({ config }: { config: BubbleConfig }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withDelay(config.delay, withTiming(1, { duration: 900 }));
    translateY.value = withDelay(config.delay,
      withRepeat(withTiming(-config.amplitude, { duration: config.duration, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }], opacity: opacity.value }));
  const box = config.size + 22;
  return (
    <Animated.View style={[style, {
      position: 'absolute', left: SW * config.x - box / 2, top: SH * config.y,
      width: box, height: box, borderRadius: box / 2,
      backgroundColor: config.bg, borderWidth: 1, borderColor: config.color + '35',
      justifyContent: 'center', alignItems: 'center',
    }]}>
      <MaterialIcons name={config.icon} size={config.size} color={config.color} />
    </Animated.View>
  );
}

// ─── Floating photo cards ─────────────────────────────────────────────────────
const PHOTO_CARDS = [
  { uri: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=160&h=160&fit=crop&crop=face', x: 0.88, y: 0.18, rotate: '9deg',  delay: 300, size: 66 },
  { uri: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=160&h=160&fit=crop&crop=face',  x: 0.08, y: 0.22, rotate: '-8deg', delay: 550, size: 62 },
  { uri: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=160&h=160&fit=crop&crop=face', x: 0.86, y: 0.60, rotate: '-7deg', delay: 750, size: 68 },
  { uri: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=160&h=160&fit=crop&crop=face', x: 0.09, y: 0.64, rotate: '6deg',  delay: 400, size: 64 },
  { uri: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=160&h=160&fit=crop&crop=face', x: 0.50, y: 0.88, rotate: '5deg',  delay: 650, size: 60 },
];

function PhotoCard({ uri, x, y, rotate, delay, size }: typeof PHOTO_CARDS[0]) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 900 }));
    translateY.value = withDelay(delay,
      withRepeat(withTiming(-11, { duration: 3600 + delay * 0.4, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }, { rotate }], opacity: opacity.value }));
  return (
    <Animated.View style={[style, {
      position: 'absolute', left: SW * x - size / 2, top: SH * y,
      width: size, height: size, borderRadius: size * 0.26,
      shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 14, elevation: 12,
      borderWidth: 2, borderColor: 'rgba(99,102,241,0.45)', overflow: 'hidden',
    }]}>
      <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(67,56,202,0.4)']} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const Field = ({ icon, placeholder, value, onChangeText, secure, showToggle, onToggle, keyboardType, autoCapitalize }: any) => (
  <View style={styles.inputWrap}>
    <MaterialIcons name={icon} size={18} color="rgba(255,255,255,0.3)" style={styles.inputIcon} />
    <TextInput
      style={[styles.input, { flex: 1, color: '#fff' }]}
      placeholder={placeholder}
      placeholderTextColor="rgba(255,255,255,0.25)"
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secure}
      keyboardType={keyboardType ?? 'default'}
      autoCapitalize={autoCapitalize ?? 'sentences'}
    />
    {showToggle !== undefined && (
      <TouchableOpacity onPress={onToggle} style={styles.eyeBtn}>
        <MaterialIcons name={showToggle ? 'visibility-off' : 'visibility'} size={18} color="rgba(255,255,255,0.3)" />
      </TouchableOpacity>
    )}
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────
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
      if (status !== 'granted') { setLocationStatus('denied'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setLocationStatus('granted');
    } catch { setLocationStatus('denied'); }
  };

  const handleRegister = async () => {
    setError('');
    if (!fullName.trim() || !email.trim() || !password) { setError('Please fill in all required fields.'); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (role === 'doctor' && !specialization.trim()) { setError('Please enter your medical specialization.'); return; }
    setLoading(true);
    try {
      await signUp(email.trim(), password, fullName.trim(), role, coords ?? undefined, specialization.trim() || undefined);
      Alert.alert('Account Created', 'Welcome to Vitals Fusion!');
    } catch (e: any) {
      setError(e.message ?? 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Background */}
      <LinearGradient colors={['#060612', '#0D0D2B', '#1A1040']} style={StyleSheet.absoluteFill} />

      {/* Grid */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: 9 }).map((_, i) => <View key={`v${i}`} style={[styles.gridV, { left: (SW / 9) * i }]} />)}
        {Array.from({ length: 12 }).map((_, i) => <View key={`h${i}`} style={[styles.gridH, { top: (SH / 12) * i }]} />)}
      </View>

      {/* Glow orbs */}
      <View style={[styles.glow, { top: SH * 0.08, left: SW * 0.3 }]} pointerEvents="none" />
      <View style={[styles.glow, { bottom: 80, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: '#7C3AED', opacity: 0.10 }]} pointerEvents="none" />

      {/* Floating bubbles */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {BUBBLES.map((b, i) => <FloatingBubble key={i} config={b} />)}
      </View>

      {/* Photo cards */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {PHOTO_CARDS.map((p, i) => <PhotoCard key={i} {...p} />)}
      </View>

      {/* Form */}
      <ScrollView
        contentContainerStyle={styles.sheet}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.brand}>
          <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.logoBox}>
            <MaterialIcons name="favorite" size={26} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={styles.brandName}>Vitals Fusion</Text>
            <Text style={styles.brandTagline}>Your intelligent health companion</Text>
          </View>
        </Animated.View>

        {/* Card */}
        <Animated.View entering={FadeInUp.delay(250).duration(550)} style={styles.card}>
          <View style={styles.cardHandle} />
          <Text style={styles.cardTitle}>Create account</Text>
          <Text style={styles.cardSub}>Join your healthcare network</Text>

          {/* Role selector */}
          <View style={styles.roleRow}>
            {(['patient', 'caregiver', 'doctor'] as Role[]).map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                onPress={() => setRole(r)}
                activeOpacity={0.8}
              >
                {role === r && (
                  <LinearGradient colors={['#4338CA', '#6366F1']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                )}
                <MaterialIcons
                  name={r === 'patient' ? 'personal-injury' : r === 'caregiver' ? 'family-restroom' : 'medical-services'}
                  size={16}
                  color={role === r ? '#fff' : 'rgba(255,255,255,0.4)'}
                />
                <Text style={[styles.roleBtnText, role === r && { color: '#fff' }]}>
                  {r === 'patient' ? 'Patient' : r === 'caregiver' ? 'Caregiver' : 'Doctor'}
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
            icon="email" placeholder="Email address"
            value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none"
          />
          <Field
            icon="lock" placeholder="Password (min. 6 characters)"
            value={password} onChangeText={setPassword}
            secure={!showPassword} showToggle={showPassword}
            onToggle={() => setShowPassword(p => !p)} autoCapitalize="none"
          />
          <Field
            icon="lock-outline" placeholder="Confirm password"
            value={confirmPassword} onChangeText={setConfirmPassword}
            secure={!showConfirm} showToggle={showConfirm}
            onToggle={() => setShowConfirm(p => !p)} autoCapitalize="none"
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
              <View style={[styles.locationIconBox, {
                backgroundColor: locationStatus === 'granted' ? 'rgba(16,185,129,0.15)' :
                  locationStatus === 'denied' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
              }]}>
                <MaterialIcons
                  name={locationStatus === 'granted' ? 'location-on' : 'location-off'}
                  size={20}
                  color={locationStatus === 'granted' ? '#10B981' : locationStatus === 'denied' ? '#EF4444' : '#6366F1'}
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.locationTitle}>
                {role === 'doctor' ? 'Clinic Location' : 'Your Location'}
              </Text>
              <Text style={[styles.locationSub, {
                color: locationStatus === 'granted' ? '#10B981' :
                  locationStatus === 'denied' ? '#EF4444' : 'rgba(255,255,255,0.38)',
              }]}>
                {locationStatus === 'granted' ? 'Location captured ✓' :
                 locationStatus === 'denied' ? 'Denied — tap to retry' :
                 locationStatus === 'fetching' ? 'Getting your location…' :
                 'Enables nearby doctor matching'}
              </Text>
            </View>
            {locationStatus !== 'granted' && locationStatus !== 'fetching' && (
              <View style={styles.enableChip}>
                <Text style={styles.enableChipText}>Enable</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.87}>
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

          {/* Sign in link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.loginLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={styles.footer}>
          <MaterialIcons name="lock" size={11} color="rgba(255,255,255,0.18)" />
          <Text style={styles.footerText}>Secured with end-to-end encryption</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060612' },

  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(99,102,241,0.05)' },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(99,102,241,0.05)' },
  glow: {
    position: 'absolute', width: 260, height: 260, borderRadius: 130,
    backgroundColor: '#3730A3', opacity: 0.12,
  },

  sheet: { flexGrow: 1, paddingHorizontal: 20, paddingTop: SH * 0.07, paddingBottom: 40 },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  logoBox: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6366F1', shadowOpacity: 0.6, shadowRadius: 16, elevation: 8,
  },
  brandName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  brandTagline: { fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 },

  card: {
    backgroundColor: 'rgba(10,10,35,0.95)',
    borderRadius: 28, borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.18)',
    padding: 24, gap: 14,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, elevation: 12,
  },
  cardHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'center', marginBottom: 2,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  cardSub: { fontSize: 13, color: 'rgba(255,255,255,0.36)', marginTop: -6 },

  roleRow: { flexDirection: 'row', gap: 10 },
  roleBtn: {
    flex: 1, height: 44, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  roleBtnActive: { borderColor: '#6366F1' },
  roleBtnText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 10, padding: 11,
  },
  errorText: { color: '#FCA5A5', fontSize: 13, flex: 1 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 14, height: 50, paddingHorizontal: 14, gap: 10,
  },
  inputIcon: { width: 20 },
  input: { color: '#fff', fontSize: 15 },
  eyeBtn: { padding: 4 },

  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 14, padding: 12,
  },
  locationGranted: { borderColor: 'rgba(16,185,129,0.35)', backgroundColor: 'rgba(16,185,129,0.06)' },
  locationDenied: { borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.05)' },
  locationIconBox: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  locationTitle: { fontSize: 13, fontWeight: '700', color: '#fff' },
  locationSub: { fontSize: 12, marginTop: 2 },
  enableChip: {
    backgroundColor: 'rgba(99,102,241,0.18)',
    borderWidth: 1, borderColor: 'rgba(99,102,241,0.35)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  enableChipText: { fontSize: 12, fontWeight: '700', color: '#818CF8' },

  btn: {
    height: 52, borderRadius: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    shadowColor: '#6366F1', shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  loginText: { fontSize: 13, color: 'rgba(255,255,255,0.38)' },
  loginLink: { fontSize: 13, fontWeight: '700', color: '#6366F1' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 20 },
  footerText: { fontSize: 12, color: 'rgba(255,255,255,0.18)' },
});

import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Image,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, {
  FadeInDown, FadeInUp,
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withDelay,
  Easing,
} from 'react-native-reanimated';
import { AuthService } from '@/src/services/SupabaseService';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Floating medical icon bubble ─────────────────────────────────────────────
type IconName =
  | 'favorite' | 'medical-services' | 'monitor-heart' | 'vaccines'
  | 'local-hospital' | 'healing' | 'psychology' | 'bloodtype';

interface BubbleConfig {
  icon: IconName;
  size: number;
  x: number;
  y: number;
  delay: number;
  duration: number;
  color: string;
  bg: string;
  amplitude: number;
}

// y is now a fraction of SH so bubbles span the full screen
const BUBBLES: BubbleConfig[] = [
  { icon: 'favorite',         size: 22, x: 0.08, y: 0.04, delay: 0,    duration: 3200, color: '#F87171', bg: 'rgba(248,113,113,0.18)', amplitude: 14 },
  { icon: 'monitor-heart',    size: 20, x: 0.80, y: 0.10, delay: 500,  duration: 2800, color: '#818CF8', bg: 'rgba(129,140,248,0.18)', amplitude: 18 },
  { icon: 'medical-services', size: 22, x: 0.50, y: 0.02, delay: 200,  duration: 3600, color: '#34D399', bg: 'rgba(52,211,153,0.18)',  amplitude: 12 },
  { icon: 'vaccines',         size: 18, x: 0.30, y: 0.28, delay: 900,  duration: 2600, color: '#FBBF24', bg: 'rgba(251,191,36,0.18)',  amplitude: 16 },
  { icon: 'healing',          size: 20, x: 0.92, y: 0.48, delay: 300,  duration: 3000, color: '#60A5FA', bg: 'rgba(96,165,250,0.18)',  amplitude: 10 },
  { icon: 'bloodtype',        size: 18, x: 0.46, y: 0.56, delay: 700,  duration: 3400, color: '#F472B6', bg: 'rgba(244,114,182,0.18)', amplitude: 20 },
  { icon: 'psychology',       size: 22, x: 0.62, y: 0.72, delay: 1100, duration: 2900, color: '#A78BFA', bg: 'rgba(167,139,250,0.18)', amplitude: 14 },
  { icon: 'local-hospital',   size: 20, x: 0.16, y: 0.60, delay: 600,  duration: 3100, color: '#6EE7B7', bg: 'rgba(110,231,183,0.18)', amplitude: 16 },
  { icon: 'healing',          size: 18, x: 0.38, y: 0.87, delay: 400,  duration: 2700, color: '#FCD34D', bg: 'rgba(252,211,77,0.18)',  amplitude: 13 },
  { icon: 'favorite',         size: 16, x: 0.70, y: 0.92, delay: 850,  duration: 3300, color: '#F87171', bg: 'rgba(248,113,113,0.15)', amplitude: 11 },
];

function FloatingBubble({ config }: { config: BubbleConfig }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(config.delay, withTiming(1, { duration: 900 }));
    translateY.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(-config.amplitude, { duration: config.duration, easing: Easing.inOut(Easing.sin) }),
        -1, true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const box = config.size + 22;
  return (
    <Animated.View style={[style, {
      position: 'absolute',
      left: SW * config.x - box / 2,
      top: SH * config.y,
      width: box, height: box, borderRadius: box / 2,
      backgroundColor: config.bg,
      borderWidth: 1, borderColor: config.color + '35',
      justifyContent: 'center', alignItems: 'center',
    }]}>
      <MaterialIcons name={config.icon} size={config.size} color={config.color} />
    </Animated.View>
  );
}

// ─── Floating doctor / patient images ─────────────────────────────────────────
// Scattered across the full screen — hero AND behind the card
const PHOTO_CARDS = [
  // top-left area
  { uri: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=160&h=160&fit=crop&crop=face', x: 0.08, y: 0.06, rotate: '-8deg', delay: 350, size: 68 },
  // top-right
  { uri: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=160&h=160&fit=crop&crop=face', x: 0.82, y: 0.04, rotate: '10deg', delay: 600, size: 72 },
  // mid-left
  { uri: 'https://images.unsplash.com/photo-1584432810601-6c7f27d2362b?w=160&h=160&fit=crop&crop=face', x: 0.10, y: 0.34, rotate: '6deg', delay: 150, size: 64 },
  // mid-right
  { uri: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=160&h=160&fit=crop&crop=face', x: 0.86, y: 0.38, rotate: '-9deg', delay: 800, size: 70 },
  // lower-left
  { uri: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=160&h=160&fit=crop&crop=face', x: 0.07, y: 0.66, rotate: '7deg', delay: 450, size: 66 },
  // lower-right
  { uri: 'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=160&h=160&fit=crop&crop=face', x: 0.85, y: 0.70, rotate: '-6deg', delay: 250, size: 72 },
  // bottom-centre-left
  { uri: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=160&h=160&fit=crop&crop=face', x: 0.22, y: 0.80, rotate: '5deg', delay: 700, size: 62 },
  // bottom-centre-right
  { uri: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=160&h=160&fit=crop&crop=face', x: 0.74, y: 0.82, rotate: '-5deg', delay: 550, size: 66 },
];

function PhotoCard({ uri, x, y, rotate, delay, size }: typeof PHOTO_CARDS[0]) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 900 }));
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-12, { duration: 3600 + delay * 0.5, easing: Easing.inOut(Easing.sin) }),
        -1, true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { rotate }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[style, {
      position: 'absolute',
      left: SW * x - size / 2,
      top: SH * y,
      width: size, height: size, borderRadius: size * 0.26,
      shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 14, elevation: 12,
      borderWidth: 2, borderColor: 'rgba(99,102,241,0.45)',
      overflow: 'hidden',
    }]}>
      <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(67,56,202,0.4)']}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
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
    } catch (e: any) {
      setError(e.message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Full-screen background layers ── */}
      <LinearGradient colors={['#060612', '#0D0D2B', '#1A1040']} style={StyleSheet.absoluteFill} />

      {/* Grid lines spanning full screen */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: 9 }).map((_, i) => (
          <View key={`v${i}`} style={[styles.gridV, { left: (SW / 9) * i }]} />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={`h${i}`} style={[styles.gridH, { top: (SH / 12) * i }]} />
        ))}
      </View>

      {/* Glow orbs */}
      <View style={[styles.glow, { top: SH * 0.12 }]} pointerEvents="none" />
      <View style={[styles.glow, styles.glowBottom]} pointerEvents="none" />

      {/* Floating icon bubbles — full screen */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {BUBBLES.map((b, i) => <FloatingBubble key={i} config={b} />)}
      </View>

      {/* Doctor / patient photos — full screen */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {PHOTO_CARDS.map((p, i) => <PhotoCard key={i} {...p} />)}
      </View>

      {/* ── Form sheet ── */}
      <ScrollView
        contentContainerStyle={styles.sheet}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand at top */}
        <Animated.View entering={FadeInDown.delay(150).duration(600)} style={styles.heroLabel}>
          <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.logoBox}>
            <MaterialIcons name="favorite" size={28} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={styles.brandName}>Vitals Fusion</Text>
            <Text style={styles.brandTagline}>Your intelligent health companion</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).duration(550)} style={styles.card}>
          <View style={styles.cardHandle} />
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSub}>Sign in to your health dashboard</Text>

          {error ? (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={15} color="#FCA5A5" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputWrap}>
            <MaterialIcons name="email" size={18} color="rgba(255,255,255,0.3)" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputWrap}>
            <MaterialIcons name="lock" size={18} color="rgba(255,255,255,0.3)" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
              <MaterialIcons
                name={showPassword ? 'visibility-off' : 'visibility'}
                size={18}
                color="rgba(255,255,255,0.3)"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.87}>
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

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>New to Vitals Fusion?</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/register')} activeOpacity={0.8}>
            <MaterialIcons name="person-add" size={16} color="rgba(255,255,255,0.55)" />
            <Text style={styles.outlineBtnText}>Create account</Text>
          </TouchableOpacity>
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
    position: 'absolute', alignSelf: 'center',
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: '#3730A3', opacity: 0.13,
  },
  glowBottom: {
    top: undefined, bottom: 60, left: SW * 0.3,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: '#7C3AED', opacity: 0.10,
  },

  heroLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 32, marginTop: 8,
  },
  logoBox: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6366F1', shadowOpacity: 0.6, shadowRadius: 16, elevation: 8,
  },
  brandName: { fontSize: 22, fontWeight: '800', color: '#fff' },
  brandTagline: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  sheet: { flexGrow: 1, paddingHorizontal: 20, paddingTop: SH * 0.1, paddingBottom: 40 },
  card: {
    backgroundColor: 'rgba(10,10,35,0.97)',
    borderRadius: 28, borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.18)',
    padding: 26, gap: 16,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, elevation: 12,
  },
  cardHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'center', marginBottom: 4,
  },
  cardTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  cardSub: { fontSize: 14, color: 'rgba(255,255,255,0.36)', marginTop: -8 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 10, padding: 12,
  },
  errorText: { color: '#FCA5A5', fontSize: 13, flex: 1 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 14, height: 52, paddingHorizontal: 14, gap: 10,
  },
  inputIcon: { width: 20 },
  input: { flex: 1, color: '#fff', fontSize: 15 },
  eyeBtn: { padding: 4 },

  btn: {
    height: 54, borderRadius: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    shadowColor: '#6366F1', shadowOpacity: 0.45, shadowRadius: 14, elevation: 7,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  outlineBtn: {
    height: 50, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  outlineBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  dividerText: { fontSize: 12, color: 'rgba(255,255,255,0.28)' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 20 },
  footerText: { fontSize: 12, color: 'rgba(255,255,255,0.18)' },
});

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  Dimensions,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width } = Dimensions.get('window');
const CARD_W = (width - Spacing.lg * 2 - Spacing.md) / 2;

// ─── Categories ───────────────────────────────────────────────────────────────

type Category = { id: string; label: string; icon: string; color: string };
const CATEGORIES: Category[] = [
  { id: 'all',       label: 'All',         icon: '🏪', color: '#6C63FF' },
  { id: 'pain',      label: 'Pain Relief', icon: '💊', color: '#FF6B8A' },
  { id: 'heart',     label: 'Cardiac',     icon: '❤️', color: '#FF4757' },
  { id: 'vitamins',  label: 'Vitamins',    icon: '🌿', color: '#43E97B' },
  { id: 'diabetes',  label: 'Diabetes',    icon: '🩸', color: '#FA709A' },
  { id: 'cold',      label: 'Cold & Flu',  icon: '🤧', color: '#4FACFE' },
  { id: 'digestive', label: 'Digestive',   icon: '🫙', color: '#FAAD14' },
  { id: 'devices',   label: 'Devices',     icon: '🩺', color: '#A55EEA' },
];

// ─── Products (images from open Wikimedia / public CDN URLs) ─────────────────

type Product = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  unit: string;
  rating: number;
  reviews: number;
  badge?: string;
  badgeColor?: string;
  description: string;
  image: string;
  gradient: [string, string];
};

const PRODUCTS: Product[] = [
  // ── Pain Relief ──────────────────────────────────────────────────────────
  {
    id: 'p1', name: 'Paracetamol 500mg', brand: 'PharmaCare', category: 'pain',
    price: 4.99, unit: '24 tablets', rating: 4.8, reviews: 2341,
    badge: 'Best Seller', badgeColor: '#FF6B8A',
    description: 'Fast-acting paracetamol for headaches, fever and mild pain relief. Suitable for adults and children over 12.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Paracetamol-tablets.jpg/320px-Paracetamol-tablets.jpg',
    gradient: ['#FF6B8A', '#FF4757'],
  },
  {
    id: 'p2', name: 'Ibuprofen 400mg', brand: 'Nurofen+', category: 'pain',
    price: 6.49, unit: '16 tablets', rating: 4.7, reviews: 1892,
    badge: 'Popular', badgeColor: '#FA709A',
    description: 'Anti-inflammatory ibuprofen for muscle pain, joint pain, period pain and fever.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Ibuprofen_200mg_Tablets.jpg/320px-Ibuprofen_200mg_Tablets.jpg',
    gradient: ['#FA709A', '#FEE140'],
  },
  {
    id: 'p3', name: 'Aspirin 300mg', brand: 'Bayer', category: 'pain',
    price: 3.99, unit: '32 tablets', rating: 4.5, reviews: 987,
    description: 'Classic aspirin tablet for pain, inflammation and fever.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Aspirin-Bayer.jpg/320px-Aspirin-Bayer.jpg',
    gradient: ['#a18cd1', '#fbc2eb'],
  },
  // ── Cardiac ──────────────────────────────────────────────────────────────
  {
    id: 'h1', name: 'Amlodipine 5mg', brand: 'Pfizer', category: 'heart',
    price: 12.99, unit: '30 tablets', rating: 4.9, reviews: 543,
    badge: 'Rx Grade', badgeColor: '#FF4757',
    description: 'Calcium channel blocker for managing high blood pressure and angina.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Amlodipine_tablets.jpg/320px-Amlodipine_tablets.jpg',
    gradient: ['#FF4757', '#C0392B'],
  },
  {
    id: 'h2', name: 'Omega-3 1000mg', brand: 'OceanHealth', category: 'heart',
    price: 15.49, unit: '60 softgels', rating: 4.6, reviews: 1204,
    badge: 'Heart Health', badgeColor: '#FF6B8A',
    description: 'High-potency fish oil softgels for cardiovascular and brain health support.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Omega-3-Capsules.jpg/320px-Omega-3-Capsules.jpg',
    gradient: ['#4FACFE', '#00F2FE'],
  },
  // ── Vitamins ─────────────────────────────────────────────────────────────
  {
    id: 'v1', name: 'Vitamin D3 1000IU', brand: 'SunHealth', category: 'vitamins',
    price: 8.99, unit: '90 tablets', rating: 4.8, reviews: 3201,
    badge: 'Top Rated', badgeColor: '#43E97B',
    description: 'Essential vitamin D3 for bone health, immune function and mood support.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Vitamin_D_supplement_tablets.jpg/320px-Vitamin_D_supplement_tablets.jpg',
    gradient: ['#FEE140', '#FA709A'],
  },
  {
    id: 'v2', name: 'Vitamin C 1000mg', brand: 'NatureWise', category: 'vitamins',
    price: 7.49, unit: '60 tablets', rating: 4.7, reviews: 2876,
    description: 'High-strength vitamin C antioxidant for immune support and skin health.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Ascorbic_acid_tablets.jpg/320px-Ascorbic_acid_tablets.jpg',
    gradient: ['#f7971e', '#ffd200'],
  },
  {
    id: 'v3', name: 'Senior Multivitamin', brand: 'Centrum Silver', category: 'vitamins',
    price: 18.99, unit: '100 tablets', rating: 4.6, reviews: 1543,
    badge: 'Senior Formula', badgeColor: '#6C63FF',
    description: 'Complete daily multivitamin formulated specifically for adults over 50.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Vitamin_pills.jpg/320px-Vitamin_pills.jpg',
    gradient: ['#43E97B', '#38F9D7'],
  },
  // ── Diabetes ─────────────────────────────────────────────────────────────
  {
    id: 'd1', name: 'Metformin 500mg', brand: 'Glucophage', category: 'diabetes',
    price: 9.99, unit: '60 tablets', rating: 4.7, reviews: 721,
    badge: 'Rx Grade', badgeColor: '#FF4757',
    description: 'Oral diabetes medication that helps control blood sugar levels in type 2 diabetes.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Metformin_tablets.jpg/320px-Metformin_tablets.jpg',
    gradient: ['#FA709A', '#C0392B'],
  },
  {
    id: 'd2', name: 'Blood Glucose Monitor', brand: 'Accu-Chek', category: 'diabetes',
    price: 34.99, unit: 'Device + strips', rating: 4.9, reviews: 892,
    badge: 'Device', badgeColor: '#A55EEA',
    description: 'Accurate blood glucose monitoring system with large display and 500-reading memory.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Accu-chek_compact_plus_glucometer.jpg/320px-Accu-chek_compact_plus_glucometer.jpg',
    gradient: ['#A55EEA', '#6C63FF'],
  },
  // ── Cold & Flu ───────────────────────────────────────────────────────────
  {
    id: 'c1', name: 'Loratadine 10mg', brand: 'Claritin', category: 'cold',
    price: 11.99, unit: '30 tablets', rating: 4.6, reviews: 1673,
    badge: 'Non-Drowsy', badgeColor: '#4FACFE',
    description: '24-hour non-drowsy antihistamine for hay fever, allergies and hives.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Claritin_tablets.jpg/320px-Claritin_tablets.jpg',
    gradient: ['#4FACFE', '#00F2FE'],
  },
  {
    id: 'c2', name: 'Cold & Flu Relief', brand: 'Lemsip Max', category: 'cold',
    price: 8.49, unit: '10 sachets', rating: 4.4, reviews: 987,
    description: 'Multi-symptom hot drink for fast relief from cold and flu symptoms.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Lemsip_Max_sachets.jpg/320px-Lemsip_Max_sachets.jpg',
    gradient: ['#2C3E50', '#4A90E2'],
  },
  // ── Digestive ────────────────────────────────────────────────────────────
  {
    id: 'g1', name: 'Omeprazole 20mg', brand: 'Prilosec', category: 'digestive',
    price: 13.99, unit: '28 capsules', rating: 4.8, reviews: 2109,
    badge: 'Best Value', badgeColor: '#FAAD14',
    description: 'Proton pump inhibitor for heartburn, acid reflux and stomach ulcers.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Omeprazole_capsules.jpg/320px-Omeprazole_capsules.jpg',
    gradient: ['#FAAD14', '#f39c12'],
  },
  {
    id: 'g2', name: 'Probiotic Complex', brand: 'BioKult', category: 'digestive',
    price: 22.99, unit: '60 capsules', rating: 4.7, reviews: 1432,
    description: '14-strain live bacteria probiotic for gut health, digestion and immunity.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Probiotic_capsules.jpg/320px-Probiotic_capsules.jpg',
    gradient: ['#43E97B', '#38F9D7'],
  },
  // ── Devices ──────────────────────────────────────────────────────────────
  {
    id: 'dv1', name: 'Blood Pressure Monitor', brand: 'Omron M3', category: 'devices',
    price: 49.99, unit: 'Device', rating: 4.9, reviews: 3421,
    badge: 'Best Seller', badgeColor: '#A55EEA',
    description: 'Clinically validated upper-arm blood pressure monitor with irregular heartbeat detection.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Omron_blood_pressure_monitor.jpg/320px-Omron_blood_pressure_monitor.jpg',
    gradient: ['#A55EEA', '#6C63FF'],
  },
  {
    id: 'dv2', name: 'Pulse Oximeter', brand: 'ChoiceMMed', category: 'devices',
    price: 24.99, unit: 'Device', rating: 4.8, reviews: 2156,
    badge: 'Popular', badgeColor: '#4FACFE',
    description: 'Fingertip SpO2 and pulse rate monitor with colour LED display and lanyard.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Pulse_oximeter_fingertip.jpg/320px-Pulse_oximeter_fingertip.jpg',
    gradient: ['#4FACFE', '#00F2FE'],
  },
];

// Fallback gradient thumbnails when image fails to load
const FALLBACK_COLORS: Record<string, [string, string]> = {
  pain: ['#FF6B8A', '#FF4757'],
  heart: ['#FF4757', '#C0392B'],
  vitamins: ['#43E97B', '#38F9D7'],
  diabetes: ['#FA709A', '#C0392B'],
  cold: ['#4FACFE', '#00F2FE'],
  digestive: ['#FAAD14', '#f39c12'],
  devices: ['#A55EEA', '#6C63FF'],
};

const PHARMACIES = [
  { id: 'ph1', name: 'MediPlus Pharmacy',  distance: '0.3 km', open: true,  rating: 4.9, icon: '🏥', color: '#FF6B8A' },
  { id: 'ph2', name: 'CareFirst Chemist',  distance: '0.7 km', open: true,  rating: 4.7, icon: '💊', color: '#43E97B' },
  { id: 'ph3', name: 'HealthHub Store',    distance: '1.2 km', open: false, rating: 4.5, icon: '🏪', color: '#6C63FF' },
  { id: 'ph4', name: 'Sunrise Pharmacy',   distance: '1.8 km', open: true,  rating: 4.8, icon: '☀️', color: '#FAAD14' },
];

// ─── Product Image component with fallback ────────────────────────────────────

function ProductImage({ uri, gradient, style }: { uri: string; gradient: [string, string]; style: any }) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  if (failed) {
    return (
      <LinearGradient colors={gradient} style={style} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
    );
  }
  return (
    <View style={style}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoad={() => setLoading(false)}
        onError={() => { setFailed(true); setLoading(false); }}
      />
      {loading && (
        <LinearGradient colors={gradient} style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />
        </LinearGradient>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PharmacyScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filtered = useMemo(() => PRODUCTS.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                        p.brand.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [activeCategory, search]);

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = PRODUCTS.find(x => x.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);

  const addToCart = (id: string) => setCart(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  const removeFromCart = (id: string) => setCart(prev => {
    const next = { ...prev };
    if ((next[id] ?? 0) > 1) next[id]--;
    else delete next[id];
    return next;
  });

  const handleCheckout = () => Alert.alert(
    'Order Placed! 🎉',
    `${cartCount} item(s) — £${cartTotal.toFixed(2)}\nYour pharmacy will prepare your order shortly.`,
    [{ text: 'OK', onPress: () => setCart({}) }]
  );

  const bgGrad: [string, string] = isDark ? ['#0A0E1A', '#0F1729'] : ['#F0F4FF', '#F8FAFF'];

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <LinearGradient colors={bgGrad} style={StyleSheet.absoluteFill} />

      {/* ── Cart FAB ──────────────────────────────────────────── */}
      {cartCount > 0 && (
        <TouchableOpacity style={styles.cartFab} onPress={handleCheckout} activeOpacity={0.85}>
          <LinearGradient colors={['#6C63FF', '#A55EEA']} style={styles.cartFabInner}>
            <Text style={styles.cartFabIcon}>🛒</Text>
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          </LinearGradient>
          <View style={[styles.cartFabLabel, { backgroundColor: '#6C63FF' }]}>
            <Text style={styles.cartFabLabelText}>£{cartTotal.toFixed(2)} — Checkout</Text>
          </View>
        </TouchableOpacity>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: Platform.OS === 'ios' ? 60 : 48 }]}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* ── Hero ──────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.heroWrap}>
          <LinearGradient colors={['#6C63FF', '#A55EEA']} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.heroContent}>
              <Text style={styles.heroTag}>💊 Vitals Pharmacy</Text>
              <Text style={styles.heroTitle}>Your Health{'\n'}Store</Text>
              <Text style={styles.heroSub}>Medicines, devices & more{'\n'}delivered to your door</Text>
            </View>
            <View style={styles.heroDeco}>
              {['💊','🩺','🌿','🔬','❤️','⚕️'].map((e, i) => (
                <Text key={i} style={{ fontSize: 24 + i * 4, opacity: 0.15 + i * 0.04 }}>{e}</Text>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Sticky search ─────────────────────────────────── */}
        <View style={[styles.searchWrap, { backgroundColor: isDark ? '#0A0E1A' : '#F0F4FF' }]}>
          <View style={[styles.searchBar, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(108,99,255,0.2)' }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: themeColors.text }]}
              placeholder="Search medicines, brands..."
              placeholderTextColor={themeColors.muted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={{ color: themeColors.muted, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Nearby pharmacies ─────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(450)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Nearby Pharmacies</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pharmacyRow}>
            {PHARMACIES.map((ph, i) => (
              <Animated.View key={ph.id} entering={ZoomIn.delay(150 + i * 60).duration(350)}>
                <TouchableOpacity style={[styles.pharmacyCard, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.07)' : ph.color + '30' }]} activeOpacity={0.8}>
                  <View style={[styles.pharmacyIconWrap, { backgroundColor: ph.color + '18' }]}>
                    <Text style={styles.pharmacyIcon}>{ph.icon}</Text>
                  </View>
                  <Text style={[styles.pharmacyName, { color: themeColors.text }]} numberOfLines={1}>{ph.name}</Text>
                  <Text style={[styles.pharmacyDist, { color: themeColors.muted }]}>{ph.distance}</Text>
                  <View style={styles.pharmacyFooter}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: ph.open ? '#43E97B22' : '#FF475722' }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: ph.open ? '#43E97B' : '#FF4757' }}>{ph.open ? 'Open' : 'Closed'}</Text>
                    </View>
                    <Text style={[{ fontSize: 11 }, { color: themeColors.muted }]}>⭐ {ph.rating}</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </ScrollView>
        </Animated.View>

        {/* ── Categories ────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).duration(450)} style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            {CATEGORIES.map(cat => {
              const active = activeCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catChip, active ? { backgroundColor: cat.color } : { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : cat.color + '30' }]}
                  onPress={() => setActiveCategory(cat.id)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.catIcon}>{cat.icon}</Text>
                  <Text style={[styles.catLabel, { color: active ? '#fff' : themeColors.muted }]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ── Products grid ─────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(250).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            {activeCategory === 'all' ? 'All Products' : CATEGORIES.find(c => c.id === activeCategory)?.label}
            {'  '}
            <Text style={{ color: themeColors.muted, fontWeight: '500', fontSize: 14 }}>{filtered.length} items</Text>
          </Text>

          <View style={styles.productsGrid}>
            {filtered.map((product, i) => {
              const qty = cart[product.id] ?? 0;
              return (
                <Animated.View key={product.id} entering={ZoomIn.delay(300 + i * 40).duration(350)}>
                  <TouchableOpacity
                    style={[styles.productCard, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}
                    onPress={() => setSelectedProduct(product)}
                    activeOpacity={0.85}
                  >
                    {/* Product image */}
                    <View style={styles.productImageWrap}>
                      <ProductImage uri={product.image} gradient={product.gradient} style={styles.productImage} />
                      {product.badge && (
                        <View style={[styles.productBadge, { backgroundColor: product.badgeColor ?? '#6C63FF' }]}>
                          <Text style={styles.productBadgeText}>{product.badge}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.productBody}>
                      <Text style={[styles.productBrand, { color: themeColors.muted }]}>{product.brand}</Text>
                      <Text style={[styles.productName, { color: themeColors.text }]} numberOfLines={2}>{product.name}</Text>
                      <Text style={[styles.productUnit, { color: themeColors.muted }]}>{product.unit}</Text>
                      <View style={styles.productRatingRow}>
                        <Text style={styles.starText}>⭐</Text>
                        <Text style={[styles.productRatingText, { color: themeColors.muted }]}>{product.rating} ({product.reviews.toLocaleString()})</Text>
                      </View>
                      <View style={styles.productFooter}>
                        <Text style={[styles.productPrice, { color: themeColors.tint }]}>£{product.price.toFixed(2)}</Text>
                        {qty === 0 ? (
                          <TouchableOpacity style={[styles.addBtn, { backgroundColor: themeColors.tint }]} onPress={() => addToCart(product.id)}>
                            <Text style={styles.addBtnText}>+ Add</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.qtyRow}>
                            <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: themeColors.tint + '20' }]} onPress={() => removeFromCart(product.id)}>
                              <Text style={[styles.qtyBtnText, { color: themeColors.tint }]}>−</Text>
                            </TouchableOpacity>
                            <Text style={[styles.qtyCount, { color: themeColors.text }]}>{qty}</Text>
                            <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: themeColors.tint }]} onPress={() => addToCart(product.id)}>
                              <Text style={[styles.qtyBtnText, { color: '#fff' }]}>+</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        <View style={{ height: cartCount > 0 ? 110 : 32 }} />
      </ScrollView>

      {/* ── Product Detail Modal ───────────────────────────── */}
      <Modal visible={!!selectedProduct} animationType="slide" transparent onRequestClose={() => setSelectedProduct(null)}>
        {selectedProduct && (
          <View style={styles.modalBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSelectedProduct(null)} />
            <Animated.View entering={FadeInUp.duration(300)} style={[styles.modalSheet, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
              {/* Large product image */}
              <View style={styles.modalImageWrap}>
                <ProductImage uri={selectedProduct.image} gradient={selectedProduct.gradient} style={styles.modalImage} />
                <LinearGradient colors={['transparent', isDark ? '#1E293B' : '#fff']} style={styles.modalImageFade} />
                <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedProduct(null)}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                {selectedProduct.badge && (
                  <View style={[styles.productBadge, { backgroundColor: selectedProduct.badgeColor ?? '#6C63FF', alignSelf: 'flex-start', marginBottom: 8 }]}>
                    <Text style={styles.productBadgeText}>{selectedProduct.badge}</Text>
                  </View>
                )}
                <Text style={[styles.modalBrand, { color: themeColors.muted }]}>{selectedProduct.brand}</Text>
                <Text style={[styles.modalName, { color: themeColors.text }]}>{selectedProduct.name}</Text>
                <Text style={[styles.productUnit, { color: themeColors.muted, marginBottom: 8 }]}>{selectedProduct.unit}</Text>
                <View style={[styles.productRatingRow, { marginBottom: 12 }]}>
                  <Text style={styles.starText}>⭐</Text>
                  <Text style={[styles.productRatingText, { color: themeColors.muted, marginLeft: 4 }]}>
                    {selectedProduct.rating} · {selectedProduct.reviews.toLocaleString()} reviews
                  </Text>
                </View>
                <Text style={[styles.modalDesc, { color: themeColors.muted }]}>{selectedProduct.description}</Text>
                <View style={styles.modalFooter}>
                  <Text style={[styles.modalPrice, { color: themeColors.tint }]}>£{selectedProduct.price.toFixed(2)}</Text>
                  {(cart[selectedProduct.id] ?? 0) === 0 ? (
                    <TouchableOpacity
                      style={[styles.modalAddBtn, { backgroundColor: themeColors.tint }]}
                      onPress={() => { addToCart(selectedProduct.id); setSelectedProduct(null); }}
                    >
                      <Text style={styles.modalAddBtnText}>Add to Cart 🛒</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.qtyRow}>
                      <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: themeColors.tint + '20' }]} onPress={() => removeFromCart(selectedProduct.id)}>
                        <Text style={[styles.qtyBtnText, { color: themeColors.tint }]}>−</Text>
                      </TouchableOpacity>
                      <Text style={[styles.qtyCount, { color: themeColors.text }]}>{cart[selectedProduct.id]}</Text>
                      <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: themeColors.tint }]} onPress={() => addToCart(selectedProduct.id)}>
                        <Text style={[styles.qtyBtnText, { color: '#fff' }]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </Animated.View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 16 },

  // Hero
  heroWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  hero: { borderRadius: 24, padding: Spacing.lg, minHeight: 160, overflow: 'hidden', flexDirection: 'row', justifyContent: 'space-between' },
  heroContent: { flex: 1 },
  heroTag: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  heroTitle: { color: '#fff', fontSize: 30, fontWeight: '900', lineHeight: 34, marginBottom: 6 },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 19 },
  heroDeco: { flexDirection: 'column', gap: 4, justifyContent: 'center' },

  // Search (sticky)
  searchWrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15 },

  // Section
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: Spacing.md, paddingHorizontal: Spacing.lg },

  // Pharmacies
  pharmacyRow: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  pharmacyCard: { width: 140, borderRadius: 18, borderWidth: 1, padding: 14, ...Shadows.light },
  pharmacyIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  pharmacyIcon: { fontSize: 22 },
  pharmacyName: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  pharmacyDist: { fontSize: 12, marginBottom: 8 },
  pharmacyFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Categories
  catRow: { paddingHorizontal: Spacing.lg, gap: 10 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
  catIcon: { fontSize: 15 },
  catLabel: { fontSize: 13, fontWeight: '600' },

  // Products
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingHorizontal: Spacing.lg },
  productCard: { width: CARD_W, borderRadius: 18, borderWidth: 1, overflow: 'hidden', ...Shadows.light },
  productImageWrap: { height: 110, position: 'relative' },
  productImage: { width: '100%', height: '100%', borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  productBadge: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99 },
  productBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  productBody: { padding: 12, gap: 3 },
  productBrand: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  productName: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  productUnit: { fontSize: 11 },
  productRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  starText: { fontSize: 11 },
  productRatingText: { fontSize: 11 },
  productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  productPrice: { fontSize: 16, fontWeight: '900' },
  addBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 18, fontWeight: '700', lineHeight: 22 },
  qtyCount: { fontSize: 14, fontWeight: '800', minWidth: 20, textAlign: 'center' },

  // Cart FAB
  cartFab: { position: 'absolute', bottom: 90, left: Spacing.lg, right: Spacing.lg, zIndex: 100, flexDirection: 'row', alignItems: 'center', borderRadius: 18, overflow: 'hidden', ...Shadows.medium },
  cartFabInner: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  cartFabIcon: { fontSize: 24 },
  cartBadge: { position: 'absolute', top: 8, right: 6, backgroundColor: '#FF4757', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  cartFabLabel: { flex: 1, height: 56, justifyContent: 'center', alignItems: 'center' },
  cartFabLabelText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', ...Shadows.medium },
  modalImageWrap: { height: 200, position: 'relative' },
  modalImage: { width: '100%', height: '100%' },
  modalImageFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
  modalClose: { position: 'absolute', top: 16, right: 16, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  modalBody: { padding: Spacing.lg },
  modalBrand: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  modalName: { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  modalDesc: { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalPrice: { fontSize: 26, fontWeight: '900' },
  modalAddBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  modalAddBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

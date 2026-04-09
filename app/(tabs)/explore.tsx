import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Dimensions,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width } = Dimensions.get('window');
const CARD_W = (width - Spacing.lg * 2 - Spacing.md) / 2;

// ─── Data ─────────────────────────────────────────────────────────────────────

type Category = { id: string; label: string; icon: string; color: string };
const CATEGORIES: Category[] = [
  { id: 'all',        label: 'All',          icon: '🏪', color: '#6C63FF' },
  { id: 'pain',       label: 'Pain Relief',  icon: '💊', color: '#FF6B8A' },
  { id: 'heart',      label: 'Cardiac',      icon: '❤️', color: '#FF4757' },
  { id: 'vitamins',   label: 'Vitamins',     icon: '🌿', color: '#43E97B' },
  { id: 'diabetes',   label: 'Diabetes',     icon: '🩸', color: '#FA709A' },
  { id: 'cold',       label: 'Cold & Flu',   icon: '🤧', color: '#4FACFE' },
  { id: 'digestive',  label: 'Digestive',    icon: '🫙', color: '#FAAD14' },
  { id: 'devices',    label: 'Devices',      icon: '🩺', color: '#A55EEA' },
];

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
  icon: string;
  gradient: [string, string];
};

const PRODUCTS: Product[] = [
  // Pain
  { id: 'p1',  name: 'Paracetamol 500mg', brand: 'PharmaCare',    category: 'pain',     price: 4.99,  unit: '24 tablets', rating: 4.8, reviews: 2341, badge: 'Best Seller', badgeColor: '#FF6B8A', description: 'Fast-acting paracetamol for headaches, fever and mild pain relief.', icon: '💊', gradient: ['#FF6B8A','#FF4757'] },
  { id: 'p2',  name: 'Ibuprofen 400mg',   brand: 'Nurofen+',      category: 'pain',     price: 6.49,  unit: '16 tablets', rating: 4.7, reviews: 1892, badge: 'Popular',     badgeColor: '#FA709A', description: 'Anti-inflammatory for muscle pain, joint pain and fever.', icon: '🔴', gradient: ['#FA709A','#FEE140'] },
  { id: 'p3',  name: 'Aspirin 300mg',     brand: 'Bayer',          category: 'pain',     price: 3.99,  unit: '32 tablets', rating: 4.5, reviews: 987,  description: 'Classic aspirin for pain and inflammation.', icon: '⚪', gradient: ['#a18cd1','#fbc2eb'] },
  // Cardiac
  { id: 'h1',  name: 'Amlodipine 5mg',    brand: 'Pfizer',         category: 'heart',    price: 12.99, unit: '30 tablets', rating: 4.9, reviews: 543,  badge: 'Rx Grade',    badgeColor: '#FF4757', description: 'Calcium channel blocker for high blood pressure management.', icon: '❤️', gradient: ['#FF4757','#C0392B'] },
  { id: 'h2',  name: 'Omega-3 1000mg',    brand: 'OceanHealth',    category: 'heart',    price: 15.49, unit: '60 softgels', rating: 4.6, reviews: 1204, badge: 'Heart Health', badgeColor: '#FF6B8A', description: 'High-potency fish oil for cardiovascular and brain health.', icon: '🐟', gradient: ['#4FACFE','#00F2FE'] },
  // Vitamins
  { id: 'v1',  name: 'Vitamin D3 1000IU', brand: 'SunHealth',      category: 'vitamins', price: 8.99,  unit: '90 tablets', rating: 4.8, reviews: 3201, badge: 'Top Rated',   badgeColor: '#43E97B', description: 'Essential vitamin D for bone health and immune support.', icon: '☀️', gradient: ['#FEE140','#FA709A'] },
  { id: 'v2',  name: 'Vitamin C 1000mg',  brand: 'NatureWise',     category: 'vitamins', price: 7.49,  unit: '60 tablets', rating: 4.7, reviews: 2876, description: 'Antioxidant support and immune system booster.', icon: '🍊', gradient: ['#f7971e','#ffd200'] },
  { id: 'v3',  name: 'Multivitamin',      brand: 'Centrum Silver', category: 'vitamins', price: 18.99, unit: '100 tablets', rating: 4.6, reviews: 1543, badge: 'Senior Formula', badgeColor: '#6C63FF', description: 'Complete daily multivitamin formulated for adults 50+.', icon: '🌈', gradient: ['#43E97B','#38F9D7'] },
  // Diabetes
  { id: 'd1',  name: 'Metformin 500mg',   brand: 'Glucophage',     category: 'diabetes', price: 9.99,  unit: '60 tablets', rating: 4.7, reviews: 721,  badge: 'Rx Grade',    badgeColor: '#FF4757', description: 'Oral diabetes medication to control blood sugar levels.', icon: '🩸', gradient: ['#FA709A','#C0392B'] },
  { id: 'd2',  name: 'Glucose Monitor',   brand: 'Accu-Chek',      category: 'diabetes', price: 34.99, unit: 'Device',     rating: 4.9, reviews: 892,  badge: 'Device',      badgeColor: '#A55EEA', description: 'Accurate blood glucose monitoring system with memory.', icon: '📟', gradient: ['#A55EEA','#6C63FF'] },
  // Cold & Flu
  { id: 'c1',  name: 'Loratadine 10mg',   brand: 'Claritin',       category: 'cold',     price: 11.99, unit: '30 tablets', rating: 4.6, reviews: 1673, badge: 'Non-Drowsy',  badgeColor: '#4FACFE', description: '24-hour non-drowsy antihistamine for allergy relief.', icon: '🤧', gradient: ['#4FACFE','#00F2FE'] },
  { id: 'c2',  name: 'Night Nurse',       brand: 'GlaxoSmith',     category: 'cold',     price: 8.49,  unit: '180ml syrup', rating: 4.4, reviews: 987,  description: 'Multi-symptom night-time cold and flu relief.', icon: '🌙', gradient: ['#2C3E50','#4A90E2'] },
  // Digestive
  { id: 'g1',  name: 'Omeprazole 20mg',   brand: 'Prilosec',       category: 'digestive',price: 13.99, unit: '28 capsules', rating: 4.8, reviews: 2109, badge: 'Best Value',  badgeColor: '#FAAD14', description: 'Proton pump inhibitor for heartburn and acid reflux.', icon: '🫙', gradient: ['#FAAD14','#f39c12'] },
  { id: 'g2',  name: 'Probiotic Complex', brand: 'BioKult',        category: 'digestive',price: 22.99, unit: '60 capsules', rating: 4.7, reviews: 1432, description: '14-strain probiotic for gut health and immunity.', icon: '🦠', gradient: ['#43E97B','#38F9D7'] },
  // Devices
  { id: 'dv1', name: 'Blood Pressure Kit',brand: 'Omron',          category: 'devices',  price: 49.99, unit: 'Device',     rating: 4.9, reviews: 3421, badge: 'Best Seller', badgeColor: '#A55EEA', description: 'Clinically validated upper-arm blood pressure monitor.', icon: '🩺', gradient: ['#A55EEA','#6C63FF'] },
  { id: 'dv2', name: 'Pulse Oximeter',    brand: 'ChoiceMMed',     category: 'devices',  price: 24.99, unit: 'Device',     rating: 4.8, reviews: 2156, badge: 'Popular',     badgeColor: '#4FACFE', description: 'Fingertip SpO2 and pulse rate monitor with LED display.', icon: '💡', gradient: ['#4FACFE','#00F2FE'] },
];

const PHARMACIES = [
  { id: 'ph1', name: 'MediPlus Pharmacy',   distance: '0.3 km', open: true,  rating: 4.9, icon: '🏥', color: '#FF6B8A' },
  { id: 'ph2', name: 'CareFirst Chemist',   distance: '0.7 km', open: true,  rating: 4.7, icon: '💊', color: '#43E97B' },
  { id: 'ph3', name: 'HealthHub Store',     distance: '1.2 km', open: false, rating: 4.5, icon: '🏪', color: '#6C63FF' },
  { id: 'ph4', name: 'Sunrise Pharmacy',    distance: '1.8 km', open: true,  rating: 4.8, icon: '☀️', color: '#FAAD14' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PharmacyScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    return PRODUCTS.filter(p => {
      const matchCat = activeCategory === 'all' || p.category === activeCategory;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.brand.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, search]);

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

  const handleCheckout = () => {
    Alert.alert('Order Placed! 🎉', `${cartCount} item(s) — £${cartTotal.toFixed(2)}\nYour pharmacy will prepare your order shortly.`, [
      { text: 'OK', onPress: () => setCart({}) }
    ]);
  };

  const bgGrad: [string, string] = isDark ? ['#0A0E1A', '#0F1729'] : ['#F0F4FF', '#F8FAFF'];

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <LinearGradient colors={bgGrad} style={StyleSheet.absoluteFill} />

      {/* ── Cart FAB ──────────────────────────────────────────────── */}
      {cartCount > 0 && (
        <TouchableOpacity style={styles.cartFab} onPress={handleCheckout} activeOpacity={0.85}>
          <LinearGradient colors={['#6C63FF', '#A55EEA']} style={styles.cartFabInner}>
            <Text style={styles.cartFabIcon}>🛒</Text>
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          </LinearGradient>
          <Text style={styles.cartFabLabel}>£{cartTotal.toFixed(2)} — Checkout</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: Platform.OS === 'ios' ? 60 : 48 }]}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* ── Hero header ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <LinearGradient colors={isDark ? ['#1E293B','#0F172A'] : ['#6C63FF','#A55EEA']} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.heroContent}>
              <Text style={styles.heroTag}>💊 Vitals Pharmacy</Text>
              <Text style={styles.heroTitle}>Your Health{'\n'}Store</Text>
              <Text style={styles.heroSub}>Medicines, devices & more{'\n'}delivered to your door</Text>
            </View>
            <View style={styles.heroDecoGrid}>
              {['💊','🩺','🌿','🔬','❤️','⚕️'].map((e, i) => (
                <Text key={i} style={[styles.heroDecoItem, { opacity: 0.15 + i * 0.05, fontSize: 28 + i * 4 }]}>{e}</Text>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Search bar (sticky) ──────────────────────────────────── */}
        <View style={[styles.searchWrap, { backgroundColor: isDark ? '#0A0E1A' : '#F0F4FF' }]}>
          <View style={[styles.searchBar, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(108,99,255,0.15)' }]}>
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

        {/* ── Nearby pharmacies ───────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(450)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Nearby Pharmacies</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pharmacyRow}>
            {PHARMACIES.map((ph, i) => (
              <Animated.View key={ph.id} entering={ZoomIn.delay(150 + i * 60).duration(350)}>
                <TouchableOpacity
                  style={[styles.pharmacyCard, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.07)' : ph.color + '30' }]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.pharmacyIconWrap, { backgroundColor: ph.color + '18' }]}>
                    <Text style={styles.pharmacyIcon}>{ph.icon}</Text>
                  </View>
                  <Text style={[styles.pharmacyName, { color: themeColors.text }]} numberOfLines={1}>{ph.name}</Text>
                  <Text style={[styles.pharmacyDist, { color: themeColors.muted }]}>{ph.distance}</Text>
                  <View style={styles.pharmacyFooter}>
                    <View style={[styles.pharmacyStatus, { backgroundColor: ph.open ? '#43E97B22' : '#FF475722' }]}>
                      <Text style={[styles.pharmacyStatusText, { color: ph.open ? '#43E97B' : '#FF4757' }]}>
                        {ph.open ? 'Open' : 'Closed'}
                      </Text>
                    </View>
                    <Text style={[styles.pharmacyRating, { color: themeColors.muted }]}>⭐ {ph.rating}</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </ScrollView>
        </Animated.View>

        {/* ── Categories ──────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).duration(450)} style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            {CATEGORIES.map((cat, i) => {
              const active = activeCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catChip, active && { backgroundColor: cat.color }, !active && { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : cat.color + '30' }]}
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

        {/* ── Products grid ───────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(250).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            {activeCategory === 'all' ? 'All Products' : CATEGORIES.find(c => c.id === activeCategory)?.label}
            <Text style={{ color: themeColors.muted, fontWeight: '500', fontSize: 14 }}>  {filtered.length} items</Text>
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
                    {/* Gradient top */}
                    <LinearGradient colors={product.gradient} style={styles.productGradTop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <Text style={styles.productEmoji}>{product.icon}</Text>
                      {product.badge && (
                        <View style={[styles.productBadge, { backgroundColor: product.badgeColor ?? '#6C63FF' }]}>
                          <Text style={styles.productBadgeText}>{product.badge}</Text>
                        </View>
                      )}
                    </LinearGradient>

                    <View style={styles.productBody}>
                      <Text style={[styles.productBrand, { color: themeColors.muted }]}>{product.brand}</Text>
                      <Text style={[styles.productName, { color: themeColors.text }]} numberOfLines={2}>{product.name}</Text>
                      <Text style={[styles.productUnit, { color: themeColors.muted }]}>{product.unit}</Text>

                      <View style={styles.productRating}>
                        <Text style={styles.productStar}>⭐</Text>
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

        <View style={{ height: cartCount > 0 ? 100 : 32 }} />
      </ScrollView>

      {/* ── Product Detail Modal ─────────────────────────────────── */}
      <Modal visible={!!selectedProduct} animationType="slide" transparent onRequestClose={() => setSelectedProduct(null)}>
        {selectedProduct && (
          <View style={styles.modalBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSelectedProduct(null)} />
            <Animated.View entering={FadeInUp.duration(300)} style={[styles.modalSheet, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
              <LinearGradient colors={selectedProduct.gradient} style={styles.modalGradTop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={styles.modalEmoji}>{selectedProduct.icon}</Text>
                <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedProduct(null)}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </LinearGradient>

              <View style={styles.modalBody}>
                {selectedProduct.badge && (
                  <View style={[styles.productBadge, { backgroundColor: selectedProduct.badgeColor ?? '#6C63FF', alignSelf: 'flex-start', marginBottom: 8 }]}>
                    <Text style={styles.productBadgeText}>{selectedProduct.badge}</Text>
                  </View>
                )}
                <Text style={[styles.modalBrand, { color: themeColors.muted }]}>{selectedProduct.brand}</Text>
                <Text style={[styles.modalName, { color: themeColors.text }]}>{selectedProduct.name}</Text>
                <Text style={[styles.modalUnit, { color: themeColors.muted }]}>{selectedProduct.unit}</Text>

                <View style={styles.modalRatingRow}>
                  <Text style={styles.productStar}>⭐</Text>
                  <Text style={[styles.productRatingText, { color: themeColors.muted, marginLeft: 4 }]}>{selectedProduct.rating} · {selectedProduct.reviews.toLocaleString()} reviews</Text>
                </View>

                <Text style={[styles.modalDesc, { color: themeColors.muted }]}>{selectedProduct.description}</Text>

                <View style={styles.modalFooter}>
                  <Text style={[styles.modalPrice, { color: themeColors.tint }]}>£{selectedProduct.price.toFixed(2)}</Text>
                  {(cart[selectedProduct.id] ?? 0) === 0 ? (
                    <TouchableOpacity style={[styles.modalAddBtn, { backgroundColor: themeColors.tint }]} onPress={() => { addToCart(selectedProduct.id); setSelectedProduct(null); }}>
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
  hero: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, borderRadius: 24, padding: Spacing.lg, minHeight: 170, overflow: 'hidden', flexDirection: 'row', justifyContent: 'space-between' },
  heroContent: { flex: 1 },
  heroTag: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  heroTitle: { color: '#fff', fontSize: 30, fontWeight: '900', lineHeight: 34, marginBottom: 6 },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 19 },
  heroDecoGrid: { position: 'absolute', right: -10, top: -10, width: 120, height: 200, flexDirection: 'row', flexWrap: 'wrap', gap: 4, opacity: 0.7 },
  heroDecoItem: { opacity: 0.2 },

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
  pharmacyStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  pharmacyStatusText: { fontSize: 11, fontWeight: '700' },
  pharmacyRating: { fontSize: 11 },

  // Categories
  catRow: { paddingHorizontal: Spacing.lg, gap: 10 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
  catIcon: { fontSize: 15 },
  catLabel: { fontSize: 13, fontWeight: '600' },

  // Products
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingHorizontal: Spacing.lg },
  productCard: { width: CARD_W, borderRadius: 18, borderWidth: 1, overflow: 'hidden', ...Shadows.light },
  productGradTop: { height: 90, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  productEmoji: { fontSize: 36 },
  productBadge: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99 },
  productBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  productBody: { padding: 12, gap: 3 },
  productBrand: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  productName: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  productUnit: { fontSize: 11 },
  productRating: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  productStar: { fontSize: 11 },
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
  cartBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#FF4757', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  cartFabLabel: { flex: 1, textAlign: 'center', color: '#fff', fontWeight: '800', fontSize: 15, backgroundColor: '#6C63FF' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', ...Shadows.medium },
  modalGradTop: { height: 140, justifyContent: 'center', alignItems: 'center' },
  modalEmoji: { fontSize: 56 },
  modalClose: { position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' },
  modalCloseText: { color: '#fff', fontWeight: '700' },
  modalBody: { padding: Spacing.lg },
  modalBrand: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  modalName: { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  modalUnit: { fontSize: 13, marginBottom: 8 },
  modalRatingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  modalDesc: { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalPrice: { fontSize: 26, fontWeight: '900' },
  modalAddBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  modalAddBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

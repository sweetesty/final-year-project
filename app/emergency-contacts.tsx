import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors, Spacing, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { useEmergencyContactsViewModel } from '@/src/viewmodels/useEmergencyContactsViewModel';

const RELATIONSHIPS = ['Parent', 'Spouse', 'Child', 'Sibling', 'Friend', 'Carer', 'Other'];

export default function EmergencyContactsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const C = Colors[colorScheme as 'light' | 'dark'];

  const { session } = useAuthViewModel();
  const patientId = session?.user?.id ?? '';

  const { contacts, loading, addContact, deleteContact, setPrimary } =
    useEmergencyContactsViewModel(patientId);

  const [showForm, setShowForm]       = useState(contacts.length === 0);
  const [name, setName]               = useState('');
  const [phone, setPhone]             = useState('');
  const [relationship, setRelationship] = useState('');
  const [saving, setSaving]           = useState(false);

  const handleAdd = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Missing fields', 'Please enter a name and phone number.');
      return;
    }
    setSaving(true);
    await addContact({
      name:         name.trim(),
      phone:        phone.trim(),
      relationship: relationship || 'Other',
      isPrimary:    contacts.length === 0,
    });
    setName(''); setPhone(''); setRelationship('');
    setShowForm(false);
    setSaving(false);
  };

  const handleDelete = (id: string, contactName: string) => {
    Alert.alert(
      'Remove Contact',
      `Remove ${contactName} from your emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => deleteContact(id) },
      ],
    );
  };

  const bgGrad: [string, string] = isDark ? ['#080C18', '#0F1729'] : ['#F4F7FE', '#EEF2FF'];

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <LinearGradient colors={bgGrad} style={StyleSheet.absoluteFill} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ───────────────────────────────────────────── */}
      <LinearGradient
        colors={['#DC2626', '#B91C1C']}
        style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 58 : 44 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <MaterialIcons name="contact-phone" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Emergency Contacts</Text>
            <Text style={styles.headerSub}>
              {contacts.length === 0
                ? 'Add someone to alert if a fall is detected'
                : `${contacts.length} contact${contacts.length > 1 ? 's' : ''} — primary gets SMS alerts`}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addFab, { backgroundColor: showForm ? 'rgba(255,255,255,0.2)' : '#fff' }]}
            onPress={() => setShowForm(v => !v)}
          >
            <MaterialIcons name={showForm ? 'close' : 'add'} size={22} color={showForm ? '#fff' : '#DC2626'} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Add Form ─────────────────────────────────────── */}
        {showForm && (
          <Animated.View entering={FadeInDown.duration(300)} style={[styles.formCard, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(220,38,38,0.15)' }]}>
            <Text style={[styles.formTitle, { color: C.text }]}>New Contact</Text>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: C.muted }]}>Full Name *</Text>
              <View style={[styles.inputWrap, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC' }]}>
                <MaterialIcons name="person" size={18} color={C.muted} />
                <TextInput
                  style={[styles.input, { color: C.text }]}
                  placeholder="e.g. John Doe"
                  placeholderTextColor={C.muted}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: C.muted }]}>Phone Number *</Text>
              <View style={[styles.inputWrap, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC' }]}>
                <MaterialIcons name="phone" size={18} color={C.muted} />
                <TextInput
                  style={[styles.input, { color: C.text }]}
                  placeholder="+234 800 000 0000"
                  placeholderTextColor={C.muted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: C.muted }]}>Relationship</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relRow}>
                {RELATIONSHIPS.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.relChip, relationship === r ? { backgroundColor: '#DC2626' } : { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]}
                    onPress={() => setRelationship(r)}
                  >
                    <Text style={[styles.relChipText, { color: relationship === r ? '#fff' : C.muted }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleAdd}
              disabled={saving}
            >
              <LinearGradient colors={['#DC2626', '#B91C1C']} style={styles.saveBtnInner}>
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><MaterialIcons name="check" size={18} color="#fff" /><Text style={styles.saveBtnText}>Save Contact</Text></>
                }
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Empty state ───────────────────────────────────── */}
        {!loading && contacts.length === 0 && !showForm && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="contact-phone" size={36} color="#DC2626" />
            </View>
            <Text style={[styles.emptyTitle, { color: C.text }]}>No contacts yet</Text>
            <Text style={[styles.emptySub, { color: C.muted }]}>
              Add at least one person who should be alerted if a fall is detected.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowForm(true)}>
              <Text style={styles.emptyBtnText}>+ Add First Contact</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Loading ───────────────────────────────────────── */}
        {loading && <ActivityIndicator size="large" color="#DC2626" style={{ marginTop: 48 }} />}

        {/* ── Contact list ─────────────────────────────────── */}
        {contacts.map((contact, i) => (
          <Animated.View key={contact.id} entering={ZoomIn.delay(i * 60).duration(350)}>
            <View style={[styles.contactCard, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: contact.isPrimary ? '#DC2626' : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}>
              {contact.isPrimary && (
                <View style={styles.primaryBanner}>
                  <MaterialIcons name="star" size={12} color="#fff" />
                  <Text style={styles.primaryBannerText}>PRIMARY — receives SMS alerts</Text>
                </View>
              )}

              <View style={styles.contactRow}>
                <LinearGradient
                  colors={contact.isPrimary ? ['#DC2626', '#B91C1C'] : ['#6366F1', '#4F46E5']}
                  style={styles.contactAvatar}
                >
                  <Text style={styles.contactAvatarText}>{contact.name.charAt(0).toUpperCase()}</Text>
                </LinearGradient>

                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: C.text }]}>{contact.name}</Text>
                  <Text style={[styles.contactPhone, { color: C.muted }]}>{contact.phone}</Text>
                  {contact.relationship ? (
                    <View style={styles.relTag}>
                      <Text style={styles.relTagText}>{contact.relationship}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.contactActions}>
                  {!contact.isPrimary && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: 'rgba(220,38,38,0.1)' }]}
                      onPress={() => setPrimary(contact.id)}
                    >
                      <MaterialIcons name="star-outline" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}
                    onPress={() => handleDelete(contact.id, contact.name)}
                  >
                    <MaterialIcons name="delete-outline" size={16} color={C.muted} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        ))}

        {/* Info strip */}
        {contacts.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={[styles.infoStrip, { backgroundColor: isDark ? 'rgba(220,38,38,0.08)' : 'rgba(220,38,38,0.06)', borderColor: isDark ? 'rgba(220,38,38,0.2)' : 'rgba(220,38,38,0.15)' }]}>
            <MaterialIcons name="info-outline" size={16} color="#DC2626" />
            <Text style={[styles.infoText, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>
              The primary contact receives an SMS with your location when a fall is confirmed.
            </Text>
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: Spacing.lg, gap: 12 },

  // Header
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  addFab: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  // Form
  formCard: { borderRadius: 20, borderWidth: 1, padding: Spacing.lg, gap: 16, ...Shadows.light },
  formTitle: { fontSize: 16, fontWeight: '800' },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  input: { flex: 1, fontSize: 15 },
  relRow: { gap: 8, paddingVertical: 2 },
  relChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  relChipText: { fontSize: 13, fontWeight: '600' },
  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  saveBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(220,38,38,0.1)', justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { backgroundColor: '#DC2626', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Contact card
  contactCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', ...Shadows.light },
  primaryBanner: { backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 5 },
  primaryBannerText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  contactAvatar: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  contactAvatarText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  contactInfo: { flex: 1, gap: 3 },
  contactName: { fontSize: 16, fontWeight: '700' },
  contactPhone: { fontSize: 13 },
  relTag: { alignSelf: 'flex-start', backgroundColor: 'rgba(99,102,241,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, marginTop: 2 },
  relTagText: { color: '#6366F1', fontSize: 11, fontWeight: '600' },
  contactActions: { gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  // Info
  infoStrip: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 4 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
});

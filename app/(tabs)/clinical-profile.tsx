import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

export default function ClinicalProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const { session, signOut } = useAuthViewModel();
  const { t } = useTranslation();
  const router = useRouter();

  const doctorName = session?.user?.user_metadata?.full_name || 'Medical Officer';
  const doctorEmail = session?.user?.email || 'doctor@hospital.com';

  const handleSignOut = async () => {
    Alert.alert(
      t('doctor.secure_logout'),
      t('doctor.logout_confirm'),
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Logout", 
          style: "destructive", 
          onPress: async () => {
            await signOut();
            router.replace('/');
          }
        }
      ]
    );
  };

  const ProfileItem = ({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) => (
    <View style={[styles.profileItem, { borderBottomColor: themeColors.border }]}>
      <View style={[styles.iconBox, { backgroundColor: (color || themeColors.tint) + '15' }]}>
        <MaterialIcons name={icon as any} size={22} color={color || themeColors.tint} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemLabel, { color: themeColors.muted }]}>{label}</Text>
        <Text style={[styles.itemValue, { color: themeColors.text }]}>{value}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ title: 'Clinical Profile', headerShown: true }} />
      
      <LinearGradient colors={[themeColors.tint + '20', 'transparent']} style={styles.header}>
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=200&auto=format&fit=crop' }} 
            style={styles.avatar} 
          />
          <View style={[styles.badge, { backgroundColor: themeColors.tint }]}>
            <MaterialIcons name="verified-user" size={14} color="#fff" />
          </View>
        </View>
        <Text style={[styles.name, { color: themeColors.text }]}>{doctorName}</Text>
        <Text style={[styles.specialty, { color: themeColors.muted }]}>{t('doctor.specialist')}</Text>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.muted }]}>{t('doctor.clinical_id')}</Text>
        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <ProfileItem icon="email" label={t('doctor.hospital_email')} value={doctorEmail} />
          <ProfileItem icon="badge" label={t('doctor.medical_id')} value="KNS-992-001" />
          <ProfileItem icon="apartment" label={t('doctor.facility')} value="Vitals Fusion Health Center" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.muted }]}>{t('doctor.system_settings')}</Text>
        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <TouchableOpacity style={[styles.profileItem, { borderBottomWidth: 0 }]}>
            <View style={[styles.iconBox, { backgroundColor: '#10B98115' }]}>
              <MaterialIcons name="security" size={22} color="#10B981" />
            </View>
            <View style={styles.itemContent}>
              <Text style={[styles.itemValue, { color: themeColors.text }]}>{t('doctor.security')}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={themeColors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.logoutButton, { backgroundColor: themeColors.card, borderColor: '#EF4444' }]}
        onPress={handleSignOut}
      >
        <MaterialIcons name="logout" size={20} color="#EF4444" />
        <Text style={styles.logoutText}>{t('doctor.secure_logout')}</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={[styles.version, { color: themeColors.muted }]}>{t('doctor.version')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 1.5,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#fff',
  },
  badge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
  },
  specialty: {
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.light,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  itemLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    height: 56,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: Spacing.sm,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  version: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});

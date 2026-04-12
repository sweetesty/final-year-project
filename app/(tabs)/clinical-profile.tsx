import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

const AVATAR_KEY = 'user_avatar_uri';

export default function ClinicalProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const { session, signOut, role } = useAuthViewModel();
  const { t } = useTranslation();
  const router = useRouter();

  const isDoctor = role === 'doctor';
  const userName = session?.user?.user_metadata?.full_name || (isDoctor ? 'Medical Officer' : 'Patient');
  const userEmail = session?.user?.email || (isDoctor ? 'doctor@hospital.com' : 'patient@vitalsfusion.com');

  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Load saved avatar on mount
  React.useEffect(() => {
    AsyncStorage.getItem(AVATAR_KEY).then(uri => { if (uri) setAvatarUri(uri); });
  }, []);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      await AsyncStorage.setItem(AVATAR_KEY, uri);
    }
  };

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
      <Stack.Screen options={{ title: isDoctor ? 'Clinical Profile' : 'Personal Profile', headerShown: true }} />
      
      <LinearGradient colors={[themeColors.tint + '20', 'transparent']} style={styles.header}>
        <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage} activeOpacity={0.85}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: themeColors.tint + '22' }]}>
              <MaterialIcons name="person" size={48} color={themeColors.tint} />
            </View>
          )}
          {/* Edit camera badge */}
          <View style={[styles.editBadge, { backgroundColor: themeColors.tint }]}>
            <MaterialIcons name="camera-alt" size={13} color="#fff" />
          </View>
          <View style={[styles.badge, { backgroundColor: isDoctor ? themeColors.tint : '#10B981' }]}>
            <MaterialIcons name={isDoctor ? "verified-user" : "person"} size={14} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={[styles.name, { color: themeColors.text }]}>{userName}</Text>
        <Text style={[styles.editHint, { color: themeColors.muted }]}>Tap photo to change</Text>
        <Text style={[styles.specialty, { color: themeColors.muted }]}>
          {isDoctor ? t('doctor.specialist') : 'Verified User'}
        </Text>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.muted }]}>
          {isDoctor ? t('doctor.clinical_id') : 'Account Information'}
        </Text>
        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <ProfileItem icon="email" label="Primary Email" value={userEmail} />
          {isDoctor ? (
            <>
              <ProfileItem icon="badge" label={t('doctor.medical_id')} value="KNS-992-001" />
              <ProfileItem icon="apartment" label={t('doctor.facility')} value="Vitals Fusion Health Center" />
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => router.push('/medical-details')}>
                <ProfileItem icon="medical-services" label="Medical Profile" value="Manage Vitals & History" color="#EC4899" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/emergency-contacts')}>
                <ProfileItem icon="contacts" label="Emergency Contacts" value="Manage SOS Recipients" color="#6366F1" />
              </TouchableOpacity>
            </>
          )}
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
        <Text style={[styles.version, { color: themeColors.muted }]}>
          {isDoctor ? t('doctor.version') : 'Vitals Fusion v1.2.0'}
        </Text>
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
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  editHint: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 4,
  },
  editBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
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

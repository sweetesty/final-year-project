import { Tabs } from 'expo-router';
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const { role, loading } = useAuthViewModel();
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={themeColors.tint} />
      </View>
    );
  }

  const isDoctor = role === 'doctor';
  const isCaregiver = role === 'caregiver';
  const isPatient = role === 'patient';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: themeColors.tint,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: themeColors.card,
          borderTopColor: themeColors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          href: isPatient ? '/' : null,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="home" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="doctor-home"
        options={{
          title: t('tabs.clinical_home'),
          href: isDoctor ? '/doctor-home' : null,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="dashboard" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="doctor"
        options={{
          title: t('tabs.clinical_panel'),
          href: isDoctor ? '/doctor' : null,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="people" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="caregiver"
        options={{
          title: 'Caregiver',
          href: isCaregiver ? '/caregiver' : null,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="family-restroom" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="clinical-messages"
        options={{
          title: t('tabs.messages'),
          href: isDoctor ? '/clinical-messages' : null,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="chat" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="clinical-alerts"
        options={{
          title: isDoctor ? t('tabs.alerts') : 'Health History',
          href: isDoctor || isCaregiver ? '/clinical-alerts' : null,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="notification-important" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="medication"
        options={{
          title: t('tabs.medication'),
          href: isPatient ? '/medication' : null,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="medication" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="ai-chat"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: t('tabs.pharmacy'),
          href: isPatient ? '/explore' : null,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="local-pharmacy" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="clinical-profile"
        options={{
          title: t('tabs.profile'),
          href: '/clinical-profile',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="account-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

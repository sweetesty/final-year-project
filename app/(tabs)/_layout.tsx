import { Tabs } from 'expo-router';
import React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const { role } = useAuthViewModel();
  const { t } = useTranslation();

  const isDoctor = role === 'doctor';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: themeColors.tint,
        headerShown: false,
        tabBarButton: HapticTab,
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
          href: isDoctor ? null : '/',
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
          tabBarIcon: ({ color, size }) => <MaterialIcons name="people" size={size} color={color} />,
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
          title: t('tabs.alerts'),
          href: isDoctor ? '/clinical-alerts' : null,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="notification-important" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="medication"
        options={{
          title: t('tabs.medication'),
          href: isDoctor ? null : '/medication',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="medication" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="ai-chat"
        options={{
          href: null, // Hidden from tab bar — accessed via FAB on home screen
          tabBarIcon: ({ color, size }) => <MaterialIcons name="smart-toy" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: t('tabs.pharmacy'),
          href: isDoctor ? null : '/explore',
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

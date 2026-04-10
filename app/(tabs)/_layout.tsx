import { Tabs } from 'expo-router';
import React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const { role } = useAuthViewModel();

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
      {/* Home Tab (Patient) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          href: isDoctor ? null : '/',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="home" size={size} color={color} />,
        }}
      />

      {/* Doctor Home (Clinical Overview) [NEW] */}
      <Tabs.Screen
        name="doctor-home"
        options={{
          title: 'Clinical Home',
          href: isDoctor ? '/doctor-home' : null,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="dashboard" size={size} color={color} />,
        }}
      />

      {/* Doctor tab (Clinical Panel - MAIN) */}
      <Tabs.Screen
        name="doctor"
        options={{
          title: 'Clinical Panel',
          href: isDoctor ? '/doctor' : null,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="people" size={size} color={color} />,
        }}
      />

      {/* Clinical Messages (Inbox) [NEW] */}
      <Tabs.Screen
        name="clinical-messages"
        options={{
          title: 'Messages',
          href: isDoctor ? '/clinical-messages' : null,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="chat" size={size} color={color} />,
        }}
      />

      {/* Clinical Alerts center */}
      <Tabs.Screen
        name="clinical-alerts"
        options={{
          title: 'Alerts',
          href: isDoctor ? '/clinical-alerts' : null,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="notification-important" size={size} color={color} />,
        }}
      />

      {/* Medication tab (Patient) */}
      <Tabs.Screen
        name="medication"
        options={{
          title: 'Medication',
          href: isDoctor ? null : '/medication',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="medication" size={size} color={color} />,
        }}
      />

      {/* AI Companion tab (Patient) */}
      <Tabs.Screen
        name="ai-chat"
        options={{
          title: 'AI Chat',
          href: isDoctor ? null : '/ai-chat',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="smart-toy" size={size} color={color} />,
        }}
      />

      {/* Pharmacy / Shop tab (Patient) */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Pharmacy',
          href: isDoctor ? null : '/explore',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="local-pharmacy" size={size} color={color} />,
        }}
      />

      {/* Clinical Profile */}
      <Tabs.Screen
        name="clinical-profile"
        options={{
          title: 'Profile',
          href: isDoctor ? '/clinical-profile' : null,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="account-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

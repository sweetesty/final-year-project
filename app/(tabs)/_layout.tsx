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

      {/* Doctor tab */}
      <Tabs.Screen
        name="doctor"
        options={{
          title: 'Patients',
          href: isDoctor ? '/doctor' : null,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="people" size={size} color={color} />,
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
    </Tabs>
  );
}

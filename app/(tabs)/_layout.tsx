import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
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
        }
      }}>
      
      {/* Home Tab (Patient Agent) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Intelligence',
          href: isDoctor ? null : '/', // Hide for Doctor
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />

      {/* Doctor tab (For Doctors) */}
      <Tabs.Screen
        name="doctor"
        options={{
          title: 'Patients',
          href: isDoctor ? '/doctor' : null, // Hide for Patient
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />

      {/* Medication tab (For Patients) */}
      <Tabs.Screen
        name="medication"
        options={{
          title: 'Medication',
          href: isDoctor ? null : '/medication', // Hide for Doctor
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="pills.fill" color={color} />,
        }}
      />

      {/* AI Companion tab (For Patients) */}
      <Tabs.Screen
        name="ai-chat"
        options={{
          title: 'AI Companion',
          href: isDoctor ? null : '/ai-chat', // Hide for Doctor
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="sparkles.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

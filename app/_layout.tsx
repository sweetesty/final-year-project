import React, { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { AppState } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { NotificationService } from '@/src/services/NotificationService';
import { DataService } from '@/src/services/SupabaseService';
import { BackgroundMonitorService } from '@/src/services/BackgroundMonitorService';
import { OfflineSyncService } from '@/src/services/OfflineSyncService';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { session, loading } = useAuthViewModel();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!loading) {
      setIsReady(true);
      SplashScreen.hideAsync();
    }
  }, [loading]);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isReady, segments]);

  useEffect(() => {
    if (session?.user?.id) {
      const setupServices = async () => {
        try {
          const token = await NotificationService.registerForPushNotificationsAsync();
          if (token) {
            await DataService.updateUserPushToken(session.user.id, token);
          }
        } catch (error) {
          console.error('Failed to setup push notifications:', error);
        }

        try {
          await BackgroundMonitorService.register();
        } catch (error) {
          console.error('Failed to register background monitor:', error);
        }
      };

      setupServices();

      const unsubscribe = NotificationService.addNotificationListeners(
        (notification) => {
          console.log('Notification Received:', notification);
        },
        (response) => {
          console.log('Notification Response:', response);
        }
      );

      return () => unsubscribe();
    }
  }, [session?.user?.id]);

  // On first load, clear any stale queued operations from old schema
  // (e.g. payloads with wrong column names that would fail forever)
  useEffect(() => {
    OfflineSyncService.clearQueue().catch(console.error);
  }, []);

  // Flush offline queue whenever the app comes to the foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        OfflineSyncService.flush().catch(console.error);
      }
    });
    return () => subscription.remove();
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="medical-details" options={{ title: 'Medical Profile' }} />
        <Stack.Screen name="emergency-contacts" options={{ title: 'Emergency Contacts' }} />
        <Stack.Screen name="add-medication" options={{ title: 'Add Medication' }} />
        <Stack.Screen name="live-tracking" options={{ title: 'Live Location' }} />
        <Stack.Screen name="chat-room" options={{ title: 'Clinical Chat' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { AppState } from 'react-native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { NotificationService } from '@/src/services/NotificationService';
import { DataService, supabase } from '@/src/services/SupabaseService';
import { BackgroundMonitorService } from '@/src/services/BackgroundMonitorService';
import { OfflineSyncService } from '@/src/services/OfflineSyncService';
import { LocationService } from '@/src/services/LocationService';
import '@/src/i18n'; // Initialize i18n

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { session, loading } = useAuthViewModel();
  const { t } = useTranslation();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!loading) {
      setIsReady(true);
      SplashScreen.hideAsync();
    }
  }, [loading]);

  const rootNavigationState = useRootNavigationState();
  const isNavReady = !!rootNavigationState?.key;

  useEffect(() => {
    if (!isReady || !isNavReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isReady, isNavReady, segments]);

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
          // Only register background monitoring for Patients
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
          if (profile?.role === 'patient') {
            await BackgroundMonitorService.register();
          } else {
            await BackgroundMonitorService.unregister();
          }
        } catch (error) {
          console.error('Failed to register background monitor:', error);
        }

        // Request location permission proactively so it's ready before an emergency
        LocationService.requestPermissions().catch(console.error);
      };

      setupServices();

      const unsubscribe = NotificationService.addNotificationListeners(
        (_notification) => {
          // In-foreground notifications are shown automatically via setNotificationHandler
        },
        (response) => {
          // Tapping a notification navigates to the relevant chat
          const data = response.notification.request.content.data as any;
          if (data?.partnerId && data?.partnerName) {
            router.push({
              pathname: '/chat-room',
              params: { partnerId: data.partnerId, partnerName: data.partnerName },
            });
          }
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
        <Stack.Screen name="medical-details" options={{ title: t('nav.medical_profile') }} />
        <Stack.Screen name="emergency-contacts" options={{ title: t('nav.emergency_contacts') }} />
        <Stack.Screen name="add-medication" options={{ title: t('nav.add_medication') }} />
        <Stack.Screen name="live-tracking" options={{ title: t('nav.live_location') }} />
        <Stack.Screen name="chat-room" options={{ title: t('nav.clinical_chat') }} />
        <Stack.Screen name="nearby-doctors" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

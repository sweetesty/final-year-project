import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { supabase } from './SupabaseService';
import { SmsService } from './SmsService';
import i18n from '../i18n';

const BACKGROUND_FALL_TASK = 'BACKGROUND_FALL_DETECTION';

// G-Force threshold for background detection (slightly higher to reduce false positives)
const BG_FALL_THRESHOLD = 3.0;

// Detect Expo Go — background tasks are not supported there
const isExpoGo = (() => {
  try {
    // expo-constants exposes the appOwnership field
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;
    return Constants.appOwnership === 'expo';
  } catch {
    return false;
  }
})();

// Lazy-load expo-background-task so the import doesn't crash in Expo Go
let BackgroundTask: typeof import('expo-background-task') | null = null;
try {
  BackgroundTask = require('expo-background-task');
} catch {
  // not available in Expo Go
}

/**
 * Define the background task. Must be called at module level (top-level),
 * before any rendering, so TaskManager can register it.
 */
if (!isExpoGo) {
  TaskManager.defineTask(BACKGROUND_FALL_TASK, async () => {
    try {
      // Sample accelerometer for 500ms
      const reading = await sampleAccelerometer(500);
      const gForce = Math.sqrt(reading.x ** 2 + reading.y ** 2 + reading.z ** 2);

      if (gForce > BG_FALL_THRESHOLD) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          return BackgroundTask?.BackgroundTaskResult?.Success ?? 1;
        }

        const patientId = session.user.id;
        const patientName = session.user.user_metadata?.full_name ?? 'Patient';

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await Notifications.scheduleNotificationAsync({
          content: {
            title: i18n.t('fall.bg_notification_title'),
            body: i18n.t('fall.bg_notification_body', { time: timestamp }),
            data: { type: 'fall_warning' },
            sound: 'default',
          },
          trigger: null,
        });

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }).catch(() => null);
        const mapsLink = location
          ? `https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`
          : 'Unknown Location';

        await supabase.from('fall_events').insert({
          patientid: patientId,
          latitude: location?.coords.latitude ?? null,
          longitude: location?.coords.longitude ?? null,
          timestamp: new Date().toISOString(),
          confirmed: false,
          source: 'background',
        });

        const { data: contact } = await supabase
          .from('emergency_contacts')
          .select('phone')
          .eq('patientid', patientId)
          .eq('isprimary', true)
          .single();

        if (contact) {
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          await SmsService.sendEmergencySms(
            contact.phone,
            i18n.t('fall.dispatch_sms', { name: patientName, time: timeStr, link: mapsLink, lng: 'en' })
          );
        }

        return BackgroundTask?.BackgroundTaskResult?.Success ?? 1;
      }

      return BackgroundTask?.BackgroundTaskResult?.Success ?? 1;
    } catch (error) {
      console.error('[BackgroundMonitor] Error:', error);
      return BackgroundTask?.BackgroundTaskResult?.Failed ?? 2;
    }
  });
}

/**
 * Samples the accelerometer for a given duration and returns the peak reading.
 */
function sampleAccelerometer(durationMs: number): Promise<{ x: number; y: number; z: number }> {
  return new Promise((resolve) => {
    let peak = { x: 0, y: 0, z: 0 };
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener((data) => {
      const mag = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
      const peakMag = Math.sqrt(peak.x ** 2 + peak.y ** 2 + peak.z ** 2);
      if (mag > peakMag) peak = data;
    });
    setTimeout(() => {
      sub.remove();
      resolve(peak);
    }, durationMs);
  });
}

export class BackgroundMonitorService {
  /**
   * Register the background task. No-ops silently in Expo Go.
   */
  static async register() {
    if (isExpoGo || !BackgroundTask) {
      console.log('[BackgroundMonitor] Skipped in Expo Go (requires dev build).');
      return false;
    }

    try {
      const status = await BackgroundTask.getStatusAsync();
      if (
        status !== BackgroundTask.BackgroundTaskStatus.Available
      ) {
        console.warn('[BackgroundMonitor] Background task is restricted or denied.');
        return false;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FALL_TASK);
      if (!isRegistered) {
        await BackgroundTask.registerTaskAsync(BACKGROUND_FALL_TASK, {
          minimumInterval: 60,
        });
        console.log('[BackgroundMonitor] Task registered.');
      }
      return true;
    } catch (error) {
      console.error('[BackgroundMonitor] Registration failed:', error);
      return false;
    }
  }

  /**
   * Unregister the background task (e.g., on logout).
   */
  static async unregister() {
    if (isExpoGo || !BackgroundTask) return;

    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FALL_TASK);
      if (isRegistered) {
        await BackgroundTask.unregisterTaskAsync(BACKGROUND_FALL_TASK);
        console.log('[BackgroundMonitor] Task unregistered.');
      }
    } catch (error) {
      console.error('[BackgroundMonitor] Unregistration failed:', error);
    }
  }

  static async isRegistered() {
    if (isExpoGo || !BackgroundTask) return false;
    return TaskManager.isTaskRegisteredAsync(BACKGROUND_FALL_TASK);
  }
}

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Location from 'expo-location';
import { supabase } from './SupabaseService';
import { SmsService } from './SmsService';

const BACKGROUND_FALL_TASK = 'BACKGROUND_FALL_DETECTION';

// G-Force threshold for background detection (slightly higher to reduce false positives)
const BG_FALL_THRESHOLD = 3.0;

/**
 * Define the background task. Must be called at module level (top-level),
 * before any rendering, so TaskManager can register it.
 */
TaskManager.defineTask(BACKGROUND_FALL_TASK, async () => {
  try {
    // Sample accelerometer for 500ms
    const reading = await sampleAccelerometer(500);
    const gForce = Math.sqrt(reading.x ** 2 + reading.y ** 2 + reading.z ** 2);

    if (gForce > BG_FALL_THRESHOLD) {
      // Retrieve the stored patient session info
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return BackgroundFetch.BackgroundFetchResult.NoData;

      const patientId = session.user.id;
      const patientName = session.user.user_metadata?.full_name ?? 'Patient';

      // Send a high-priority local notification to alert the user
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Possible Fall Detected',
          body: 'Are you okay? Open the app to cancel the emergency alert.',
          data: { type: 'fall_warning' },
          sound: 'default',
        },
        trigger: null, // Immediate
      });

      // Get location
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
      const mapsLink = location
        ? `https://www.google.com/maps/search/?api=1&query=${location.coords.latitude},${location.coords.longitude}`
        : 'Unknown Location';

      // Log the event
      await supabase.from('fall_events').insert({
        patientId,
        latitude: location?.coords.latitude ?? null,
        longitude: location?.coords.longitude ?? null,
        timestamp: new Date().toISOString(),
        confirmed: false, // Background detection — not yet confirmed
        source: 'background',
      });

      // SMS primary emergency contact
      const { data: contact } = await supabase
        .from('emergency_contacts')
        .select('phone')
        .eq('patientId', patientId)
        .eq('isPrimary', true)
        .single();

      if (contact) {
        await SmsService.sendEmergencySms(
          contact.phone,
          `ALERT: ${patientName} may have fallen (background detection). Location: ${mapsLink}`
        );
      }

      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[BackgroundMonitor] Error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

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
   * Register the background fetch task. Call this once after permissions are granted.
   */
  static async register() {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      if (
        status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
        status === BackgroundFetch.BackgroundFetchStatus.Denied
      ) {
        console.warn('[BackgroundMonitor] Background fetch is restricted or denied.');
        return false;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FALL_TASK);
      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_FALL_TASK, {
          minimumInterval: 60, // Every 60 seconds minimum (OS may delay)
          stopOnTerminate: false, // Continue after app is closed
          startOnBoot: true, // Restart after device reboot
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
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FALL_TASK);
      if (isRegistered) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FALL_TASK);
        console.log('[BackgroundMonitor] Task unregistered.');
      }
    } catch (error) {
      console.error('[BackgroundMonitor] Unregistration failed:', error);
    }
  }

  static async isRegistered() {
    return TaskManager.isTaskRegisteredAsync(BACKGROUND_FALL_TASK);
  }
}

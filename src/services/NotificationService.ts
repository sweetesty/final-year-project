import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Medication } from '../models/Medication';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  static async registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 100, 100, 100],
        lightColor: '#6366F1',
        sound: 'default',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return;
    }

    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId ??
        '1b4da79e-db2e-4321-a2aa-6211aee5e081';

      token = (await Notifications.getExpoPushTokenAsync({
        projectId,
      })).data;
      console.log('Expo Push Token:', token);
    } catch (e) {
      console.error('Error getting expo push token', e);
    }

    return token;
  }

  static addNotificationListeners(
    onReceived: (notification: Notifications.Notification) => void,
    onResponse: (response: Notifications.NotificationResponse) => void
  ) {
    const notificationListener = Notifications.addNotificationReceivedListener(onReceived);
    const responseListener = Notifications.addNotificationResponseReceivedListener(onResponse);

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }

  static async scheduleMedicationReminders(medication: Medication) {
    const { name, times, isCritical, frequency, specificDays, durationDays, startDate } = medication;

    const title = isCritical
      ? '⚠️ CRITICAL MEDICATION'
      : medication.isPrescribed
      ? '📋 PRESCRIBED DOSE'
      : '💊 Medication Reminder';

    const body = medication.isPrescribed
      ? `It's time for your prescribed ${name}.`
      : `Reminder to take your ${name}.`;

    for (const time of times) {
      const [hours, minutes] = time.split(':').map(Number);

      if (durationDays && durationDays > 0) {
        // Schedule one notification per day for the duration
        const base = startDate ? new Date(startDate) : new Date();
        base.setHours(hours, minutes, 0, 0);

        for (let day = 0; day < durationDays; day++) {
          const fireDate = new Date(base);
          fireDate.setDate(base.getDate() + day);

          // Skip if in the past
          if (fireDate <= new Date()) continue;

          const identifier = await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body: `${body} (Day ${day + 1} of ${durationDays})`,
              data: { medicationId: medication.id },
              sound: isCritical ? 'default' : 'default',
              channelId: 'default',
            } as any,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: fireDate,
            },
          });
          console.log(`[Notifications] Scheduled ${name} day ${day + 1}: ${fireDate.toISOString()} — ID: ${identifier}`);
        }
      } else {
        // Indefinite repeating reminder
        const identifier = await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: { medicationId: medication.id },
            sound: 'default',
            channelId: 'default',
          } as any,
          trigger: this.getTriggerForFrequency(frequency, hours, minutes, specificDays),
        });
        console.log(`[Notifications] Scheduled repeating reminder for ${name} at ${time} — ID: ${identifier}`);
      }
    }
  }

  private static getTriggerForFrequency(
    frequency: string,
    hour: number,
    minute: number,
    specificDays?: number[]
  ): Notifications.NotificationTriggerInput {
    if (frequency === 'daily') {
      return {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        repeats: true,
      };
    }

    if (frequency === 'weekly' && specificDays && specificDays.length > 0) {
      return {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        weekday: specificDays[0] + 1,
        hour,
        minute,
        repeats: true,
      };
    }

    return {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
    };
  }

  static async cancelMedicationReminders(medicationId: string) {
    if (!medicationId) return;
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const toCancel = scheduled.filter(n => n.content.data?.medicationId === medicationId);
      
      for (const n of toCancel) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
      console.log(`[Notifications] Cancelled ${toCancel.length} scheduled reminders for med: ${medicationId}`);
    } catch (e) {
      console.warn('[NotificationService] Failed to cancel reminders:', e);
    }
  }

  static async cancelAllReminders() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Send a push notification to a specific Expo push token via Expo's push API.
   * Works both in-app (via local notification fallback) and out-of-app (via push).
   */
  static async sendPushToToken(
    expoPushToken: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ) {
    if (!expoPushToken) return;
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify({
          to: expoPushToken,
          title,
          body,
          data: data ?? {},
          sound: 'default',
          priority: 'high',
          channelId: 'messages',
        }),
      });
    } catch (e) {
      console.warn('[NotificationService] Push send failed:', e);
    }
  }

  /**
   * Show an immediate local notification (used when the app is in the foreground).
   */
  static async showLocalNotification(title: string, body: string, data?: Record<string, any>) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {}, sound: 'default' },
      trigger: null,
    });
  }
}
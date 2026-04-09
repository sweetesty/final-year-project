import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Medication } from '../models/Medication';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
    const { name, times, isCritical, frequency, specificDays } = medication;

    for (const time of times) {
      const [hours, minutes] = time.split(':').map(Number);

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: isCritical ? '⚠️ CRITICAL MEDICATION' : 'Medication Reminder',
          body: `It's time to take your ${name}.`,
          data: { medicationId: medication.id },
          sound: isCritical ? 'critical' : 'default',
        },
        trigger: this.getTriggerForFrequency(frequency, hours, minutes, specificDays),
      });

      console.log(`Scheduled reminder for ${name} at ${time}. ID: ${identifier}`);
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

  static async cancelAllReminders() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}
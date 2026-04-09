import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * Free SMS service using the device's native SMS app.
 * No API key or paid service required.
 * Opens a pre-filled SMS that the user/system can send directly.
 *
 * For a fully automated (no-tap) free option in production,
 * consider Twilio's free trial (25 free SMS) or Firebase Extensions.
 */
export class SmsService {
  static async sendEmergencySms(to: string, message: string): Promise<boolean> {
    return this.sendNativeSms(to, message);
  }

  /**
   * Opens the device's native SMS app with pre-filled recipient and message.
   * Works on both iOS and Android with no API key needed.
   */
  static async sendNativeSms(to: string, message: string): Promise<boolean> {
    const encodedMessage = encodeURIComponent(message);
    const url = Platform.OS === 'ios'
      ? `sms:${to}&body=${encodedMessage}`
      : `sms:${to}?body=${encodedMessage}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return true;
      } else {
        console.error('[SmsService] Native SMS not supported on this device.');
        return false;
      }
    } catch (error) {
      console.error('[SmsService] Error opening SMS:', error);
      return false;
    }
  }
}

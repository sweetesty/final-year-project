import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

// Termii Settings - Loaded from .env
const TERMII_API_KEY = process.env.EXPO_PUBLIC_TERMII_API_KEY || "YOUR_TERMII_API_KEY";
const TERMII_SENDER_ID = process.env.EXPO_PUBLIC_TERMII_SENDER_ID || "VitalsFusion";
const TERMII_BASE_URL = "https://api.ng.termii.com/api/sms/send";

export class SmsService {
  /**
   * Sends an SMS via Termii API.
   * If it fails or no key is provided, it falls back to native SMS app.
   */
  static async sendEmergencySms(to: string, message: string) {
    if (TERMII_API_KEY === "YOUR_TERMII_API_KEY") {
      console.warn("Termii API Key missing. Falling back to native SMS.");
      return this.sendNativeSms(to, message);
    }

    try {
      const response = await fetch(TERMII_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          from: TERMII_SENDER_ID,
          sms: message,
          type: "plain",
          channel: "generic",
          api_key: TERMII_API_KEY,
        }),
      });

      const data = await response.json();
      console.log('Termii Response:', data);

      if (data.code !== "ok") {
        throw new Error(data.message || "Failed to send SMS via Termii");
      }
      return true;
    } catch (error) {
      console.error('Termii SMS Error:', error);
      return this.sendNativeSms(to, message);
    }
  }

  /**
   * Opens the device's native SMS app with pre-filled content.
   */
  static async sendNativeSms(to: string, message: string) {
    const url = Platform.OS === 'ios' 
      ? `sms:${to}&body=${encodeURIComponent(message)}` 
      : `sms:${to}?body=${encodeURIComponent(message)}`;

    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    } else {
      console.error("SMS protocol not supported on this device.");
      return false;
    }
  }
}

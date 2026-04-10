import * as Speech from 'expo-speech';

export class SpeechService {
  /**
   * Speaks the given text in the requested language.
   * Resets any existing speech immediately to ensure responsiveness.
   */
  static async speak(text: string, lng?: string) {
    if (!text) return;

    try {
      // 1. Force stop any current speech to clear the audio channel
      await Speech.stop();

      // 2. Map app language codes to standard BCP-47 regional codes
      let languageCode = 'en-US';
      const cleanLng = lng?.toLowerCase() || 'en';

      if (cleanLng.startsWith('yo')) languageCode = 'yo-NG';
      else if (cleanLng.startsWith('ig')) languageCode = 'ig-NG';
      else if (cleanLng.startsWith('ha')) languageCode = 'ha-NG';
      else if (cleanLng.startsWith('en')) languageCode = 'en-US';
      else if (lng) languageCode = lng;

      console.log(`[SpeechService] Speaking (${languageCode}): ${text.substring(0, 30)}...`);

      // 3. Trigger speech with optimal settings for accessibility
      Speech.speak(text, {
        language: languageCode,
        rate: 0.88,   // Slightly slower for clarity
        pitch: 1.0,  // Natural pitch
        volume: 1.0, // Maximum system-requested volume
      });
    } catch (e) {
      console.warn('[SpeechService] speak() encountered an error:', e);
    }
  }

  static async stop() {
    try {
      await Speech.stop();
    } catch (e) {
      console.warn('[SpeechService] stop() failed:', e);
    }
  }
}

import * as Speech from 'expo-speech';

// @react-native-voice/voice requires a development build (not supported in Expo Go).
// We lazy-load it so the app doesn't crash in Expo Go — voice input is simply disabled.
let Voice: any = null;
try {
  Voice = require('@react-native-voice/voice').default;
} catch {
  console.warn('[VoiceService] @react-native-voice/voice not available in this environment. Voice input disabled.');
}

export class VoiceService {
  private static isListening = false;
  private static onEmergencyTriggered: (() => void) | null = null;

  static async init() {
    if (!Voice) return;
    Voice.onSpeechStart = () => (this.isListening = true);
    Voice.onSpeechEnd = () => (this.isListening = false);
    Voice.onSpeechResults = (e: any) => {
      const results = e.value;
      if (results && results.some((r: string) => r.toLowerCase().includes('help') || r.toLowerCase().includes('emergency'))) {
        this.onEmergencyTriggered?.();
      }
    };
  }

  static setEmergencyCallback(callback: () => void) {
    this.onEmergencyTriggered = callback;
  }

  static async startListening() {
    if (!Voice) return;
    try {
      await Voice.start('en-US');
    } catch (e) {
      console.error('Failed to start voice listener', e);
    }
  }

  static async stopListening() {
    if (!Voice) return;
    try {
      await Voice.stop();
    } catch (e) {
      console.error('Failed to stop voice listener', e);
    }
  }

  static async captureSpeechOnce(): Promise<string> {
    if (!Voice) {
      return Promise.reject('Voice input not available in Expo Go. Please use a development build.');
    }
    return new Promise(async (resolve, reject) => {
      const originalOnResults = Voice.onSpeechResults;
      const originalOnEnd = Voice.onSpeechEnd;

      Voice.onSpeechResults = (e: any) => {
        if (e.value && e.value.length > 0) {
          resolve(e.value[0]);
        }
      };

      Voice.onSpeechEnd = async () => {
        Voice.onSpeechResults = originalOnResults;
        Voice.onSpeechEnd = originalOnEnd;
        this.isListening = false;
      };

      try {
        await Voice.start('en-US');
      } catch (err) {
        reject(err);
      }
    });
  }

  static speak(text: string) {
    Speech.speak(text, { pitch: 1.0, rate: 1.0 });
  }
}

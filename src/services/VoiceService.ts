import Voice from '@react-native-voice/voice';
import * as Speech from 'expo-speech';

export class VoiceService {
  private static isListening = false;

  static async init() {
    Voice.onSpeechStart = () => (this.isListening = true);
    Voice.onSpeechEnd = () => (this.isListening = false);
    Voice.onSpeechResults = (e) => {
      const results = e.value;
      if (results && results.some(r => r.toLowerCase().includes('help') || r.toLowerCase().includes('emergency'))) {
        this.onEmergencyTriggered?.();
      }
    };
  }

  private static onEmergencyTriggered: (() => void) | null = null;

  static setEmergencyCallback(callback: () => void) {
    this.onEmergencyTriggered = callback;
  }

  static async startListening() {
    try {
      await Voice.start('en-US');
    } catch (e) {
      console.error('Failed to start voice listener', e);
    }
  }

  static async stopListening() {
    try {
      await Voice.stop();
    } catch (e) {
      console.error('Failed to stop voice listener', e);
    }
  }

  static async captureSpeechOnce(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const originalOnResults = Voice.onSpeechResults;
      const originalOnEnd = Voice.onSpeechEnd;

      Voice.onSpeechResults = (e) => {
        if (e.value && e.value.length > 0) {
          resolve(e.value[0]);
        }
      };

      Voice.onSpeechEnd = async () => {
        // Restore originals
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
    Speech.speak(text, {
      pitch: 1.0,
      rate: 1.0,
    });
  }
}

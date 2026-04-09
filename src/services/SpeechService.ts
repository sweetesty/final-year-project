import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

export class SpeechService {
  private static isSpeaking = false;

  // Best natural-sounding voices per platform
  // iOS: Samantha (US English neural voice, Apple's most natural)
  // Android: falls back to language match — 'en-US' with lower rate sounds best
  private static getVoiceOptions() {
    if (Platform.OS === 'ios') {
      return {
        voice: 'com.apple.ttsbundle.Samantha-compact', // warm US English, built into all iPhones
        pitch: 1.0,
        rate: 0.88,
      };
    }
    return {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.85,
    };
  }

  static async speak(text: string) {
    if (this.isSpeaking) {
      await Speech.stop();
    }
    this.isSpeaking = true;
    Speech.speak(text, {
      ...this.getVoiceOptions(),
      onDone:  () => { this.isSpeaking = false; },
      onError: () => { this.isSpeaking = false; },
    });
  }

  static async stop() {
    await Speech.stop();
    this.isSpeaking = false;
  }
}

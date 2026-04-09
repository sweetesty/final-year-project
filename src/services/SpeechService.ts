import * as Speech from 'expo-speech';

export class SpeechService {
  private static isSpeaking = false;

  static async speak(text: string) {
    if (this.isSpeaking) {
      await Speech.stop();
    }

    this.isSpeaking = true;
    Speech.speak(text, {
      language: 'en-GB',   // British English — warmer, more natural on iOS/Android
      pitch: 1.05,         // Very slightly above neutral — less monotone
      rate: 0.82,          // Slower than default — more conversational, less rushed
      onDone: () => { this.isSpeaking = false; },
      onError: () => { this.isSpeaking = false; },
    });
  }

  static async stop() {
    await Speech.stop();
    this.isSpeaking = false;
  }
}

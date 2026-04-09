import * as Speech from 'expo-speech';

export class SpeechService {
  private static isSpeaking = false;

  static async speak(text: string) {
    if (this.isSpeaking) {
      await Speech.stop();
    }

    this.isSpeaking = true;
    Speech.speak(text, {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.9,
      onDone: () => { this.isSpeaking = false; },
      onError: () => { this.isSpeaking = false; },
    });
  }

  static async stop() {
    await Speech.stop();
    this.isSpeaking = false;
  }
}

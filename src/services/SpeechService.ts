import * as Speech from 'expo-speech';

export class SpeechService {
  private static isSpeaking = false;

  static async speak(text: string) {
    try {
      if (this.isSpeaking) await Speech.stop();
      this.isSpeaking = true;

      Speech.speak(text, {
        language: 'en-US',
        rate: 0.86,
        pitch: 1.0,
        onDone:  () => { this.isSpeaking = false; },
        onError: () => { this.isSpeaking = false; },
      });
    } catch (e) {
      this.isSpeaking = false;
      console.warn('[Speech] speak() failed:', e);
    }
  }

  static async stop() {
    try { await Speech.stop(); } catch {}
    this.isSpeaking = false;
  }
}

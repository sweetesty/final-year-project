import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { documentDirectory, getInfoAsync, makeDirectoryAsync, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { encode } from 'base64-arraybuffer';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';

// Orpheus voices: tara, leah, jess, leo, dan, mia, zac, zoe
// "tara" is warm and natural — good for a health companion
const GROQ_VOICE = 'hannah'; // warm, natural female voice
const GROQ_TTS_MODEL = 'canopylabs/orpheus-v1-english';

let _sound: Audio.Sound | null = null;

function _getCacheKey(text: string, voice: string): string {
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
  const hash = Math.abs(
    text.length + text.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0)
  );
  return `groq_${voice}_${clean}_${hash}.wav`;
}

async function _stopCurrent() {
  if (_sound) {
    try {
      await _sound.stopAsync();
      await _sound.unloadAsync();
    } catch (_) {}
    _sound = null;
  }
}

async function _speakGroq(text: string): Promise<boolean> {
  if (!GROQ_API_KEY) return false;

  try {
    const cacheKey = _getCacheKey(text, GROQ_VOICE);
    const cacheDir = documentDirectory + 'groq_tts_cache/';
    const cacheUri = cacheDir + cacheKey;

    // Ensure cache directory exists
    const dirInfo = await getInfoAsync(cacheDir);
    if (!dirInfo.exists) {
      await makeDirectoryAsync(cacheDir, { intermediates: true });
    }

    // Use cached audio if available
    const cacheInfo = await getInfoAsync(cacheUri);
    if (!cacheInfo.exists) {
      console.log('[SpeechService] Generating Groq TTS audio...');
      const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_TTS_MODEL,
          input: text,
          voice: GROQ_VOICE,
          response_format: 'wav',
        }),
      });

      if (!response.ok) {
        console.warn('[SpeechService] Groq TTS error:', response.status, await response.text());
        return false;
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = encode(arrayBuffer);
      await writeAsStringAsync(cacheUri, base64, { encoding: EncodingType.Base64 });
      console.log('[SpeechService] Groq TTS audio saved to cache.');
    } else {
      console.log('[SpeechService] Using cached Groq TTS audio.');
    }

    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });

    const { sound } = await Audio.Sound.createAsync(
      { uri: cacheUri },
      { shouldPlay: true, volume: 1.0 }
    );
    _sound = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (_sound === sound) _sound = null;
      }
    });

    return true;
  } catch (e) {
    console.warn('[SpeechService] Groq TTS failed, falling back to native:', e);
    return false;
  }
}

function _fallbackSpeak(text: string, lng?: string) {
  const clean = lng?.toLowerCase() ?? 'en';

  let languageCode = 'en-US';
  let rate = 0.88;
  let pitch = 1.0;

  if (clean.startsWith('yo')) {
    languageCode = 'yo-NG';
    rate = 0.80; // speak slower for tonal language clarity
    pitch = 1.05;
  } else if (clean.startsWith('ig')) {
    languageCode = 'ig-NG';
    rate = 0.80;
    pitch = 1.0;
  } else if (clean.startsWith('ha')) {
    languageCode = 'ha-NG';
    rate = 0.82;
    pitch = 0.98;
  }

  console.log(`[SpeechService] Native TTS → ${languageCode}`);
  Speech.speak(text, { language: languageCode, rate, pitch, volume: 1.0 });
}

const GROQ_SUPPORTED_LANGS = ['en'];

function _isGroqSupported(lng?: string): boolean {
  if (!lng) return true; // default English
  const l = lng.toLowerCase();
  return GROQ_SUPPORTED_LANGS.some(code => l.startsWith(code));
}

export class SpeechService {
  static async speak(text: string, lng?: string) {
    if (!text) return;
    try {
      await _stopCurrent();
      Speech.stop();

      // For non-English languages skip Groq entirely — it's English-only
      if (!_isGroqSupported(lng)) {
        _fallbackSpeak(text, lng);
        return;
      }

      const success = await _speakGroq(text);
      if (!success) {
        _fallbackSpeak(text, lng);
      }
    } catch (e) {
      console.warn('[SpeechService] speak() error:', e);
      _fallbackSpeak(text, lng);
    }
  }

  static async stop() {
    try {
      await _stopCurrent();
      Speech.stop();
    } catch (e) {
      console.warn('[SpeechService] stop() failed:', e);
    }
  }
}

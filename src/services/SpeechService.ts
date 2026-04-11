import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import { encode } from 'base64-arraybuffer';

// ElevenLabs voice IDs — "Rachel" is calm, warm, natural (great for health apps)
const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

// Language → ElevenLabs model. Multilingual v2 handles Yoruba/Igbo/Hausa better.
const MULTILINGUAL_LANGS = ['yo', 'ig', 'ha'];

const EL_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? '';

let _sound: Audio.Sound | null = null;

/**
 * Creates a stable filename for a given text and language.
 * Used to avoid re-downloading the same audio (Saving Credits!).
 */
function _getCacheKey(text: string, lng: string): string {
  // Simple alphanumeric hash for filename safety
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
  const hash = text.length + text.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
  return `el_${lng}_${clean}_${Math.abs(hash)}.mp3`;
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

async function _speakElevenLabs(text: string, lng: string): Promise<boolean> {
  if (!EL_API_KEY || EL_API_KEY === 'her_key_here') {
    return false;
  }

  try {
    const cacheKey = _getCacheKey(text, lng);
    const cacheUri = FileSystem.documentDirectory + 'audio_cache/' + cacheKey;

    // 1. Ensure cache directory exists
    const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory + 'audio_cache/');
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + 'audio_cache/', { intermediates: true });
    }

    // 2. Check if we already have this audio saved (Credit Saver!)
    const cacheInfo = await FileSystem.getInfoAsync(cacheUri);
    let playUri = cacheUri;

    if (cacheInfo.exists) {
      console.log('[SpeechService] Using Cached Local Audio (Credit Saved!):', cacheKey);
    } else {
      console.log('[SpeechService] Generating New ElevenLabs Audio...');
      const isMultilingual = MULTILINGUAL_LANGS.some(l => lng.startsWith(l));
      const modelId = isMultilingual ? 'eleven_multilingual_v2' : 'eleven_turbo_v2_5';

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': EL_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
              stability: 0.55,
              similarity_boost: 0.80,
              style: 0.20,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        console.warn('[SpeechService] ElevenLabs API error:', response.status);
        return false;
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = encode(arrayBuffer);
      await FileSystem.writeAsStringAsync(cacheUri, base64, {
        encoding: 'base64' as any,
      });
    }

    // 3. Play the audio (either freshly downloaded or cached)
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: playUri },
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
    console.warn('[SpeechService] ElevenLabs failed, falling back:', e);
    return false;
  }
}

function _fallbackSpeak(text: string, lng?: string) {
  console.log('[SpeechService] Playing Native Robot Voice (Fallback)');
  let languageCode = 'en-US';
  const clean = lng?.toLowerCase() ?? 'en';
  if (clean.startsWith('yo')) languageCode = 'yo-NG';
  else if (clean.startsWith('ig')) languageCode = 'ig-NG';
  else if (clean.startsWith('ha')) languageCode = 'ha-NG';

  Speech.speak(text, { language: languageCode, rate: 0.88, pitch: 1.0, volume: 1.0 });
}

export class SpeechService {
  static async speak(text: string, lng?: string) {
    if (!text) return;

    try {
      await _stopCurrent();
      await Speech.stop();

      const success = await _speakElevenLabs(text, lng ?? 'en');
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
      await Speech.stop();
    } catch (e) {
      console.warn('[SpeechService] stop() failed:', e);
    }
  }
}

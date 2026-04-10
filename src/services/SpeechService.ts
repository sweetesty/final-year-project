import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';

// ElevenLabs voice IDs — "Rachel" is calm, warm, natural (great for health apps)
const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

// Language → ElevenLabs model. Multilingual v2 handles Yoruba/Igbo/Hausa better.
const MULTILINGUAL_LANGS = ['yo', 'ig', 'ha'];

const EL_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? '';

let _sound: Audio.Sound | null = null;

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
  if (!EL_API_KEY) return false;

  try {
    const isMultilingual = MULTILINGUAL_LANGS.some(l => lng.startsWith(l));
    const modelId = isMultilingual
      ? 'eleven_multilingual_v2'
      : 'eleven_turbo_v2_5'; // fastest + most natural for English

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
            stability: 0.55,        // slight variation → feels human
            similarity_boost: 0.80, // stays true to Rachel's voice
            style: 0.20,            // gentle expressiveness
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      console.warn('[SpeechService] ElevenLabs API error:', response.status);
      return false;
    }

    // Write audio blob to a temp file (expo-av needs a URI)
    const arrayBuffer = await response.arrayBuffer();
    const base64 = _arrayBufferToBase64(arrayBuffer);
    const uri = FileSystem.cacheDirectory + `el_tts_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, volume: 1.0 }
    );
    _sound = sound;

    // Clean up after playback finishes
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        if (_sound === sound) _sound = null;
      }
    });

    return true;
  } catch (e) {
    console.warn('[SpeechService] ElevenLabs failed, falling back:', e);
    return false;
  }
}

function _arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function _fallbackSpeak(text: string, lng?: string) {
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
      // Stop anything currently playing
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

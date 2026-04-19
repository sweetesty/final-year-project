import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { documentDirectory, getInfoAsync, makeDirectoryAsync, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { encode } from 'base64-arraybuffer';
import i18n from '@/src/i18n';

const TTS_BACKEND_URL = process.env.EXPO_PUBLIC_TTS_BACKEND_URL ?? '';
const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? '';
const ELEVENLABS_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah - Clean, professional medical tone

let _sound: Audio.Sound | null = null;

function _getCacheKey(text: string, locale: string): string {
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
  const hash = Math.abs(
    text.length + text.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0)
  );
  return `yarn_${locale}_${clean}_${hash}.mp3`;
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

async function _speakYarn(text: string, locale: string): Promise<boolean> {
  if (!TTS_BACKEND_URL) return false;

  try {
    const cacheKey = _getCacheKey(text, locale);
    const cacheDir = documentDirectory + 'yarn_tts_cache/';
    const cacheUri = cacheDir + cacheKey;

    const dirInfo = await getInfoAsync(cacheDir);
    if (!dirInfo.exists) {
      await makeDirectoryAsync(cacheDir, { intermediates: true });
    }

    const cacheInfo = await getInfoAsync(cacheUri);
    if (!cacheInfo.exists) {
      const response = await fetch(`${TTS_BACKEND_URL}/api/tts/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, locale, format: 'mp3' }),
      });

      if (!response.ok) {
        console.warn('[SpeechService] YarnGPT backend error:', response.status);
        return false;
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = encode(arrayBuffer);
      await writeAsStringAsync(cacheUri, base64, { encoding: EncodingType.Base64 });
    }

    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });

    const { sound } = await Audio.Sound.createAsync(
      { uri: cacheUri },
      { shouldPlay: true, volume: 1.0 },
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
    console.warn('[SpeechService] YarnGPT TTS failed, falling back to native:', e);
    return false;
  }
}

async function _speakElevenLabs(text: string): Promise<boolean> {
  if (!ELEVENLABS_API_KEY) return false;

  try {
    const cacheKey = `eleven_${Math.abs(text.length + text.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0))}.mp3`;
    const cacheDir = documentDirectory + 'eleven_tts_cache/';
    const cacheUri = cacheDir + cacheKey;

    const dirInfo = await getInfoAsync(cacheDir);
    if (!dirInfo.exists) {
      await makeDirectoryAsync(cacheDir, { intermediates: true });
    }

    const cacheInfo = await getInfoAsync(cacheUri);
    if (!cacheInfo.exists) {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });

      if (!response.ok) {
        console.warn('[SpeechService] ElevenLabs error:', response.status);
        return false;
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = encode(arrayBuffer);
      await writeAsStringAsync(cacheUri, base64, { encoding: EncodingType.Base64 });
    }

    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });

    const { sound } = await Audio.Sound.createAsync(
      { uri: cacheUri },
      { shouldPlay: true, volume: 1.0 },
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
    console.warn('[SpeechService] ElevenLabs failed:', e);
    return false;
  }
}

function _fallbackSpeak(text: string, lng?: string) {
  let languageCode = 'en-US';
  const clean = lng?.toLowerCase() ?? 'en';
  if (clean.startsWith('yo')) languageCode = 'yo-NG';
  else if (clean.startsWith('ig')) languageCode = 'ig-NG';
  else if (clean.startsWith('ha')) languageCode = 'ha-NG';
  else if (clean.startsWith('pcm')) languageCode = 'en-NG'; // Nigerian English accent for Pidgin
  
  console.log('[SpeechService] Fallback to native TTS:', { text, languageCode });
  Speech.speak(text, { language: languageCode, rate: 0.88, pitch: 1.05, volume: 1.0 });
}

export class SpeechService {
  static async speak(text: string, lng?: string) {
    if (!text) return;
    try {
      await _stopCurrent();
      Speech.stop();

      const language = lng?.toLowerCase() ?? i18n.language?.toLowerCase() ?? 'en';
      
      let success = false;
      const isEnglish = language === 'en' || language.startsWith('en-');
      
      if (isEnglish) {
        console.log('[SpeechService] Attempting ElevenLabs/Groq Voice for:', language);
        success = await _speakElevenLabs(text);
      } else {
        console.log('[SpeechService] Attempting YarnGPT for:', language);
        success = await _speakYarn(text, language);
      }

      if (success) return;

      _fallbackSpeak(text, language);
    } catch (e) {
      console.warn('[SpeechService] speak() error:', e);
      _fallbackSpeak(text, lng || i18n.language);
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

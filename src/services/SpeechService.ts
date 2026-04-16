import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { documentDirectory, getInfoAsync, makeDirectoryAsync, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { encode } from 'base64-arraybuffer';
import i18n from '@/src/i18n';

const TTS_BACKEND_URL = process.env.EXPO_PUBLIC_TTS_BACKEND_URL ?? '';
const CACHE_DIR = documentDirectory + 'yarn_tts_cache/';

let _sound: Audio.Sound | null = null;
let _audioModeSet = false;
let _cacheDirReady = false;

// In-flight fetch deduplication: cacheKey → Promise<string> (uri)
const _inflight = new Map<string, Promise<string>>();

function _getCacheKey(text: string, locale: string): string {
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
  const hash = Math.abs(
    text.length + text.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0)
  );
  return `yarn_${locale}_${clean}_${hash}.mp3`;
}

async function _ensureCacheDir() {
  if (_cacheDirReady) return;
  const info = await getInfoAsync(CACHE_DIR);
  if (!info.exists) await makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  _cacheDirReady = true;
}

async function _ensureAudioMode() {
  if (_audioModeSet) return;
  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
  _audioModeSet = true;
}

async function _stopCurrent() {
  if (_sound) {
    try { await _sound.stopAsync(); await _sound.unloadAsync(); } catch (_) {}
    _sound = null;
  }
}

// Returns the local URI for the audio, fetching only once per unique text+locale.
function _getAudioUri(text: string, locale: string): Promise<string> {
  const key = _getCacheKey(text, locale);
  const uri = CACHE_DIR + key;

  // Return existing in-flight promise for this key (deduplicates rapid taps)
  if (_inflight.has(key)) return _inflight.get(key)!;

  const promise = (async (): Promise<string> => {
    try {
      await _ensureCacheDir();
      const cached = await getInfoAsync(uri);
      if (cached.exists) return uri;

      const response = await fetch(`${TTS_BACKEND_URL}/api/tts/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, locale, format: 'mp3' }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const base64 = encode(await response.arrayBuffer());
      await writeAsStringAsync(uri, base64, { encoding: EncodingType.Base64 });
      return uri;
    } finally {
      _inflight.delete(key);
    }
  })();

  _inflight.set(key, promise);
  return promise;
}

function _fallbackSpeak(text: string, lng?: string) {
  let languageCode = 'en-US';
  const clean = lng?.toLowerCase() ?? 'en';
  if (clean.startsWith('yo')) languageCode = 'yo-NG';
  else if (clean.startsWith('ig')) languageCode = 'ig-NG';
  else if (clean.startsWith('ha')) languageCode = 'ha-NG';
  Speech.speak(text, { language: languageCode, rate: 0.88, pitch: 1.05, volume: 1.0 });
}

export class SpeechService {
  static async speak(text: string, lng?: string) {
    if (!text) return;

    // Stop whatever is currently playing immediately — don't await the fetch first
    _stopCurrent();
    Speech.stop();

    const language = lng?.toLowerCase() ?? i18n.language?.toLowerCase() ?? 'en';

    if (!TTS_BACKEND_URL) {
      _fallbackSpeak(text, language);
      return;
    }

    try {
      // Kick off audio fetch (or reuse in-flight) and audio mode setup in parallel
      const [uri] = await Promise.all([
        _getAudioUri(text, language),
        _ensureAudioMode(),
      ]);

      // If the user tapped again while we were fetching, _sound will have changed
      // — just play the latest request.
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: 1.0 },
      );
      _sound = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          if (_sound === sound) _sound = null;
        }
      });
    } catch (e) {
      console.warn('[SpeechService] YarnGPT TTS failed, falling back to native:', e);
      _fallbackSpeak(text, language);
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

  /** Pre-warm the cache for a piece of text (call when screen loads). */
  static prefetch(text: string, lng?: string) {
    if (!TTS_BACKEND_URL || !text) return;
    const language = lng?.toLowerCase() ?? i18n.language?.toLowerCase() ?? 'en';
    _getAudioUri(text, language).catch(() => {});
  }
}

import { Router, Request, Response } from 'express';

const router = Router();

const YARNGPT_API_KEY = process.env.YARNGPT_API_KEY ?? '';
const YARNGPT_URL = 'https://yarngpt.ai/api/v1/tts';

// Maps i18n locale → best YarnGPT voice
const LOCALE_VOICE: Record<string, string> = {
  en:  'Idera',
  yo:  'Wura',   // Yoruba
  ha:  'Umar',   // Hausa
  ig:  'Adaora', // Igbo
  pcm: 'Osagie', // Nigerian Pidgin
};

export type YarnVoice =
  | 'Idera' | 'Emma' | 'Zainab' | 'Osagie' | 'Wura' | 'Jude'
  | 'Chinenye' | 'Tayo' | 'Regina' | 'Femi' | 'Adaora' | 'Umar'
  | 'Mary' | 'Nonso' | 'Remi' | 'Adam';

/**
 * POST /api/tts/speak
 * Body: { text: string, voice?: YarnVoice, locale?: string, format?: 'mp3'|'wav' }
 * Returns: audio/mpeg (or audio/wav) stream
 */
router.post('/speak', async (req: Request, res: Response) => {
  const { text, voice, locale, format = 'mp3' } = req.body as {
    text?: string;
    voice?: YarnVoice;
    locale?: string;
    format?: 'mp3' | 'wav';
  };

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  if (text.length > 2000) {
    res.status(400).json({ error: 'text must be 2000 characters or fewer' });
    return;
  }

  if (!YARNGPT_API_KEY) {
    res.status(500).json({ error: 'YARNGPT_API_KEY is not configured on the server' });
    return;
  }

  // Resolve voice: explicit > locale-mapped > default
  const resolvedVoice: string =
    voice ?? LOCALE_VOICE[locale?.toLowerCase().slice(0, 2) ?? 'en'] ?? 'Idera';

  try {
    const upstream = await fetch(YARNGPT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${YARNGPT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text.trim(), voice: resolvedVoice, response_format: format }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error('[tts] YarnGPT error:', upstream.status, errText);
      res.status(upstream.status).json({ error: 'YarnGPT upstream error', detail: errText });
      return;
    }

    const contentType = upstream.headers.get('content-type') ?? (format === 'wav' ? 'audio/wav' : 'audio/mpeg');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache audio 24h on CDN/client

    // Stream the audio directly to the client
    const arrayBuffer = await upstream.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('[tts] Request failed:', err);
    res.status(502).json({ error: 'Failed to reach YarnGPT' });
  }
});

/**
 * GET /api/tts/voices
 * Returns the list of available voices and their locale mapping
 */
router.get('/voices', (_req, res) => {
  res.json({
    voices: [
      'Idera', 'Emma', 'Zainab', 'Osagie', 'Wura', 'Jude',
      'Chinenye', 'Tayo', 'Regina', 'Femi', 'Adaora', 'Umar',
      'Mary', 'Nonso', 'Remi', 'Adam',
    ],
    localeDefaults: LOCALE_VOICE,
  });
});

export default router;

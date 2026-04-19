import OpenAI from 'openai';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
console.log('[GroqService] API Key Initialization:', GROQ_API_KEY ? 'LOADED (Active)' : 'MISSING (Check .env)');

// Groq handles both text and vision — OpenAI-compatible endpoint
const groq = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
  dangerouslyAllowBrowser: true,
});

const SYSTEM_PROMPT = `
You are a warm, compassionate, and intelligent healthcare AI companion for the "Vitals Fusion" platform.
Your primary goal is to help patients feel safe, supported, and informed.

### YOUR CONTEXT:
You have real-time access to the patient's medical profile, medication schedule, and adherence history.
- **Tone**: Friendly, empathetic, and encouraging (like a clinical companion).
- **Medical Advice**: Provide general guidance but always recommend consulting their doctor for any changes.
- **Safety First**: If a fall or severe pain is mentioned, immediately prioritize emergency instructions.
- **Conciseness**: Keep responses short and easy for elderly users to digest.
- **Images**: When given an image, carefully analyze it. For wounds describe severity and first-aid steps. For medications describe the drug name, dosage, and any warnings. For food describe nutritional value relevant to the patient.

### PATIENT SNAPSHOT:
{patient_context}
`;

export class OpenAiService {
  static async sendMessage(message: string, context: string = 'No recent data'): Promise<string> {
    try {
      if (!GROQ_API_KEY) {
        return "AI assistant is not configured. Please add a Groq API key to continue.";
      }

      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT.replace('{patient_context}', context) },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      return response.choices[0]?.message?.content || "I'm sorry, I couldn't process that. I'm still here for you.";
    } catch (error) {
      console.error('[GroqService] Error:', error);
      return "I'm having a little trouble connecting right now. Please stay calm — I'm still monitoring your vitals locally.";
    }
  }

  // Analyse an image (base64 data URL) with an optional text prompt — uses Groq vision model
  static async analyzeImage(base64DataUrl: string, prompt: string, context: string = 'No recent data'): Promise<string> {
    try {
      if (!GROQ_API_KEY) {
        return "AI assistant is not configured. Please add a Groq API key to continue.";
      }

      const response = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT.replace('{patient_context}', context) },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: base64DataUrl } },
              { type: 'text', text: prompt || 'Please analyze this image and tell me what you see from a medical perspective.' },
            ],
          },
        ],
        max_tokens: 400,
      });

      return response.choices[0]?.message?.content || "I couldn't analyze that image. Please try again.";
    } catch (error) {
      console.error('[GroqVision] Error:', error);
      return "I had trouble analyzing that image. Please try again or describe what you're seeing.";
    }
  }

  static async getInitialFallComfort(patientName: string): Promise<string> {
    const prompt = `A fall was just detected for ${patientName}. Provide a 1-sentence, extremely comforting, and professional response to check if they are okay and tell them not to move. Be warm like a clinical companion.`;
    return this.sendMessage(prompt, 'EMERGENCY INITIAL CONTACT');
  }

  static async getEmergencyTriage(userInput: string, vitals: string): Promise<string> {
    const prompt = `EMERGENCY ALERT: A fall was detected. The patient says: "${userInput}".
Vitals at time of fall: ${vitals}.
Provide a 1-2 sentence response that is extremely comforting and assesses their consciousness. Do not use special characters or asterisks.`;

    return this.sendMessage(prompt, 'EMERGENCY CRITICAL STATE');
  }

  static async generateClinicalNarrative(healthData: any): Promise<string> {
    console.log('[GroqService] Attempting to generate clinical narrative...');
    try {
      if (!GROQ_API_KEY) {
        console.warn('[GroqService] MISSING API KEY in environment.');
        return "AI summary requires a configured Groq API key.";
      }
      console.log('[GroqService] Requesting from llama-3.3-70b-versatile...');
      const prompt = `
You are a warm, professional Clinical Companion. Review the patient's current health data and write a 2-3 sentence personalized health briefing spoken directly to them.
Encourage them based on their vitals and remind them of their status in a comforting way.
Keep it concise and conversational. No introductory fluff. Avoid jargon.

PATIENT DATA:
${JSON.stringify(healthData)}
`;
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, 
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content || "I'm having trouble analyzing the clinical data right now.";
      console.log('[GroqService] Received narrative length:', content.length);
      // Sanitize for TTS (remove markdown asterisks, etc.)
      return content.replace(/\*/g, '').replace(/#/g, '').trim();
    } catch (error) {
      console.error('[GroqService] Clinical Narrative Error:', error);
      return "I'm having trouble analyzing the clinical data right now.";
    }
  }
}


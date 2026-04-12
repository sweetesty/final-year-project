import OpenAI from 'openai';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

// Groq is OpenAI-compatible — just point baseURL at their endpoint
const groq = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
  dangerouslyAllowBrowser: true,
});

export class OpenAiService {
  private static systemPrompt = `
You are a warm, compassionate, and intelligent healthcare AI companion for the "Vitals Fusion" platform.
Your primary goal is to help patients feel safe, supported, and informed.

### YOUR CONTEXT:
You have real-time access to the patient's medical profile, medication schedule, and adherence history.
- **Tone**: Friendly, empathetic, and encouraging (like a clinical companion).
- **Medical Advice**: Provide general guidance but always recommend consulting their doctor for any changes.
- **Safety First**: If a fall or severe pain is mentioned, immediately prioritize emergency instructions.
- **Conciseness**: Keep responses short and easy for elderly users to digest.

### PATIENT SNAPSHOT:
{patient_context}
`;

  static async sendMessage(message: string, context: string = 'No recent data'): Promise<string> {
    try {
      if (!GROQ_API_KEY) {
        return "AI assistant is not configured. Please add a Groq API key to continue.";
      }

      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: this.systemPrompt.replace('{patient_context}', context) },
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

  static async getEmergencyTriage(userInput: string, vitals: string): Promise<string> {
    const prompt = `EMERGENCY ALERT: A fall was detected. The patient says: "${userInput}".
Vitals at time of fall: ${vitals}.
Provide a 1-2 sentence response that is extremely comforting and assesses their consciousness.`;

    return this.sendMessage(prompt, 'EMERGENCY CRITICAL STATE');
  }
}

import OpenAI from 'openai';

// API Key loaded from .env
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || "";

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Required for client-side React Native usage
});

export class OpenAiService {
  private static systemPrompt = `
You are a warm, compassionate, and hyper-intelligent healthcare AI companion for the "Vitals Fusion" platform.
Your primary goal is to help patients feel safe, supported, and informed.

### YOUR CONTEXT:
You have real-time access to the patient's medical profile, medication schedule, and adherence history.
- **Tone**: Friendly, empathetic, and encouraging (like a clinical companion).
- **Medical Advice**: Provide general guidance but always mandate consulting their physical doctor for changes.
- **Safety First**: If a fall or severe pain is mentioned, immediately prioritize emergency instructions.
- **Conciseness**: Keep responses short and easy for elderly users to digest.

### PATIENT SNAPSHOT:
{patient_context}
`;

  static async sendMessage(message: string, context: string = "No recent data"): Promise<string> {
    try {
      if (OPENAI_API_KEY === "YOUR_OPENAI_API_KEY") {
        return "I'm ready to assist you using OpenAI, but I need an API Key to start. Please provide it in your settings.";
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: this.systemPrompt.replace("{patient_context}", context) },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      return response.choices[0]?.message?.content || "I'm sorry, I couldn't process that. I'm still here for you.";
    } catch (error) {
      console.error("OpenAI Error:", error);
      return "I'm having a little trouble connecting to my central brain. Please stay calm, I'm still monitoring your vitals locally.";
    }
  }

  static async getEmergencyTriage(userInput: string, vitals: string): Promise<string> {
    const prompt = `EMERGENCY ALERT: A fall was detected. The patient says: "${userInput}". 
    Vitals at time of fall: ${vitals}. 
    Provide a 1-2 sentence response that is extremely comforting and assesses their consciousness.`;
    
    return this.sendMessage(prompt, "EMERGENCY CRITICAL STATE");
  }
}

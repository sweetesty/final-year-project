import { GoogleGenerativeAI } from "@google/generative-ai";

// Gemini Settings - Loaded from .env
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "YOUR_GEMINI_API_KEY";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export interface ChatMessage {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

const SYSTEM_INSTRUCTION = `
You are a warm, compassionate, and companion-like healthcare AI assistant for the "Vitals Fusion" platform.
Your primary goal is to help patients feel safe, supported, and informed.
- Keep your tone friendly, empathetic, and encouraging.
- Provide general health advice but always remind the user to consult their doctor for clinical decisions.
- If the user mentions pain, falling, or an emergency, prioritize safety instructions (e.g., "Please try to stay still, I am alerting your emergency contacts").
- Keep responses concise and easy to understand for elderly users.
`;

export class AiChatService {
  private static chat = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION
  }).startChat({
    history: [],
  });

  static async sendMessage(message: string): Promise<string> {
    try {
      if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
        return "I'm ready to help, but I need my Gemini API Key to start our conversation. Please provide it in the settings!";
      }

      const result = await this.chat.sendMessage(message);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini Error:", error);
      return "I'm sorry, I'm having a little trouble connecting right now. Don't worry, I'm still here with you.";
    }
  }

  static async getEmergencyTriageResponse(userInput: string): Promise<string> {
    const prompt = `EMERGENCY ALERT: A fall was detected. The user just said: "${userInput}". 
    Assess their consciousness and pain level. Provide a very short, comforting response (max 2 sentences).`;
    
    return this.sendMessage(prompt);
  }
}

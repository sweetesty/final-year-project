import { useState, useCallback } from 'react';
import { OpenAiService } from '../services/OpenAiService';
import { SpeechService } from '../services/SpeechService';
import { VoiceService } from '../services/VoiceService';
import { supabase } from '../services/SupabaseService';
import { useAuthViewModel } from './useAuthViewModel';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

export const useAiAssistantViewModel = () => {
  const { session } = useAuthViewModel();
  const patientId = session?.user?.id ?? '';
  const patientName = session?.user?.user_metadata?.full_name ?? 'the patient';

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your Vitals Fusion AI companion. How are you feeling today?",
      sender: 'assistant',
      timestamp: new Date(),
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const getPatientContext = async () => {
    if (!patientId) return "Patient not authenticated.";
    try {
      // 1. Fetch Medications
      const { data: meds } = await supabase
        .from('medications')
        .select('name, dosage, frequency')
        .eq('patientid', patientId);

      // 2. Fetch Profile
      const { data: profile } = await supabase
        .from('medical_details')
        .select('*')
        .eq('patientid', patientId)
        .single();

      return `
      PATIENT NAME: ${patientName}
      MEDICATIONS: ${meds?.map(m => `${m.name} (${m.dosage}) ${m.frequency}`).join(', ') || 'No medications listed'}
      MEDICAL PROFILE: ${profile ? JSON.stringify(profile) : 'No medical profile on record'}
      `;
    } catch (error) {
      console.error("Context Fetch Error:", error);
      return "Current health data unavailable, proceed with general empathy.";
    }
  };

  const sendMessage = useCallback(async (text: string, voiceMode = false) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const context = await getPatientContext();
    const responseText = await OpenAiService.sendMessage(text, context);
    
    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      text: responseText,
      sender: 'assistant',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMsg]);
    setIsLoading(false);

    if (voiceMode) {
      await SpeechService.speak(responseText);
    }
  }, [patientId]);

  const startVoiceChat = async () => {
    setIsListening(true);
    try {
      // Use VoiceService to capture speech
      const text = await VoiceService.captureSpeechOnce();
      if (text) {
        await sendMessage(text, true);
      }
    } catch (error) {
      console.error("Voice Chat Error:", error);
    } finally {
      setIsListening(false);
    }
  };

  return {
    messages,
    isLoading,
    isListening,
    sendMessage,
    startVoiceChat,
  };
};

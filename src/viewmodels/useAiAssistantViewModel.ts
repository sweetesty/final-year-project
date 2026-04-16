import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
  imageUri?: string;
}

export interface PendingImage {
  uri: string;
  base64DataUrl: string;
}

export const useAiAssistantViewModel = () => {
  const { session } = useAuthViewModel();
  const patientId = session?.user?.id ?? '';
  const patientName = session?.user?.user_metadata?.full_name ?? 'the patient';

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your Vitals Fusion AI companion. How are you feeling today? You can also send me a photo of a wound or medication and I'll help analyse it.",
      sender: 'assistant',
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);

  const getPatientContext = async () => {
    if (!patientId) return 'Patient not authenticated.';
    try {
      const { data: meds } = await supabase
        .from('medications')
        .select('name, dosage, frequency')
        .eq('patientid', patientId);

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
      console.error('Context Fetch Error:', error);
      return 'Current health data unavailable, proceed with general empathy.';
    }
  };

  const sendMessage = useCallback(async (text: string, forceVoice = false) => {
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

    if (forceVoice || voiceReplyEnabled) {
      await SpeechService.speak(responseText);
    }
  }, [patientId, voiceReplyEnabled]);

  // Called after user confirms the image + caption in the preview overlay
  const sendImageMessage = useCallback(async (imageUri: string, base64DataUrl: string, caption: string) => {
    setPendingImage(null);

    const userMsg: Message = {
      id: Date.now().toString(),
      text: caption || '📷 Image',
      sender: 'user',
      timestamp: new Date(),
      imageUri,
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const context = await getPatientContext();
    const responseText = await OpenAiService.analyzeImage(base64DataUrl, caption, context);

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      text: responseText,
      sender: 'assistant',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMsg]);
    setIsLoading(false);

    if (voiceReplyEnabled) {
      await SpeechService.speak(responseText);
    }
  }, [patientId, voiceReplyEnabled]);

  // Opens image picker and stores result as pendingImage for the UI to show preview
  const openImagePicker = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to send images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      if (!asset.base64) return;

      const mimeType = asset.mimeType ?? 'image/jpeg';
      setPendingImage({
        uri: asset.uri,
        base64DataUrl: `data:${mimeType};base64,${asset.base64}`,
      });
    } catch (e) {
      console.error('[openImagePicker] error:', e);
      Alert.alert('Error', 'Could not open photo library. Please try again.');
    }
  }, []);

  const cancelPendingImage = useCallback(() => setPendingImage(null), []);

  const startVoiceChat = async () => {
    setIsListening(true);
    try {
      const text = await VoiceService.captureSpeechOnce();
      if (text) {
        await sendMessage(text, true);
      }
    } catch (error: any) {
      const msg = typeof error === 'string' ? error : error?.message ?? '';
      if (msg.toLowerCase().includes('expo go') || msg.toLowerCase().includes('not available')) {
        Alert.alert(
          'Voice Input Unavailable',
          'Voice input requires a development build. You can still type your message below.',
          [{ text: 'OK' }]
        );
      } else {
        console.error('Voice Chat Error:', error);
      }
    } finally {
      setIsListening(false);
    }
  };

  return {
    messages,
    isLoading,
    isListening,
    voiceReplyEnabled,
    setVoiceReplyEnabled,
    pendingImage,
    sendMessage,
    sendImageMessage,
    openImagePicker,
    cancelPendingImage,
    startVoiceChat,
  };
};

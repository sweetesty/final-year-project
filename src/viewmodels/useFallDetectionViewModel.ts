import { useState, useEffect, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { SensorService } from '../services/SensorService';
import { FallDetectionState } from '../models/FallEvent';
import { SpeechService } from '../services/SpeechService';
import { LocationService } from '../services/LocationService';
import { SmsService } from '../services/SmsService';
import { supabase } from '../services/SupabaseService';
import { AiModelService } from '../services/AiModelService';
import { SignalService } from '../services/SignalService';
import { OpenAiService } from '../services/OpenAiService';

export const useFallDetectionViewModel = (
  fallThreshold: number = 2.5, // G-Force threshold
  impactWindow: number = 2000 // ms
) => {
  const [state, setState] = useState<FallDetectionState>('idle');
  const [lastGForce, setLastGForce] = useState(0);
  const [timer, setTimer] = useState<number | null>(null);

  useEffect(() => {
    // Initialize AI Model
    AiModelService.init();
  }, []);

  const triggerEmergency = useCallback(async () => {
    setState('emergency_triggered');
    SpeechService.speak("I'm sorry, you didn't respond. I'm calling for help now. Please stay calm.");
    
    // 1. Get Location
    const coords = await LocationService.trackLocation('patient-123');
    const mapsLink = coords ? LocationService.getMapsLink(coords.latitude, coords.longitude) : "Unknown Location";

    // 2. Fetch Primary Contact
    const { data: contacts } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('patientId', 'patient-123')
      .eq('isPrimary', true)
      .single();

    if (contacts) {
      const message = `EMERGENCY ALERT: [Patient Name] has detected a fall! Location: ${mapsLink}`;
      await SmsService.sendEmergencySms(contacts.phone, message);
    }

    console.log('EMERGENCY TRIGGERED: Fall confirmed and alerts sent');
  }, []);

  const handleSuspiciousMovement = useCallback(async (gForce: number) => {
    setLastGForce(gForce);
    setState('suspicious');
    
    // Allow 500ms for the buffer to fill
    setTimeout(async () => {
      const { isFall, confidence } = await AiModelService.predictFall();
      
      if (isFall) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setState('user_response_window');

        // Dynamic OpenAI Triage Response
        const triageResponse = await OpenAiService.getEmergencyTriage(
          "No voice input yet", 
          `G-Force Magnitude: ${gForce.toFixed(2)}`
        );
        SpeechService.speak(triageResponse);
        
        const countdown = setTimeout(() => {
          triggerEmergency();
        }, 20000);
        setTimer(countdown as unknown as number);
      } else {
        setState('idle');
      }
    }, 500);
  }, [triggerEmergency]);

  const cancelAlert = useCallback(() => {
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }
    setState('idle');
  }, [timer]);

  useEffect(() => {
    SensorService.setUpdateInterval(100);
    SensorService.startMonitoring((data) => {
      SignalService.addSample(data);
      const gForce = SensorService.calculateGForce(data.accelerometer);
      if (state === 'idle' && gForce > fallThreshold) {
        handleSuspiciousMovement(gForce);
      }
    });

    return () => {
      SensorService.stopMonitoring();
      if (timer) clearTimeout(timer);
    };
  }, [state, fallThreshold, handleSuspiciousMovement, timer]);

  return {
    state,
    lastGForce,
    cancelAlert,
    triggerEmergency,
  };
};

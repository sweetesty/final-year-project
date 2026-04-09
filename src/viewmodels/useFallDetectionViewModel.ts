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
  patientId: string,
  patientName: string,
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
    const coords = await LocationService.trackLocation(patientId);
    const mapsLink = coords ? LocationService.getMapsLink(coords.latitude, coords.longitude) : "Unknown Location";
    const timestamp = new Date().toLocaleString();

    // 2. Log fall event to Supabase
    await supabase.from('fall_events').insert({
      patientId,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      timestamp: new Date().toISOString(),
      confirmed: true,
    });

    // 3. SMS primary emergency contact
    const { data: contact } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('patientId', patientId)
      .eq('isPrimary', true)
      .single();

    if (contact) {
      const smsMessage = `EMERGENCY ALERT: ${patientName} has detected a fall at ${timestamp}!\nLocation: ${mapsLink}`;
      await SmsService.sendEmergencySms(contact.phone, smsMessage);
    }

    // 4. Push notification to linked doctor(s)
    const { data: doctorLinks } = await supabase
      .from('doctor_patient_links')
      .select('doctor_id')
      .eq('patient_id', patientId);

    if (doctorLinks && doctorLinks.length > 0) {
      const doctorIds = doctorLinks.map((l: any) => l.doctor_id);
      const { data: doctorProfiles } = await supabase
        .from('profiles')
        .select('push_token')
        .in('id', doctorIds)
        .not('push_token', 'is', null);

      if (doctorProfiles && doctorProfiles.length > 0) {
        const tokens = doctorProfiles.map((p: any) => p.push_token).filter(Boolean);
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(tokens.map((token: string) => ({
            to: token,
            title: '🚨 EMERGENCY: Fall Detected',
            body: `${patientName} has fallen and needs assistance!\nLocation: ${mapsLink}`,
            data: { type: 'fall_alert', patientId, mapsLink },
            priority: 'high',
            sound: 'default',
          }))),
        });
      }
    }

    console.log('EMERGENCY TRIGGERED: Fall confirmed, SMS + push notifications sent');
  }, [patientId, patientName]);

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
      // Use adaptive threshold — adjusts based on recent activity level
      const adaptiveThreshold = SignalService.getAdaptiveThreshold();
      if (state === 'idle' && gForce > adaptiveThreshold) {
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
    isUserActive: SignalService.isUserActive(),
  };
};

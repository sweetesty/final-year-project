import { useState, useEffect, useCallback, useRef } from 'react';
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

const RESPONSE_WINDOW_MS = 20_000; // 20 s for user to cancel before emergency

export const useFallDetectionViewModel = (
  patientId:  string,
  patientName: string,
) => {
  const [state,     setState]     = useState<FallDetectionState>('idle');
  const [lastGForce, setLastGForce] = useState(0);

  // Use a ref for the countdown so cancelAlert always clears the live timer
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Init AI model once ────────────────────────────────────────────────────
  useEffect(() => {
    AiModelService.init();
  }, []);

  // ── Emergency dispatch ────────────────────────────────────────────────────
  const triggerEmergency = useCallback(async () => {
    setState('emergency_triggered');
    SpeechService.speak("I couldn't reach you. Alerting your emergency contacts now. Please stay calm.");

    const coords   = await LocationService.trackLocation(patientId);
    const mapsLink = coords
      ? LocationService.getMapsLink(coords.latitude, coords.longitude)
      : 'Unknown Location';
    const timestamp = new Date().toLocaleString();

    // Log to Supabase — all column names lowercase to match DB schema
    await supabase.from('fall_events').insert({
      patientid:  patientId,          // DB: patientid (lowercase)
      latitude:   coords?.latitude  ?? null,
      longitude:  coords?.longitude ?? null,
      timestamp:  new Date().toISOString(),
      confirmed:  true,
      source:     'foreground',
    });

    // SMS primary emergency contact — columns: patientid, isprimary
    const { data: contact } = await supabase
      .from('emergency_contacts')
      .select('phone, name')
      .eq('patientid', patientId)     // DB: patientid
      .eq('isprimary', true)          // DB: isprimary
      .single();

    if (contact) {
      await SmsService.sendEmergencySms(
        contact.phone,
        `EMERGENCY: ${patientName} has fallen at ${timestamp}.\nLocation: ${mapsLink}\nPlease respond immediately.`,
      );
    }

    // Push notification to linked doctors
    const { data: links } = await supabase
      .from('doctor_patient_links')
      .select('doctor_id')
      .eq('patient_id', patientId);

    if (links && links.length > 0) {
      const doctorIds = links.map((l: any) => l.doctor_id);
      const { data: doctorProfiles } = await supabase
        .from('profiles')
        .select('push_token')
        .in('id', doctorIds)
        .not('push_token', 'is', null);

      const tokens = (doctorProfiles ?? []).map((p: any) => p.push_token).filter(Boolean);
      if (tokens.length > 0) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(tokens.map((token: string) => ({
            to:       token,
            title:    'EMERGENCY: Fall Detected',
            body:     `${patientName} has fallen and needs assistance. Location: ${mapsLink}`,
            data:     { type: 'fall_alert', patientId, mapsLink },
            priority: 'high',
            sound:    'default',
          }))),
        });
      }
    }

    console.log('[FallDetection] Emergency dispatched — SMS + push sent.');
  }, [patientId, patientName]);

  // ── Cancel (user pressed "I'm OK") ───────────────────────────────────────
  const cancelAlert = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState('idle');
    SpeechService.speak("Good to hear you're okay. I'll keep monitoring.");
  }, []);

  // ── Suspicious movement handler ───────────────────────────────────────────
  const handleSuspiciousMovement = useCallback(async (gForce: number) => {
    if (state !== 'idle') return;          // already handling an event

    setLastGForce(gForce);
    setState('suspicious');

    // Give the buffer ~500 ms to accumulate post-impact samples for stillness check
    await new Promise(r => setTimeout(r, 600));

    const threshold = SignalService.getAdaptiveThreshold();
    const { isFall, confidence, peakG } = await AiModelService.predictFall(threshold);

    console.log(`[FallDetection] isFall=${isFall} confidence=${confidence.toFixed(2)} peakG=${peakG.toFixed(2)}`);

    if (isFall) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setState('user_response_window');

      // AI triage voice prompt
      try {
        const triage = await OpenAiService.getEmergencyTriage(
          'No voice input',
          `Peak G-Force: ${peakG.toFixed(2)}G, confidence: ${(confidence * 100).toFixed(0)}%`,
        );
        SpeechService.speak(triage);
      } catch {
        SpeechService.speak(`${patientName}, are you okay? I detected a possible fall. If you need help, stay still. I will alert your contacts in 20 seconds.`);
      }

      // Start countdown — use ref so cancelAlert always clears the right timer
      timerRef.current = setTimeout(() => {
        triggerEmergency();
      }, RESPONSE_WINDOW_MS);
    } else {
      setState('idle');
    }
  }, [state, triggerEmergency, patientName]);

  // ── Sensor loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    SensorService.setUpdateInterval(50); // 20 Hz — better temporal resolution
    SensorService.startMonitoring((data) => {
      SignalService.addSample(data);

      if (state === 'idle') {
        const gForce    = SensorService.calculateGForce(data.accelerometer);
        const threshold = SignalService.getAdaptiveThreshold();
        if (gForce > threshold) {
          handleSuspiciousMovement(gForce);
        }
      }
    });

    return () => {
      SensorService.stopMonitoring();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state, handleSuspiciousMovement]);

  return {
    state,
    lastGForce,
    cancelAlert,
    triggerEmergency,
    isUserActive: SignalService.isUserActive(),
  };
};

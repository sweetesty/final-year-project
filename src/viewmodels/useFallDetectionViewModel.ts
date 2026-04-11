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

const RESPONSE_WINDOW_MS = 20_000;

export const useFallDetectionViewModel = (
  patientId:   string,
  patientName: string,
) => {
  const [state,      setState]      = useState<FallDetectionState>('idle');
  const [lastGForce, setLastGForce] = useState(0);

  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef    = useRef<FallDetectionState>('idle'); // mirror for use inside callbacks

  // Keep stateRef in sync
  useEffect(() => { stateRef.current = state; }, [state]);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => { AiModelService.init(); }, []);

  // ── Emergency dispatch ────────────────────────────────────────────────────
  const triggerEmergency = useCallback(async () => {
    setState('emergency_triggered');
    stateRef.current = 'emergency_triggered';
    SpeechService.speak("I couldn't reach you. Alerting your emergency contacts now. Please stay calm.");

    const coords   = await LocationService.trackLocation(patientId);
    const mapsLink = coords
      ? LocationService.getMapsLink(coords.latitude, coords.longitude)
      : 'Unknown Location';

    await supabase.from('fall_events').insert({
      patientid:  patientId,
      latitude:   coords?.latitude  ?? null,
      longitude:  coords?.longitude ?? null,
      timestamp:  new Date().toISOString(),
      confirmed:  true,
      source:     'foreground',
    });

    const { data: contact } = await supabase
      .from('emergency_contacts')
      .select('phone, name')
      .eq('patientid', patientId)
      .eq('isprimary', true)
      .single();

    if (contact) {
      await SmsService.sendEmergencySms(
        contact.phone,
        `EMERGENCY: ${patientName} has fallen at ${new Date().toLocaleString()}.\nLocation: ${mapsLink}\nPlease respond immediately.`,
      );
    }

    const { data: links } = await supabase
      .from('doctor_patient_links')
      .select('doctor_id')
      .eq('patient_id', patientId);

    if (links?.length) {
      const { data: doctors } = await supabase
        .from('profiles')
        .select('push_token')
        .in('id', links.map((l: any) => l.doctor_id))
        .not('push_token', 'is', null);

      const tokens = (doctors ?? []).map((p: any) => p.push_token).filter(Boolean);
      if (tokens.length) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(tokens.map((token: string) => ({
            to: token, priority: 'high', sound: 'default',
            title: 'EMERGENCY: Fall Detected',
            body:  `${patientName} has fallen. Location: ${mapsLink}`,
            data:  { type: 'fall_alert', patientId, mapsLink },
          }))),
        });
      }
    }
    console.log('[FallDetection] Emergency dispatched.');
  }, [patientId, patientName]);

  // ── Cancel ────────────────────────────────────────────────────────────────
  const cancelAlert = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setState('idle');
    stateRef.current = 'idle';
    SpeechService.speak("Glad you're okay. I'll keep monitoring.");
  }, []);

  // ── Fall confirmed by SignalService state machine ─────────────────────────
  const onFallConfirmed = useCallback(async (peakG: number) => {
    // Ignore if we're already handling an alert
    if (stateRef.current !== 'idle') return;

    console.log(`[FallDetection] Confirmed fall — peakG=${peakG.toFixed(2)}`);
    setLastGForce(peakG);
    setState('user_response_window');
    stateRef.current = 'user_response_window';

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    // Voice triage — local phrases, no API call (avoids quota errors + zero latency)
    const triagePhrases = [
      `${patientName}, I detected a fall. Are you okay? If you need help, stay still. I'll alert your contacts in 20 seconds. Tap cancel if you're fine.`,
      `Hey ${patientName}, it looks like you may have fallen. Please don't worry, I'm here. Tap the cancel button if you're alright, otherwise I'll call for help shortly.`,
      `${patientName}, are you okay? I noticed a sudden impact. Stay calm — I'm giving you 20 seconds to let me know you're fine before I alert your emergency contacts.`,
    ];
    SpeechService.speak(triagePhrases[Math.floor(Math.random() * triagePhrases.length)]);

    timerRef.current = setTimeout(() => { triggerEmergency(); }, RESPONSE_WINDOW_MS);
  }, [patientName, triggerEmergency]);

  // ── Sensor loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Register the fall callback with SignalService
    SignalService.onFallDetected(onFallConfirmed);

    SensorService.setUpdateInterval(50); // 20 Hz
    SensorService.startMonitoring((data) => {
      SignalService.addSample(data); // state machine runs inside addSample
    });

    return () => {
      SensorService.stopMonitoring();
      SignalService.clearFallCallback();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onFallConfirmed]);

  return {
    state,
    lastGForce,
    cancelAlert,
    triggerEmergency,
    isUserActive: SignalService.isUserActive(),
  };
};

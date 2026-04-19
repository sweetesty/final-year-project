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
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { OpenAiService } from '../services/OpenAiService';

const RESPONSE_WINDOW_MS = 20_000;

export const useFallDetectionViewModel = (
  patientId:   string,
  patientName: string,
) => {
  const [state,      setState]      = useState<FallDetectionState>('idle');
  const [lastGForce, setLastGForce] = useState(0);
  const [countdown,  setCountdown]  = useState(20);
  const { t } = useTranslation();

  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef    = useRef<FallDetectionState>('idle'); // mirror for use inside callbacks

  // Keep stateRef in sync
  useEffect(() => { stateRef.current = state; }, [state]);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => { AiModelService.init(); }, []);

  // ── Emergency dispatch ────────────────────────────────────────────────────
  const triggerEmergency = useCallback(async () => {
    setState('emergency_triggered');
    stateRef.current = 'emergency_triggered';
    SpeechService.speak(t('fall.dispatch_speak'));

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
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      await SmsService.sendEmergencySms(
        contact.phone,
        t('fall.dispatch_sms', { name: patientName, time: timeStr, link: mapsLink, lng: 'en' }),
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
            title: t('fall.dispatch_notification_title', { lng: 'en' }),
            body:  t('fall.dispatch_notification_body', { name: patientName, time: new Date().toLocaleTimeString(), link: mapsLink, lng: 'en' }),
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
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setState('idle');
    setCountdown(20);
    stateRef.current = 'idle';
    SpeechService.speak(t('fall.cancel_speak'));
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
    
    // Voice triage - Dynamic for English (Groq), Static for others
    const currentLang = (i18n?.language || 'en').toLowerCase();
    if (currentLang.startsWith('en')) {
      OpenAiService.getInitialFallComfort(patientName)
        .then(msg => SpeechService.speak(msg, 'en'))
        .catch(err => {
          console.warn('[FallDetection] Dynamic triage failed, using fallback:', err);
          const triageIndex = Math.floor(Math.random() * 3) + 1;
          SpeechService.speak(t(`fall.triage_${triageIndex}`, { name: patientName }), 'en');
        });
    } else {
      const triageIndex = Math.floor(Math.random() * 3) + 1;
      const triageText = t(`fall.triage_${triageIndex}`, { name: patientName });
      console.log('[FallDetection] Triage language info:', { 
        currentLanguage: currentLang, 
        triageText 
      });
      SpeechService.speak(triageText, currentLang);
    }

    setCountdown(20);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

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
    console.log('[FallDetection] Sensor monitoring STARTED');

    return () => {
      SensorService.stopMonitoring();
      SignalService.clearFallCallback();
      console.log('[FallDetection] Sensor monitoring STOPPED');
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onFallConfirmed]);

  return {
    state,
    lastGForce,
    cancelAlert,
    triggerEmergency,
    countdown,
    isUserActive: SignalService.isUserActive(),
  };
};

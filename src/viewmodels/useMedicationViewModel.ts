import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../services/SupabaseService';
import { Medication, MedicationLog, NewMedication } from '../models/Medication';
import { NotificationService } from '../services/NotificationService';
import { OfflineSyncService } from '../services/OfflineSyncService';
import { SmsService } from '../services/SmsService';
import { DoctorService } from '../services/DoctorService';
import { CaregiverService } from '../services/CaregiverService';

export const useMedicationViewModel = (patientId: string, patientName?: string) => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [todayLogs, setTodayLogs] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchMedications = useCallback(async (silent = false) => {
    if (!patientId || patientId.length < 10) { 
      setLoading(false);
      setHasFetched(true);
      return; 
    }
    
    if (patientId === 'patient-123') { 
      setLoading(false); 
      setHasFetched(true);
      return; 
    }

    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('patientid', patientId);

    if (error) {
      console.error('[MedicationViewModel] Fetch error:', error);
    } else {
      const mapped = (data || []).map((m: any) => ({
        ...m,
        isCritical: m.iscritical,
        isPrescribed: m.is_prescribed,
        prescribedBy: m.prescribed_by,
        patientId: m.patientid,
        createdAt: m.createdat,
        durationDays: m.duration_days,
        startDate: m.start_date,
        endDate: m.end_date,
      }));
      setMedications(mapped);
    }
    setLoading(false);
    setRefreshing(false);
    setHasFetched(true);
  }, [patientId]);

  const fetchTodayLogs = useCallback(async () => {
    if (!patientId || patientId.length < 10 || patientId === 'patient-123') return;
    
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('medication_logs')
      .select('*')
      .eq('patientid', patientId)
      .gte('takenat', startOfDay.toISOString()); 

    if (error) console.error('[MedicationViewModel] Logs error:', error);
    else {
      const mapped = (data || []).map((l: any) => ({
        id: l.id,
        medicationId: l.medicationid,
        patientId: l.patientid,
        status: l.status,
        scheduledTime: l.scheduledtime,
        takenAt: l.takenat
      }));
      setTodayLogs(mapped);
    }
  }, [patientId]);

  // Calculations for summary stats
  const summary = useMemo(() => {
    const schedule = medications.flatMap(med =>
      med.times.map(time => {
        const log = todayLogs.find(l => 
          l.medicationId === med.id && 
          l.scheduledTime === time
        );
        return {
          medId: med.id,
          name: med.name,
          time,
          status: log?.status || 'pending',
          isCritical: med.isCritical
        };
      })
    ).sort((a, b) => a.time.localeCompare(b.time));

    const now = new Date();
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const upcoming = schedule.find(s => s.status === 'pending' && s.time >= currentTimeStr);
    const taken = schedule.filter(s => s.status === 'taken').length;
    const missed = schedule.filter(s => s.status === 'skipped' || s.status === 'missed').length;
    const pending = schedule.filter(s => s.status === 'pending').length;

    return {
      totalToday: schedule.length,
      takenCount: taken,
      missedCount: missed,
      pendingCount: pending,
      upcomingDose: upcoming || null,
      fullSchedule: schedule
    };
  }, [medications, todayLogs]);

  const addMedication = async (newMed: NewMedication) => {
    if (!patientId || patientId.length < 10) {
      Alert.alert('Error', 'Patient context not ready. Please wait a moment.');
      return;
    }
    const startDate = newMed.startDate ?? new Date().toISOString().split('T')[0];
    const endDate = newMed.durationDays
      ? (() => {
          const d = new Date(startDate);
          d.setDate(d.getDate() + newMed.durationDays! - 1);
          return d.toISOString().split('T')[0];
        })()
      : undefined;

    const { data, error } = await supabase
      .from('medications')
      .insert({
        name: newMed.name,
        dosage: newMed.dosage,
        instructions: newMed.instructions,
        iscritical: newMed.isCritical,
        is_prescribed: newMed.isPrescribed,
        prescribed_by: newMed.prescribedBy,
        times: newMed.times,
        frequency: newMed.frequency,
        patientid: patientId,
        duration_days: newMed.durationDays ?? null,
        start_date: startDate,
        end_date: endDate ?? null,
      })
      .select()
      .single();

    if (error) {
      Alert.alert('Failed to Add', error.message);
    } else {
      const mapped = {
        ...data,
        isCritical: data.iscritical,
        isPrescribed: data.is_prescribed,
        prescribedBy: data.prescribed_by,
        patientId: data.patientid,
        durationDays: data.duration_days,
        startDate: data.start_date,
        endDate: data.end_date,
        createdAt: data.createdat,
      };
      await NotificationService.scheduleMedicationReminders(mapped);
      await fetchMedications();
    }
  };

  const deleteMedication = async (medicationId: string) => {
    const { error } = await supabase.from('medications').delete().eq('id', medicationId);
    if (error) { Alert.alert('Error', error.message); return; }
    
    // Cleanup scheduled notifications
    await NotificationService.cancelMedicationReminders(medicationId);
    
    setMedications(prev => prev.filter(m => m.id !== medicationId));
  };

  const updateMedication = async (medicationId: string, updates: Partial<NewMedication>) => {
    const { error } = await supabase
      .from('medications')
      .update({
        name: updates.name,
        dosage: updates.dosage,
        instructions: updates.instructions,
        iscritical: updates.isCritical,
        times: updates.times,
        frequency: updates.frequency,
      })
      .eq('id', medicationId);
    if (error) { Alert.alert('Error', error.message); return; }
    await fetchMedications();
  };

  const logDose = async (medicationId: string, scheduledTime: string, status: 'taken' | 'skipped') => {
    if (!patientId || patientId.length < 10) {
      Alert.alert('Error', 'Patient context not ready.');
      return;
    }
    const now = new Date().toISOString();
    // ── Optimistic UI Update ──
    const optimisticLog: MedicationLog = {
      id: Math.random().toString(36).substring(7), // temporary id
      medicationId,
      patientId,
      status,
      scheduledTime,
      takenAt: now,
    };
    
    setTodayLogs(prev => [...prev.filter(l => !(l.medicationId === medicationId && l.scheduledTime === scheduledTime)), optimisticLog]);

    try {
      // Perform write in background
      OfflineSyncService.write('medication_logs', 'insert', {
        medicationid: medicationId,
        patientid: patientId,
        status,
        scheduledtime: scheduledTime,
        takenat: now,
      }).catch(err => {
        console.error('[MedicationViewModel] Sync failed:', err);
        // On failure, we might want to revert or just let the offline service retry
        // For now, we rely on the persistent offline queue.
      });

      // We don't await fetchTodayLogs() here anymore to keep UI responsive.
      // fetchTodayLogs(); 


      if (status === 'skipped') {
        const med = medications.find(m => m.id === medicationId);
        if (med) {
          const doctors = await DoctorService.getLinkedDoctors(patientId);
          const caregivers = await CaregiverService.getLinkedCaregivers(patientId);
          const displayName = patientName || 'A patient';

          await Promise.all(doctors.map(async (doc) => {
            if (doc?.push_token) {
              await NotificationService.sendPushToToken(
                doc.push_token,
                'Medication Skipped',
                `${displayName} just skipped their scheduled dose of ${med.name}.`,
                { type: 'med_skipped', patientId }
              );
            }
          }));

          for (const cg of caregivers) {
            if (cg.push_token) {
              await NotificationService.sendPushToToken(
                cg.push_token,
                'Medication Skipped',
                `${displayName} just skipped their scheduled dose of ${med.name}.`,
                { type: 'med_skipped', patientId }
              );
            }
          }
        }
      }
    } catch (error: any) {
      Alert.alert('Log Error', error.message);
    }
  };

  const checkMissedCriticalMedications = useCallback(async () => {
    if (!patientId || patientId.length < 10 || medications.length === 0) return;

    const now = new Date();
    const displayName = patientName || 'A patient';
    
    // 1. Get contact info (emergency and doctor)
    const { data: profile } = await supabase.from('profiles').select('emergency_contact_phone').eq('id', patientId).single();
    const doctors = await DoctorService.getLinkedDoctors(patientId);
    const caregivers = await CaregiverService.getLinkedCaregivers(patientId);

    const emergencyPhone = profile?.emergency_contact_phone;

    if (!emergencyPhone && doctors.length === 0 && caregivers.length === 0) return;

    for (const med of medications) {
      if (!med.isCritical) continue;

      for (const time of med.times) {
        const [hours, minutes] = time.split(':').map(Number);
        const scheduledDate = new Date();
        scheduledDate.setHours(hours, minutes, 0, 0);

        const diffMinutes = (now.getTime() - scheduledDate.getTime()) / (1000 * 60);

        // If it's more than 30 mins late but less than 4 hours (to avoid spamming old ones)
        if (diffMinutes > 30 && diffMinutes < 240) {
          const log = todayLogs.find(l => 
            l.medicationId === med.id && 
            l.scheduledTime === time
          );

          if (!log) {
            console.warn(`[Escalation] Critical med ${med.name} missed at ${time}`);
            if (emergencyPhone) await SmsService.sendEmergencyEscalation(emergencyPhone, displayName, med.name);
            
            // Notify all linked doctors via SMS if possible, or push
            for (const doc of doctors) {
              if (doc.phone) await SmsService.sendEmergencyEscalation(doc.phone, displayName, med.name);
              if (doc.push_token) {
                await NotificationService.sendPushToToken(
                  doc.push_token,
                  '🚨 Critical Medication Missed',
                  `${displayName} missed their scheduled ${med.name}. Please check on them.`,
                  { type: 'emergency_med', patientId }
                );
              }
            }

            // Notify all linked caregivers
            for (const cg of caregivers) {
              if (cg.push_token) {
                await NotificationService.sendPushToToken(
                  cg.push_token,
                  '🚨 Critical Medication Missed',
                  `${displayName} missed their scheduled ${med.name}. Please check on them.`,
                  { type: 'emergency_med', patientId }
                );
              }
            }
          }
        }
      }
    }
  }, [patientId, medications, todayLogs, patientName]);

  useEffect(() => {
    fetchMedications();
    fetchTodayLogs();
  }, [fetchMedications, fetchTodayLogs]);

  // Periodic check for missed critical meds
  useEffect(() => {
    const interval = setInterval(() => {
      checkMissedCriticalMedications();
    }, 10 * 60 * 1000); // Check every 10 minutes
    return () => clearInterval(interval);
  }, [checkMissedCriticalMedications]);

  // Real-time subscription
  useEffect(() => {
    if (!patientId || patientId.length < 10 || patientId === 'patient-123') return;

    const channelName = `medications_${patientId}`;
    
    // Remove any stale channel with this name first
    const existing = supabase.getChannels().find(c => c.topic.includes(channelName));
    if (existing) supabase.removeChannel(existing);

    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'medications',
        filter: `patientid=eq.${patientId}`,
      }, (payload: any) => {
        const newMed = payload.new;
        if (newMed.is_prescribed) {
          NotificationService.showLocalNotification(
            '📋 New Prescription Added',
            `Doctor ${newMed.prescribed_by || ''} has added ${newMed.name} to your schedule.`
          );
        }
        fetchMedications();
      })
      .on('postgres_changes', {
        event: '*', // Watch all changes for summary updates
        schema: 'public',
        table: 'medication_logs',
        filter: `patientid=eq.${patientId}`,
      }, () => {
        fetchTodayLogs();
      }) // End of log watch
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'medications',
        filter: `patientid=eq.${patientId}`,
      }, () => {
        fetchMedications();
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'medications',
        filter: `patientid=eq.${patientId}`,
      }, () => {
        fetchMedications();
      })
      .subscribe((status, err) => {
        if (err) {
          console.error(`[MedicationViewModel] Real-time error for ${patientId}:`, err);
        } else if (status === 'SUBSCRIBED') {
          console.log(`[MedicationViewModel] Real-time active for ${patientId}`);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn(`[MedicationViewModel] channel ${status} for ${patientId}, retrying...`);
          setTimeout(() => fetchMedications(true), 1000);
        }
      });

    return () => { supabase.removeChannel(subscription); };
  }, [patientId, fetchMedications]);

  return {
    medications,
    todayLogs,
    summary,
    loading,
    refreshing,
    addMedication,
    updateMedication,
    deleteMedication,
    logDose,
    refresh: (silent = true) => { fetchMedications(silent); fetchTodayLogs(); },
  };
};
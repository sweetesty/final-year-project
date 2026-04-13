import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/SupabaseService';
import { Medication, MedicationLog, NewMedication } from '../models/Medication';
import { NotificationService } from '../services/NotificationService';
import { OfflineSyncService } from '../services/OfflineSyncService';

export const useMedicationViewModel = (patientId: string) => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [todayLogs, setTodayLogs] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMedications = useCallback(async () => {
    // Don't query until we have a real UUID
    if (!patientId || patientId === 'patient-123') { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('patientid', patientId);

    if (error) console.error(error);
    else {
      // Map DB lowercase column names to model fields
      const mapped = (data || []).map((m: any) => ({
        ...m,
        isCritical: m.iscritical,
        patientId: m.patientid,
        createdAt: m.createdat,
        durationDays: m.duration_days,
        startDate: m.start_date,
        endDate: m.end_date,
      }));
      setMedications(mapped);
    }
    setLoading(false);
  }, [patientId]);

  const fetchTodayLogs = useCallback(async () => {
    // Don't query until we have a real UUID
    if (!patientId || patientId === 'patient-123') return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('medication_logs')
      .select('*')
      .eq('patientid', patientId)
      .gte('takenat', startOfDay.toISOString()); 

    if (error) console.error(error);
    else setTodayLogs(data || []);
  }, [patientId]);

  const addMedication = async (newMed: NewMedication) => {
    if (!patientId || patientId.length < 10) {
      alert('Patient context not ready. Please wait a moment.');
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
      alert(error.message);
    } else {
      const mapped = {
        ...data,
        isCritical: data.iscritical,
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
    if (error) { alert(error.message); return; }
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
    if (error) { alert(error.message); return; }
    await fetchMedications();
  };

  const logDose = async (medicationId: string, scheduledTime: string, status: 'taken' | 'skipped') => {
    if (!patientId || patientId.length < 10) {
      alert('Patient context not ready.');
      return;
    }
    try {
      await OfflineSyncService.write('medication_logs', 'insert', {
        medicationid: medicationId,
        patientid: patientId,
        status,
        scheduledtime: scheduledTime,
        takenat: new Date().toISOString(),
      });
      await fetchTodayLogs();
    } catch (error: any) {
      alert(error.message);
    }
  };

  useEffect(() => {
    fetchMedications();
    fetchTodayLogs();
  }, [fetchMedications, fetchTodayLogs]);

  // Real-time subscription: instantly show new prescriptions added by doctor
  useEffect(() => {
    if (!patientId || patientId === 'patient-123') return;

    const channelName = `medications_${patientId}`;
    
    // Remove any stale channel with this name first (prevents remount conflicts)
    const existing = supabase.getChannels().find(c => c.topic.includes(channelName));
    if (existing) supabase.removeChannel(existing);

    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
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
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [patientId, fetchMedications]);

  return {
    medications,
    todayLogs,
    loading,
    addMedication,
    updateMedication,
    deleteMedication,
    logDose,
    refresh: () => { fetchMedications(); fetchTodayLogs(); },
  };
};
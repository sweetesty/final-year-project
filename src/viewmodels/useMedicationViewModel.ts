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
      // Map DB lowercase column names to camelCase model fields
      const mapped = (data || []).map((m: any) => ({
        ...m,
        isCritical: m.iscritical,
        isPrescribed: m.isprescribed,
        prescribedBy: m.prescribedby,
        patientId: m.patientid,
        createdAt: m.createdat,
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
      .gte('createdat', startOfDay.toISOString());

    if (error) console.error(error);
    else setTodayLogs(data || []);
  }, [patientId]);

  const addMedication = async (newMed: NewMedication) => {
    if (!patientId || patientId.length < 10) {
      alert('Patient context not ready. Please wait a moment.');
      return;
    }
    const { data, error } = await supabase
      .from('medications')
      .insert({
        name: newMed.name,
        dosage: newMed.dosage,
        instructions: newMed.instructions,
        iscritical: newMed.isCritical,
        isprescribed: newMed.isPrescribed,
        prescribedby: newMed.prescribedBy,
        times: newMed.times,
        frequency: newMed.frequency,
        patientid: patientId 
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
    } else {
      await NotificationService.scheduleMedicationReminders(data);
      await fetchMedications();
    }
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
        createdat: new Date().toISOString(),
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
    logDose,
    refresh: () => { fetchMedications(); fetchTodayLogs(); },
  };
};
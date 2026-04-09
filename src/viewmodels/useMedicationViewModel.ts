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
    setLoading(true);
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('patientId', patientId);

    if (error) console.error(error);
    else setMedications(data || []);
    setLoading(false);
  }, [patientId]);

  const fetchTodayLogs = useCallback(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const { data, error } = await supabase
      .from('medication_logs')
      .select('*')
      .eq('patientId', patientId)
      .gte('takenAt', startOfDay.toISOString());

    if (error) console.error(error);
    else setTodayLogs(data || []);
  }, [patientId]);

  const addMedication = async (newMed: NewMedication) => {
    const { data, error } = await supabase
      .from('medications')
      .insert({ ...newMed, patientId })
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
    try {
      await OfflineSyncService.write('medication_logs', 'insert', {
        medicationId,
        patientId,
        status,
        scheduledTime,
        takenAt: new Date().toISOString(),
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

  return {
    medications,
    todayLogs,
    loading,
    addMedication,
    logDose,
    refresh: () => { fetchMedications(); fetchTodayLogs(); },
  };
};

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
    else setMedications(data || []);
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
      .gte('loggedat', startOfDay.toISOString()); // DB column is 'loggedat', not 'takenAt'

    if (error) console.error(error);
    else setTodayLogs(data || []);
  }, [patientId]);

  const addMedication = async (newMed: NewMedication) => {
    const { data, error } = await supabase
      .from('medications')
      .insert({ ...newMed, patientid: patientId })
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
        medicationid: medicationId,
        patientid: patientId,
        status,
        scheduledtime: scheduledTime,
        loggedat: new Date().toISOString(), // DB column is 'loggedat'
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
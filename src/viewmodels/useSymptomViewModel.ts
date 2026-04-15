import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/SupabaseService';
import { DoctorService } from '../services/DoctorService';
import { NotificationService } from '../services/NotificationService';

export interface SymptomLog {
  id: string;
  patientid: string;
  type: string;
  notes?: string;
  severity?: string;
  timestamp: string;
}

export const useSymptomViewModel = (patientId: string, patientName?: string) => {
  const [logs, setLogs] = useState<SymptomLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('symptom_logs')
      .select('*')
      .eq('patientid', patientId)
      .order('timestamp', { ascending: false });

    if (error) console.error('[useSymptomViewModel] Fetch error:', error);
    else setLogs(data || []);
    setLoading(false);
  }, [patientId]);

  const logSymptom = async (type: string, notes?: string, severity?: string) => {
    if (!patientId) return;
    
    const { error } = await supabase
      .from('symptom_logs')
      .insert({
        patientid: patientId,
        type,
        notes,
        severity,
        timestamp: new Date().toISOString()
      });

    if (error) {
      console.error('[useSymptomViewModel] Insert error:', error);
      throw error;
    }

    // 2. Notify Doctor (Non-blocking)
    const notifyDoctor = async () => {
      try {
        const doctor = await DoctorService.getLinkedDoctor(patientId);
        if (doctor?.push_token) {
          const displayName = patientName || 'A patient';
          await NotificationService.sendPushToToken(
            doctor.push_token,
            `👨‍⚕️ Health Update: ${displayName}`,
            `${displayName} reported feeling ${type.toLowerCase()} (${severity || 'moderate'}).`,
            { type: 'symptom_report', patientId }
          );
        }
      } catch (e) {
        console.warn('[useSymptomViewModel] Push notification failed:', e);
      }
    };

    notifyDoctor().catch(() => {});
    await fetchLogs();
  };

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    logSymptom,
    refresh: fetchLogs
  };
};

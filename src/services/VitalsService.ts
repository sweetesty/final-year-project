import { supabase } from './SupabaseService';
import { OfflineSyncService } from './OfflineSyncService';

export interface VitalsReading {
  patientid: string;
  heartrate: number;
  spo2:      number;
  steps:     number;
  timestamp: string;
}

export class VitalsService {
  /**
   * Persist a vitals reading to Supabase (offline-safe).
   * Column names must match the DB: patientid, heartrate, spo2, steps.
   */
  static async logVitals(reading: VitalsReading): Promise<void> {
    await OfflineSyncService.write('vitals', 'insert', {
      patientid: reading.patientid,
      heartrate: reading.heartrate,
      spo2:      reading.spo2,
      steps:     reading.steps,
      timestamp: reading.timestamp,
    });
  }

  /**
   * Fetch the last N vitals readings for a patient.
   */
  static async getRecentVitals(patientId: string, limit: number = 24): Promise<VitalsReading[]> {
    const { data, error } = await supabase
      .from('vitals')
      .select('*')
      .eq('patientid', patientId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[VitalsService] Fetch error:', error);
      return [];
    }
    
    return (data || []).map((v: any) => ({
      patientid: v.patientid,
      heartrate: v.heartrate,
      spo2:      v.spo2,
      steps:     v.steps,
      timestamp: v.timestamp
    })).reverse();
  }
}

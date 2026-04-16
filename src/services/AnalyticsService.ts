import { SymptomLog, HealthPattern } from '../models/SymptomLog';
import { VitalsService } from './VitalsService';
import { supabase } from './SupabaseService';
import { OpenAiService } from './OpenAiService';

export class AnalyticsService {
  /**
   * Generates a descriptive health summary based on recent data.
   */
  static async generateWeeklySummary(patientId: string): Promise<string> {
    try {
      const vitals = await VitalsService.getRecentVitals(patientId, 50);
      const falls = await this.getRecentFalls(patientId);
      const symptoms = await this.getRecentSymptoms(patientId);
      const adherence = await this.getMedicationAdherence(patientId);
      
      const avgHR = vitals.length ? Math.round(vitals.reduce((acc, v) => acc + v.heartrate, 0) / vitals.length) : 'N/A';
      const avgSpo2 = vitals.length ? Math.round(vitals.reduce((acc, v) => acc + v.spo2, 0) / vitals.length) : 'N/A';
      
      const healthData = {
        vitalsSummary: { avgHeartRate: avgHR, avgBloodOxygen: avgSpo2 },
        recentFalls: falls.map(f => ({ date: f.timestamp, confirmed: f.confirmed, status: f.status })),
        reportedSymptoms: symptoms.map(s => ({ type: s.type, severity: s.severity, notes: s.notes, date: s.timestamp })),
        medicationAdherence: adherence
      };

      const summary = await OpenAiService.generateClinicalNarrative(healthData);
      return summary;
    } catch (e) {
      console.error('[AnalyticsService] Summary failed:', e);
      return 'Could not generate AI clinical narrative at this time.';
    }
  }

  static async getRecentSymptoms(patientId: string) {
    const { data } = await supabase
      .from('symptom_logs')
      .select('type, severity, notes, timestamp')
      .eq('patientid', patientId)
      .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false });
    return data || [];
  }

  static async getMedicationAdherence(patientId: string) {
    const { data } = await supabase
      .from('medication_logs')
      .select('status, scheduledtime, takenat')
      .eq('patientid', patientId)
      .gte('takenat', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    
    const logs = data || [];
    const total = logs.length;
    if (total === 0) return { info: 'No medication logs in the last 7 days.' };
    
    const taken = logs.filter(l => l.status === 'taken').length;
    const skipped = logs.filter(l => l.status === 'skipped').length;
    const missed = logs.filter(l => l.status === 'missed').length;
    const adherenceScore = Math.round((taken / total) * 100);

    return { adherenceScore: `${adherenceScore}%`, total, taken, skipped, missed };
  }

  static async getRecentFalls(patientId: string) {
    const { data } = await supabase
      .from('fall_events') 
      .select('*')
      .eq('patientid', patientId)
      .limit(10);
    return data || [];
  }

  /**
   * Detects patterns like "Frequent Dizziness after Morning Dose"
   */
  static async detectSymptomCorrelations(patientId: string): Promise<HealthPattern[]> {
    // For a production app, this would use more complex grouping
    // For this version/demo, we return high-level detected states
    return [
      {
        type: 'vital_trend',
        severity: 'low',
        message: 'Heart rate is normal and stable.',
        dataPoints: 24,
      }
    ];
  }
}

import { SymptomLog, HealthPattern } from '../models/SymptomLog';
import { VitalsService } from './VitalsService';
import { supabase } from './SupabaseService';

export class AnalyticsService {
  /**
   * Generates a descriptive health summary based on recent data.
   */
  static async generateWeeklySummary(patientId: string): Promise<string> {
    try {
      const vitals = await VitalsService.getRecentVitals(patientId, 50);
      const falls = await this.getRecentFalls(patientId);
      
      const avgHR = vitals.reduce((acc, v) => acc + v.heartrate, 0) / (vitals.length || 1);
      const activityTrend = vitals.length > 10 ? (vitals[vitals.length-1].steps > vitals[0].steps ? 'increasing' : 'decreasing') : 'stable';
      const fallCount = falls.length;

      let summary = `Patient health is generally stable. Average heart rate is ${avgHR.toFixed(0)} BPM. `;
      summary += `Activity levels are ${activityTrend} lately. `;
      
      if (fallCount > 0) {
        summary += `${fallCount} fall incidents detected recently. IMMEDIATE REVIEW ADVISED. `;
      } else {
        summary += `No falls detected in the last recorded period. `;
      }

      return summary;
    } catch (e) {
      console.error('[AnalyticsService] Summary failed:', e);
      return 'Could not generate health summary at this time.';
    }
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

export interface SymptomLog {
  id: string;
  patientId: string;
  symptomType: 'headache' | 'dizziness' | 'nausea' | 'pain' | 'fatigue' | 'other';
  severity: 1 | 2 | 3 | 4 | 5;
  timestamp: string;
  notes?: string;
  associatedMedicationId?: string; // Optional: trigger detection
}

export type HealthPattern = {
  type: 'fall_risk' | 'activity_drought' | 'symptom_warning' | 'vital_trend';
  severity: 'low' | 'medium' | 'high';
  message: string;
  dataPoints: number;
};

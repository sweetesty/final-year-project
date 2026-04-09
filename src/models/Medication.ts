export type MedicationFrequency = 'daily' | 'weekly' | 'interval';

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  instructions?: string;
  frequency: MedicationFrequency;
  specificDays?: number[]; // 0-6 (Sunday-Saturday)
  times: string[]; // ["HH:mm"]
  isCritical: boolean;
  createdAt: string;
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  patientId: string;
  status: 'taken' | 'skipped';
  scheduledTime: string;
  takenAt: string;
}

export type NewMedication = Omit<Medication, 'id' | 'createdAt' | 'patientId'>;

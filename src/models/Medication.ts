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
  isPrescribed: boolean;
  prescribedBy?: string;
  createdAt: string;
  durationDays?: number;   // how many days to take it (undefined = indefinite)
  startDate?: string;      // ISO date string (YYYY-MM-DD)
  endDate?: string;        // computed: startDate + durationDays - 1
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

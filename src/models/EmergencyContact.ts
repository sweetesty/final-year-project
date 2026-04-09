export interface EmergencyContact {
  id: string;
  patientId: string;
  name: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
  createdAt?: string;
}

export type NewEmergencyContact = Omit<EmergencyContact, 'id' | 'createdAt' | 'patientId'>;

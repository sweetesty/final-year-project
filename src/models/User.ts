export type UserRole = 'patient' | 'doctor' | 'caregiver';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
  pushToken?: string;
  createdAt: string;
}

export interface PatientProfile extends UserProfile {
  role: 'patient';
  dateOfBirth: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  doctorIds: string[];
}

export interface DoctorProfile extends UserProfile {
  role: 'doctor';
  specialization: string;
  licenseNumber: string;
  patientIds: string[];
}

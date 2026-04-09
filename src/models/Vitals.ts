export interface HealthVital {
  id: string;
  patientId: string;
  timestamp: string;
  heartRate?: number;
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  oxygenLevel?: number; // SpO2
  temperature?: number;
}

export interface SensorData {
  accelerometer: {
    x: number;
    y: number;
    z: number;
  };
  gyroscope: {
    x: number;
    y: number;
    z: number;
  };
  timestamp: number;
}

export interface VitalHistory {
  patientId: string;
  vitals: HealthVital[];
  timeframe: 'day' | 'week' | 'month';
}

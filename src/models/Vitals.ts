export interface HealthVital {
  id: string;
  patientid: string;
  timestamp: string;
  heartrate?: number;
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  spo2?: number; // SpO2
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
  patientid: string;
  vitals: HealthVital[];
  timeframe: 'day' | 'week' | 'month';
}

export type FallDetectionState = 
  | 'idle' 
  | 'suspicious' 
  | 'confirmed' 
  | 'user_response_window' 
  | 'emergency_triggered';

export interface FallEvent {
  id: string;
  patientid: string;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  sensorSnapshot: {
    maxGForce: number;
    rotationRate: number;
  };
  status: 'alert_sent' | 'acknowledged' | 'false_positive' | 'escalated';
}

export interface EmergencyPayload {
  eventId: string;
  patientName: string;
  location: {
    latitude: number;
    longitude: number;
  };
  timestamp: string;
  vitalSnapshot?: {
    heartrate?: number;
    spo2?: number;
  };
}

import { useState, useEffect } from 'react';
import { HealthVital } from '../models/Vitals';

export const useVitalsViewModel = (patientId: string) => {
  const [currentVitals, setCurrentVitals] = useState<Partial<HealthVital>>({
    heartrate: 72,
    spo2: 98,
    bloodPressure: { systolic: 120, diastolic: 80 },
    temperature: 36.6,
  });

  // Simulation of live vitals updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentVitals(prev => ({
        ...prev,
        heartrate: (prev.heartrate || 72) + (Math.random() > 0.5 ? 1 : -1),
        spo2: Math.random() > 0.95 ? 97 : 98,
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return {
    currentVitals,
    patientId,
  };
};

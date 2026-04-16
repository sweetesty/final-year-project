import { useState, useEffect, useCallback } from 'react';
import { VitalsService, VitalsReading } from '../services/VitalsService';

export const useVitalsViewModel = (patientId: string) => {
  const [history, setHistory] = useState<VitalsReading[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async (limit: number = 24) => {
    if (!patientId || patientId === 'patient-123') return;
    setLoading(true);
    const data = await VitalsService.getRecentVitals(patientId, limit);
    setHistory(data);
    setLoading(false);
  }, [patientId]);

  const getChartData = () => {
    if (history.length === 0) {
      return {
        heartRate: { data: [70, 72, 71, 75, 74, 73], labels: ['-5h', '-4h', '-3h', '-2h', '-1h', 'Now'] },
        spo2: { data: [98, 97, 98, 99, 98, 98], labels: ['-5h', '-4h', '-3h', '-2h', '-1h', 'Now'] }
      };
    }

    // Format for react-native-chart-kit
    // We'll take every 4th reading if we have many, to avoid clutter
    const step = Math.max(1, Math.floor(history.length / 6));
    const filtered = history.filter((_, i) => i % step === 0).slice(-6);

    return {
      heartRate: {
        data: filtered.map(r => r.heartrate),
        labels: filtered.map(r => {
          const d = new Date(r.timestamp);
          return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
        })
      },
      spo2: {
        data: filtered.map(r => r.spo2),
        labels: filtered.map(r => {
           const d = new Date(r.timestamp);
           return `${d.getHours()}h`;
        })
      }
    };
  };

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    loading,
    fetchHistory,
    chartData: getChartData()
  };
};

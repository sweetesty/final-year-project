import { Pedometer } from 'expo-sensors';

export class PedometerService {
  /**
   * Check if the pedometer is available on this device.
   */
  static async isAvailableAsync(): Promise<boolean> {
    try {
      return await Pedometer.isAvailableAsync();
    } catch (e) {
      console.warn('[PedometerService] Availability check failed:', e);
      return false;
    }
  }

  /**
   * Request physical activity permissions.
   */
  static async requestPermissionsAsync(): Promise<boolean> {
    try {
      const { status } = await Pedometer.requestPermissionsAsync();
      return status === 'granted';
    } catch (e) {
      console.warn('[PedometerService] Permission request failed:', e);
      return false;
    }
  }

  /**
   * Get step count between two dates.
   */
  static async getStepCountAsync(start: Date, end: Date): Promise<number> {
    try {
      const result = await Pedometer.getStepCountAsync(start, end);
      return result.steps;
    } catch (e) {
      console.error('[PedometerService] getStepCountAsync error:', e);
      return 0;
    }
  }

  /**
   * Subscribe to live step count updates.
   * Note: The steps returned in the callback are steps taken SINCE the listener was added.
   */
  static watchStepCount(callback: (stepsSinceStart: number) => void) {
    return Pedometer.watchStepCount(result => {
      callback(result.steps);
    });
  }

  /**
   * Get the start of the current day (midnight).
   */
  static getTodayMidnight(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  /**
   * Get historical step counts for the last N days.
   * Returns an array of { date: string, steps: number }
   */
  static async getStepHistoryAsync(days: number = 7): Promise<{ date: string; steps: number }[]> {
    const history = [];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
       const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0);
       const end = i === 0 ? new Date() : new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1, 0, 0, 0);
       
       const steps = await this.getStepCountAsync(start, end);
       
       // Create label (e.g., "Mon", "Tue", "Yesterday", "Today")
       const dateLabel = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : start.toLocaleDateString(undefined, { weekday: 'short' });
       
       history.push({ date: dateLabel, steps });
    }
    
    return history.reverse(); // Return from oldest to newest
  }
}

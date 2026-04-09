import { Accelerometer, Gyroscope } from 'expo-sensors';
import { SensorData } from '../models/Vitals';

export class SensorService {
  private static accSubscription: any = null;
  private static gyroSubscription: any = null;
  
  private static currentAcc = { x: 0, y: 0, z: 0 };
  private static currentGyro = { x: 0, y: 0, z: 0 };

  static setUpdateInterval(ms: number) {
    Accelerometer.setUpdateInterval(ms);
    Gyroscope.setUpdateInterval(ms);
  }

  static startMonitoring(onData: (data: SensorData) => void) {
    this.accSubscription = Accelerometer.addListener(data => {
      this.currentAcc = data;
      this.emitData(onData);
    });

    this.gyroSubscription = Gyroscope.addListener(data => {
      this.currentGyro = data;
      this.emitData(onData);
    });
  }

  static stopMonitoring() {
    this.accSubscription?.remove();
    this.gyroSubscription?.remove();
    this.accSubscription = null;
    this.gyroSubscription = null;
  }

  private static emitData(onData: (data: SensorData) => void) {
    onData({
      accelerometer: this.currentAcc,
      gyroscope: this.currentGyro,
      timestamp: Date.now(),
    });
  }

  /**
   * Calculates the magnitude of acceleration (G-Force)
   */
  static calculateGForce(acc: { x: number; y: number; z: number }) {
    return Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
  }
}

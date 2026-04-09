import { SensorData } from '../models/Vitals';

export class SignalService {
  private static readonly WINDOW_SIZE = 100; // 2 seconds at 50Hz
  private static buffer: number[][] = [];

  /**
   * Adds sensor data to the sliding window buffer.
   * Data format: [acc.x, acc.y, acc.z, gyro.x, gyro.y, gyro.z]
   */
  static addSample(data: SensorData) {
    const sample = [
      data.accelerometer.x,
      data.accelerometer.y,
      data.accelerometer.z,
      data.gyroscope.x,
      data.gyroscope.y,
      data.gyroscope.z,
    ];

    this.buffer.push(sample);

    if (this.buffer.length > this.WINDOW_SIZE) {
      this.buffer.shift();
    }
  }

  static getWindow() {
    return this.buffer;
  }

  static isBufferFull() {
    return this.buffer.length === this.WINDOW_SIZE;
  }

  static clearBuffer() {
    this.buffer = [];
  }

  /**
   * Pre-processes the window for AI inference.
   * Reshapes and normalizes data.
   */
  static getInferenceData() {
    if (!this.isBufferFull()) return null;
    
    // Normalization logic would go here (e.g. subtracting mean / dividing by std)
    // For scaffolding, we return the raw window.
    return this.buffer;
  }
}

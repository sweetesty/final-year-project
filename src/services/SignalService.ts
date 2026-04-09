import { SensorData } from '../models/Vitals';

// Baseline G-Force thresholds
const BASE_THRESHOLD = 2.5;
const ACTIVITY_THRESHOLD = 3.2; // Higher threshold when user is active (walking/running)
const ACTIVITY_DETECTION_WINDOW = 50; // samples (~5s at 10Hz)
const ACTIVITY_G_MEAN_CUTOFF = 1.3; // Mean G-Force above this = active movement

export class SignalService {
  private static readonly WINDOW_SIZE = 100; // 2 seconds at 50Hz
  private static buffer: number[][] = [];

  // Short rolling buffer used purely for activity detection
  private static activityBuffer: number[] = [];

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

    // Track G-Force for activity detection
    const gForce = Math.sqrt(
      data.accelerometer.x ** 2 +
      data.accelerometer.y ** 2 +
      data.accelerometer.z ** 2
    );
    this.activityBuffer.push(gForce);
    if (this.activityBuffer.length > ACTIVITY_DETECTION_WINDOW) {
      this.activityBuffer.shift();
    }
  }

  /**
   * Returns an adaptive G-Force threshold based on recent movement patterns.
   * If the user has been actively moving (walking, exercise), the threshold is
   * raised to reduce false positives from vigorous activity.
   */
  static getAdaptiveThreshold(): number {
    if (this.activityBuffer.length < 10) return BASE_THRESHOLD;

    const mean =
      this.activityBuffer.reduce((sum, g) => sum + g, 0) / this.activityBuffer.length;

    return mean > ACTIVITY_G_MEAN_CUTOFF ? ACTIVITY_THRESHOLD : BASE_THRESHOLD;
  }

  /**
   * Returns true if the recent sensor data suggests active movement
   * (as opposed to rest or sedentary state).
   */
  static isUserActive(): boolean {
    if (this.activityBuffer.length < 10) return false;
    const mean =
      this.activityBuffer.reduce((sum, g) => sum + g, 0) / this.activityBuffer.length;
    return mean > ACTIVITY_G_MEAN_CUTOFF;
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
   * Normalizes data using z-score per channel.
   */
  static getInferenceData() {
    if (!this.isBufferFull()) return null;

    // Z-score normalization per channel
    const numFeatures = 6;
    const normalized = this.buffer.map(row => [...row]);

    for (let col = 0; col < numFeatures; col++) {
      const values = this.buffer.map(row => row[col]);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) || 1;
      for (let row = 0; row < normalized.length; row++) {
        normalized[row][col] = (normalized[row][col] - mean) / std;
      }
    }

    return normalized;
  }
}

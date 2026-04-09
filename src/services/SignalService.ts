import { SensorData } from '../models/Vitals';

// ─── Thresholds ───────────────────────────────────────────────────────────────
const BASE_THRESHOLD      = 2.5;   // G — resting / sedentary
const ACTIVITY_THRESHOLD  = 3.2;   // G — raised when walking/active
const FREEFALL_THRESHOLD  = 0.4;   // G — below this = free-fall phase
const STILLNESS_THRESHOLD = 1.2;   // G — below this = lying still after impact
const STILLNESS_WINDOW    = 15;    // samples that must be "still" after impact

const ACTIVITY_WINDOW      = 50;   // ~5 s at 10 Hz
const ACTIVITY_MEAN_CUTOFF = 1.3;  // mean G above this → user is active

export class SignalService {
  // 2-second sliding window for AI inference [acc.x, acc.y, acc.z, gyro.x, gyro.y, gyro.z]
  private static readonly WINDOW_SIZE = 100;
  private static buffer: number[][] = [];

  // Short buffer for activity detection
  private static activityBuffer: number[] = [];

  // Ring buffer of recent G-Force magnitudes used for pattern detection
  private static gBuffer: number[] = [];
  private static readonly G_BUFFER_SIZE = 60; // ~3 s at 20 Hz

  // ── Public API ──────────────────────────────────────────────────────────────

  static addSample(data: SensorData) {
    const { x, y, z } = data.accelerometer;
    const gx = data.gyroscope.x;
    const gy = data.gyroscope.y;
    const gz = data.gyroscope.z;

    const sample = [x, y, z, gx, gy, gz];
    this.buffer.push(sample);
    if (this.buffer.length > this.WINDOW_SIZE) this.buffer.shift();

    const g = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
    this.activityBuffer.push(g);
    if (this.activityBuffer.length > ACTIVITY_WINDOW) this.activityBuffer.shift();

    this.gBuffer.push(g);
    if (this.gBuffer.length > this.G_BUFFER_SIZE) this.gBuffer.shift();
  }

  /**
   * Adaptive G-Force threshold — higher when the user is actively moving
   * to reduce false positives during walking/exercise.
   */
  static getAdaptiveThreshold(): number {
    if (this.activityBuffer.length < 10) return BASE_THRESHOLD;
    const mean = this._mean(this.activityBuffer);
    return mean > ACTIVITY_MEAN_CUTOFF ? ACTIVITY_THRESHOLD : BASE_THRESHOLD;
  }

  static isUserActive(): boolean {
    if (this.activityBuffer.length < 10) return false;
    return this._mean(this.activityBuffer) > ACTIVITY_MEAN_CUTOFF;
  }

  /**
   * Real fall pattern check — requires three phases in the recent G buffer:
   *
   *   1. FREE-FALL  : at least 2 consecutive samples < 0.4 G
   *   2. IMPACT     : at least 1 sample > threshold (peak shock)
   *   3. STILLNESS  : STILLNESS_WINDOW samples after impact averaging < 1.2 G
   *
   * This distinguishes a true fall from vigorous shaking, jumping, or
   * a single hard tap on the device.
   */
  static detectFallPattern(impactThreshold: number): {
    detected: boolean;
    peakG: number;
    freefallDetected: boolean;
    stillnessDetected: boolean;
  } {
    const buf = this.gBuffer;
    if (buf.length < 20) {
      return { detected: false, peakG: 0, freefallDetected: false, stillnessDetected: false };
    }

    let impactIdx = -1;
    let peakG = 0;
    let freefallDetected = false;

    // Scan forward to find the impact peak
    for (let i = 2; i < buf.length; i++) {
      if (buf[i] > impactThreshold) {
        // Check that ≥2 of the preceding samples were free-fall
        const preceding = buf.slice(Math.max(0, i - 5), i);
        const freefallCount = preceding.filter(g => g < FREEFALL_THRESHOLD).length;
        if (freefallCount >= 2) {
          freefallDetected = true;
          impactIdx = i;
          peakG = Math.max(peakG, buf[i]);
          break;
        }
      }
    }

    if (impactIdx === -1) {
      return { detected: false, peakG, freefallDetected: false, stillnessDetected: false };
    }

    // Check stillness after impact
    const post = buf.slice(impactIdx + 1);
    if (post.length < STILLNESS_WINDOW) {
      // Not enough samples yet after impact — inconclusive
      return { detected: false, peakG, freefallDetected, stillnessDetected: false };
    }

    const stillSamples = post.slice(0, STILLNESS_WINDOW);
    const meanPost = this._mean(stillSamples);
    const stillnessDetected = meanPost < STILLNESS_THRESHOLD;

    return {
      detected: freefallDetected && stillnessDetected,
      peakG,
      freefallDetected,
      stillnessDetected,
    };
  }

  // ── Inference data ──────────────────────────────────────────────────────────

  static getWindow() { return this.buffer; }
  static isBufferFull() { return this.buffer.length === this.WINDOW_SIZE; }
  static clearBuffer() { this.buffer = []; this.gBuffer = []; }

  /**
   * Z-score normalised window for 1D-CNN inference.
   * Output shape: [100, 6]
   */
  static getInferenceData(): number[][] | null {
    if (!this.isBufferFull()) return null;

    const numFeatures = 6;
    const normalized  = this.buffer.map(row => [...row]);

    for (let col = 0; col < numFeatures; col++) {
      const values = this.buffer.map(row => row[col]);
      const mean   = this._mean(values);
      const std    = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) || 1;
      for (let row = 0; row < normalized.length; row++) {
        normalized[row][col] = (normalized[row][col] - mean) / std;
      }
    }

    return normalized;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private static _mean(arr: number[]): number {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }
}

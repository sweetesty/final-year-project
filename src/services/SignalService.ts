import { SensorData } from '../models/Vitals';

// ─── Thresholds ───────────────────────────────────────────────────────────────
const BASE_THRESHOLD      = 2.5;   // G — resting / sedentary impact trigger
const ACTIVITY_THRESHOLD  = 3.2;   // G — raised when user is active
const FREEFALL_THRESHOLD  = 0.7;   // G — below this counts as free-fall phase
const STILLNESS_THRESHOLD = 1.8;   // G — below this = still after impact (raised for surface vibration)
const STILLNESS_SAMPLES   = 6;     // consecutive still samples required (~300ms @ 20Hz)
const FREEFALL_SAMPLES    = 2;     // consecutive free-fall samples required

const ACTIVITY_WINDOW      = 50;   // samples (~2.5s at 20Hz)
const ACTIVITY_MEAN_CUTOFF = 1.3;

export class SignalService {
  private static readonly WINDOW_SIZE = 100;
  private static buffer: number[][] = [];

  private static activityBuffer: number[] = [];

  // G-Force ring buffer — pattern detection runs on this
  private static gBuffer: number[] = [];
  private static readonly G_BUFFER_SIZE = 80; // ~4s at 20Hz

  // Fall pattern state machine
  private static phase: 'watching' | 'freefall' | 'impact' | 'stillness' = 'watching';
  private static freefallCount  = 0;
  private static stillCount     = 0;
  private static peakGSeen      = 0;
  private static fallDetectedCb: ((peakG: number) => void) | null = null;

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Register a callback that fires when a complete fall pattern is confirmed.
   * The callback receives the peak G-Force of the impact.
   */
  static onFallDetected(cb: (peakG: number) => void) {
    this.fallDetectedCb = cb;
  }

  static clearFallCallback() {
    this.fallDetectedCb = null;
  }

  static addSample(data: SensorData) {
    const { x, y, z } = data.accelerometer;
    const gx = data.gyroscope.x;
    const gy = data.gyroscope.y;
    const gz = data.gyroscope.z;

    // Inference window
    this.buffer.push([x, y, z, gx, gy, gz]);
    if (this.buffer.length > this.WINDOW_SIZE) this.buffer.shift();

    const g = Math.sqrt(x ** 2 + y ** 2 + z ** 2);

    // Activity buffer
    this.activityBuffer.push(g);
    if (this.activityBuffer.length > ACTIVITY_WINDOW) this.activityBuffer.shift();

    // G ring buffer
    this.gBuffer.push(g);
    if (this.gBuffer.length > this.G_BUFFER_SIZE) this.gBuffer.shift();

    // Run the state machine on every sample
    this._runStateMachine(g);
  }

  /**
   * Continuous state-machine fall detector — runs on every sample.
   *
   * States:
   *  watching  → looking for free-fall phase
   *  freefall  → counting consecutive low-G samples
   *  impact    → detected impact spike; now watching for stillness
   *  stillness → counting consecutive still samples after impact
   *
   * On completing the full cycle → fires fallDetectedCb(peakG)
   */
  private static _runStateMachine(g: number) {
    const threshold = this.getAdaptiveThreshold();

    switch (this.phase) {
      case 'watching':
        if (g < FREEFALL_THRESHOLD) {
          this.freefallCount = 1;
          this.phase = 'freefall';
        }
        break;

      case 'freefall':
        if (g < FREEFALL_THRESHOLD) {
          this.freefallCount++;
        } else if (g > threshold && this.freefallCount >= FREEFALL_SAMPLES) {
          // Impact detected after sufficient free-fall
          this.peakGSeen = g;
          this.stillCount = 0;
          this.phase = 'impact';
          console.log(`[SignalService] Impact detected: G=${g.toFixed(2)} after ${this.freefallCount} freefall samples`);
        } else {
          // Interrupted — not a fall pattern, reset
          this.phase = 'watching';
          this.freefallCount = 0;
        }
        break;

      case 'impact':
        // Track peak — multiple bounces are fine, just keep the highest
        if (g > this.peakGSeen) this.peakGSeen = g;

        if (g < STILLNESS_THRESHOLD) {
          // Starting to settle — move to stillness phase
          this.stillCount = 1;
          this.phase = 'stillness';
        }
        // Do NOT reset on secondary spikes (bounces) — stay in impact phase
        break;

      case 'stillness':
        if (g < STILLNESS_THRESHOLD) {
          this.stillCount++;
          if (this.stillCount >= STILLNESS_SAMPLES) {
            // ✅ Complete fall pattern confirmed
            const peakG = this.peakGSeen;
            console.log(`[SignalService] Fall pattern CONFIRMED: peakG=${peakG.toFixed(2)}`);
            this._resetStateMachine();
            if (this.fallDetectedCb) this.fallDetectedCb(peakG);
          }
        } else if (g > STILLNESS_THRESHOLD * 2) {
          // Very large spike after settling = person got up or second fall — reset fully
          this._resetStateMachine();
        } else {
          // Small movement — tolerate it, just don't count this sample
        }
        break;
    }
  }

  private static _resetStateMachine() {
    this.phase = 'watching';
    this.freefallCount = 0;
    this.stillCount = 0;
    this.peakGSeen = 0;
  }

  static getAdaptiveThreshold(): number {
    if (this.activityBuffer.length < 10) return BASE_THRESHOLD;
    const mean = this._mean(this.activityBuffer);
    return mean > ACTIVITY_MEAN_CUTOFF ? ACTIVITY_THRESHOLD : BASE_THRESHOLD;
  }

  static isUserActive(): boolean {
    if (this.activityBuffer.length < 10) return false;
    return this._mean(this.activityBuffer) > ACTIVITY_MEAN_CUTOFF;
  }

  // ── Inference data for 1D-CNN ────────────────────────────────────────────

  static getWindow() { return this.buffer; }
  static isBufferFull() { return this.buffer.length === this.WINDOW_SIZE; }

  static clearBuffer() {
    this.buffer = [];
    this.gBuffer = [];
    this._resetStateMachine();
  }

  static getInferenceData(): number[][] | null {
    if (!this.isBufferFull()) return null;
    const numFeatures = 6;
    const normalized = this.buffer.map(row => [...row]);
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

  private static _mean(arr: number[]): number {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }
}

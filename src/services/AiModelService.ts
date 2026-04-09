import * as tf from '@tensorflow/tfjs';
import { SignalService } from './SignalService';

export class AiModelService {
  private static model: tf.LayersModel | null = null;
  private static isInitializing = false;

  static async init() {
    if (this.model || this.isInitializing) return;
    this.isInitializing = true;

    try {
      await tf.ready();
      console.log('[AiModel] TFJS ready. Backend:', tf.getBackend());

      // When model weights are bundled, load them like this:
      // const modelJson    = require('../../assets/model/model.json');
      // const modelWeights = require('../../assets/model/weights.bin');
      // this.model = await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));

      console.log('[AiModel] Weights not yet bundled — running heuristic fallback.');
    } catch (error) {
      console.error('[AiModel] Init error:', error);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Returns a fall prediction.
   *
   * When the 1D-CNN model is loaded it runs tensor inference (shape [1, 100, 6]).
   * Without model weights it falls back to SignalService.detectFallPattern() —
   * the three-phase heuristic (free-fall → impact → stillness) which is far more
   * accurate than the previous single-sample G-Force check.
   */
  static async predictFall(impactThreshold: number): Promise<{ isFall: boolean; confidence: number; peakG: number }> {
    const data = SignalService.getInferenceData();

    // ── Model path ───────────────────────────────────────────────────────────
    if (this.model && data) {
      try {
        const inputTensor = tf.tensor3d([data], [1, 100, 6]);
        const prediction  = this.model.predict(inputTensor) as tf.Tensor;
        const score       = (await prediction.data())[0];
        inputTensor.dispose();
        prediction.dispose();
        return { isFall: score > 0.8, confidence: score, peakG: 0 };
      } catch (err) {
        console.error('[AiModel] Inference error:', err);
      }
    }

    // ── Heuristic fallback ───────────────────────────────────────────────────
    const result = SignalService.detectFallPattern(impactThreshold);
    const confidence = result.detected
      ? 0.85
      : result.freefallDetected
        ? 0.45   // free-fall seen but no stillness yet
        : 0.1;

    return {
      isFall:     result.detected,
      confidence,
      peakG:      result.peakG,
    };
  }
}

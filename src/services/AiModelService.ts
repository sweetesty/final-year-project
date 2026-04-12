import * as tf from '@tensorflow/tfjs';
import { SignalService } from './SignalService';

/**
 * AiModelService — 1D-CNN inference for fall detection.
 *
 * The primary detection path is now SignalService's continuous state machine
 * (free-fall → impact → stillness). This service is used as an optional
 * second-opinion layer when model weights are bundled.
 *
 * To activate: drop model.json + weights.bin into assets/model/ and
 * uncomment the bundleResourceIO lines below.
 */
export class AiModelService {
  private static model: tf.LayersModel | null = null;
  private static isInitializing = false;

  static async init() {
    if (this.model || this.isInitializing) return;
    this.isInitializing = true;
    try {
      await tf.ready();
      console.log('[AiModel] TFJS ready. Backend:', tf.getBackend());

      // Uncomment when model assets are bundled:
      // const modelJson    = require('../../assets/model/model.json');
      // const modelWeights = require('../../assets/model/weights.bin');
      // this.model = await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));
      // console.log('[AiModel] Model loaded.');

      console.log('[AiModel] Weights not yet bundled — heuristic state machine active.');
    } catch (err) {
      console.error('[AiModel] Init error:', err);
    } finally {
      this.isInitializing = false;
    }
  }

  /** Run CNN inference on the current window. Returns null if model not loaded. */
  static async runInference(): Promise<{ isFall: boolean; confidence: number } | null> {
    if (!this.model) return null;
    const data = SignalService.getInferenceData();
    if (!data) return null;
    try {
      const inputTensor = tf.tensor3d([data], [1, 100, 6]);
      const prediction  = this.model.predict(inputTensor) as tf.Tensor;
      const score       = (await prediction.data())[0];
      inputTensor.dispose();
      prediction.dispose();
      return { isFall: score > 0.8, confidence: score };
    } catch (err) {
      console.error('[AiModel] Inference error:', err);
      return null;
    }
  }

  static isLoaded() { return this.model !== null; }
}

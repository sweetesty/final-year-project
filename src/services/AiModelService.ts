import * as tf from '@tensorflow/tfjs';
import { bundleResourceIO, decodeJpeg } from '@tensorflow/tfjs-react-native';
import { SignalService } from './SignalService';

export class AiModelService {
  private static model: tf.LayersModel | null = null;
  private static isInitializing = false;

  static async init() {
    if (this.model || this.isInitializing) return;
    this.isInitializing = true;

    try {
      await tf.ready();
      console.log('TFJS Ready. Backend:', tf.getBackend());

      // In a real app, we bundle the model.json and weights
      // const modelJson = require('../../assets/model/model.json');
      // const modelWeights = require('../../assets/model/weights.bin');
      // this.model = await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));
      
      console.log('AI Model architecture scaffolded. Waiting for weight assets.');
    } catch (error) {
      console.error('TFJS Init Error:', error);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Performs inference using the 1D-CNN model.
   * Input shape: [1, 100, 6] (Batch, TimeSteps, Features)
   */
  static async predictFall(): Promise<{ isFall: boolean; confidence: number }> {
    const data = SignalService.getInferenceData();
    if (!data || data.length < 100) {
      return { isFall: false, confidence: 0 };
    }

    try {
      // 1. Convert to Tensor
      const inputTensor = tf.tensor3d([data], [1, 100, 6]);

      // 2. Run Inference
      if (this.model) {
        const prediction = this.model.predict(inputTensor) as tf.Tensor;
        const score = (await prediction.data())[0];
        
        // Cleanup
        inputTensor.dispose();
        prediction.dispose();

        return { isFall: score > 0.8, confidence: score };
      } else {
        // Mock Inference Logic (G-Force analysis if AI model is not yet loaded)
        // This allows development to continue without the actual .json weight files
        const lastSample = data[data.length - 1];
        const gForce = Math.sqrt(lastSample[0]**2 + lastSample[1]**2 + lastSample[2]**2);
        
        inputTensor.dispose();
        return { isFall: gForce > 3.0, confidence: 0.9 };
      }
    } catch (error) {
      console.error('Inference Error:', error);
      return { isFall: false, confidence: 0 };
    }
  }
}

import type { FeatureVector } from '$lib/audio/types';
import type { ClassifierModel, NormalizationParams } from './model';

/**
 * Flatten a FeatureVector into a plain number array for the classifier.
 * Order: 13 MFCCs, spectral centroid, ZCR, energy (16 elements total).
 */
export function flattenFeatureVector(fv: FeatureVector): number[] {
  return [...fv.mfcc, fv.spectralCentroid, fv.zcr, fv.energy];
}

/**
 * Compute z-score normalization parameters (mean, std) across all samples in the model.
 * Uses population std (divide by N, not N-1) since we want to normalize training data itself.
 */
export function computeNormalization(model: ClassifierModel): NormalizationParams {
  const allSamples: number[][] = [];
  for (const samples of Object.values(model.surfaces)) {
    for (const sample of samples) {
      allSamples.push(sample.features);
    }
  }

  if (allSamples.length === 0) {
    return { mean: [], std: [] };
  }

  const numFeatures = allSamples[0].length;
  const mean = new Array<number>(numFeatures).fill(0);
  const std = new Array<number>(numFeatures).fill(0);

  // Compute mean
  for (const features of allSamples) {
    for (let i = 0; i < numFeatures; i++) {
      mean[i] += features[i];
    }
  }
  for (let i = 0; i < numFeatures; i++) {
    mean[i] /= allSamples.length;
  }

  // Compute std (population)
  for (const features of allSamples) {
    for (let i = 0; i < numFeatures; i++) {
      const diff = features[i] - mean[i];
      std[i] += diff * diff;
    }
  }
  for (let i = 0; i < numFeatures; i++) {
    std[i] = Math.sqrt(std[i] / allSamples.length);
  }

  return { mean, std };
}

/**
 * Apply z-score normalization to a feature vector.
 * Returns 0 for dimensions where std is 0 (avoids NaN).
 */
export function normalize(features: number[], params: NormalizationParams): number[] {
  return features.map((val, i) => {
    if (params.std[i] === 0) return 0;
    return (val - params.mean[i]) / params.std[i];
  });
}

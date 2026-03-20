import type { FeatureVector } from '$lib/audio/types';
import type { ClassifierModel, NormalizationParams } from './model';

/**
 * Flatten a FeatureVector into a plain number array for the classifier.
 * Order: 13 MFCCs, spectral centroid, ZCR, energy (16 elements total).
 */
export function flattenFeatureVector(fv: FeatureVector): number[] {
  return [...fv.mfcc, fv.spectralCentroid, fv.zcr, fv.energy];
}

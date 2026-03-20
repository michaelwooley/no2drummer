import type { FeatureVector } from '$lib/audio/types';

/** Number of features in a flattened FeatureVector (13 MFCCs + centroid + ZCR + energy) */
export const FEATURE_COUNT = 16;

/** A labeled training sample — flattened feature vector with surface label */
export interface LabeledSample {
  surface: string;
  features: number[];
}

/** Z-score normalization parameters */
export interface NormalizationParams {
  mean: number[];
  std: number[];
}

/** The complete classifier model */
export interface ClassifierModel {
  surfaces: Record<string, LabeledSample[]>;
  normalization: NormalizationParams | null;
}

/** Classification result */
export interface ClassificationResult {
  surface: string;
  confidence: number;
}

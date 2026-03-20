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

/**
 * Serialize a classifier model to a JSON string.
 */
export function serializeModel(model: ClassifierModel): string {
  return JSON.stringify(model);
}

/**
 * Deserialize a classifier model from a JSON string.
 * Throws if the JSON is malformed or has an unexpected structure.
 */
export function deserializeModel(json: string): ClassifierModel {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Model must be an object');
  }

  const obj = parsed as Record<string, unknown>;

  if (!('surfaces' in obj) || typeof obj.surfaces !== 'object' || obj.surfaces === null) {
    throw new Error('Model must have a surfaces object');
  }

  if (obj.normalization !== null && typeof obj.normalization !== 'object') {
    throw new Error('Model normalization must be an object or null');
  }

  return obj as unknown as ClassifierModel;
}

import type { FeatureVector } from '$lib/audio/types';
import type { ClassifierModel } from './model';
import { flattenFeatureVector, computeNormalization } from './normalize';

/**
 * Create an empty classifier model.
 */
export function createModel(): ClassifierModel {
  return {
    surfaces: {},
    normalization: null
  };
}

/**
 * Add a training sample to the model. Returns a new model (immutable).
 * Flattens the FeatureVector and recomputes normalization.
 */
export function addSample(
  model: ClassifierModel,
  surface: string,
  fv: FeatureVector
): ClassifierModel {
  const flat = flattenFeatureVector(fv);
  const existingSamples = model.surfaces[surface] ?? [];
  const newSurfaces = {
    ...model.surfaces,
    [surface]: [...existingSamples, { surface, features: flat }]
  };
  const newModel: ClassifierModel = {
    surfaces: newSurfaces,
    normalization: null
  };
  newModel.normalization = computeNormalization(newModel);
  return newModel;
}

/**
 * Remove a surface and all its samples. Returns a new model (immutable).
 * Recomputes normalization from remaining surfaces.
 */
export function removeSurface(model: ClassifierModel, surface: string): ClassifierModel {
  const remainingSurfaces = Object.fromEntries(
    Object.entries(model.surfaces).filter(([key]) => key !== surface)
  );
  const newModel: ClassifierModel = {
    surfaces: remainingSurfaces,
    normalization: null
  };
  newModel.normalization = computeNormalization(newModel);
  return newModel;
}

/**
 * Get the names of all surfaces in the model.
 */
export function getSurfaceNames(model: ClassifierModel): string[] {
  return Object.keys(model.surfaces);
}

/**
 * Get the number of training samples for a surface. Returns 0 if surface doesn't exist.
 */
export function getSampleCount(model: ClassifierModel, surface: string): number {
  return model.surfaces[surface]?.length ?? 0;
}

import type { ClassifierModel, ClassificationResult } from './model';
import { normalize } from './normalize';

/**
 * Euclidean distance between two feature vectors.
 */
export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

const DEFAULT_K = 5;

/**
 * Classify a feature vector using inverse-distance-weighted KNN.
 *
 * 1. Normalizes the input using the model's normalization params
 * 2. Finds the k nearest training samples by Euclidean distance
 * 3. Weights each neighbor's vote by 1/distance
 * 4. Returns the surface with the highest total weight + confidence score
 *
 * Returns null if the model has no samples or no normalization params.
 */
export function classify(
  model: ClassifierModel,
  features: number[],
  k: number = DEFAULT_K
): ClassificationResult | null {
  if (!model.normalization) return null;

  // Collect all samples
  const allSamples: { surface: string; features: number[] }[] = [];
  for (const samples of Object.values(model.surfaces)) {
    for (const sample of samples) {
      allSamples.push(sample);
    }
  }
  if (allSamples.length === 0) return null;

  // Normalize the query
  const normalizedQuery = normalize(features, model.normalization);

  // Compute distances to all samples
  const distances: { surface: string; distance: number }[] = allSamples.map((sample) => ({
    surface: sample.surface,
    distance: euclideanDistance(
      normalizedQuery,
      normalize(sample.features, model.normalization!)
    )
  }));

  // Sort by distance and take k nearest
  distances.sort((a, b) => a.distance - b.distance);
  const neighbors = distances.slice(0, Math.min(k, distances.length));

  // Check for exact match (distance = 0)
  if (neighbors[0].distance === 0) {
    return { surface: neighbors[0].surface, confidence: 1 };
  }

  // Inverse-distance weighting
  const weights: Record<string, number> = {};
  let totalWeight = 0;

  for (const neighbor of neighbors) {
    const weight = 1 / neighbor.distance;
    weights[neighbor.surface] = (weights[neighbor.surface] ?? 0) + weight;
    totalWeight += weight;
  }

  // Find winner
  let bestSurface = '';
  let bestWeight = -1;
  for (const [surface, weight] of Object.entries(weights)) {
    if (weight > bestWeight) {
      bestWeight = weight;
      bestSurface = surface;
    }
  }

  return {
    surface: bestSurface,
    confidence: bestWeight / totalWeight
  };
}

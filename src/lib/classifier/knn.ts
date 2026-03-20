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

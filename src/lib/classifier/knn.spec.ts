import { describe, it, expect } from 'vitest';
import { euclideanDistance, classify } from './knn';
import type { ClassifierModel } from './model';
import { flattenFeatureVector } from './normalize';
import { createModel, addSample } from './trainer';
import type { FeatureVector } from '$lib/audio/types';

describe('euclideanDistance', () => {
  it('returns 0 for identical vectors', () => {
    expect(euclideanDistance([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('returns correct distance for known vectors', () => {
    // Distance between [0, 0] and [3, 4] = 5
    expect(euclideanDistance([0, 0], [3, 4])).toBeCloseTo(5, 5);
  });

  it('returns correct distance for single dimension', () => {
    expect(euclideanDistance([0], [7])).toBeCloseTo(7, 5);
  });
});

describe('classify', () => {
  // Helper: build a model with pre-normalized samples and matching normalization params
  function makeModel(surfaces: Record<string, number[][]>): ClassifierModel {
    const model: ClassifierModel = { surfaces: {}, normalization: null };
    const allFeatures: number[][] = [];

    for (const [name, featureSets] of Object.entries(surfaces)) {
      model.surfaces[name] = featureSets.map((features) => ({ surface: name, features }));
      allFeatures.push(...featureSets);
    }

    // Compute normalization
    if (allFeatures.length === 0) return model;
    const numFeatures = allFeatures[0].length;
    const mean = new Array<number>(numFeatures).fill(0);
    const std = new Array<number>(numFeatures).fill(0);

    for (const f of allFeatures) {
      for (let i = 0; i < numFeatures; i++) mean[i] += f[i];
    }
    for (let i = 0; i < numFeatures; i++) mean[i] /= allFeatures.length;

    for (const f of allFeatures) {
      for (let i = 0; i < numFeatures; i++) {
        const diff = f[i] - mean[i];
        std[i] += diff * diff;
      }
    }
    for (let i = 0; i < numFeatures; i++) std[i] = Math.sqrt(std[i] / allFeatures.length);

    model.normalization = { mean, std };
    return model;
  }

  it('returns null for empty model', () => {
    const model: ClassifierModel = { surfaces: {}, normalization: null };
    expect(classify(model, [1, 2])).toBeNull();
  });

  it('classifies correctly with well-separated clusters', () => {
    // Surface A clusters around [0, 0], Surface B around [10, 10]
    const model = makeModel({
      a: [[0, 0], [0.1, 0.1], [0, 0.1], [0.1, 0], [-0.1, 0]],
      b: [[10, 10], [10.1, 10.1], [10, 10.1], [10.1, 10], [9.9, 10]]
    });

    const resultA = classify(model, [0.05, 0.05]);
    expect(resultA).not.toBeNull();
    expect(resultA!.surface).toBe('a');

    const resultB = classify(model, [10.05, 10.05]);
    expect(resultB).not.toBeNull();
    expect(resultB!.surface).toBe('b');
  });

  it('returns high confidence when all neighbors agree', () => {
    const model = makeModel({
      a: [[0, 0], [0.1, 0.1], [0, 0.1], [0.1, 0], [-0.1, 0]],
      b: [[10, 10], [10.1, 10.1], [10, 10.1], [10.1, 10], [9.9, 10]]
    });

    const result = classify(model, [0, 0]);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThan(0.9);
  });

  it('returns lower confidence when neighbors are mixed', () => {
    // Surfaces overlap at the boundary
    const model = makeModel({
      a: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]],
      b: [[3, 3], [4, 4], [5, 5], [6, 6], [7, 7]]
    });

    // Query right at the overlap zone
    const result = classify(model, [3.5, 3.5]);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeLessThan(0.9);
  });

  it('handles exact match without division errors', () => {
    const model = makeModel({
      a: [[0, 0], [0.1, 0.1], [0, 0.1], [0.1, 0], [-0.1, 0]],
      b: [[10, 10], [10.1, 10.1], [10, 10.1], [10.1, 10], [9.9, 10]]
    });

    // Query exactly matches a training sample (after normalization, may not be exact 0)
    const result = classify(model, [0, 0]);
    expect(result).not.toBeNull();
    expect(result!.surface).toBe('a');
    expect(Number.isNaN(result!.confidence)).toBe(false);
  });

  it('uses k parameter', () => {
    // With k=1, nearest neighbor wins
    const model = makeModel({
      a: [[0, 0], [0.1, 0.1]],
      b: [[0.2, 0.2], [10, 10], [10.1, 10.1]]
    });

    const resultK1 = classify(model, [0.15, 0.15], 1);
    expect(resultK1).not.toBeNull();
    // With k=1, the single nearest neighbor decides
    expect(resultK1!.confidence).toBe(1);
  });
});

describe('integration: train and classify', () => {
  function makeFV(values: number[]): FeatureVector {
    return {
      mfcc: new Float64Array(values.slice(0, 13)),
      spectralCentroid: values[13] ?? 0,
      zcr: values[14] ?? 0,
      energy: values[15] ?? 0
    };
  }

  it('classifies hits correctly after training with FeatureVectors', () => {
    let model = createModel();

    // Train surface "desk" — low energy, low centroid
    for (let i = 0; i < 10; i++) {
      const noise = (Math.random() - 0.5) * 0.1;
      model = addSample(
        model,
        'desk',
        makeFV([1 + noise, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 200, 0.3, 0.2])
      );
    }

    // Train surface "book" — high energy, high centroid
    for (let i = 0; i < 10; i++) {
      const noise = (Math.random() - 0.5) * 0.1;
      model = addSample(
        model,
        'book',
        makeFV([10 + noise, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 5000, 0.8, 0.9])
      );
    }

    // Classify a desk-like hit
    const deskHit = flattenFeatureVector(
      makeFV([1.05, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 200, 0.3, 0.2])
    );
    const deskResult = classify(model, deskHit);
    expect(deskResult).not.toBeNull();
    expect(deskResult!.surface).toBe('desk');
    expect(deskResult!.confidence).toBeGreaterThan(0.8);

    // Classify a book-like hit
    const bookHit = flattenFeatureVector(
      makeFV([10.05, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 5000, 0.8, 0.9])
    );
    const bookResult = classify(model, bookHit);
    expect(bookResult).not.toBeNull();
    expect(bookResult!.surface).toBe('book');
    expect(bookResult!.confidence).toBeGreaterThan(0.8);
  });
});

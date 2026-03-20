import { describe, it, expect } from 'vitest';
import { flattenFeatureVector, computeNormalization, normalize } from './normalize';
import type { FeatureVector } from '$lib/audio/types';
import type { ClassifierModel } from './model';

describe('flattenFeatureVector', () => {
  it('produces 16 elements in correct order', () => {
    const fv: FeatureVector = {
      mfcc: new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
      spectralCentroid: 100,
      zcr: 0.5,
      energy: 0.8
    };
    const flat = flattenFeatureVector(fv);

    expect(flat).toHaveLength(16);
    // First 13: MFCCs
    expect(flat.slice(0, 13)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    // Then centroid, ZCR, energy
    expect(flat[13]).toBe(100);
    expect(flat[14]).toBe(0.5);
    expect(flat[15]).toBe(0.8);
  });

  it('converts Float64Array MFCCs to plain numbers', () => {
    const fv: FeatureVector = {
      mfcc: new Float64Array(13).fill(0),
      spectralCentroid: 0,
      zcr: 0,
      energy: 0
    };
    const flat = flattenFeatureVector(fv);

    expect(flat).toHaveLength(16);
    expect(Array.isArray(flat)).toBe(true);
    for (const val of flat) {
      expect(typeof val).toBe('number');
    }
  });
});

describe('computeNormalization', () => {
  it('computes correct mean and std for known data', () => {
    const model: ClassifierModel = {
      surfaces: {
        a: [
          { surface: 'a', features: [2, 4] },
          { surface: 'a', features: [4, 6] }
        ],
        b: [{ surface: 'b', features: [6, 8] }]
      },
      normalization: null
    };
    const params = computeNormalization(model);

    // Mean of [2, 4, 6] = 4, Mean of [4, 6, 8] = 6
    expect(params.mean[0]).toBeCloseTo(4, 5);
    expect(params.mean[1]).toBeCloseTo(6, 5);

    // Std of [2, 4, 6] = sqrt(((2-4)^2 + (4-4)^2 + (6-4)^2) / 3) = sqrt(8/3)
    expect(params.std[0]).toBeCloseTo(Math.sqrt(8 / 3), 5);
    // Std of [4, 6, 8] = sqrt(((4-6)^2 + (6-6)^2 + (8-6)^2) / 3) = sqrt(8/3)
    expect(params.std[1]).toBeCloseTo(Math.sqrt(8 / 3), 5);
  });

  it('returns zero std when all values are identical', () => {
    const model: ClassifierModel = {
      surfaces: {
        a: [
          { surface: 'a', features: [5, 5] },
          { surface: 'a', features: [5, 5] }
        ]
      },
      normalization: null
    };
    const params = computeNormalization(model);

    expect(params.mean[0]).toBe(5);
    expect(params.std[0]).toBe(0);
  });
});

describe('normalize', () => {
  it('produces z-scored values', () => {
    const params = { mean: [10, 20], std: [2, 5] };
    const result = normalize([12, 25], params);

    // (12 - 10) / 2 = 1, (25 - 20) / 5 = 1
    expect(result[0]).toBeCloseTo(1, 5);
    expect(result[1]).toBeCloseTo(1, 5);
  });

  it('returns 0 when std is 0', () => {
    const params = { mean: [5], std: [0] };
    const result = normalize([5], params);

    expect(result[0]).toBe(0);
  });

  it('does not produce NaN', () => {
    const params = { mean: [0], std: [0] };
    const result = normalize([100], params);

    expect(result[0]).toBe(0);
    expect(Number.isNaN(result[0])).toBe(false);
  });
});

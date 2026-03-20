import { describe, it, expect } from 'vitest';
import { flattenFeatureVector } from './normalize';
import type { FeatureVector } from '$lib/audio/types';

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

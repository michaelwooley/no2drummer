import { describe, it, expect } from 'vitest';
import { euclideanDistance } from './knn';

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

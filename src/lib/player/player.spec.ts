import { describe, it, expect } from 'vitest';
import { intensityToGain } from './player';

describe('intensityToGain', () => {
  it('maps 0 to 0', () => {
    expect(intensityToGain(0)).toBe(0);
  });

  it('maps 1 to 1', () => {
    expect(intensityToGain(1)).toBeCloseTo(1, 5);
  });

  it('maps 0.5 above 0.5 (log curve boosts quiet hits)', () => {
    const gain = intensityToGain(0.5);
    expect(gain).toBeGreaterThan(0.5);
    expect(gain).toBeLessThan(1);
  });

  it('is monotonically increasing', () => {
    const values = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const gains = values.map(intensityToGain);
    for (let i = 1; i < gains.length; i++) {
      expect(gains[i]).toBeGreaterThanOrEqual(gains[i - 1]);
    }
  });

  it('clamps negative values to 0', () => {
    expect(intensityToGain(-0.5)).toBe(0);
  });

  it('clamps values above 1 to gain of 1', () => {
    expect(intensityToGain(2)).toBeCloseTo(1, 5);
  });
});

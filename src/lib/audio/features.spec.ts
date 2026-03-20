import { describe, it, expect } from 'vitest';
import { rmsEnergy, zeroCrossingRate, spectralCentroid, mfcc, extractFeatures } from './features';

describe('rmsEnergy', () => {
  it('returns 0 for silence', () => {
    const silence = new Float32Array(512);
    expect(rmsEnergy(silence)).toBe(0);
  });

  it('returns correct RMS for a known signal', () => {
    // All samples at 0.5 → RMS = 0.5
    const signal = new Float32Array(512).fill(0.5);
    expect(rmsEnergy(signal)).toBeCloseTo(0.5, 5);
  });

  it('returns correct RMS for a mixed signal', () => {
    // Alternating 1 and -1 → RMS = 1
    const signal = new Float32Array(512);
    for (let i = 0; i < signal.length; i++) {
      signal[i] = i % 2 === 0 ? 1 : -1;
    }
    expect(rmsEnergy(signal)).toBeCloseTo(1, 5);
  });
});

describe('zeroCrossingRate', () => {
  it('returns 0 for all-positive signal', () => {
    const signal = new Float32Array(512).fill(0.5);
    expect(zeroCrossingRate(signal)).toBe(0);
  });

  it('returns ~1.0 for signal that crosses every sample', () => {
    const signal = new Float32Array(512);
    for (let i = 0; i < signal.length; i++) {
      signal[i] = i % 2 === 0 ? 1 : -1;
    }
    expect(zeroCrossingRate(signal)).toBeCloseTo(1, 1);
  });

  it('returns ~0.5 for signal that crosses every other sample', () => {
    const signal = new Float32Array(512);
    for (let i = 0; i < signal.length; i++) {
      signal[i] = Math.floor(i / 2) % 2 === 0 ? 1 : -1;
    }
    expect(zeroCrossingRate(signal)).toBeCloseTo(0.5, 1);
  });
});

describe('spectralCentroid', () => {
  it('returns 0 for silence', () => {
    const silence = new Float32Array(512);
    expect(spectralCentroid(silence, 44100)).toBe(0);
  });

  it('returns higher centroid for high-frequency signal', () => {
    const sampleRate = 44100;
    const n = 512;
    const lowFreq = new Float32Array(n);
    const highFreq = new Float32Array(n);

    // 200 Hz sine
    for (let i = 0; i < n; i++) {
      lowFreq[i] = Math.sin((2 * Math.PI * 200 * i) / sampleRate);
    }
    // 4000 Hz sine
    for (let i = 0; i < n; i++) {
      highFreq[i] = Math.sin((2 * Math.PI * 4000 * i) / sampleRate);
    }

    const lowCentroid = spectralCentroid(lowFreq, sampleRate);
    const highCentroid = spectralCentroid(highFreq, sampleRate);

    expect(highCentroid).toBeGreaterThan(lowCentroid);
    // Low freq centroid should be near 200 Hz (within FFT bin resolution)
    expect(lowCentroid).toBeGreaterThan(100);
    expect(lowCentroid).toBeLessThan(400);
  });
});

describe('mfcc', () => {
  it('returns 13 coefficients', () => {
    const signal = new Float32Array(512);
    for (let i = 0; i < signal.length; i++) {
      signal[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
    }
    const coeffs = mfcc(signal, 44100);
    expect(coeffs).toHaveLength(13);
  });

  it('returns all zeros for silence', () => {
    const silence = new Float32Array(512);
    const coeffs = mfcc(silence, 44100);
    expect(coeffs).toHaveLength(13);
    for (const c of coeffs) {
      expect(c).toBe(0);
    }
  });

  it('produces different coefficients for different frequencies', () => {
    const sampleRate = 44100;
    const n = 512;

    const low = new Float32Array(n);
    const high = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      low[i] = Math.sin((2 * Math.PI * 300 * i) / sampleRate);
      high[i] = Math.sin((2 * Math.PI * 3000 * i) / sampleRate);
    }

    const lowMfcc = mfcc(low, sampleRate);
    const highMfcc = mfcc(high, sampleRate);

    let totalDiff = 0;
    for (let i = 0; i < 13; i++) {
      totalDiff += Math.abs(lowMfcc[i] - highMfcc[i]);
    }
    expect(totalDiff).toBeGreaterThan(1);
  });
});

describe('extractFeatures', () => {
  it('returns a complete FeatureVector', () => {
    const signal = new Float32Array(512);
    for (let i = 0; i < signal.length; i++) {
      signal[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
    }
    const features = extractFeatures(signal, 44100);

    expect(features.mfcc).toHaveLength(13);
    expect(features.spectralCentroid).toBeGreaterThan(0);
    expect(features.zcr).toBeGreaterThanOrEqual(0);
    expect(features.energy).toBeGreaterThan(0);
  });
});

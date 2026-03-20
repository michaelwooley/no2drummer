import { describe, it, expect } from 'vitest'
import { rmsEnergy, zeroCrossingRate, spectralCentroid } from './features'

describe('rmsEnergy', () => {
  it('returns 0 for silence', () => {
    const silence = new Float32Array(512)
    expect(rmsEnergy(silence)).toBe(0)
  })

  it('returns correct RMS for a known signal', () => {
    // All samples at 0.5 → RMS = 0.5
    const signal = new Float32Array(512).fill(0.5)
    expect(rmsEnergy(signal)).toBeCloseTo(0.5, 5)
  })

  it('returns correct RMS for a mixed signal', () => {
    // Alternating 1 and -1 → RMS = 1
    const signal = new Float32Array(512)
    for (let i = 0; i < signal.length; i++) {
      signal[i] = i % 2 === 0 ? 1 : -1
    }
    expect(rmsEnergy(signal)).toBeCloseTo(1, 5)
  })
})

describe('zeroCrossingRate', () => {
  it('returns 0 for all-positive signal', () => {
    const signal = new Float32Array(512).fill(0.5)
    expect(zeroCrossingRate(signal)).toBe(0)
  })

  it('returns ~1.0 for signal that crosses every sample', () => {
    const signal = new Float32Array(512)
    for (let i = 0; i < signal.length; i++) {
      signal[i] = i % 2 === 0 ? 1 : -1
    }
    expect(zeroCrossingRate(signal)).toBeCloseTo(1, 1)
  })

  it('returns ~0.5 for signal that crosses every other sample', () => {
    const signal = new Float32Array(512)
    for (let i = 0; i < signal.length; i++) {
      signal[i] = Math.floor(i / 2) % 2 === 0 ? 1 : -1
    }
    expect(zeroCrossingRate(signal)).toBeCloseTo(0.5, 1)
  })
})

describe('spectralCentroid', () => {
  it('returns 0 for silence', () => {
    const silence = new Float32Array(512)
    expect(spectralCentroid(silence, 44100)).toBe(0)
  })

  it('returns higher centroid for high-frequency signal', () => {
    const sampleRate = 44100
    const n = 512
    const lowFreq = new Float32Array(n)
    const highFreq = new Float32Array(n)

    // 200 Hz sine
    for (let i = 0; i < n; i++) {
      lowFreq[i] = Math.sin(2 * Math.PI * 200 * i / sampleRate)
    }
    // 4000 Hz sine
    for (let i = 0; i < n; i++) {
      highFreq[i] = Math.sin(2 * Math.PI * 4000 * i / sampleRate)
    }

    const lowCentroid = spectralCentroid(lowFreq, sampleRate)
    const highCentroid = spectralCentroid(highFreq, sampleRate)

    expect(highCentroid).toBeGreaterThan(lowCentroid)
    // Low freq centroid should be near 200 Hz (within FFT bin resolution)
    expect(lowCentroid).toBeGreaterThan(100)
    expect(lowCentroid).toBeLessThan(400)
  })
})

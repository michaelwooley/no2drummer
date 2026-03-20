import { describe, it, expect } from 'vitest'
import { rmsEnergy, zeroCrossingRate } from './features'

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

# Milestone 1: Audio Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture mic audio, detect percussive hits, extract audio features, and display them in real time.

**Architecture:** AudioWorklet captures mic input and detects onsets via adaptive energy threshold. Feature extraction (MFCCs, spectral centroid, ZCR, energy) runs as pure functions shared between the worklet and tests. Feature vectors are posted to the main thread via MessagePort and displayed on a debug page.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Web Audio API (AudioWorklet, getUserMedia), TailwindCSS v4, Vitest

**Spec:** `docs/superpowers/specs/2026-03-19-no2drummer-design.md`

---

## File Structure

```
src/lib/audio/
├── features.ts          — Pure feature extraction functions (MFCC, spectral centroid, ZCR, energy)
├── features.spec.ts     — Unit tests for feature extraction
├── onset.ts             — Onset detection logic (adaptive energy threshold)
├── onset.spec.ts        — Unit tests for onset detection
├── worklet-processor.ts — AudioWorkletProcessor (ring buffer → onset → features → post)
├── capture.ts           — getUserMedia + AudioContext + worklet registration
└── types.ts             — Shared types (FeatureVector, OnsetEvent, WorkletMessage)

src/routes/debug/
└── +page.svelte         — Debug page: mic input, hit detection, feature display
```

**Why `onset.ts` is separate from `worklet-processor.ts`:** The onset detection algorithm is pure math (takes samples, returns boolean). Extracting it lets us unit test it without an AudioWorklet context. The worklet just calls these functions.

**Why `features.ts` is separate:** Same reason — pure functions that take a Float32Array and return numbers. Testable in Node, usable in the worklet.

---

## Task 1: Shared Types

**Files:**
- Create: `src/lib/audio/types.ts`

- [ ] **Step 1: Create type definitions**

```ts
/** Feature vector extracted from a single hit */
export interface FeatureVector {
  /** 13 Mel-frequency cepstral coefficients */
  mfcc: Float64Array
  /** Spectral centroid in Hz — "brightness" of the sound */
  spectralCentroid: number
  /** Zero-crossing rate — noisy vs tonal */
  zcr: number
  /** RMS energy — hit intensity */
  energy: number
}

/** Message posted from AudioWorklet to main thread */
export interface WorkletHitMessage {
  type: 'hit'
  features: FeatureVector
  /** RMS energy of the hit, used for volume scaling */
  intensity: number
  /** Timestamp from performance.now() at detection time */
  timestamp: number
}

/** Message posted from main thread to AudioWorklet */
export interface WorkletConfigMessage {
  type: 'config'
  /** Energy threshold multiplier for onset detection (higher = less sensitive) */
  sensitivityMultiplier: number
}

export type WorkletMessage = WorkletHitMessage | WorkletConfigMessage
```

- [ ] **Step 2: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/audio/types.ts
git commit -m "feat(audio): add shared types for audio pipeline"
```

---

## Task 2: Feature Extraction — Energy & ZCR

**Files:**
- Create: `src/lib/audio/features.ts`
- Create: `src/lib/audio/features.spec.ts`

- [ ] **Step 1: Write failing tests for energy and ZCR**

```ts
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
    // Every adjacent pair crosses, so rate ≈ 1.0
    expect(zeroCrossingRate(signal)).toBeCloseTo(1, 1)
  })

  it('returns ~0.5 for signal that crosses every other sample', () => {
    const signal = new Float32Array(512)
    for (let i = 0; i < signal.length; i++) {
      // Pattern: +, +, -, -, +, +, -, - ...
      signal[i] = Math.floor(i / 2) % 2 === 0 ? 1 : -1
    }
    expect(zeroCrossingRate(signal)).toBeCloseTo(0.5, 1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test:unit -- --run --project server src/lib/audio/features.spec.ts`
Expected: FAIL — `rmsEnergy` and `zeroCrossingRate` not found

- [ ] **Step 3: Implement energy and ZCR**

```ts
/**
 * Root Mean Square energy of a signal buffer.
 * Returns 0 for empty buffers.
 */
export function rmsEnergy(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i]
  }
  return Math.sqrt(sum / samples.length)
}

/**
 * Zero-crossing rate: fraction of adjacent sample pairs that cross zero.
 * Range: 0 (no crossings) to ~1 (crosses every sample).
 */
export function zeroCrossingRate(samples: Float32Array): number {
  if (samples.length < 2) return 0
  let crossings = 0
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) {
      crossings++
    }
  }
  return crossings / (samples.length - 1)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit -- --run --project server src/lib/audio/features.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/features.ts src/lib/audio/features.spec.ts
git commit -m "feat(audio): add RMS energy and zero-crossing rate extraction"
```

---

## Task 3: Feature Extraction — Spectral Centroid

**Files:**
- Modify: `src/lib/audio/features.ts`
- Modify: `src/lib/audio/features.spec.ts`

- [ ] **Step 1: Write failing test for spectral centroid**

Append to `features.spec.ts`:

```ts
import { spectralCentroid } from './features'

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run --project server src/lib/audio/features.spec.ts`
Expected: FAIL — `spectralCentroid` not found

- [ ] **Step 3: Implement spectral centroid**

Add to `features.ts`:

```ts
/**
 * Compute magnitude spectrum using a naive DFT (real input, first N/2 bins).
 * For 512 samples this is fast enough. If perf matters, swap for FFT later.
 */
function magnitudeSpectrum(samples: Float32Array): Float64Array {
  const n = samples.length
  const numBins = Math.floor(n / 2)
  const magnitudes = new Float64Array(numBins)

  for (let k = 0; k < numBins; k++) {
    let real = 0
    let imag = 0
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n
      real += samples[t] * Math.cos(angle)
      imag -= samples[t] * Math.sin(angle)
    }
    magnitudes[k] = Math.sqrt(real * real + imag * imag)
  }

  return magnitudes
}

/**
 * Spectral centroid: weighted mean of frequencies by their magnitudes.
 * Returns frequency in Hz. Returns 0 for silent signals.
 */
export function spectralCentroid(samples: Float32Array, sampleRate: number): number {
  const magnitudes = magnitudeSpectrum(samples)
  const numBins = magnitudes.length
  const binWidth = sampleRate / (numBins * 2)

  let weightedSum = 0
  let totalMagnitude = 0

  for (let k = 0; k < numBins; k++) {
    const freq = k * binWidth
    weightedSum += freq * magnitudes[k]
    totalMagnitude += magnitudes[k]
  }

  if (totalMagnitude === 0) return 0
  return weightedSum / totalMagnitude
}
```

**Note:** The naive DFT is O(n^2) but for n=512 that's ~130k ops — fine for both tests and real-time use at ~12ms intervals. If profiling shows it's too slow in the worklet, replace with FFT (Cooley-Tukey) as a drop-in optimization. Export `magnitudeSpectrum` only if needed by MFCCs later.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit -- --run --project server src/lib/audio/features.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/features.ts src/lib/audio/features.spec.ts
git commit -m "feat(audio): add spectral centroid extraction with DFT"
```

---

## Task 4: Feature Extraction — MFCCs

**Files:**
- Modify: `src/lib/audio/features.ts`
- Modify: `src/lib/audio/features.spec.ts`

- [ ] **Step 1: Write failing tests for MFCCs**

Append to `features.spec.ts`:

```ts
import { mfcc } from './features'

describe('mfcc', () => {
  it('returns 13 coefficients', () => {
    const signal = new Float32Array(512)
    for (let i = 0; i < signal.length; i++) {
      signal[i] = Math.sin(2 * Math.PI * 440 * i / 44100)
    }
    const coeffs = mfcc(signal, 44100)
    expect(coeffs).toHaveLength(13)
  })

  it('returns all zeros for silence', () => {
    const silence = new Float32Array(512)
    const coeffs = mfcc(silence, 44100)
    expect(coeffs).toHaveLength(13)
    for (const c of coeffs) {
      expect(c).toBe(0)
    }
  })

  it('produces different coefficients for different frequencies', () => {
    const sampleRate = 44100
    const n = 512

    const low = new Float32Array(n)
    const high = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      low[i] = Math.sin(2 * Math.PI * 300 * i / sampleRate)
      high[i] = Math.sin(2 * Math.PI * 3000 * i / sampleRate)
    }

    const lowMfcc = mfcc(low, sampleRate)
    const highMfcc = mfcc(high, sampleRate)

    // At least some coefficients should differ meaningfully
    let totalDiff = 0
    for (let i = 0; i < 13; i++) {
      totalDiff += Math.abs(lowMfcc[i] - highMfcc[i])
    }
    expect(totalDiff).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run --project server src/lib/audio/features.spec.ts`
Expected: FAIL — `mfcc` not found

- [ ] **Step 3: Implement MFCCs**

Add to `features.ts`:

```ts
const NUM_MEL_FILTERS = 26
const NUM_MFCC = 13

/**
 * Convert frequency in Hz to Mel scale.
 */
function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700)
}

/**
 * Convert Mel scale to Hz.
 */
function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1)
}

/**
 * Build a Mel filterbank matrix.
 * Returns array of NUM_MEL_FILTERS filters, each an array of [binIndex, weight] pairs.
 */
function melFilterbank(
  numBins: number,
  sampleRate: number
): Array<Array<[number, number]>> {
  const maxFreq = sampleRate / 2
  const minMel = hzToMel(0)
  const maxMel = hzToMel(maxFreq)

  // Equally spaced points in Mel space
  const numPoints = NUM_MEL_FILTERS + 2
  const melPoints = new Float64Array(numPoints)
  for (let i = 0; i < numPoints; i++) {
    melPoints[i] = minMel + (i * (maxMel - minMel)) / (numPoints - 1)
  }

  // Convert to Hz and then to FFT bin indices
  const binIndices = new Float64Array(numPoints)
  for (let i = 0; i < numPoints; i++) {
    binIndices[i] = Math.floor(
      ((numBins * 2) * melToHz(melPoints[i])) / sampleRate
    )
  }

  const filters: Array<Array<[number, number]>> = []

  for (let m = 0; m < NUM_MEL_FILTERS; m++) {
    const filter: Array<[number, number]> = []
    const left = binIndices[m]
    const center = binIndices[m + 1]
    const right = binIndices[m + 2]

    for (let k = Math.floor(left); k <= Math.min(Math.floor(right), numBins - 1); k++) {
      if (k < 0) continue
      let weight = 0
      if (k >= left && k < center && center !== left) {
        weight = (k - left) / (center - left)
      } else if (k >= center && k <= right && right !== center) {
        weight = (right - k) / (right - center)
      }
      if (weight > 0) {
        filter.push([k, weight])
      }
    }
    filters.push(filter)
  }

  return filters
}

/**
 * Extract 13 MFCCs from an audio buffer.
 * Returns Float64Array of 13 coefficients. Returns all zeros for silent input.
 */
export function mfcc(samples: Float32Array, sampleRate: number): Float64Array {
  const coefficients = new Float64Array(NUM_MFCC)
  const magnitudes = magnitudeSpectrum(samples)

  // Check for silence
  let totalEnergy = 0
  for (let i = 0; i < magnitudes.length; i++) {
    totalEnergy += magnitudes[i]
  }
  if (totalEnergy === 0) return coefficients

  const filters = melFilterbank(magnitudes.length, sampleRate)

  // Apply Mel filterbank and take log
  const melEnergies = new Float64Array(NUM_MEL_FILTERS)
  for (let m = 0; m < NUM_MEL_FILTERS; m++) {
    let energy = 0
    for (const [k, weight] of filters[m]) {
      energy += magnitudes[k] * weight
    }
    melEnergies[m] = energy > 0 ? Math.log(energy) : 0
  }

  // DCT-II to get MFCCs
  for (let i = 0; i < NUM_MFCC; i++) {
    let sum = 0
    for (let j = 0; j < NUM_MEL_FILTERS; j++) {
      sum += melEnergies[j] * Math.cos((Math.PI * i * (j + 0.5)) / NUM_MEL_FILTERS)
    }
    coefficients[i] = sum
  }

  return coefficients
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit -- --run --project server src/lib/audio/features.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/features.ts src/lib/audio/features.spec.ts
git commit -m "feat(audio): add MFCC extraction with Mel filterbank and DCT"
```

---

## Task 5: Combined Feature Extraction

**Files:**
- Modify: `src/lib/audio/features.ts`
- Modify: `src/lib/audio/features.spec.ts`

- [ ] **Step 1: Write failing test for extractFeatures**

Append to `features.spec.ts`:

```ts
import { extractFeatures } from './features'

describe('extractFeatures', () => {
  it('returns a complete FeatureVector', () => {
    const signal = new Float32Array(512)
    for (let i = 0; i < signal.length; i++) {
      signal[i] = Math.sin(2 * Math.PI * 440 * i / 44100)
    }
    const features = extractFeatures(signal, 44100)

    expect(features.mfcc).toHaveLength(13)
    expect(features.spectralCentroid).toBeGreaterThan(0)
    expect(features.zcr).toBeGreaterThanOrEqual(0)
    expect(features.energy).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run --project server src/lib/audio/features.spec.ts`
Expected: FAIL — `extractFeatures` not found

- [ ] **Step 3: Implement extractFeatures**

Add to `features.ts`:

```ts
import type { FeatureVector } from './types'

/**
 * Extract all features from an audio buffer in one call.
 * This is the main entry point used by the AudioWorklet and training pipeline.
 */
export function extractFeatures(samples: Float32Array, sampleRate: number): FeatureVector {
  return {
    mfcc: mfcc(samples, sampleRate),
    spectralCentroid: spectralCentroid(samples, sampleRate),
    zcr: zeroCrossingRate(samples),
    energy: rmsEnergy(samples)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit -- --run --project server src/lib/audio/features.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/features.ts src/lib/audio/features.spec.ts
git commit -m "feat(audio): add combined extractFeatures entry point"
```

---

## Task 6: Onset Detection

**Files:**
- Create: `src/lib/audio/onset.ts`
- Create: `src/lib/audio/onset.spec.ts`

- [ ] **Step 1: Write failing tests for onset detection**

```ts
import { describe, it, expect } from 'vitest'
import { OnsetDetector } from './onset'

describe('OnsetDetector', () => {
  it('does not trigger on silence', () => {
    const detector = new OnsetDetector()
    const silence = new Float32Array(512)

    // Feed several frames of silence to build up noise floor
    for (let i = 0; i < 10; i++) {
      expect(detector.process(silence)).toBe(false)
    }
  })

  it('triggers on a sudden energy spike', () => {
    const detector = new OnsetDetector()
    const silence = new Float32Array(512)
    const loud = new Float32Array(512).fill(0.5)

    // Build up noise floor with silence
    for (let i = 0; i < 10; i++) {
      detector.process(silence)
    }

    // Spike should trigger onset
    expect(detector.process(loud)).toBe(true)
  })

  it('does not re-trigger immediately after a hit (cooldown)', () => {
    const detector = new OnsetDetector()
    const silence = new Float32Array(512)
    const loud = new Float32Array(512).fill(0.5)

    // Build up noise floor
    for (let i = 0; i < 10; i++) {
      detector.process(silence)
    }

    // First hit triggers
    expect(detector.process(loud)).toBe(true)

    // Immediate second loud frame should NOT trigger (cooldown)
    expect(detector.process(loud)).toBe(false)
  })

  it('re-triggers after cooldown period', () => {
    const detector = new OnsetDetector()
    const silence = new Float32Array(512)
    const loud = new Float32Array(512).fill(0.5)

    // Build noise floor
    for (let i = 0; i < 10; i++) {
      detector.process(silence)
    }

    // First hit
    expect(detector.process(loud)).toBe(true)

    // Wait out cooldown with silence (cooldown is ~50ms = ~4 frames at 512/44100)
    for (let i = 0; i < 10; i++) {
      detector.process(silence)
    }

    // Should trigger again
    expect(detector.process(loud)).toBe(true)
  })

  it('adapts to a noisy environment', () => {
    const detector = new OnsetDetector()
    const noise = new Float32Array(512).fill(0.05)
    const hit = new Float32Array(512).fill(0.5)

    // Build noise floor from background noise
    for (let i = 0; i < 20; i++) {
      detector.process(noise)
    }

    // Hit well above noise floor should trigger
    expect(detector.process(hit)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test:unit -- --run --project server src/lib/audio/onset.spec.ts`
Expected: FAIL — `OnsetDetector` not found

- [ ] **Step 3: Implement onset detector**

```ts
import { rmsEnergy } from './features'

/** How quickly the noise floor adapts (0-1, lower = slower adaptation) */
const NOISE_FLOOR_ALPHA = 0.05

/** How many times above the noise floor a signal must be to trigger */
const DEFAULT_SENSITIVITY = 3.0

/** Minimum frames between triggers (prevents double-hits) */
const COOLDOWN_FRAMES = 5

/**
 * Detects percussive onsets using an adaptive energy threshold.
 *
 * Maintains a running estimate of the noise floor. When a frame's energy
 * exceeds the noise floor by a multiplier, an onset is detected.
 * A cooldown period prevents immediate re-triggering.
 */
export class OnsetDetector {
  private noiseFloor = 0
  private cooldown = 0
  private sensitivity: number
  private initialized = false

  constructor(sensitivity = DEFAULT_SENSITIVITY) {
    this.sensitivity = sensitivity
  }

  /**
   * Process a frame of audio samples.
   * Returns true if an onset (hit) was detected in this frame.
   */
  process(samples: Float32Array): boolean {
    const energy = rmsEnergy(samples)

    // First few frames: initialize noise floor without triggering
    if (!this.initialized) {
      this.noiseFloor = energy
      this.initialized = true
      return false
    }

    // Decrement cooldown
    if (this.cooldown > 0) {
      this.cooldown--
      // Still adapt noise floor during cooldown, but only from quiet frames
      if (energy < this.noiseFloor * 1.5) {
        this.noiseFloor += NOISE_FLOOR_ALPHA * (energy - this.noiseFloor)
      }
      return false
    }

    const threshold = Math.max(this.noiseFloor * this.sensitivity, 0.01)

    if (energy > threshold) {
      this.cooldown = COOLDOWN_FRAMES
      return true
    }

    // Adapt noise floor from non-hit frames
    this.noiseFloor += NOISE_FLOOR_ALPHA * (energy - this.noiseFloor)
    return false
  }

  /** Update sensitivity multiplier (e.g., from UI slider) */
  setSensitivity(value: number): void {
    this.sensitivity = value
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit -- --run --project server src/lib/audio/onset.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/onset.ts src/lib/audio/onset.spec.ts
git commit -m "feat(audio): add adaptive onset detector"
```

---

## Task 7: AudioWorklet Processor

**Files:**
- Create: `src/lib/audio/worklet-processor.ts`

This file runs in the AudioWorklet context. It cannot be unit-tested directly (no AudioWorklet in Node), but it delegates all logic to the tested `onset.ts` and `features.ts` functions.

- [ ] **Step 1: Implement the worklet processor**

```ts
// NOTE: This file runs in the AudioWorklet scope.
// It cannot import from normal modules at runtime — the code for
// OnsetDetector and feature functions must be bundled into this file
// or loaded via a blob URL. For now, we inline the necessary logic
// and keep the tested versions in onset.ts and features.ts as the
// source of truth.
//
// The build step for this will be handled in Task 8 (capture.ts),
// which constructs a blob URL from the bundled worklet code.
//
// This file serves as the template/reference for the worklet processor.

import { OnsetDetector } from './onset'
import { extractFeatures } from './features'
import type { WorkletHitMessage, WorkletConfigMessage } from './types'

const SAMPLE_RATE = 44100
const BUFFER_SIZE = 512

class HitDetectorProcessor extends AudioWorkletProcessor {
  private ringBuffer = new Float32Array(BUFFER_SIZE)
  private writeIndex = 0
  private detector = new OnsetDetector()

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<WorkletConfigMessage>) => {
      if (event.data.type === 'config') {
        this.detector.setSensitivity(event.data.sensitivityMultiplier)
      }
    }
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0]
    if (!input) return true

    // Fill ring buffer
    for (let i = 0; i < input.length; i++) {
      this.ringBuffer[this.writeIndex] = input[i]
      this.writeIndex++

      // When buffer is full, check for onset
      if (this.writeIndex >= BUFFER_SIZE) {
        this.writeIndex = 0

        if (this.detector.process(this.ringBuffer)) {
          const features = extractFeatures(this.ringBuffer, SAMPLE_RATE)
          const message: WorkletHitMessage = {
            type: 'hit',
            features,
            intensity: features.energy,
            timestamp: performance.now()
          }
          this.port.postMessage(message)
        }
      }
    }

    return true
  }
}

registerProcessor('hit-detector', HitDetectorProcessor)
```

- [ ] **Step 2: Verify types compile**

Run: `bun run check`
Expected: No errors (may need to add AudioWorklet type references)

- [ ] **Step 3: Commit**

```bash
git add src/lib/audio/worklet-processor.ts
git commit -m "feat(audio): add AudioWorklet processor for hit detection"
```

---

## Task 8: Audio Capture

**Files:**
- Create: `src/lib/audio/capture.ts`

This module handles `getUserMedia`, creates the AudioContext, registers the worklet, and returns a handle for the main thread to receive hit events.

- [ ] **Step 1: Implement capture module**

```ts
import type { WorkletHitMessage } from './types'

export interface AudioCapture {
  /** Subscribe to hit events from the worklet */
  onHit: (callback: (event: WorkletHitMessage) => void) => void
  /** Update sensitivity (forwarded to worklet) */
  setSensitivity: (value: number) => void
  /** Stop capturing and release resources */
  stop: () => void
}

/**
 * Start capturing audio from the microphone.
 * Registers the AudioWorklet and returns a handle for receiving hits.
 *
 * Throws if mic permission is denied or AudioWorklet is unsupported.
 */
export async function startCapture(): Promise<AudioCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  })

  const audioContext = new AudioContext({ sampleRate: 44100 })
  const source = audioContext.createMediaStreamSource(stream)

  // Build worklet code as a blob URL so it can import our modules
  // In production, this would be a bundled file. For now, we use the
  // worklet-processor.ts compiled output.
  const workletUrl = new URL('./worklet-processor.ts', import.meta.url).href
  await audioContext.audioWorklet.addModule(workletUrl)

  const workletNode = new AudioWorkletNode(audioContext, 'hit-detector')

  source.connect(workletNode)
  // Don't connect to destination — we don't want to hear the mic input
  // workletNode.connect(audioContext.destination)

  let hitCallback: ((event: WorkletHitMessage) => void) | null = null

  workletNode.port.onmessage = (event: MessageEvent<WorkletHitMessage>) => {
    if (event.data.type === 'hit' && hitCallback) {
      hitCallback(event.data)
    }
  }

  return {
    onHit(callback) {
      hitCallback = callback
    },
    setSensitivity(value) {
      workletNode.port.postMessage({ type: 'config', sensitivityMultiplier: value })
    },
    stop() {
      workletNode.disconnect()
      source.disconnect()
      stream.getTracks().forEach((track) => track.stop())
      audioContext.close()
    }
  }
}
```

**Note:** The worklet URL approach (`new URL('./worklet-processor.ts', import.meta.url)`) works with Vite's built-in support for `?url` imports and AudioWorklet. If there are bundling issues at integration time, we may need to adjust the URL strategy (e.g., place the worklet in `static/` or use a blob URL with inlined code). This is an integration concern to resolve in the debug page step.

- [ ] **Step 2: Verify types compile**

Run: `bun run check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/audio/capture.ts
git commit -m "feat(audio): add mic capture with AudioWorklet integration"
```

---

## Task 9: Debug Page

**Files:**
- Create: `src/routes/debug/+page.svelte`

A simple page that starts the mic, shows "Hit detected!" on each onset, and displays the extracted features. This is the Milestone 1 deliverable.

**Important:** Use the Svelte MCP server (`mcp__svelte__svelte-autofixer`) when writing this component to catch Svelte 5 issues.

- [ ] **Step 1: Create the debug page**

```svelte
<script lang="ts">
  import { startCapture, type AudioCapture } from '$lib/audio/capture'
  import type { WorkletHitMessage } from '$lib/audio/types'

  interface HitRecord {
    id: number
    timestamp: number
    energy: number
    spectralCentroid: number
    zcr: number
    mfcc: number[]
  }

  let capture: AudioCapture | null = $state(null)
  let isListening = $state(false)
  let error = $state<string | null>(null)
  let hits = $state<HitRecord[]>([])
  let hitCount = $state(0)

  async function startListening() {
    try {
      error = null
      capture = await startCapture()
      isListening = true

      capture.onHit((event: WorkletHitMessage) => {
        hitCount++
        const record: HitRecord = {
          id: hitCount,
          timestamp: event.timestamp,
          energy: event.features.energy,
          spectralCentroid: event.features.spectralCentroid,
          zcr: event.features.zcr,
          mfcc: Array.from(event.features.mfcc)
        }
        // Keep last 20 hits
        hits = [record, ...hits.slice(0, 19)]
      })
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to start mic'
      isListening = false
    }
  }

  function stopListening() {
    capture?.stop()
    capture = null
    isListening = false
  }
</script>

<div class="mx-auto max-w-2xl p-8">
  <h1 class="mb-4 text-3xl font-bold">Audio Debug</h1>
  <p class="mb-6 text-gray-400">
    Milestone 1: Hit detection and feature extraction
  </p>

  {#if error}
    <div class="mb-4 rounded-lg bg-red-900/30 p-4 text-red-300">
      {error}
    </div>
  {/if}

  <div class="mb-6">
    {#if isListening}
      <button
        class="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
        onclick={stopListening}
      >
        Stop Listening
      </button>
      <span class="ml-4 text-green-400">Listening... hit something!</span>
    {:else}
      <button
        class="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
        onclick={startListening}
      >
        Start Listening
      </button>
    {/if}
  </div>

  <div class="mb-2 text-sm text-gray-500">
    Hits detected: {hitCount}
  </div>

  {#if hits.length > 0}
    <div class="space-y-3">
      {#each hits as hit (hit.id)}
        <div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <div class="mb-2 flex items-center justify-between">
            <span class="font-mono text-sm text-gray-400">
              Hit #{hit.id}
            </span>
            <span class="text-sm text-gray-500">
              {hit.timestamp.toFixed(0)}ms
            </span>
          </div>
          <div class="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span class="text-gray-500">Energy</span>
              <div class="font-mono text-yellow-400">{hit.energy.toFixed(4)}</div>
            </div>
            <div>
              <span class="text-gray-500">Centroid</span>
              <div class="font-mono text-blue-400">{hit.spectralCentroid.toFixed(0)} Hz</div>
            </div>
            <div>
              <span class="text-gray-500">ZCR</span>
              <div class="font-mono text-green-400">{hit.zcr.toFixed(3)}</div>
            </div>
          </div>
          <div class="mt-2">
            <span class="text-xs text-gray-500">MFCCs</span>
            <div class="font-mono text-xs text-gray-400">
              [{hit.mfcc.map((c) => c.toFixed(1)).join(', ')}]
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on the component. Fix any issues and repeat until clean.

- [ ] **Step 3: Verify it builds**

Run: `bun run build`
Expected: Build succeeds (the debug page is pre-rendered as a static route)

- [ ] **Step 4: Manual smoke test**

Run: `bun dev`
Navigate to `http://localhost:5173/debug`

- Click "Start Listening" — should prompt for mic permission
- Hit a surface — should see hit cards appear with feature data
- Click "Stop Listening" — mic should release

**Note:** If the AudioWorklet URL doesn't load correctly with Vite, troubleshoot the URL strategy in `capture.ts`. Common fix: use `new URL('./worklet-processor.ts?worker&url', import.meta.url)` or place compiled worklet in `static/`.

- [ ] **Step 5: Commit**

```bash
git add src/routes/debug/+page.svelte
git commit -m "feat(ui): add debug page for hit detection and feature display"
```

---

## Task 10: Integration Verification

- [ ] **Step 1: Run all unit tests**

Run: `bun run test:unit -- --run`
Expected: All tests pass (features.spec.ts, onset.spec.ts, plus existing greet.spec.ts)

- [ ] **Step 2: Run type check**

Run: `bun run check`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `bun run lint`
Expected: No errors (run `bun run format` first if needed)

- [ ] **Step 4: Run build**

Run: `bun run build`
Expected: Static build succeeds

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: fix lint/type issues from milestone 1 integration"
```

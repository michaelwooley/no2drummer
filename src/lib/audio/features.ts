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

/**
 * Compute magnitude spectrum using a naive DFT (real input, first N/2 bins).
 * Applies a Hann window before the DFT to reduce spectral leakage.
 */
function magnitudeSpectrum(samples: Float32Array): Float64Array {
  const n = samples.length
  const numBins = Math.floor(n / 2)
  const magnitudes = new Float64Array(numBins)

  for (let k = 0; k < numBins; k++) {
    let real = 0
    let imag = 0
    for (let t = 0; t < n; t++) {
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * t) / (n - 1)))
      const angle = (2 * Math.PI * k * t) / n
      real += samples[t] * window * Math.cos(angle)
      imag -= samples[t] * window * Math.sin(angle)
    }
    magnitudes[k] = Math.sqrt(real * real + imag * imag)
  }

  return magnitudes
}

const NUM_MEL_FILTERS = 26
const NUM_MFCC = 13

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700)
}

function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1)
}

function melFilterbank(
  numBins: number,
  sampleRate: number
): Array<Array<[number, number]>> {
  const maxFreq = sampleRate / 2
  const minMel = hzToMel(0)
  const maxMel = hzToMel(maxFreq)

  const numPoints = NUM_MEL_FILTERS + 2
  const melPoints = new Float64Array(numPoints)
  for (let i = 0; i < numPoints; i++) {
    melPoints[i] = minMel + (i * (maxMel - minMel)) / (numPoints - 1)
  }

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

  let totalEnergy = 0
  for (let i = 0; i < magnitudes.length; i++) {
    totalEnergy += magnitudes[i]
  }
  if (totalEnergy === 0) return coefficients

  const filters = melFilterbank(magnitudes.length, sampleRate)

  const melEnergies = new Float64Array(NUM_MEL_FILTERS)
  for (let m = 0; m < NUM_MEL_FILTERS; m++) {
    let energy = 0
    for (const [k, weight] of filters[m]) {
      energy += magnitudes[k] * weight
    }
    melEnergies[m] = energy > 0 ? Math.log(energy) : 0
  }

  for (let i = 0; i < NUM_MFCC; i++) {
    let sum = 0
    for (let j = 0; j < NUM_MEL_FILTERS; j++) {
      sum += melEnergies[j] * Math.cos((Math.PI * i * (j + 0.5)) / NUM_MEL_FILTERS)
    }
    coefficients[i] = sum
  }

  return coefficients
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

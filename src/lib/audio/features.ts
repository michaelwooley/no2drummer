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

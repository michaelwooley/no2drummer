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

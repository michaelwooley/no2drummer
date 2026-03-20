import { rmsEnergy } from './features'

const NOISE_FLOOR_ALPHA = 0.05
const DEFAULT_SENSITIVITY = 3.0
const COOLDOWN_FRAMES = 5

/**
 * Detects percussive onsets using an adaptive energy threshold.
 */
export class OnsetDetector {
  private noiseFloor = 0
  private cooldown = 0
  private sensitivity: number
  private initialized = false

  constructor(sensitivity = DEFAULT_SENSITIVITY) {
    this.sensitivity = sensitivity
  }

  process(samples: Float32Array): boolean {
    const energy = rmsEnergy(samples)

    if (!this.initialized) {
      this.noiseFloor = energy
      this.initialized = true
      return false
    }

    if (this.cooldown > 0) {
      this.cooldown--
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

    this.noiseFloor += NOISE_FLOOR_ALPHA * (energy - this.noiseFloor)
    return false
  }

  setSensitivity(value: number): void {
    this.sensitivity = value
  }
}

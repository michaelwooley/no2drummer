import { rmsEnergy } from './features';

/** How quickly the noise floor adapts (0-1, lower = slower) */
const NOISE_FLOOR_ALPHA = 0.05;

/** Default multiplier above noise floor to trigger */
const DEFAULT_SENSITIVITY = 3.0;

/** Minimum frames between triggers (prevents double-hits) */
const COOLDOWN_FRAMES = 8;

/** Absolute minimum RMS threshold — below this we never trigger */
const MIN_THRESHOLD = 0.008;

/**
 * Compute peak amplitude of a buffer.
 */
function peakAmplitude(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  return peak;
}

/**
 * Detects percussive onsets using adaptive energy threshold with peak detection.
 *
 * Uses both RMS energy (for sustained sounds) and peak amplitude (for short
 * transients like taps) to catch percussive hits that have high peak but low RMS.
 */
export class OnsetDetector {
  private noiseFloor = 0;
  private peakNoiseFloor = 0;
  private cooldown = 0;
  private sensitivity: number;
  private initialized = false;

  constructor(sensitivity = DEFAULT_SENSITIVITY) {
    this.sensitivity = sensitivity;
  }

  /**
   * Process a frame of audio samples.
   * Returns true if an onset (hit) was detected in this frame.
   */
  process(samples: Float32Array): boolean {
    const energy = rmsEnergy(samples);
    const peak = peakAmplitude(samples);

    // First frame: initialize noise floors
    if (!this.initialized) {
      this.noiseFloor = energy;
      this.peakNoiseFloor = peak;
      this.initialized = true;
      return false;
    }

    // Cooldown: prevent double-triggering
    if (this.cooldown > 0) {
      this.cooldown--;
      if (energy < this.noiseFloor * 1.5) {
        this.noiseFloor += NOISE_FLOOR_ALPHA * (energy - this.noiseFloor);
        this.peakNoiseFloor += NOISE_FLOOR_ALPHA * (peak - this.peakNoiseFloor);
      }
      return false;
    }

    const rmsThreshold = Math.max(this.noiseFloor * this.sensitivity, MIN_THRESHOLD);
    const peakThreshold = Math.max(this.peakNoiseFloor * this.sensitivity, MIN_THRESHOLD * 5);

    // Trigger if EITHER RMS or peak exceeds threshold
    if (energy > rmsThreshold || peak > peakThreshold) {
      this.cooldown = COOLDOWN_FRAMES;
      return true;
    }

    // Adapt noise floors from non-hit frames
    this.noiseFloor += NOISE_FLOOR_ALPHA * (energy - this.noiseFloor);
    this.peakNoiseFloor += NOISE_FLOOR_ALPHA * (peak - this.peakNoiseFloor);
    return false;
  }

  /** Update sensitivity multiplier (e.g., from UI slider) */
  setSensitivity(value: number): void {
    this.sensitivity = value;
  }
}

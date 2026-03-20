import type { DrumId } from './samples';
import { SAMPLES } from './samples';

/**
 * Logarithmic mapping from hit intensity [0, 1] to gain [0, 1].
 * Uses log1p curve to match human loudness perception.
 * Clamps input to [0, 1].
 */
export function intensityToGain(intensity: number): number {
  const clamped = Math.max(0, Math.min(1, intensity));
  if (clamped === 0) return 0;
  return Math.log1p(clamped * (Math.E - 1));
}

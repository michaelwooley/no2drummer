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

export class DrumPlayer {
  private context: AudioContext;
  private buffers = new Map<DrumId, AudioBuffer>();

  constructor() {
    this.context = new AudioContext();
  }

  async load(): Promise<void> {
    const entries = Object.entries(SAMPLES) as [DrumId, string][];
    const results = await Promise.all(
      entries.map(async ([id, path]) => {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`Failed to load sample: ${id}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        return [id, audioBuffer] as const;
      })
    );
    this.buffers = new Map(results);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  play(drumId: DrumId, intensity: number): void {
    // Stub -- implemented in Task 4
  }

  dispose(): void {
    this.context.close();
  }
}

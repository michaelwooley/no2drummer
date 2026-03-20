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
  private context: AudioContext | null = null;
  private buffers = new Map<DrumId, AudioBuffer>();

  private getContext(): AudioContext {
    if (!this.context) this.context = new AudioContext();
    return this.context;
  }

  async load(): Promise<void> {
    const context = this.getContext();
    const entries = Object.entries(SAMPLES) as [DrumId, string][];
    const results = await Promise.all(
      entries.map(async ([id, path]) => {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`Failed to load sample: ${id}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await context.decodeAudioData(arrayBuffer).catch(() => {
          throw new Error(`Failed to decode sample: ${id}`);
        });
        return [id, audioBuffer] as const;
      })
    );
    this.buffers = new Map(results);
  }

  play(drumId: DrumId, intensity: number): void {
    const buffer = this.buffers.get(drumId);
    if (!buffer) return;

    const context = this.getContext();
    const source = context.createBufferSource();
    source.buffer = buffer;

    const gain = context.createGain();
    gain.gain.value = intensityToGain(intensity);

    source.connect(gain).connect(context.destination);
    source.start();
  }

  dispose(): void {
    this.context?.close();
  }
}

# Milestone 3: Sound Playback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pre-load bundled drum samples into AudioBuffers, trigger playback on hit detection, and scale volume by hit intensity.

**Architecture:** A `DrumPlayer` class owns a separate `AudioContext`, pre-loads 4 WAV samples from `static/samples/` into `AudioBuffer`s, and plays them on demand via `BufferSource` → `GainNode` → destination. Volume is scaled from hit intensity using a logarithmic curve. A static manifest maps `DrumId` to file paths. All audio logic is pure TypeScript with no Svelte dependency.

**Tech Stack:** TypeScript, Web Audio API (AudioContext, AudioBuffer, AudioBufferSourceNode, GainNode), Vitest

**Spec:** `docs/superpowers/specs/2026-03-19-milestone3-sound-playback-design.md`

---

## File Structure

```
src/lib/player/
├── samples.ts      — DrumId type + static manifest mapping drum names to file paths
├── player.ts       — intensityToGain (pure function) + DrumPlayer class
└── player.spec.ts  — Unit tests for volume scaling, loading, and playback

static/samples/
├── kick.wav        — CC0 from waveplaySFX on Freesound
├── snare.wav       — CC0 from deadrobotmusic on Freesound
├── hihat.wav       — CC0 from deadrobotmusic on Freesound
├── cymbal.wav      — CC0 from deadrobotmusic on Freesound
└── LICENSES.md     — Source URLs and CC0 license for each file
```

**Why `samples.ts` is separate from `player.ts`:** The manifest is pure data with no logic. Other milestones (mapping UI, play UI) will import `DrumId` and `SAMPLES` without pulling in the player's AudioContext dependency.

**Why `intensityToGain` is exported from `player.ts`:** It's a pure math function — exporting it allows direct unit testing without instantiating a DrumPlayer or mocking AudioContext.

---

## Task 1: Sample Manifest

**Files:**
- Create: `src/lib/player/samples.ts`

- [ ] **Step 1: Create the manifest**

```ts
export type DrumId = 'kick' | 'snare' | 'hihat' | 'cymbal';

export const DRUM_IDS: DrumId[] = ['kick', 'snare', 'hihat', 'cymbal'];

export const SAMPLES: Record<DrumId, string> = {
  kick: '/samples/kick.wav',
  snare: '/samples/snare.wav',
  hihat: '/samples/hihat.wav',
  cymbal: '/samples/cymbal.wav'
} as const;
```

- [ ] **Step 2: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/player/samples.ts
git commit -m "feat(player): add drum sample manifest and DrumId type"
```

---

## Task 2: Volume Scaling

**Files:**
- Create: `src/lib/player/player.ts` (partial — just the pure function)
- Create: `src/lib/player/player.spec.ts` (partial — just volume scaling tests)

- [ ] **Step 1: Write failing tests for intensityToGain**

```ts
import { describe, it, expect } from 'vitest';
import { intensityToGain } from './player';

describe('intensityToGain', () => {
  it('maps 0 to 0', () => {
    expect(intensityToGain(0)).toBe(0);
  });

  it('maps 1 to 1', () => {
    expect(intensityToGain(1)).toBeCloseTo(1, 5);
  });

  it('maps 0.5 above 0.5 (log curve boosts quiet hits)', () => {
    const gain = intensityToGain(0.5);
    expect(gain).toBeGreaterThan(0.5);
    expect(gain).toBeLessThan(1);
  });

  it('is monotonically increasing', () => {
    const values = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const gains = values.map(intensityToGain);
    for (let i = 1; i < gains.length; i++) {
      expect(gains[i]).toBeGreaterThanOrEqual(gains[i - 1]);
    }
  });

  it('clamps negative values to 0', () => {
    expect(intensityToGain(-0.5)).toBe(0);
  });

  it('clamps values above 1 to gain of 1', () => {
    expect(intensityToGain(2)).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test:unit -- --run --project server src/lib/player/player.spec.ts`
Expected: FAIL — `intensityToGain` not found

- [ ] **Step 3: Implement intensityToGain**

Create `src/lib/player/player.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit -- --run --project server src/lib/player/player.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/player.ts src/lib/player/player.spec.ts
git commit -m "feat(player): add logarithmic intensity-to-gain mapping"
```

---

## Task 3: DrumPlayer — Loading

**Files:**
- Modify: `src/lib/player/player.ts`
- Modify: `src/lib/player/player.spec.ts`

- [ ] **Step 1: Write failing tests for loading**

Append to `player.spec.ts`:

```ts
import { DrumPlayer } from './player';
import { DRUM_IDS } from './samples';
import type { DrumId } from './samples';
import { vi, beforeEach, afterEach } from 'vitest';

describe('DrumPlayer', () => {
  // --- Mock setup ---
  // In Node there's no AudioContext or fetch. We stub both globally.

  function createMockAudioContext() {
    const bufferMap = new Map<string, object>();
    let fetchCallIndex = 0;
    const fetchOrder: string[] = [];

    const context = {
      createBufferSource: vi.fn(),
      createGain: vi.fn(),
      decodeAudioData: vi.fn((arrayBuffer: ArrayBuffer) => {
        // Each call gets a unique buffer object tagged with the URL
        const url = fetchOrder[fetchCallIndex++] ?? 'unknown';
        const mockBuffer = { __drumUrl: url };
        bufferMap.set(url, mockBuffer);
        return Promise.resolve(mockBuffer as unknown as AudioBuffer);
      }),
      destination: {},
      close: vi.fn()
    };

    const mockFetch = vi.fn((url: string) => {
      fetchOrder.push(url);
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      });
    });

    return { context, mockFetch, bufferMap };
  }

  let mockSetup: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    mockSetup = createMockAudioContext();
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => mockSetup.context)
    );
    vi.stubGlobal('fetch', mockSetup.mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('load', () => {
    it('fetches all 4 sample URLs', async () => {
      const player = new DrumPlayer();
      await player.load();

      expect(mockSetup.mockFetch).toHaveBeenCalledTimes(4);
      for (const id of DRUM_IDS) {
        expect(mockSetup.mockFetch).toHaveBeenCalledWith(`/samples/${id}.wav`);
      }
    });

    it('decodes all 4 fetched ArrayBuffers', async () => {
      const player = new DrumPlayer();
      await player.load();

      expect(mockSetup.context.decodeAudioData).toHaveBeenCalledTimes(4);
    });

    it('throws with sample name when fetch fails', async () => {
      mockSetup.mockFetch.mockImplementation((url: string) => {
        if (url.includes('snare')) {
          return Promise.resolve({ ok: false, status: 404 });
        }
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
        });
      });

      const player = new DrumPlayer();
      await expect(player.load()).rejects.toThrow('snare');
    });

    it('throws with sample name when decodeAudioData fails', async () => {
      mockSetup.context.decodeAudioData.mockImplementationOnce(() => {
        return Promise.reject(new Error('decode error'));
      });

      const player = new DrumPlayer();
      await expect(player.load()).rejects.toThrow();
    });
  });
}); // closes describe('DrumPlayer')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test:unit -- --run --project server src/lib/player/player.spec.ts`
Expected: FAIL — `DrumPlayer` not found

- [ ] **Step 3: Implement DrumPlayer constructor and load()**

Append to `src/lib/player/player.ts`:

```ts
export class DrumPlayer {
  private context: AudioContext;
  private buffers = new Map<DrumId, AudioBuffer>();

  constructor() {
    this.context = new AudioContext();
  }

  /**
   * Fetch and decode all drum samples. Throws if any sample fails.
   * Must be called before play().
   */
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

  /**
   * Play a drum sample with intensity-based volume. No-op if not loaded.
   */
  play(drumId: DrumId, intensity: number): void {
    // Implemented in Task 4
  }

  /**
   * Close the AudioContext and release resources.
   */
  dispose(): void {
    this.context.close();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit -- --run --project server src/lib/player/player.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/player.ts src/lib/player/player.spec.ts
git commit -m "feat(player): add DrumPlayer with sample loading"
```

---

## Task 4: DrumPlayer — Playback

**Files:**
- Modify: `src/lib/player/player.ts`
- Modify: `src/lib/player/player.spec.ts`

- [ ] **Step 1: Write failing tests for playback**

Add these `describe` blocks inside the existing `describe('DrumPlayer')` block in `player.spec.ts` (before the closing `});`):

```ts
  describe('play', () => {
    it('creates a BufferSource and GainNode connected to destination', async () => {
      const mockGainNode = {
        gain: { value: 0 },
        connect: vi.fn()
      };
      const mockSource = {
        buffer: null as unknown,
        connect: vi.fn().mockReturnValue(mockGainNode),
        start: vi.fn()
      };
      mockSetup.context.createBufferSource.mockReturnValue(mockSource);
      mockSetup.context.createGain.mockReturnValue(mockGainNode);

      const player = new DrumPlayer();
      await player.load();
      player.play('snare', 0.5);

      expect(mockSetup.context.createBufferSource).toHaveBeenCalled();
      expect(mockSetup.context.createGain).toHaveBeenCalled();
      expect(mockSource.connect).toHaveBeenCalledWith(mockGainNode);
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockSetup.context.destination);
      expect(mockSource.start).toHaveBeenCalled();
    });

    it('sets gain using logarithmic intensity scaling', async () => {
      const mockGainNode = {
        gain: { value: 0 },
        connect: vi.fn()
      };
      const mockSource = {
        buffer: null as unknown,
        connect: vi.fn().mockReturnValue(mockGainNode),
        start: vi.fn()
      };
      mockSetup.context.createBufferSource.mockReturnValue(mockSource);
      mockSetup.context.createGain.mockReturnValue(mockGainNode);

      const player = new DrumPlayer();
      await player.load();
      player.play('kick', 0.5);

      // Log curve: 0.5 maps to above 0.5 (boosts quiet hits)
      expect(mockGainNode.gain.value).toBeGreaterThan(0.5);
      expect(mockGainNode.gain.value).toBeLessThan(1);
    });

    it('does not throw when called before load', () => {
      const player = new DrumPlayer();
      expect(() => player.play('kick', 0.5)).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('closes the AudioContext', () => {
      const player = new DrumPlayer();
      player.dispose();

      expect(mockSetup.context.close).toHaveBeenCalled();
    });
  });
}); // closes describe('DrumPlayer')
```

- [ ] **Step 2: Run tests to verify the new tests fail**

Run: `bun run test:unit -- --run --project server src/lib/player/player.spec.ts`
Expected: FAIL — play tests fail (play is a no-op stub)

- [ ] **Step 3: Implement play()**

Replace the stub `play()` method in `src/lib/player/player.ts`:

```ts
  /**
   * Play a drum sample with intensity-based volume. No-op if not loaded.
   */
  play(drumId: DrumId, intensity: number): void {
    const buffer = this.buffers.get(drumId);
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const gain = this.context.createGain();
    gain.gain.value = intensityToGain(intensity);

    source.connect(gain).connect(this.context.destination);
    source.start();
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit -- --run --project server src/lib/player/player.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/player.ts src/lib/player/player.spec.ts
git commit -m "feat(player): add playback with logarithmic volume scaling"
```

---

## Task 5: End-to-End Wiring (Deliverable)

**Files:**
- Modify: `src/routes/debug/+page.svelte` (if it exists from Milestone 1)
- OR Create: `src/routes/debug-player/+page.svelte` (if debug page doesn't exist yet)

This task wires the audio capture pipeline to the drum player to achieve the Milestone 3 deliverable: hit a surface, hear a drum sound. Since Milestone 2 (classification) may not be complete, every detected hit plays a fixed drum sound (`'snare'`) with intensity-based volume.

**Important:** Use the Svelte MCP server (`mcp__svelte__svelte-autofixer`) when writing/modifying Svelte components.

- [ ] **Step 1: Check if the debug page exists**

Run: `ls src/routes/debug/+page.svelte`

If it exists (from Milestone 1), modify it to add player integration. If not, create `src/routes/debug-player/+page.svelte`.

- [ ] **Step 2: Add player wiring to the debug page**

The page needs to:
1. Import and instantiate `DrumPlayer`
2. Call `player.load()` on startup
3. In the `onHit` callback, call `player.play('snare', event.intensity)`
4. Show loading state and any load errors for the samples

If modifying the existing debug page, add the player alongside the existing hit detection display. If creating a new page, it can be minimal — just a start/stop button and status text.

Example wiring (add to the existing `startListening` function or create a new one):

```ts
import { DrumPlayer } from '$lib/player/player';

let player: DrumPlayer | null = $state(null);
let samplesLoaded = $state(false);
let sampleError = $state<string | null>(null);

async function startListening() {
  try {
    error = null;
    sampleError = null;

    // Load drum samples
    player = new DrumPlayer();
    await player.load();
    samplesLoaded = true;

    // Start audio capture
    capture = await startCapture();
    isListening = true;

    capture.onHit((event) => {
      // Play snare on every hit (hardcoded — no classifier yet)
      player?.play('snare', event.intensity);

      // ... existing hit display logic ...
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (!samplesLoaded) {
      sampleError = `Failed to load samples: ${message}`;
    } else {
      error = message;
    }
    isListening = false;
  }
}

function stopListening() {
  capture?.stop();
  capture = null;
  player?.dispose();
  player = null;
  isListening = false;
  samplesLoaded = false;
}
```

Add a status indicator in the template:

```svelte
{#if sampleError}
  <div class="mb-4 rounded-lg bg-red-900/30 p-4 text-red-300">
    {sampleError}
  </div>
{/if}

{#if samplesLoaded}
  <span class="text-sm text-green-400">Samples loaded</span>
{/if}
```

- [ ] **Step 3: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on the component. Fix any issues and repeat until clean.

- [ ] **Step 4: Manual smoke test**

Run: `bun dev`
Navigate to the debug page (e.g., `http://localhost:5173/debug`)

- Click "Start Listening" — should prompt for mic, then load samples
- Hit a surface — should hear a snare sound with volume proportional to hit intensity
- Hit softly vs hard — volume should differ noticeably
- Click "Stop Listening" — audio should stop, resources released

**Note:** This requires the sample WAV files to be present in `static/samples/`. If Task 6 (sample files) hasn't been done yet, the load will fail with a fetch error — that's expected. Complete Task 6 first if doing manual testing.

- [ ] **Step 5: Commit**

```bash
git add src/routes/debug/+page.svelte  # or debug-player/+page.svelte
git commit -m "feat(player): wire drum player to audio capture for end-to-end playback"
```

---

## Task 6: Sample Files

**Files:**
- Create: `static/samples/kick.wav`
- Create: `static/samples/snare.wav`
- Create: `static/samples/hihat.wav`
- Create: `static/samples/cymbal.wav`
- Create: `static/samples/LICENSES.md`

**Note:** This task requires manually downloading samples from Freesound.org (login required). An agentic worker should flag this step for human action.

- [ ] **Step 1: Download samples from Freesound**

Visit each pack/sound page and download one WAV sample per drum sound:

| Sound | Source | What to pick |
|-------|--------|-------------|
| Kick | [waveplaySFX Kicks Pack 1](https://freesound.org/people/waveplaySFX/packs/12562/) | A clean, punchy kick — short duration (<0.5s) |
| Snare | [deadrobotmusic Snares](https://freesound.org/people/deadrobotmusic/packs/32405/) | A crisp snare hit — not too reverby |
| Hi-hat | [deadrobotmusic Hi Hats](https://freesound.org/people/deadrobotmusic/packs/33078/) | A closed hi-hat — short and tight |
| Cymbal | [DR Cymbal 02](https://freesound.org/people/deadrobotmusic/sounds/591631/) | This is a single sound, download it directly |

If a sample is not WAV format, convert it:

```bash
# Example using ffmpeg (if needed)
ffmpeg -i input.flac -ar 44100 -sample_fmt s16 output.wav
```

- [ ] **Step 2: Place files in static/samples/**

```bash
mkdir -p static/samples
# Move/copy downloaded files:
# static/samples/kick.wav
# static/samples/snare.wav
# static/samples/hihat.wav
# static/samples/cymbal.wav
```

Verify each file is a valid WAV:

```bash
file static/samples/*.wav
```

Expected: each file reports `RIFF (little-endian) data, WAVE audio`

- [ ] **Step 3: Create LICENSES.md**

Create `static/samples/LICENSES.md`:

```markdown
# Sample Licenses

All drum samples in this directory are licensed under
[CC0 1.0 Universal (Public Domain)](https://creativecommons.org/publicdomain/zero/1.0/).

## Sources

| File | Freesound Sound | Author |
|------|----------------|--------|
| kick.wav | [Sound URL after selection] | waveplaySFX |
| snare.wav | [Sound URL after selection] | deadrobotmusic |
| hihat.wav | [Sound URL after selection] | deadrobotmusic |
| cymbal.wav | [Sound URL after selection] | deadrobotmusic |

Replace `[Sound URL after selection]` with the specific Freesound sound URL
(e.g., `https://freesound.org/people/deadrobotmusic/sounds/591631/`) for each
file after downloading.
```

**After downloading:** update each row with the actual Freesound sound page URL (not the pack URL — the individual sound URL).

- [ ] **Step 4: Commit**

```bash
git add static/samples/
git commit -m "feat(player): add CC0 drum samples from Freesound"
```

---

## Task 7: Integration Verification

- [ ] **Step 1: Run all unit tests**

Run: `bun run test:unit -- --run`
Expected: All tests pass (player specs + existing audio/classifier specs)

- [ ] **Step 2: Run type check**

Run: `bun run check`
Expected: No errors

- [ ] **Step 3: Run lint and format**

Run: `bun run format && bun run lint`
Expected: No errors

- [ ] **Step 4: Run build**

Run: `bun run build`
Expected: Static build succeeds. WAV files in `static/samples/` are copied to the build output.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: fix lint/type issues from milestone 3 integration"
```

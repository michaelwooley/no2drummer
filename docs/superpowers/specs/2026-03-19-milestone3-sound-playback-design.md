# Milestone 3: Sound Playback — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Parent spec:** `docs/superpowers/specs/2026-03-19-no2drummer-design.md`

## Overview

Pre-load bundled drum samples into AudioBuffers, trigger playback on classification result, and scale volume by hit intensity. This milestone completes the end-to-end pipeline: hit a surface → hear a drum sound.

**Deliverable:** End-to-end pipeline works — hit a surface, hear a drum sound (wired up manually, no UI).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sample source | [Freesound.org](https://freesound.org), CC0 filter | Public domain, no attribution required, zero legal risk |
| Sample author | [deadrobotmusic](https://freesound.org/people/deadrobotmusic/) | CC0 one-shot packs for each drum type, consistent quality |
| Audio format | WAV (convert if needed) | Simplest decoding, no codec dependency |
| AudioContext | Separate from capture | Clean module isolation, easier testing. Browsers support multiple contexts. |
| Volume scaling | Logarithmic (log1p curve) | Matches human loudness perception for natural instrument feel |
| Sample manifest | Static TypeScript object | Only 4 known samples, YAGNI on dynamic loading |
| Loading strategy | All-or-nothing, upfront | Tiny payload (<1MB), surface errors to user if any sample fails |

## Sample Sources

All samples are CC0 (public domain) from Freesound.org by deadrobotmusic:

| Sound | Freesound Pack/Sound | Local Path |
|-------|---------------------|------------|
| Kick | [Kicks pack (TBD)](https://freesound.org/people/deadrobotmusic/packs/) | `static/samples/kick.wav` |
| Snare | [Drum One Shots - Snares](https://freesound.org/people/deadrobotmusic/packs/32405/) | `static/samples/snare.wav` |
| Hi-hat | [Drum One Shots - Hi Hats](https://freesound.org/people/deadrobotmusic/packs/33078/) | `static/samples/hihat.wav` |
| Cymbal | [DR Cymbal 02](https://freesound.org/people/deadrobotmusic/sounds/591631/) | `static/samples/cymbal.wav` |

One sample per sound is selected from each pack, converted to WAV if not already, and placed in `static/samples/`. A `LICENSES.md` file in `static/samples/` documents the source URL and CC0 license for each file.

## File Structure

```
src/lib/player/
├── player.ts       — DrumPlayer class: owns AudioContext, loads samples, plays on demand
├── player.spec.ts  — Unit tests (mock fetch + AudioContext)
└── samples.ts      — Static manifest mapping DrumId to file paths

static/samples/
├── kick.wav
├── snare.wav
├── hihat.wav
├── cymbal.wav
└── LICENSES.md     — Source URLs and CC0 attribution for each sample
```

## Module Design

### `samples.ts` — Sample Manifest

```ts
export type DrumId = 'kick' | 'snare' | 'hihat' | 'cymbal'

export const SAMPLES: Record<DrumId, string> = {
  kick: '/samples/kick.wav',
  snare: '/samples/snare.wav',
  hihat: '/samples/hihat.wav',
  cymbal: '/samples/cymbal.wav',
} as const
```

Pure data, no logic. Exports the `DrumId` type used throughout the player and later milestones (mapping, play UI).

### `player.ts` — DrumPlayer

```ts
class DrumPlayer {
  private context: AudioContext
  private buffers: Map<DrumId, AudioBuffer>

  constructor()           // Creates its own AudioContext
  async load(): Promise<void>  // Fetches + decodes all samples; throws on any failure
  play(drumId: DrumId, intensity: number): void  // Plays sample with volume scaling
  dispose(): void         // Closes AudioContext
}
```

#### Loading

- Fetches all 4 samples in parallel via `Promise.all`
- Each fetch: `fetch(path)` → `response.arrayBuffer()` → `context.decodeAudioData(buffer)`
- If any fetch or decode fails, the entire `load()` rejects with an error naming the failed sample
- `this.buffers` is only populated after all samples succeed (no partial state)

#### Playback

- Each `play()` call creates a fresh `BufferSource` → `GainNode` → `context.destination`
- Multiple simultaneous plays layer naturally (polyphony via separate BufferSources)
- Old sources are garbage collected after playback completes
- Calling `play()` before `load()` is a no-op (no buffer to play)

#### Volume Scaling

Logarithmic mapping from hit intensity [0, 1] to gain [0, 1]:

```ts
private intensityToGain(intensity: number): number {
  const clamped = Math.max(0, Math.min(1, intensity))
  if (clamped === 0) return 0
  return Math.log1p(clamped * (Math.E - 1))  // [0,1] → [0,1] on a log curve
}
```

- `log1p(x * (e-1))` maps 0→0 and 1→1 with a logarithmic curve in between
- Soft taps produce quieter sounds; hard hits are loud but not clipped
- Intensity comes from `WorkletHitMessage.intensity` (RMS energy), passed through directly
- The clamp guards against out-of-range values; if the raw intensity range is far from [0, 1] in practice, a min/max normalizer can be added later

## Testing Strategy

Unit tests in `player.spec.ts` (Vitest server project):

1. **Load success** — mock `fetch` to return valid audio data, verify `load()` resolves and all 4 buffers are populated
2. **Load failure** — mock `fetch` to reject for one sample, verify `load()` throws with an error naming the failed sample
3. **Play triggers correct sample** — after loading, call `play('snare', 0.5)`, verify a `BufferSource` was created with the snare's `AudioBuffer`
4. **Volume scaling** — verify `intensityToGain`: 0 → 0, 1 → 1, 0.5 → value between 0 and 0.5 (log curve below linear)
5. **Play before load** — call `play()` without `load()`, verify no-op (no throw)

**Mocked:** `fetch`, `AudioContext` (including `decodeAudioData`, `createBufferSource`, `createGain`)

**Not tested automatically:** Actual audio output, real sample decoding. These are validated by manual testing per the project's testing strategy.

## Integration Point

The end-to-end wiring for the Milestone 3 deliverable:

```
WorkletHitMessage (from Milestone 1)
  → Classifier result (from Milestone 2) → { drumId, intensity }
  → player.play(drumId, intensity)
```

Since Milestone 2 (classification) may not be complete, the deliverable can be demonstrated by manually wiring the player to the onset detector — every detected hit plays a fixed drum sound with intensity-based volume. This proves the pipeline works without requiring classification.

## Dependencies

- **Milestone 1 (Audio Foundation):** Provides `WorkletHitMessage` with `intensity` field
- **Milestone 2 (Classification):** Provides `drumId` mapping (not required for M3 deliverable — can hardcode)
- **External:** 4 CC0 WAV files from Freesound.org, downloaded and committed to `static/samples/`

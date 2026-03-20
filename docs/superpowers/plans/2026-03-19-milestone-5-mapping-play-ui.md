# Milestone 5: Mapping & Play UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Mapping screen (`/map`) and Play screen (`/play`) with route guards, completing the train → map → play app loop.

**Architecture:** Two new routes (`/map`, `/play`) backed by a shared `KitState` reactive store. Presentational components (DrumPad, HitLane, SurfaceDropZone, DrumSoundCard, etc.) are composed by two smart page components (MappingPage, PlayPage). Route guards use `$effect` redirects (matching M4's pattern). Drag-and-drop uses the native HTML5 API. Lane stream uses CSS `@keyframes` animation.

**Tech Stack:** SvelteKit, Svelte 5 (runes), TypeScript, TailwindCSS v4, Vitest (server + client projects), Storybook 10 (Svelte CSF)

**Spec:** `docs/superpowers/specs/2026-03-19-milestone5-mapping-play-ui-design.md`

**Dependencies (all implemented by the time M5 is built):**
- `src/lib/audio/capture.ts` — `startCapture()` returns `AudioCapture` with `onHit()`, `stop()`
- `src/lib/audio/types.ts` — `FeatureVector`, `WorkletHitMessage`
- `src/lib/classifier/knn.ts` — `classify(model, features)` returns `ClassificationResult | null`
- `src/lib/classifier/normalize.ts` — `flattenFeatureVector(fv)`
- `src/lib/classifier/model.ts` — `ClassifierModel`, `ClassificationResult`
- `src/lib/player/player.ts` — `DrumPlayer` class with `load()`, `play(drumId, intensity)`, `dispose()`
- `src/lib/player/samples.ts` — `DrumId`, `DRUM_IDS`, `SAMPLES`
- `src/lib/wizard/state.svelte.ts` — `wizardState` with `.model` and `.surfaces`

---

## File Structure

```
src/lib/state/
  kit.svelte.ts                — Shared kit state (model, mapping, surfaces, threshold)
  kit.spec.ts                  — Unit tests for kit state helpers

src/lib/constants/
  colors.ts                    — Surface color palette + getSurfaceColor helper
  colors.spec.ts               — Unit tests for color assignment

src/lib/components/play/
  DrumPad.svelte               — Single pad tile with flash animation
  DrumPad.stories.svelte       — Storybook stories
  DrumPadGrid.svelte           — Responsive grid of DrumPad tiles (2-4)
  DrumPadGrid.stories.svelte   — Storybook stories
  ControlBar.svelte            — Remap/Retrain buttons + confidence slider
  ControlBar.stories.svelte    — Storybook stories
  HitLane.svelte               — Single lane with scrolling hit blocks
  HitLane.stories.svelte       — Storybook stories
  LaneStream.svelte            — Container for all HitLane components
  LaneStream.stories.svelte    — Storybook stories
  PlayPage.svelte              — Smart component: wires audio pipeline + all play components

src/lib/components/mapping/
  SurfaceDropZone.svelte       — Drop target for a surface
  SurfaceDropZone.stories.svelte — Storybook stories
  DrumSoundCard.svelte         — Draggable sound card with preview button
  DrumSoundCard.stories.svelte — Storybook stories
  MappingPage.svelte           — Smart component: owns mapping state + drag-and-drop

src/routes/map/
  +page.svelte                 — Route entry: guard + renders MappingPage

src/routes/play/
  +page.svelte                 — Route entry: guard + renders PlayPage

src/routes/train/try/
  +page.svelte                 — MODIFY: enable "Done" button, wire to KitState → /map
```

**Dependency order:** Kit state + colors (Tasks 1-2) → Presentational components (Tasks 3-9) → Smart page components + routes (Tasks 10-11) → M4 modification (Task 12) → Integration (Task 13).

**Note on route guards:** The spec says `+page.ts` load functions, but this plan uses `$effect` redirects in `+page.svelte` to match M4's established pattern and avoid SSR/prerender issues with the static adapter.

---

## Task 1: Kit State Store

**Files:**
- Create: `src/lib/state/kit.svelte.ts`
- Create: `src/lib/state/kit.spec.ts`

- [ ] **Step 1: Write failing tests for the kit state store**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  kitState,
  resetKit,
  setModel,
  setMapping,
  setThreshold,
  getDefaultMapping,
  hasModel,
  hasMapping,
  DRUM_DISPLAY_NAMES
} from './kit.svelte'
import type { ClassifierModel } from '$lib/classifier/model'
import type { DrumId } from '$lib/player/samples'

function makeMockModel(): ClassifierModel {
  return {
    surfaces: {
      Desk: [{ surface: 'Desk', features: new Array(16).fill(1) }],
      Book: [{ surface: 'Book', features: new Array(16).fill(2) }]
    },
    normalization: { mean: new Array(16).fill(0), std: new Array(16).fill(1) }
  }
}

describe('kit state', () => {
  beforeEach(() => {
    resetKit()
  })

  describe('resetKit', () => {
    it('returns to initial state', () => {
      setModel(makeMockModel(), ['Desk', 'Book'])
      setMapping({ Desk: 'snare', Book: 'kick' })
      setThreshold(0.5)
      resetKit()

      expect(kitState.model).toBeNull()
      expect(kitState.surfaceNames).toHaveLength(0)
      expect(kitState.mapping).toBeNull()
      expect(kitState.confidenceThreshold).toBe(0.7)
    })
  })

  describe('setModel', () => {
    it('sets model and surface names', () => {
      const model = makeMockModel()
      setModel(model, ['Desk', 'Book'])

      expect(kitState.model).toBe(model)
      expect(kitState.surfaceNames).toEqual(['Desk', 'Book'])
    })

    it('clears mapping when model changes', () => {
      setModel(makeMockModel(), ['Desk', 'Book'])
      setMapping({ Desk: 'snare', Book: 'kick' })
      setModel(makeMockModel(), ['A', 'B'])

      expect(kitState.mapping).toBeNull()
    })
  })

  describe('setMapping', () => {
    it('sets the mapping', () => {
      const mapping: Record<string, DrumId> = { Desk: 'snare', Book: 'kick' }
      setMapping(mapping)

      expect(kitState.mapping).toEqual(mapping)
    })
  })

  describe('setThreshold', () => {
    it('updates confidence threshold', () => {
      setThreshold(0.5)

      expect(kitState.confidenceThreshold).toBe(0.5)
    })

    it('clamps to [0, 1]', () => {
      setThreshold(1.5)
      expect(kitState.confidenceThreshold).toBe(1)

      setThreshold(-0.1)
      expect(kitState.confidenceThreshold).toBe(0)
    })
  })

  describe('getDefaultMapping', () => {
    it('maps surfaces to drums in order: snare, kick, hihat, cymbal', () => {
      const mapping = getDefaultMapping(['Desk', 'Book', 'Bottle', 'Case'])

      expect(mapping).toEqual({
        Desk: 'snare',
        Book: 'kick',
        Bottle: 'hihat',
        Case: 'cymbal'
      })
    })

    it('handles 2 surfaces', () => {
      const mapping = getDefaultMapping(['A', 'B'])

      expect(mapping).toEqual({ A: 'snare', B: 'kick' })
    })

    it('handles 3 surfaces', () => {
      const mapping = getDefaultMapping(['A', 'B', 'C'])

      expect(mapping).toEqual({ A: 'snare', B: 'kick', C: 'hihat' })
    })
  })

  describe('hasModel', () => {
    it('returns false when no model', () => {
      expect(hasModel()).toBe(false)
    })

    it('returns true when model is set', () => {
      setModel(makeMockModel(), ['Desk', 'Book'])

      expect(hasModel()).toBe(true)
    })
  })

  describe('hasMapping', () => {
    it('returns false when no mapping', () => {
      expect(hasMapping()).toBe(false)
    })

    it('returns true when mapping is set', () => {
      setMapping({ Desk: 'snare' })

      expect(hasMapping()).toBe(true)
    })
  })

  describe('DRUM_DISPLAY_NAMES', () => {
    it('has display names for all drum types', () => {
      expect(DRUM_DISPLAY_NAMES.kick).toBe('Kick')
      expect(DRUM_DISPLAY_NAMES.snare).toBe('Snare')
      expect(DRUM_DISPLAY_NAMES.hihat).toBe('Hi-Hat')
      expect(DRUM_DISPLAY_NAMES.cymbal).toBe('Cymbal')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run --project server src/lib/state/kit.spec.ts`
Expected: FAIL — module `./kit.svelte` not found

- [ ] **Step 3: Implement the kit state store**

```ts
import type { ClassifierModel } from '$lib/classifier/model'
import type { DrumId } from '$lib/player/samples'

export interface KitState {
  model: ClassifierModel | null
  surfaceNames: string[]
  mapping: Record<string, DrumId> | null
  confidenceThreshold: number
}

const DEFAULT_THRESHOLD = 0.7
const DEFAULT_DRUMS: DrumId[] = ['snare', 'kick', 'hihat', 'cymbal']

export const DRUM_DISPLAY_NAMES: Record<DrumId, string> = {
  kick: 'Kick',
  snare: 'Snare',
  hihat: 'Hi-Hat',
  cymbal: 'Cymbal'
}

// eslint-disable-next-line prefer-const -- Svelte 5 $state() requires `let` for reactive proxy
export let kitState: KitState = $state({
  model: null,
  surfaceNames: [],
  mapping: null,
  confidenceThreshold: DEFAULT_THRESHOLD
})

export function resetKit(): void {
  kitState.model = null
  kitState.surfaceNames = []
  kitState.mapping = null
  kitState.confidenceThreshold = DEFAULT_THRESHOLD
}

export function setModel(model: ClassifierModel, surfaceNames: string[]): void {
  kitState.model = model
  kitState.surfaceNames = surfaceNames
  kitState.mapping = null
}

export function setMapping(mapping: Record<string, DrumId>): void {
  kitState.mapping = mapping
}

export function setThreshold(value: number): void {
  kitState.confidenceThreshold = Math.max(0, Math.min(1, value))
}

export function getDefaultMapping(surfaceNames: string[]): Record<string, DrumId> {
  const mapping: Record<string, DrumId> = {}
  for (let i = 0; i < surfaceNames.length; i++) {
    mapping[surfaceNames[i]] = DEFAULT_DRUMS[i]
  }
  return mapping
}

export function hasModel(): boolean {
  return kitState.model !== null
}

export function hasMapping(): boolean {
  return kitState.mapping !== null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- --run --project server src/lib/state/kit.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/kit.svelte.ts src/lib/state/kit.spec.ts
git commit -m "feat(kit): add shared kit state store with model, mapping, and threshold"
```

---

## Task 2: Surface Colors

**Files:**
- Create: `src/lib/constants/colors.ts`
- Create: `src/lib/constants/colors.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { SURFACE_COLORS, getSurfaceColor } from './colors'

describe('SURFACE_COLORS', () => {
  it('has 4 colors', () => {
    expect(SURFACE_COLORS).toHaveLength(4)
  })
})

describe('getSurfaceColor', () => {
  it('returns blue for index 0', () => {
    expect(getSurfaceColor(0)).toBe('#4a9eff')
  })

  it('returns red for index 1', () => {
    expect(getSurfaceColor(1)).toBe('#ff6b6b')
  })

  it('returns yellow for index 2', () => {
    expect(getSurfaceColor(2)).toBe('#ffd93d')
  })

  it('returns green for index 3', () => {
    expect(getSurfaceColor(3)).toBe('#6bcb77')
  })

  it('wraps around for out-of-range index', () => {
    expect(getSurfaceColor(4)).toBe('#4a9eff')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run --project server src/lib/constants/colors.spec.ts`
Expected: FAIL — module `./colors` not found

- [ ] **Step 3: Implement**

```ts
export const SURFACE_COLORS = ['#4a9eff', '#ff6b6b', '#ffd93d', '#6bcb77'] as const

export function getSurfaceColor(index: number): string {
  return SURFACE_COLORS[index % SURFACE_COLORS.length]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- --run --project server src/lib/constants/colors.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants/colors.ts src/lib/constants/colors.spec.ts
git commit -m "feat(kit): add surface color palette"
```

---

## Task 3: DrumPad Component

**Files:**
- Create: `src/lib/components/play/DrumPad.svelte`
- Create: `src/lib/components/play/DrumPad.stories.svelte`

- [ ] **Step 1: Create the DrumPad component**

```svelte
<script lang="ts">
  interface Props {
    drumName: string
    surfaceName: string
    color: string
    flash?: boolean
  }

  let { drumName, surfaceName, color, flash = false }: Props = $props()
</script>

<div
  class="flex min-h-[100px] flex-col items-center justify-center rounded-xl border-2 p-4 text-center"
  style="
    border-color: {color};
    background: {flash ? color : 'transparent'};
    box-shadow: {flash ? `0 0 20px ${color}66` : 'none'};
    transition: background-color 150ms ease-out, box-shadow 150ms ease-out;
  "
>
  <div
    class="text-xl font-bold"
    style="color: {flash ? 'white' : color}; transition: color 150ms ease-out;"
  >
    {drumName}
  </div>
  <div class="mt-1 text-xs text-gray-500">{surfaceName}</div>
</div>
```

- [ ] **Step 2: Create Storybook stories**

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import DrumPad from './DrumPad.svelte'

  const { Story } = defineMeta({
    title: 'Play/DrumPad',
    component: DrumPad,
    tags: ['autodocs'],
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8" style="max-width: 200px;"><slot /></div>'
      })
    ]
  })
</script>

<Story name="Idle (Blue)" args={{ drumName: 'Snare', surfaceName: 'Desk', color: '#4a9eff' }} />
<Story name="Flash (Blue)" args={{ drumName: 'Snare', surfaceName: 'Desk', color: '#4a9eff', flash: true }} />
<Story name="Idle (Red)" args={{ drumName: 'Kick', surfaceName: 'Book', color: '#ff6b6b' }} />
<Story name="Flash (Red)" args={{ drumName: 'Kick', surfaceName: 'Book', color: '#ff6b6b', flash: true }} />
<Story name="Idle (Yellow)" args={{ drumName: 'Hi-Hat', surfaceName: 'Bottle', color: '#ffd93d' }} />
<Story name="Idle (Green)" args={{ drumName: 'Cymbal', surfaceName: 'Case', color: '#6bcb77' }} />
```

- [ ] **Step 3: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/play/DrumPad.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 4: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/play/DrumPad.svelte src/lib/components/play/DrumPad.stories.svelte
git commit -m "feat(play): add DrumPad component with flash animation"
```

---

## Task 4: DrumPadGrid Component

**Files:**
- Create: `src/lib/components/play/DrumPadGrid.svelte`
- Create: `src/lib/components/play/DrumPadGrid.stories.svelte`

- [ ] **Step 1: Create the DrumPadGrid component**

```svelte
<script lang="ts">
  import DrumPad from './DrumPad.svelte'

  interface PadData {
    drumName: string
    surfaceName: string
    color: string
    flash: boolean
  }

  interface Props {
    pads: PadData[]
  }

  let { pads }: Props = $props()

  let gridCols = $derived(
    pads.length <= 2 ? 'grid-cols-2'
    : pads.length === 3 ? 'grid-cols-3'
    : 'grid-cols-2'
  )
</script>

<div class="grid gap-3 {gridCols}">
  {#each pads as pad (pad.surfaceName)}
    <DrumPad
      drumName={pad.drumName}
      surfaceName={pad.surfaceName}
      color={pad.color}
      flash={pad.flash}
    />
  {/each}
</div>
```

- [ ] **Step 2: Create Storybook stories**

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import DrumPadGrid from './DrumPadGrid.svelte'

  const { Story } = defineMeta({
    title: 'Play/DrumPadGrid',
    component: DrumPadGrid,
    tags: ['autodocs'],
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8" style="max-width: 500px;"><slot /></div>'
      })
    ]
  })
</script>

<Story name="2 Surfaces" args={{
  pads: [
    { drumName: 'Snare', surfaceName: 'Desk', color: '#4a9eff', flash: false },
    { drumName: 'Kick', surfaceName: 'Book', color: '#ff6b6b', flash: false }
  ]
}} />
<Story name="3 Surfaces" args={{
  pads: [
    { drumName: 'Snare', surfaceName: 'Desk', color: '#4a9eff', flash: false },
    { drumName: 'Kick', surfaceName: 'Book', color: '#ff6b6b', flash: false },
    { drumName: 'Hi-Hat', surfaceName: 'Bottle', color: '#ffd93d', flash: true }
  ]
}} />
<Story name="4 Surfaces" args={{
  pads: [
    { drumName: 'Snare', surfaceName: 'Desk', color: '#4a9eff', flash: true },
    { drumName: 'Kick', surfaceName: 'Book', color: '#ff6b6b', flash: false },
    { drumName: 'Hi-Hat', surfaceName: 'Bottle', color: '#ffd93d', flash: false },
    { drumName: 'Cymbal', surfaceName: 'Case', color: '#6bcb77', flash: false }
  ]
}} />
```

- [ ] **Step 3: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/play/DrumPadGrid.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 4: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/play/DrumPadGrid.svelte src/lib/components/play/DrumPadGrid.stories.svelte
git commit -m "feat(play): add DrumPadGrid component with responsive layout"
```

---

## Task 5: ControlBar Component

**Files:**
- Create: `src/lib/components/play/ControlBar.svelte`
- Create: `src/lib/components/play/ControlBar.stories.svelte`

- [ ] **Step 1: Create the ControlBar component**

```svelte
<script lang="ts">
  interface Props {
    threshold: number
    onthresholdchange: (value: number) => void
    onremap: () => void
    onretrain: () => void
  }

  let { threshold, onthresholdchange, onremap, onretrain }: Props = $props()

  function handleSlider(e: Event) {
    const target = e.target as HTMLInputElement
    onthresholdchange(parseFloat(target.value))
  }
</script>

<div
  class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/80 px-4 py-2.5"
>
  <div class="flex gap-2">
    <button
      class="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400
        transition-colors hover:border-gray-500"
      onclick={onremap}
      type="button"
    >
      ← Remap
    </button>
    <button
      class="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400
        transition-colors hover:border-gray-500"
      onclick={onretrain}
      type="button"
    >
      Retrain
    </button>
  </div>
  <div class="flex items-center gap-3">
    <span class="text-xs text-gray-500">Confidence</span>
    <input
      type="range"
      min="0"
      max="1"
      step="0.05"
      value={threshold}
      oninput={handleSlider}
      class="w-28 accent-blue-500"
    />
    <span class="min-w-[2rem] text-right text-xs text-blue-400">
      {threshold.toFixed(2)}
    </span>
  </div>
</div>
```

- [ ] **Step 2: Create Storybook stories**

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import ControlBar from './ControlBar.svelte'
  import { fn } from 'storybook/test'

  const { Story } = defineMeta({
    title: 'Play/ControlBar',
    component: ControlBar,
    tags: ['autodocs'],
    args: {
      onthresholdchange: fn(),
      onremap: fn(),
      onretrain: fn()
    },
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8" style="max-width: 600px;"><slot /></div>'
      })
    ]
  })
</script>

<Story name="Default" args={{ threshold: 0.7 }} />
<Story name="Low Threshold" args={{ threshold: 0.3 }} />
<Story name="High Threshold" args={{ threshold: 0.95 }} />
```

- [ ] **Step 3: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/play/ControlBar.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 4: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/play/ControlBar.svelte src/lib/components/play/ControlBar.stories.svelte
git commit -m "feat(play): add ControlBar component with confidence slider"
```

---

## Task 6: HitLane Component

**Files:**
- Create: `src/lib/components/play/HitLane.svelte`
- Create: `src/lib/components/play/HitLane.stories.svelte`

- [ ] **Step 1: Create the HitLane component**

```svelte
<script lang="ts">
  interface HitBlock {
    id: string
    intensity: number
  }

  interface Props {
    label: string
    color: string
    hits: HitBlock[]
  }

  let { label, color, hits }: Props = $props()
</script>

<div class="flex items-center gap-2">
  <div class="min-w-[52px] text-right text-[10px] font-medium" style="color: {color};">
    {label}
  </div>
  <div
    class="relative flex-1 overflow-hidden rounded border border-gray-800 bg-[#1a1a2e]"
    style="height: 32px;"
  >
    {#each hits as hit (hit.id)}
      <div
        class="hit-block absolute bottom-0 w-1.5 rounded-sm"
        style="background: {color}; height: {Math.max(4, hit.intensity * 32)}px;"
      ></div>
    {/each}
  </div>
</div>

<style>
  .hit-block {
    right: 0;
    animation: slide-left 5s linear forwards;
  }

  @keyframes slide-left {
    from {
      right: 0;
      opacity: 1;
    }
    to {
      right: 100%;
      opacity: 0.15;
    }
  }
</style>
```

- [ ] **Step 2: Create Storybook stories**

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import HitLane from './HitLane.svelte'

  const { Story } = defineMeta({
    title: 'Play/HitLane',
    component: HitLane,
    tags: ['autodocs'],
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8" style="max-width: 500px;"><slot /></div>'
      })
    ]
  })
</script>

<Story name="Empty" args={{ label: 'Snare', color: '#4a9eff', hits: [] }} />
<Story name="Sparse Hits" args={{
  label: 'Kick',
  color: '#ff6b6b',
  hits: [
    { id: '1', intensity: 0.8 },
    { id: '2', intensity: 0.5 }
  ]
}} />
<Story name="Dense Hits" args={{
  label: 'Hi-Hat',
  color: '#ffd93d',
  hits: [
    { id: '1', intensity: 0.3 },
    { id: '2', intensity: 0.6 },
    { id: '3', intensity: 0.9 },
    { id: '4', intensity: 0.4 },
    { id: '5', intensity: 0.7 },
    { id: '6', intensity: 0.5 }
  ]
}} />
<Story name="Varying Intensity" args={{
  label: 'Cymbal',
  color: '#6bcb77',
  hits: [
    { id: '1', intensity: 0.1 },
    { id: '2', intensity: 0.5 },
    { id: '3', intensity: 1.0 }
  ]
}} />
```

- [ ] **Step 3: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/play/HitLane.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 4: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/play/HitLane.svelte src/lib/components/play/HitLane.stories.svelte
git commit -m "feat(play): add HitLane component with scrolling hit blocks"
```

---

## Task 7: LaneStream Component

**Files:**
- Create: `src/lib/components/play/LaneStream.svelte`
- Create: `src/lib/components/play/LaneStream.stories.svelte`

- [ ] **Step 1: Create the LaneStream component**

```svelte
<script lang="ts">
  import HitLane from './HitLane.svelte'

  interface HitBlock {
    id: string
    intensity: number
  }

  interface LaneData {
    label: string
    color: string
    hits: HitBlock[]
  }

  interface Props {
    lanes: LaneData[]
  }

  let { lanes }: Props = $props()
</script>

<div>
  <div class="mb-2 text-[10px] uppercase tracking-wider text-gray-600">
    Hit Stream
  </div>
  <div class="space-y-1.5">
    {#each lanes as lane (lane.label)}
      <HitLane label={lane.label} color={lane.color} hits={lane.hits} />
    {/each}
  </div>
</div>
```

- [ ] **Step 2: Create Storybook stories**

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import LaneStream from './LaneStream.svelte'

  const { Story } = defineMeta({
    title: 'Play/LaneStream',
    component: LaneStream,
    tags: ['autodocs'],
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8" style="max-width: 500px;"><slot /></div>'
      })
    ]
  })
</script>

<Story name="2 Lanes" args={{
  lanes: [
    { label: 'Snare', color: '#4a9eff', hits: [{ id: '1', intensity: 0.7 }] },
    { label: 'Kick', color: '#ff6b6b', hits: [{ id: '2', intensity: 0.9 }] }
  ]
}} />
<Story name="4 Lanes" args={{
  lanes: [
    { label: 'Snare', color: '#4a9eff', hits: [{ id: '1', intensity: 0.8 }, { id: '2', intensity: 0.5 }] },
    { label: 'Kick', color: '#ff6b6b', hits: [{ id: '3', intensity: 0.9 }] },
    { label: 'Hi-Hat', color: '#ffd93d', hits: [{ id: '4', intensity: 0.3 }, { id: '5', intensity: 0.6 }, { id: '6', intensity: 0.4 }] },
    { label: 'Cymbal', color: '#6bcb77', hits: [] }
  ]
}} />
<Story name="Empty" args={{
  lanes: [
    { label: 'Snare', color: '#4a9eff', hits: [] },
    { label: 'Kick', color: '#ff6b6b', hits: [] },
    { label: 'Hi-Hat', color: '#ffd93d', hits: [] }
  ]
}} />
```

- [ ] **Step 3: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/play/LaneStream.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 4: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/play/LaneStream.svelte src/lib/components/play/LaneStream.stories.svelte
git commit -m "feat(play): add LaneStream component"
```

---

## Task 8: SurfaceDropZone Component

**Files:**
- Create: `src/lib/components/mapping/SurfaceDropZone.svelte`
- Create: `src/lib/components/mapping/SurfaceDropZone.stories.svelte`

- [ ] **Step 1: Create the SurfaceDropZone component**

```svelte
<script lang="ts">
  import type { DrumId } from '$lib/player/samples'
  import { DRUM_DISPLAY_NAMES } from '$lib/state/kit.svelte'

  interface Props {
    surfaceName: string
    color: string
    assignedDrum: DrumId | null
    onassign: (drumId: DrumId) => void
    onunassign: () => void
  }

  let { surfaceName, color, assignedDrum, onassign, onunassign }: Props = $props()

  let dragover = $state(false)

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    dragover = true
  }

  function handleDragLeave() {
    dragover = false
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    dragover = false
    const drumId = e.dataTransfer?.getData('text/plain') as DrumId
    if (drumId) onassign(drumId)
  }
</script>

<div
  class="flex items-center gap-3 rounded-lg p-3
    {assignedDrum ? 'border-2 border-solid' : 'border-2 border-dashed'}
    {dragover ? 'border-white/50 bg-white/5' : assignedDrum ? '' : 'border-gray-700'}"
  style="{assignedDrum ? `border-color: ${color};` : ''} background: {assignedDrum ? `${color}10` : 'rgb(37 37 64)'}"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="listitem"
>
  <div
    class="rounded-md px-2.5 py-1 text-xs font-semibold"
    style="background: {color}; color: {color === '#ffd93d' ? '#1a1a2e' : 'white'};"
  >
    {surfaceName}
  </div>
  <span class="text-xs text-gray-600">→</span>
  {#if assignedDrum}
    <div class="flex-1 rounded-md bg-gray-800 px-2.5 py-1 text-xs text-green-400">
      {DRUM_DISPLAY_NAMES[assignedDrum]}
    </div>
    <button
      class="text-xs text-gray-600 transition-colors hover:text-gray-400"
      onclick={onunassign}
      type="button"
    >
      ✕
    </button>
  {:else}
    <div class="flex-1 text-center text-xs text-gray-600">
      drop a sound here
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Create Storybook stories**

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SurfaceDropZone from './SurfaceDropZone.svelte'
  import { fn } from 'storybook/test'

  const { Story } = defineMeta({
    title: 'Mapping/SurfaceDropZone',
    component: SurfaceDropZone,
    tags: ['autodocs'],
    args: { onassign: fn(), onunassign: fn() },
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8" style="max-width: 400px;"><slot /></div>'
      })
    ]
  })
</script>

<Story name="Empty" args={{ surfaceName: 'Desk', color: '#4a9eff', assignedDrum: null }} />
<Story name="Assigned (Snare)" args={{ surfaceName: 'Desk', color: '#4a9eff', assignedDrum: 'snare' }} />
<Story name="Assigned (Kick)" args={{ surfaceName: 'Book', color: '#ff6b6b', assignedDrum: 'kick' }} />
<Story name="Empty (Yellow)" args={{ surfaceName: 'Bottle', color: '#ffd93d', assignedDrum: null }} />
```

- [ ] **Step 3: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/mapping/SurfaceDropZone.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 4: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/mapping/SurfaceDropZone.svelte src/lib/components/mapping/SurfaceDropZone.stories.svelte
git commit -m "feat(mapping): add SurfaceDropZone component with drag-and-drop"
```

---

## Task 9: DrumSoundCard Component

**Files:**
- Create: `src/lib/components/mapping/DrumSoundCard.svelte`
- Create: `src/lib/components/mapping/DrumSoundCard.stories.svelte`

- [ ] **Step 1: Create the DrumSoundCard component**

```svelte
<script lang="ts">
  import type { DrumId } from '$lib/player/samples'
  import { DRUM_DISPLAY_NAMES } from '$lib/state/kit.svelte'

  interface Props {
    drumId: DrumId
    assignedTo: string | null
    onpreview: (drumId: DrumId) => void
  }

  let { drumId, assignedTo, onpreview }: Props = $props()

  let isAssigned = $derived(assignedTo !== null)

  function handleDragStart(e: DragEvent) {
    e.dataTransfer?.setData('text/plain', drumId)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
    }
  }

  function handlePreview(e: Event) {
    e.stopPropagation()
    onpreview(drumId)
  }
</script>

<div
  class="flex items-center gap-2 rounded-lg border px-3 py-2
    {isAssigned ? 'border-gray-800 opacity-40' : 'cursor-grab border-gray-600'}"
  draggable="true"
  ondragstart={handleDragStart}
  role="listitem"
>
  <button
    class="flex h-7 w-7 items-center justify-center rounded-full text-xs text-white
      {isAssigned ? 'bg-gray-700' : 'bg-blue-500 hover:bg-blue-400'}"
    onclick={handlePreview}
    type="button"
    aria-label="Preview {DRUM_DISPLAY_NAMES[drumId]}"
  >
    ▶
  </button>
  <div class="flex-1">
    <div class="text-xs font-semibold text-gray-200">
      {DRUM_DISPLAY_NAMES[drumId]}
    </div>
    {#if isAssigned}
      <div class="text-[9px]" style="color: #4a9eff;">→ {assignedTo}</div>
    {:else}
      <div class="text-[9px] text-gray-500">available</div>
    {/if}
  </div>
  <div class="text-[10px] text-gray-600">⠿</div>
</div>
```

- [ ] **Step 2: Create Storybook stories**

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import DrumSoundCard from './DrumSoundCard.svelte'
  import { fn } from 'storybook/test'

  const { Story } = defineMeta({
    title: 'Mapping/DrumSoundCard',
    component: DrumSoundCard,
    tags: ['autodocs'],
    args: { onpreview: fn() },
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8" style="max-width: 200px;"><slot /></div>'
      })
    ]
  })
</script>

<Story name="Available (Snare)" args={{ drumId: 'snare', assignedTo: null }} />
<Story name="Available (Kick)" args={{ drumId: 'kick', assignedTo: null }} />
<Story name="Assigned" args={{ drumId: 'snare', assignedTo: 'Desk' }} />
<Story name="Available (Hi-Hat)" args={{ drumId: 'hihat', assignedTo: null }} />
<Story name="Available (Cymbal)" args={{ drumId: 'cymbal', assignedTo: null }} />
```

- [ ] **Step 3: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/mapping/DrumSoundCard.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 4: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/mapping/DrumSoundCard.svelte src/lib/components/mapping/DrumSoundCard.stories.svelte
git commit -m "feat(mapping): add DrumSoundCard component with drag and preview"
```

---

## Task 10: MappingPage + Map Route

**Files:**
- Create: `src/lib/components/mapping/MappingPage.svelte`
- Create: `src/routes/map/+page.svelte`

- [ ] **Step 1: Create the MappingPage component**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import type { DrumId } from '$lib/player/samples'
  import { DRUM_IDS } from '$lib/player/samples'
  import { DrumPlayer } from '$lib/player/player'
  import { kitState, setMapping, getDefaultMapping } from '$lib/state/kit.svelte'
  import { getSurfaceColor } from '$lib/constants/colors'
  import SurfaceDropZone from './SurfaceDropZone.svelte'
  import DrumSoundCard from './DrumSoundCard.svelte'

  let mapping: Record<string, DrumId> = $state(
    getDefaultMapping(kitState.surfaceNames)
  )
  let player: DrumPlayer | null = $state(null)
  let loadError = $state<string | null>(null)

  let allMapped = $derived(
    kitState.surfaceNames.every((name) => mapping[name] != null)
  )

  // Build reverse lookup: drumId → surface name (or null)
  let drumAssignments = $derived.by(() => {
    const assignments: Record<string, string | null> = {}
    for (const id of DRUM_IDS) {
      assignments[id] = null
    }
    for (const [surface, drumId] of Object.entries(mapping)) {
      if (drumId) assignments[drumId] = surface
    }
    return assignments
  })

  // Load drum player for previews
  $effect(() => {
    let cancelled = false

    async function load() {
      try {
        const p = new DrumPlayer()
        await p.load()
        if (cancelled) {
          p.dispose()
          return
        }
        player = p
      } catch {
        loadError = 'Could not load drum samples'
      }
    }

    load()

    return () => {
      cancelled = true
      player?.dispose()
      player = null
    }
  })

  function handleAssign(surface: string, drumId: DrumId) {
    // Unassign drum from any other surface first
    const newMapping = { ...mapping }
    for (const [s, d] of Object.entries(newMapping)) {
      if (d === drumId && s !== surface) {
        delete newMapping[s]
      }
    }
    newMapping[surface] = drumId
    mapping = newMapping
  }

  function handleUnassign(surface: string) {
    const newMapping = { ...mapping }
    delete newMapping[surface]
    mapping = newMapping
  }

  function handlePreview(drumId: DrumId) {
    player?.play(drumId, 0.7)
  }

  function handleStartPlaying() {
    if (!allMapped) return
    setMapping(mapping)
    goto(`${base}/play`)
  }

  function handleUseDefaults() {
    const defaults = getDefaultMapping(kitState.surfaceNames)
    setMapping(defaults)
    goto(`${base}/play`)
  }
</script>

<div class="mx-auto max-w-xl p-8">
  <div class="mb-8 text-center">
    <h2 class="mb-2 text-2xl font-semibold text-white">Map Your Surfaces</h2>
    <p class="text-sm text-gray-500">
      Drag drum sounds onto your surfaces, or use the defaults
    </p>
  </div>

  {#if loadError}
    <div class="mb-4 rounded-lg bg-yellow-900/20 p-3 text-xs text-yellow-400">
      {loadError} — previews unavailable
    </div>
  {/if}

  <div class="flex gap-6">
    <!-- Surfaces column -->
    <div class="flex-1 space-y-2">
      <div class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        Your Surfaces
      </div>
      {#each kitState.surfaceNames as name, i (name)}
        <SurfaceDropZone
          surfaceName={name}
          color={getSurfaceColor(i)}
          assignedDrum={mapping[name] ?? null}
          onassign={(drumId) => handleAssign(name, drumId)}
          onunassign={() => handleUnassign(name)}
        />
      {/each}
    </div>

    <!-- Drum sounds column -->
    <div class="min-w-[160px] space-y-2">
      <div class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        Drum Sounds
      </div>
      {#each DRUM_IDS as drumId (drumId)}
        <DrumSoundCard
          {drumId}
          assignedTo={drumAssignments[drumId]}
          onpreview={handlePreview}
        />
      {/each}
    </div>
  </div>

  <div class="mt-8 flex items-center justify-between">
    <div class="text-xs text-gray-600">
      {kitState.surfaceNames.filter((n) => mapping[n]).length} of {kitState.surfaceNames.length} mapped
    </div>
    <div class="flex gap-3">
      <button
        class="rounded-lg border border-gray-700 px-4 py-2.5 text-xs text-gray-400
          transition-colors hover:border-gray-500"
        onclick={handleUseDefaults}
        type="button"
      >
        Use defaults & play
      </button>
      <button
        class="rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors
          {allMapped
          ? 'bg-blue-500 text-white hover:bg-blue-400'
          : 'cursor-not-allowed bg-gray-800 text-gray-500'}"
        disabled={!allMapped}
        onclick={handleStartPlaying}
        type="button"
      >
        Start Playing →
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Create the Map route page**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import { kitState, hasModel } from '$lib/state/kit.svelte'
  import MappingPage from '$lib/components/mapping/MappingPage.svelte'

  // Guard: redirect if no model
  $effect(() => {
    if (!hasModel()) {
      goto(`${base}/`)
    }
  })
</script>

<div class="min-h-screen bg-gray-950">
  {#if kitState.model}
    <MappingPage />
  {/if}
</div>
```

- [ ] **Step 3: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/mapping/MappingPage.svelte`. Fix any issues and repeat until clean.
Then run on `src/routes/map/+page.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 4: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/mapping/MappingPage.svelte src/routes/map/+page.svelte
git commit -m "feat(mapping): add MappingPage component and /map route with guard"
```

---

## Task 11: PlayPage + Play Route

**Files:**
- Create: `src/lib/components/play/PlayPage.svelte`
- Create: `src/routes/play/+page.svelte`

- [ ] **Step 1: Create the PlayPage component**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import { startCapture } from '$lib/audio/capture'
  import type { AudioCapture } from '$lib/audio/capture'
  import { classify } from '$lib/classifier/knn'
  import { flattenFeatureVector } from '$lib/classifier/normalize'
  import { DrumPlayer } from '$lib/player/player'
  import { kitState, setThreshold, DRUM_DISPLAY_NAMES } from '$lib/state/kit.svelte'
  import { getSurfaceColor } from '$lib/constants/colors'
  import ControlBar from './ControlBar.svelte'
  import DrumPadGrid from './DrumPadGrid.svelte'
  import LaneStream from './LaneStream.svelte'

  let capture: AudioCapture | null = $state(null)
  let player: DrumPlayer | null = $state(null)
  let error = $state<string | null>(null)
  let padFlash: Record<string, boolean> = $state({})
  let laneHits: Record<string, Array<{ id: string; intensity: number }>> = $state({})

  // Initialize per-surface state
  $effect(() => {
    const flash: Record<string, boolean> = {}
    const hits: Record<string, Array<{ id: string; intensity: number }>> = {}
    for (const name of kitState.surfaceNames) {
      flash[name] = false
      hits[name] = []
    }
    padFlash = flash
    laneHits = hits
  })

  // Start audio capture and drum player
  $effect(() => {
    if (!kitState.model || !kitState.mapping) return

    let stopped = false
    const timeouts: ReturnType<typeof setTimeout>[] = []

    async function start() {
      try {
        error = null

        const p = new DrumPlayer()
        await p.load()
        if (stopped) {
          p.dispose()
          return
        }
        player = p

        const c = await startCapture()
        if (stopped) {
          c.stop()
          p.dispose()
          return
        }
        capture = c

        capture.onHit((event) => {
          if (!kitState.model || !kitState.mapping) return

          const features = flattenFeatureVector(event.features)
          const result = classify(kitState.model, features)

          if (!result || result.confidence < kitState.confidenceThreshold) return

          const drumId = kitState.mapping[result.surface]
          if (!drumId) return

          // Play drum sound
          player?.play(drumId, event.intensity)

          // Flash pad
          padFlash[result.surface] = true
          const flashT = setTimeout(() => {
            padFlash[result.surface] = false
          }, 150)
          timeouts.push(flashT)

          // Add lane hit block
          const hitId = crypto.randomUUID()
          laneHits[result.surface] = [
            ...laneHits[result.surface],
            { id: hitId, intensity: event.intensity }
          ]
          const hitT = setTimeout(() => {
            laneHits[result.surface] = laneHits[result.surface].filter(
              (h) => h.id !== hitId
            )
          }, 5000)
          timeouts.push(hitT)
        })
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to start audio'
      }
    }

    start()

    return () => {
      stopped = true
      capture?.stop()
      capture = null
      player?.dispose()
      player = null
      for (const t of timeouts) clearTimeout(t)
    }
  })

  let pads = $derived(
    kitState.surfaceNames.map((name, i) => ({
      drumName: kitState.mapping ? DRUM_DISPLAY_NAMES[kitState.mapping[name]] ?? '' : '',
      surfaceName: name,
      color: getSurfaceColor(i),
      flash: padFlash[name] ?? false
    }))
  )

  let lanes = $derived(
    kitState.surfaceNames.map((name, i) => ({
      label: kitState.mapping ? DRUM_DISPLAY_NAMES[kitState.mapping[name]] ?? name : name,
      color: getSurfaceColor(i),
      hits: laneHits[name] ?? []
    }))
  )

  function handleRemap() {
    goto(`${base}/map`)
  }

  function handleRetrain() {
    goto(`${base}/train/setup`)
  }

  function handleThresholdChange(value: number) {
    setThreshold(value)
  }
</script>

<div class="mx-auto max-w-xl p-4">
  {#if error}
    <div class="mb-4 rounded-lg bg-red-900/30 p-4 text-red-300">
      <p class="mb-2 text-sm">{error}</p>
      <button
        class="rounded border border-red-500 px-4 py-1.5 text-xs text-red-400
          hover:bg-red-900/30"
        onclick={() => location.reload()}
        type="button"
      >
        Try Again
      </button>
    </div>
  {/if}

  <div class="mb-4">
    <ControlBar
      threshold={kitState.confidenceThreshold}
      onthresholdchange={handleThresholdChange}
      onremap={handleRemap}
      onretrain={handleRetrain}
    />
  </div>

  <div class="mb-6">
    <DrumPadGrid {pads} />
  </div>

  <LaneStream {lanes} />
</div>
```

- [ ] **Step 2: Create the Play route page**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import { kitState, hasModel, hasMapping } from '$lib/state/kit.svelte'
  import PlayPage from '$lib/components/play/PlayPage.svelte'

  // Guard: redirect if prerequisites missing
  $effect(() => {
    if (!hasModel()) {
      goto(`${base}/`)
    } else if (!hasMapping()) {
      goto(`${base}/map`)
    }
  })
</script>

<div class="min-h-screen bg-gray-950">
  {#if kitState.model && kitState.mapping}
    <PlayPage />
  {/if}
</div>
```

- [ ] **Step 3: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/play/PlayPage.svelte`. Fix any issues and repeat until clean.
Then run on `src/routes/play/+page.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 4: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/play/PlayPage.svelte src/routes/play/+page.svelte
git commit -m "feat(play): add PlayPage component and /play route with guard"
```

---

## Task 12: M4 Try It Modification

**Files:**
- Modify: `src/routes/train/try/+page.svelte`

This task enables the disabled "Done" button on M4's Try It page and wires it to populate `KitState` and navigate to `/map`.

- [ ] **Step 1: Read the current Try It page**

Run: Read `src/routes/train/try/+page.svelte` to see the current "Done" button code. Per the M4 plan, it should look like:

```svelte
<button
  class="cursor-not-allowed rounded-lg bg-gray-800 px-6 py-2.5 text-sm text-gray-500"
  disabled
  type="button"
>
  Done
</button>
<span class="mt-2 text-[11px] text-gray-600">Mapping coming in a future update</span>
```

- [ ] **Step 2: Add kit state import and Done handler**

Add to the `<script>` section:

```ts
import { setModel } from '$lib/state/kit.svelte'
```

Add a handler function:

```ts
function handleDone() {
  if (!wizardState.model) return
  setModel(wizardState.model, wizardState.surfaces.map((s) => s.name))
  goto(`${base}/map`)
}
```

- [ ] **Step 3: Replace the disabled Done button**

Replace the disabled button and placeholder text with:

```svelte
<button
  class="rounded-lg bg-green-500 px-6 py-2.5 text-sm font-semibold text-black
    transition-colors hover:bg-green-400"
  onclick={handleDone}
  type="button"
>
  Done — Map Sounds →
</button>
```

Remove the "Mapping coming in a future update" text.

- [ ] **Step 4: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/routes/train/try/+page.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 5: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/routes/train/try/+page.svelte
git commit -m "feat(wizard): wire Done button to kit state and navigate to /map"
```

---

## Task 13: Integration Verification

- [ ] **Step 1: Run all unit tests**

Run: `bun run test:unit -- --run`
Expected: All tests pass (kit state + colors + existing audio/classifier/wizard specs)

- [ ] **Step 2: Run type check**

Run: `bun run check`
Expected: No errors

- [ ] **Step 3: Run lint and format**

Run: `bun run format && bun run lint`
Expected: No errors

- [ ] **Step 4: Run build**

Run: `bun run build`
Expected: Static build succeeds. The `/map` and `/play` routes should prerender as empty shells (the guard `$effect` only runs in the browser, so the pages render the `{#if}` fallback during SSR). This is expected — the pages are populated at runtime after the wizard completes.

- [ ] **Step 5: Full manual smoke test**

Run: `bun dev`
Navigate to `http://localhost:5173`

Test the full flow:
1. Home → "New Kit" → complete training wizard (2+ surfaces, 50+ hits each)
2. "Done — Map Sounds" on Try It page → arrives at `/map`
3. Mapping: verify default mapping is pre-filled (Surface 1→Snare, 2→Kick, etc.)
4. Drag a sound card onto a different surface → mapping updates
5. Click ▶ on a sound card → hear sound preview
6. Click ✕ on a surface → unassigns
7. Click "Start Playing" → arrives at `/play`
8. Hit surfaces → correct drum pad flashes, correct sound plays, lane blocks appear
9. Adjust confidence slider → higher threshold rejects more hits
10. Click "← Remap" → back to `/map` with mapping preserved
11. Click "Retrain" → back to training wizard
12. Navigate directly to `/play` without mapping → redirected to `/map`
13. Navigate directly to `/map` without model → redirected to `/`
14. Go back to `/map`, click "Use defaults & play" → arrives at `/play` with defaults

- [ ] **Step 6: Final commit if any fixes were needed**

Stage only the files that were modified to fix issues, then commit:

```bash
git commit -m "chore: fix integration issues from milestone 5"
```

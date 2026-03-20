# Milestone 4: Training Wizard UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Training Wizard UI that guides users through recording surface hits, building a KNN classifier, and verifying it works with a live "Try It" demo.

**Architecture:** Route-per-step wizard under `/train/` with a shared reactive store (`state.svelte.ts`) using Svelte 5 module-level `$state`. Each wizard step is its own SvelteKit route. Reusable components (StepIndicator, HitCounter, ProgressBar, SurfaceDot, SurfaceTile) live in `src/lib/components/`. The wizard consumes M1's audio capture API and M2's classifier API directly — both are fully implemented.

**Tech Stack:** SvelteKit, Svelte 5 (runes), TypeScript, TailwindCSS v4, Vitest (server + client projects), Storybook 10 (Svelte CSF)

**Spec:** `docs/superpowers/specs/2026-03-19-milestone4-training-wizard-design.md`

---

## File Structure

```
src/lib/wizard/
  state.svelte.ts              — Shared wizard store (reactive state + mutation functions)
  state.spec.ts                — Unit tests for store logic

src/lib/components/
  StepIndicator.svelte         — Step progress bar (Setup → Record → Train → Try It)
  StepIndicator.stories.svelte — Storybook stories
  SurfaceDot.svelte            — Clickable surface indicator with name and count
  SurfaceDot.stories.svelte    — Storybook stories
  HitCounter.svelte            — Large circular hit counter with flash animation
  HitCounter.stories.svelte    — Storybook stories
  ProgressBar.svelte           — Progress bar with min/target markers
  ProgressBar.stories.svelte   — Storybook stories
  SurfaceTile.svelte           — Tile that flashes on classification result
  SurfaceTile.stories.svelte   — Storybook stories

src/routes/
  +page.svelte                 — Home screen (replace existing placeholder)
  train/
    +layout.svelte             — Shared step indicator for all wizard routes
    setup/+page.svelte         — Surface count + naming step
    record/+page.svelte        — Hit recording with mic capture
    train/+page.svelte         — Model building + progress
    try/+page.svelte           — Live classification demo
```

**Dependency order:** Wizard store (Task 1) → Components (Tasks 2-6) → Routes (Tasks 7-12) → Integration (Task 13).

**Existing dependencies (all implemented):**
- `src/lib/audio/capture.ts` — `startCapture()` returns `AudioCapture` with `onHit()`, `stop()`
- `src/lib/audio/types.ts` — `FeatureVector`, `WorkletHitMessage`
- `src/lib/classifier/trainer.ts` — `createModel()`, `addSample()`, `getSurfaceNames()`, `getSampleCount()`
- `src/lib/classifier/knn.ts` — `classify()`
- `src/lib/classifier/normalize.ts` — `flattenFeatureVector()`
- `src/lib/classifier/model.ts` — `ClassifierModel`, `ClassificationResult`

---

## Task 1: Wizard Store

**Files:**
- Create: `src/lib/wizard/state.svelte.ts`
- Create: `src/lib/wizard/state.spec.ts`

- [ ] **Step 1: Write failing tests for the wizard store**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import type { FeatureVector } from '$lib/audio/types'
import {
  wizardState,
  reset,
  setSurfaces,
  addRecording,
  setCurrentSurface,
  buildModel,
  getRecordingCount,
  canProceedToTrain,
  canProceedFromSetup
} from './state.svelte'

function makeFV(seed: number): FeatureVector {
  return {
    mfcc: new Float64Array([
      seed, seed + 1, seed + 2, seed + 3, seed + 4, seed + 5, seed + 6,
      seed + 7, seed + 8, seed + 9, seed + 10, seed + 11, seed + 12
    ]),
    spectralCentroid: seed * 100,
    zcr: seed * 0.1,
    energy: seed * 0.05
  }
}

describe('wizard store', () => {
  beforeEach(() => {
    reset()
  })

  describe('reset', () => {
    it('returns to initial state', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }])
      addRecording('Desk', makeFV(1))
      reset()

      expect(wizardState.surfaces).toHaveLength(0)
      expect(Object.keys(wizardState.recordings)).toHaveLength(0)
      expect(wizardState.currentSurfaceIndex).toBe(0)
      expect(wizardState.model).toBeNull()
    })
  })

  describe('setSurfaces', () => {
    it('sets surface configs and clears recordings', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }])
      addRecording('Desk', makeFV(1))

      setSurfaces([{ name: 'A' }, { name: 'B' }, { name: 'C' }])

      expect(wizardState.surfaces).toHaveLength(3)
      expect(wizardState.surfaces[0].name).toBe('A')
      expect(Object.keys(wizardState.recordings)).toHaveLength(0)
      expect(wizardState.currentSurfaceIndex).toBe(0)
      expect(wizardState.model).toBeNull()
    })
  })

  describe('addRecording', () => {
    it('appends a FeatureVector to the named surface', () => {
      setSurfaces([{ name: 'Desk' }])
      addRecording('Desk', makeFV(1))
      addRecording('Desk', makeFV(2))

      expect(wizardState.recordings['Desk']).toHaveLength(2)
    })

    it('creates entry if surface not yet recorded', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }])
      addRecording('Book', makeFV(1))

      expect(wizardState.recordings['Book']).toHaveLength(1)
      expect(wizardState.recordings['Desk']).toBeUndefined()
    })
  })

  describe('setCurrentSurface', () => {
    it('updates currentSurfaceIndex', () => {
      setSurfaces([{ name: 'A' }, { name: 'B' }])
      setCurrentSurface(1)

      expect(wizardState.currentSurfaceIndex).toBe(1)
    })
  })

  describe('getRecordingCount', () => {
    it('returns 0 for unrecorded surface', () => {
      setSurfaces([{ name: 'Desk' }])

      expect(getRecordingCount('Desk')).toBe(0)
    })

    it('returns correct count', () => {
      setSurfaces([{ name: 'Desk' }])
      addRecording('Desk', makeFV(1))
      addRecording('Desk', makeFV(2))
      addRecording('Desk', makeFV(3))

      expect(getRecordingCount('Desk')).toBe(3)
    })
  })

  describe('canProceedFromSetup', () => {
    it('returns false with no surfaces', () => {
      expect(canProceedFromSetup()).toBe(false)
    })

    it('returns false with only 1 named surface', () => {
      setSurfaces([{ name: 'Desk' }])

      expect(canProceedFromSetup()).toBe(false)
    })

    it('returns true with 2+ named surfaces', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }])

      expect(canProceedFromSetup()).toBe(true)
    })

    it('returns false if any surface has empty name', () => {
      setSurfaces([{ name: 'Desk' }, { name: '' }])

      expect(canProceedFromSetup()).toBe(false)
    })
  })

  describe('canProceedToTrain', () => {
    it('returns false when no recordings', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }])

      expect(canProceedToTrain()).toBe(false)
    })

    it('returns false when not all surfaces have 50+ hits', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }])
      for (let i = 0; i < 50; i++) addRecording('Desk', makeFV(i))
      for (let i = 0; i < 10; i++) addRecording('Book', makeFV(i))

      expect(canProceedToTrain()).toBe(false)
    })

    it('returns true when all surfaces have 50+ hits', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }])
      for (let i = 0; i < 50; i++) addRecording('Desk', makeFV(i))
      for (let i = 0; i < 50; i++) addRecording('Book', makeFV(i))

      expect(canProceedToTrain()).toBe(true)
    })
  })

  describe('buildModel', () => {
    it('creates a ClassifierModel from all recordings', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }])
      for (let i = 0; i < 5; i++) addRecording('Desk', makeFV(i))
      for (let i = 0; i < 5; i++) addRecording('Book', makeFV(i + 10))

      buildModel()

      expect(wizardState.model).not.toBeNull()
      expect(wizardState.model!.normalization).not.toBeNull()
    })

    it('model has samples for each surface', () => {
      setSurfaces([{ name: 'A' }, { name: 'B' }])
      for (let i = 0; i < 3; i++) addRecording('A', makeFV(i))
      for (let i = 0; i < 3; i++) addRecording('B', makeFV(i + 10))

      buildModel()

      expect(wizardState.model!.surfaces['A']).toHaveLength(3)
      expect(wizardState.model!.surfaces['B']).toHaveLength(3)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run --project server src/lib/wizard/state.spec.ts`
Expected: FAIL — module `./state.svelte` not found

- [ ] **Step 3: Implement the wizard store**

```ts
import type { FeatureVector } from '$lib/audio/types'
import type { ClassifierModel } from '$lib/classifier/model'
import { createModel, addSample } from '$lib/classifier/trainer'

export interface SurfaceConfig {
  name: string
}

interface WizardState {
  surfaces: SurfaceConfig[]
  recordings: Record<string, FeatureVector[]>
  currentSurfaceIndex: number
  model: ClassifierModel | null
}

export let wizardState: WizardState = $state({
  surfaces: [],
  recordings: {},
  currentSurfaceIndex: 0,
  model: null
})

export function reset(): void {
  wizardState.surfaces = []
  wizardState.recordings = {}
  wizardState.currentSurfaceIndex = 0
  wizardState.model = null
}

export function setSurfaces(surfaces: SurfaceConfig[]): void {
  wizardState.surfaces = surfaces
  wizardState.recordings = {}
  wizardState.currentSurfaceIndex = 0
  wizardState.model = null
}

export function addRecording(surface: string, fv: FeatureVector): void {
  if (!wizardState.recordings[surface]) {
    wizardState.recordings[surface] = []
  }
  wizardState.recordings[surface].push(fv)
}

export function setCurrentSurface(index: number): void {
  wizardState.currentSurfaceIndex = index
}

export function getRecordingCount(surface: string): number {
  return wizardState.recordings[surface]?.length ?? 0
}

export function canProceedFromSetup(): boolean {
  const named = wizardState.surfaces.filter((s) => s.name.trim().length > 0)
  return named.length >= 2
}

export function canProceedToTrain(): boolean {
  if (wizardState.surfaces.length < 2) return false
  return wizardState.surfaces.every(
    (s) => getRecordingCount(s.name) >= 50
  )
}

export function buildModel(): void {
  let model = createModel()
  for (const [surface, recordings] of Object.entries(wizardState.recordings)) {
    for (const fv of recordings) {
      model = addSample(model, surface, fv)
    }
  }
  wizardState.model = model
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- --run --project server src/lib/wizard/state.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/wizard/state.svelte.ts src/lib/wizard/state.spec.ts
git commit -m "feat(wizard): add wizard store with reactive state and mutation functions"
```

---

## Task 2: StepIndicator Component

**Files:**
- Create: `src/lib/components/StepIndicator.svelte`
- Create: `src/lib/components/StepIndicator.stories.svelte`

- [ ] **Step 1: Create the StepIndicator component**

```svelte
<script lang="ts">
  interface Props {
    currentStep: 'setup' | 'record' | 'train' | 'try'
  }

  let { currentStep }: Props = $props()

  const steps = [
    { id: 'setup' as const, label: 'Setup' },
    { id: 'record' as const, label: 'Record' },
    { id: 'train' as const, label: 'Train' },
    { id: 'try' as const, label: 'Try It' }
  ]

  const stepIndex = $derived(steps.findIndex((s) => s.id === currentStep))
</script>

<div class="flex items-center justify-center gap-2">
  {#each steps as step, i}
    {#if i > 0}
      <div class="h-px w-6 {i <= stepIndex ? 'bg-green-500' : 'bg-gray-700'}"></div>
    {/if}
    <div class="flex items-center gap-1.5">
      <div
        class="flex h-5 w-5 items-center justify-center rounded-full text-[10px]
          {i < stepIndex
          ? 'bg-green-500 text-white'
          : i === stepIndex
            ? 'bg-white font-bold text-black'
            : 'bg-gray-800 text-gray-500'}"
      >
        {#if i < stepIndex}
          ✓
        {:else}
          {i + 1}
        {/if}
      </div>
      <span
        class="text-xs
          {i < stepIndex
          ? 'text-green-500'
          : i === stepIndex
            ? 'font-semibold text-white'
            : 'text-gray-500'}"
      >
        {step.label}
      </span>
    </div>
  {/each}
</div>
```

- [ ] **Step 2: Create Storybook stories**

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import StepIndicator from './StepIndicator.svelte'

  const { Story } = defineMeta({
    title: 'Wizard/StepIndicator',
    component: StepIndicator,
    tags: ['autodocs'],
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8"><slot /></div>'
      })
    ]
  })
</script>

<Story name="Setup" args={{ currentStep: 'setup' }} />
<Story name="Record" args={{ currentStep: 'record' }} />
<Story name="Train" args={{ currentStep: 'train' }} />
<Story name="Try It" args={{ currentStep: 'try' }} />
```

- [ ] **Step 3: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 4: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/StepIndicator.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/StepIndicator.svelte src/lib/components/StepIndicator.stories.svelte
git commit -m "feat(wizard): add StepIndicator component"
```

---

## Task 3: HitCounter Component

**Files:**
- Create: `src/lib/components/HitCounter.svelte`
- Create: `src/lib/components/HitCounter.stories.svelte`

- [ ] **Step 1: Create the HitCounter component**

The large circular element that shows hit count and flashes green on each new hit.

```svelte
<script lang="ts">
  interface Props {
    count: number
    flash?: boolean
  }

  let { count, flash = false }: Props = $props()
</script>

<div
  class="relative mx-auto flex h-40 w-40 items-center justify-center rounded-full border-2
    {flash ? 'border-green-400 shadow-[0_0_24px_rgba(34,197,94,0.4)]' : 'border-gray-800'}"
  style="background: radial-gradient(circle, {flash
    ? 'rgba(34,197,94,0.15)'
    : 'rgba(34,197,94,0.05)'} 0%, transparent 70%);
    transition: border-color 100ms, box-shadow 100ms;"
>
  <div class="text-center">
    <div class="text-5xl font-bold text-white">{count}</div>
    <div class="mt-1 text-xs text-gray-500">hits</div>
  </div>
</div>
```

- [ ] **Step 2: Create Storybook stories**

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import HitCounter from './HitCounter.svelte'

  const { Story } = defineMeta({
    title: 'Wizard/HitCounter',
    component: HitCounter,
    tags: ['autodocs'],
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8"><slot /></div>'
      })
    ]
  })
</script>

<Story name="Empty" args={{ count: 0 }} />
<Story name="In Progress" args={{ count: 67 }} />
<Story name="Flashing" args={{ count: 68, flash: true }} />
<Story name="Complete" args={{ count: 100 }} />
```

- [ ] **Step 3: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 4: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/HitCounter.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/HitCounter.svelte src/lib/components/HitCounter.stories.svelte
git commit -m "feat(wizard): add HitCounter component"
```

---

## Task 4: ProgressBar Component

**Files:**
- Create: `src/lib/components/ProgressBar.svelte`
- Create: `src/lib/components/ProgressBar.stories.svelte`

- [ ] **Step 1: Create the ProgressBar component**

```svelte
<script lang="ts">
  interface Props {
    value: number
    min: number
    max: number
  }

  let { value, min, max }: Props = $props()

  let percent = $derived(Math.min(100, (value / max) * 100))
  let minPercent = $derived((min / max) * 100)
</script>

<div class="mx-auto max-w-md">
  <div class="relative h-1.5 overflow-visible rounded-full bg-gray-800">
    <div
      class="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-green-500 to-green-400"
      style="width: {percent}%; transition: width 100ms;"
    ></div>
    <div
      class="absolute top-[-3px] h-3 w-px bg-gray-600"
      style="left: {minPercent}%;"
    ></div>
  </div>
  <div class="mt-1.5 flex justify-between text-[11px]">
    <span class="text-gray-500">{value}</span>
    <span class="text-green-400" style="position: relative; left: -{50 - minPercent}%;">
      min: {min}
    </span>
    <span class="text-gray-500">{max}</span>
  </div>
</div>
```

- [ ] **Step 2: Create Storybook stories**

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import ProgressBar from './ProgressBar.svelte'

  const { Story } = defineMeta({
    title: 'Wizard/ProgressBar',
    component: ProgressBar,
    tags: ['autodocs'],
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8"><slot /></div>'
      })
    ]
  })
</script>

<Story name="Empty" args={{ value: 0, min: 50, max: 100 }} />
<Story name="Below Minimum" args={{ value: 30, min: 50, max: 100 }} />
<Story name="At Minimum" args={{ value: 50, min: 50, max: 100 }} />
<Story name="Above Minimum" args={{ value: 67, min: 50, max: 100 }} />
<Story name="Full" args={{ value: 100, min: 50, max: 100 }} />
```

- [ ] **Step 3: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 4: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/ProgressBar.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ProgressBar.svelte src/lib/components/ProgressBar.stories.svelte
git commit -m "feat(wizard): add ProgressBar component"
```

---

## Task 5: SurfaceDot Component

**Files:**
- Create: `src/lib/components/SurfaceDot.svelte`
- Create: `src/lib/components/SurfaceDot.stories.svelte`

- [ ] **Step 1: Create the SurfaceDot component**

```svelte
<script lang="ts">
  interface Props {
    name: string
    count: number
    active?: boolean
    complete?: boolean
    onclick?: () => void
  }

  let { name, count, active = false, complete = false, onclick }: Props = $props()

  let borderColor = $derived(
    active ? 'border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.3)]'
    : complete ? 'border-green-500'
    : 'border-gray-700'
  )
  let textColor = $derived(
    active ? 'text-green-500' : complete ? 'text-green-500' : 'text-gray-500'
  )
  let opacity = $derived(active || complete ? 'opacity-100' : 'opacity-50')
</script>

<button class="text-center {opacity}" onclick={onclick} type="button">
  <div
    class="mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 bg-gray-950
      {borderColor}"
  >
    <span class="{textColor} text-[10px] font-semibold">{count}</span>
  </div>
  <div class="{textColor} mt-1.5 text-[11px] {active ? 'font-semibold' : ''}">{name}</div>
</button>
```

- [ ] **Step 2: Create Storybook stories**

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SurfaceDot from './SurfaceDot.svelte'
  import { fn } from 'storybook/test'

  const { Story } = defineMeta({
    title: 'Wizard/SurfaceDot',
    component: SurfaceDot,
    tags: ['autodocs'],
    args: { onclick: fn() },
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8"><slot /></div>'
      })
    ]
  })
</script>

<Story name="Pending" args={{ name: 'Surface 1', count: 0 }} />
<Story name="Active" args={{ name: 'Desk', count: 67, active: true }} />
<Story name="Complete" args={{ name: 'Book', count: 102, complete: true }} />
```

- [ ] **Step 3: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 4: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/SurfaceDot.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/SurfaceDot.svelte src/lib/components/SurfaceDot.stories.svelte
git commit -m "feat(wizard): add SurfaceDot component"
```

---

## Task 6: SurfaceTile Component

**Files:**
- Create: `src/lib/components/SurfaceTile.svelte`
- Create: `src/lib/components/SurfaceTile.stories.svelte`

- [ ] **Step 1: Create the SurfaceTile component**

Used in the "Try It" step. Flashes when a hit is classified as this surface.

```svelte
<script lang="ts">
  interface Props {
    name: string
    confidence?: number | null
    unrecognized?: boolean
  }

  let { name, confidence = null, unrecognized = false }: Props = $props()

  let isActive = $derived(confidence !== null)
</script>

<div
  class="flex min-h-[120px] min-w-[120px] flex-col items-center justify-center rounded-lg border-2 p-4
    {isActive
    ? 'border-green-400 bg-green-500/10 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
    : unrecognized
      ? 'border-yellow-500/50 bg-yellow-500/5'
      : 'border-gray-700 bg-gray-900'}"
  style="transition: border-color 150ms, background-color 150ms, box-shadow 150ms;"
>
  <div
    class="text-lg font-semibold
      {isActive ? 'text-green-400' : unrecognized ? 'text-yellow-500' : 'text-gray-400'}"
  >
    {#if unrecognized}
      ?
    {:else}
      {name}
    {/if}
  </div>
  {#if confidence !== null}
    <div class="mt-1 text-xs text-green-300">{Math.round(confidence * 100)}%</div>
  {/if}
</div>
```

- [ ] **Step 2: Create Storybook stories**

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SurfaceTile from './SurfaceTile.svelte'

  const { Story } = defineMeta({
    title: 'Wizard/SurfaceTile',
    component: SurfaceTile,
    tags: ['autodocs'],
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8 flex gap-4"><slot /></div>'
      })
    ]
  })
</script>

<Story name="Idle" args={{ name: 'Desk' }} />
<Story name="Active (high confidence)" args={{ name: 'Desk', confidence: 0.95 }} />
<Story name="Active (low confidence)" args={{ name: 'Book', confidence: 0.62 }} />
<Story name="Unrecognized" args={{ name: 'Desk', unrecognized: true }} />
```

- [ ] **Step 3: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 4: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/SurfaceTile.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/SurfaceTile.svelte src/lib/components/SurfaceTile.stories.svelte
git commit -m "feat(wizard): add SurfaceTile component"
```

---

## Task 7: Home Screen

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Read the existing home page**

Run: Read `src/routes/+page.svelte` to see current content.

- [ ] **Step 2: Replace with the Home screen**

```svelte
<script lang="ts">
  import { base } from '$app/paths'
  import { reset } from '$lib/wizard/state.svelte'

  function handleNewKit() {
    reset()
  }
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-8">
  <h1 class="mb-2 text-4xl font-bold text-white">No. 2 Drummer</h1>
  <p class="mb-12 text-gray-500">Turn any surface into a drum kit</p>

  <div class="flex flex-col gap-4">
    <a
      href="{base}/train/setup"
      class="rounded-lg bg-green-500 px-8 py-3 text-center font-semibold text-black
        transition-colors hover:bg-green-400"
      onclick={handleNewKit}
    >
      New Kit
    </a>
    <button
      class="cursor-not-allowed rounded-lg border border-gray-700 px-8 py-3 text-gray-500"
      disabled
      type="button"
    >
      Load Saved Kit
    </button>
    <span class="text-center text-xs text-gray-600">Coming soon</span>
  </div>
</div>
```

- [ ] **Step 3: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/routes/+page.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 4: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(wizard): add home screen with New Kit button"
```

---

## Task 8: Train Layout with Step Indicator

**Files:**
- Create: `src/routes/train/+layout.svelte`

- [ ] **Step 1: Create the train layout**

This layout wraps all `/train/*` routes and renders the shared step indicator.

```svelte
<script lang="ts">
  import StepIndicator from '$lib/components/StepIndicator.svelte'
  import { page } from '$app/state'

  interface Props {
    children: import('svelte').Snippet
  }

  let { children }: Props = $props()

  let currentStep = $derived(
    page.url.pathname.endsWith('/setup') ? 'setup' as const
    : page.url.pathname.endsWith('/record') ? 'record' as const
    : page.url.pathname.endsWith('/train') ? 'train' as const
    : 'try' as const
  )
</script>

<div class="min-h-screen bg-gray-950 p-8">
  <div class="mx-auto max-w-xl">
    <div class="mb-8">
      <StepIndicator {currentStep} />
    </div>
    {@render children()}
  </div>
</div>
```

- [ ] **Step 2: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/routes/train/+layout.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 3: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/train/+layout.svelte
git commit -m "feat(wizard): add train layout with step indicator"
```

---

## Task 9: Setup Step

**Files:**
- Create: `src/routes/train/setup/+page.svelte`

- [ ] **Step 1: Create the Setup page**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import {
    wizardState,
    setSurfaces,
    canProceedFromSetup
  } from '$lib/wizard/state.svelte'

  let surfaceCount = $state(3)
  let names = $state(['Surface 1', 'Surface 2', 'Surface 3', 'Surface 4'])

  // Sync surfaces into wizard state whenever names or count changes
  $effect(() => {
    const configs = names.slice(0, surfaceCount).map((name) => ({ name }))
    setSurfaces(configs)
  })

  function handleCountChange(count: number) {
    surfaceCount = count
  }

  function handleNext() {
    if (canProceedFromSetup()) {
      goto(`${base}/train/record`)
    }
  }
</script>

<div class="text-center">
  <h2 class="mb-2 text-2xl font-semibold text-white">Setup Your Kit</h2>
  <p class="mb-8 text-sm text-gray-500">Choose your surfaces and name them</p>
</div>

<div class="mb-8">
  <label class="mb-3 block text-xs uppercase tracking-wider text-gray-500">
    Number of surfaces
  </label>
  <div class="flex justify-center gap-3">
    {#each [2, 3, 4] as count}
      <button
        class="h-10 w-10 rounded-lg text-sm font-semibold transition-colors
          {surfaceCount === count
          ? 'bg-green-500 text-black'
          : 'border border-gray-700 text-gray-400 hover:border-gray-500'}"
        onclick={() => handleCountChange(count)}
        type="button"
      >
        {count}
      </button>
    {/each}
  </div>
</div>

<div class="mb-8 space-y-3">
  <label class="mb-3 block text-xs uppercase tracking-wider text-gray-500">
    Surface names
  </label>
  {#each { length: surfaceCount } as _, i}
    <input
      type="text"
      bind:value={names[i]}
      placeholder="Surface {i + 1}"
      class="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-white
        placeholder-gray-600 focus:border-green-500 focus:outline-none focus:ring-1
        focus:ring-green-500"
    />
  {/each}
</div>

<div class="flex justify-between">
  <a
    href="{base}/"
    class="rounded-lg border border-gray-700 px-5 py-2.5 text-sm text-gray-400
      transition-colors hover:border-gray-500"
  >
    ← Back
  </a>
  <button
    class="rounded-lg px-6 py-2.5 text-sm font-semibold transition-colors
      {canProceedFromSetup()
      ? 'bg-green-500 text-black hover:bg-green-400'
      : 'cursor-not-allowed bg-gray-800 text-gray-500'}"
    disabled={!canProceedFromSetup()}
    onclick={handleNext}
    type="button"
  >
    Start Recording →
  </button>
</div>
```

- [ ] **Step 2: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/routes/train/setup/+page.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 3: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 4: Smoke test in browser**

Run: `bun dev`
Navigate to `http://localhost:5173` → click "New Kit" → should see Setup page with surface count buttons and name inputs.

- [ ] **Step 5: Commit**

```bash
git add src/routes/train/setup/+page.svelte
git commit -m "feat(wizard): add Setup step with surface count and naming"
```

---

## Task 10: Record Step

**Files:**
- Create: `src/routes/train/record/+page.svelte`

This is the most complex page — it integrates audio capture with the wizard store.

- [ ] **Step 1: Create the Record page**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import { startCapture } from '$lib/audio/capture'
  import type { AudioCapture } from '$lib/audio/capture'
  import HitCounter from '$lib/components/HitCounter.svelte'
  import ProgressBar from '$lib/components/ProgressBar.svelte'
  import SurfaceDot from '$lib/components/SurfaceDot.svelte'
  import {
    wizardState,
    addRecording,
    setCurrentSurface,
    getRecordingCount,
    canProceedToTrain
  } from '$lib/wizard/state.svelte'

  let capture: AudioCapture | null = $state(null)
  let error = $state<string | null>(null)
  let flash = $state(false)
  let showBackConfirm = $state(false)

  const MIN_HITS = 50
  const TARGET_HITS = 100

  let currentSurface = $derived(wizardState.surfaces[wizardState.currentSurfaceIndex])
  let currentCount = $derived(currentSurface ? getRecordingCount(currentSurface.name) : 0)

  // Redirect if no surfaces configured
  $effect(() => {
    if (wizardState.surfaces.length === 0) {
      goto(`${base}/train/setup`)
    }
  })

  // Start mic capture on mount
  $effect(() => {
    let stopped = false

    async function start() {
      try {
        error = null
        const c = await startCapture()
        if (stopped) {
          c.stop()
          return
        }
        capture = c

        capture.onHit((event) => {
          // Read directly from wizardState — not from $derived — so the callback
          // always uses the latest surface even though it's registered once.
          const surface = wizardState.surfaces[wizardState.currentSurfaceIndex]
          if (!surface) return
          addRecording(surface.name, event.features)
          flash = true
          setTimeout(() => { flash = false }, 100)
        })
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to access microphone'
      }
    }

    start()

    return () => {
      stopped = true
      capture?.stop()
      capture = null
    }
  })

  function handleSurfaceClick(index: number) {
    setCurrentSurface(index)
  }

  function handleSkip() {
    const next = wizardState.surfaces.findIndex(
      (s, i) => i !== wizardState.currentSurfaceIndex && getRecordingCount(s.name) < MIN_HITS
    )
    if (next !== -1) {
      setCurrentSurface(next)
    } else {
      // All at min — cycle to next
      setCurrentSurface((wizardState.currentSurfaceIndex + 1) % wizardState.surfaces.length)
    }
  }

  function handleBack() {
    const hasRecordings = Object.values(wizardState.recordings).some((r) => r.length > 0)
    if (hasRecordings && !showBackConfirm) {
      showBackConfirm = true
      return
    }
    goto(`${base}/train/setup`)
  }

  function handleTrain() {
    if (canProceedToTrain()) {
      goto(`${base}/train/train`)
    }
  }
</script>

<div class="text-center">
  {#if error}
    <div class="mb-6 rounded-lg bg-red-900/30 p-4 text-red-300">
      <p class="mb-2">{error}</p>
      <button
        class="rounded border border-red-500 px-4 py-1.5 text-sm text-red-400
          hover:bg-red-900/30"
        onclick={() => { error = null; location.reload() }}
        type="button"
      >
        Try Again
      </button>
    </div>
  {/if}

  {#if currentSurface}
    <h2 class="mb-2 text-2xl font-semibold text-white">
      Hit the <span class="text-green-500">{currentSurface.name}</span>
    </h2>
    <p class="mb-8 text-sm text-gray-500">
      Tap repeatedly with your pencil — aim for {TARGET_HITS} hits
    </p>

    <div class="mb-6">
      <HitCounter count={currentCount} {flash} />
    </div>

    <div class="mb-8">
      <ProgressBar value={currentCount} min={MIN_HITS} max={TARGET_HITS} />
    </div>

    <div class="mb-8 flex justify-center gap-5">
      {#each wizardState.surfaces as surface, i}
        <SurfaceDot
          name={surface.name}
          count={getRecordingCount(surface.name)}
          active={i === wizardState.currentSurfaceIndex}
          complete={getRecordingCount(surface.name) >= MIN_HITS}
          onclick={() => handleSurfaceClick(i)}
        />
      {/each}
    </div>
  {/if}
</div>

<div class="flex items-center justify-between">
  <div>
    {#if showBackConfirm}
      <div class="flex items-center gap-2">
        <span class="text-xs text-yellow-400">Clear all recordings?</span>
        <button
          class="rounded border border-yellow-500 px-3 py-1.5 text-xs text-yellow-400
            hover:bg-yellow-900/20"
          onclick={() => goto(`${base}/train/setup`)}
          type="button"
        >
          Yes, go back
        </button>
        <button
          class="rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-400
            hover:border-gray-500"
          onclick={() => { showBackConfirm = false }}
          type="button"
        >
          Cancel
        </button>
      </div>
    {:else}
      <button
        class="rounded-lg border border-gray-700 px-5 py-2.5 text-sm text-gray-400
          transition-colors hover:border-gray-500"
        onclick={handleBack}
        type="button"
      >
        ← Back
      </button>
    {/if}
  </div>

  <div class="flex gap-3">
    <button
      class="rounded-lg border border-gray-700 px-4 py-2.5 text-sm text-gray-400
        transition-colors hover:border-gray-500"
      onclick={handleSkip}
      type="button"
    >
      Skip to Next Surface
    </button>
    <button
      class="rounded-lg px-6 py-2.5 text-sm font-semibold transition-colors
        {canProceedToTrain()
        ? 'bg-green-500 text-black hover:bg-green-400'
        : 'cursor-not-allowed bg-gray-800 text-gray-500'}"
      disabled={!canProceedToTrain()}
      onclick={handleTrain}
      type="button"
    >
      Train Model →
    </button>
  </div>
</div>

{#if !canProceedToTrain()}
  <p class="mt-2 text-center text-[11px] text-gray-600">
    All surfaces need at least {MIN_HITS} hits before training
  </p>
{/if}
```

- [ ] **Step 2: Check that `AudioCapture` is exported from capture.ts**

Read `src/lib/audio/capture.ts` to verify `AudioCapture` is exported as a type. If it's only an interface (not exported), the import in the Record page will need adjustment — use `import type { ... }` or the capture module may need a small update to export the type.

- [ ] **Step 3: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/routes/train/record/+page.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 4: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/routes/train/record/+page.svelte
git commit -m "feat(wizard): add Record step with mic capture and hit recording"
```

---

## Task 11: Train Step

**Files:**
- Create: `src/routes/train/train/+page.svelte`

- [ ] **Step 1: Create the Train page**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import {
    wizardState,
    buildModel,
    canProceedToTrain,
    getRecordingCount
  } from '$lib/wizard/state.svelte'

  let progress = $state('')
  let done = $state(false)
  let totalSamples = $state(0)

  // Redirect if prerequisites not met
  $effect(() => {
    if (!canProceedToTrain()) {
      goto(`${base}/train/record`)
    }
  })

  // Build model on mount
  $effect(() => {
    let cancelled = false

    async function train() {
      // Small delay so the step feels intentional
      await new Promise((r) => setTimeout(r, 200))
      if (cancelled) return

      let total = 0
      for (let i = 0; i < wizardState.surfaces.length; i++) {
        const surface = wizardState.surfaces[i]
        progress = `Processing surface ${i + 1} of ${wizardState.surfaces.length}: ${surface.name}`
        total += getRecordingCount(surface.name)
        // Yield to let UI update
        await new Promise((r) => setTimeout(r, 50))
        if (cancelled) return
      }

      buildModel()
      totalSamples = total

      // Brief pause so completion feels satisfying
      await new Promise((r) => setTimeout(r, 300))
      if (cancelled) return

      done = true
    }

    train()

    return () => {
      cancelled = true
    }
  })
</script>

<div class="flex flex-col items-center justify-center py-16 text-center">
  {#if !done}
    <div class="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-green-500">
    </div>
    <h2 class="mb-2 text-xl font-semibold text-white">Training Model</h2>
    <p class="text-sm text-gray-500">{progress}</p>
  {:else}
    <div
      class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-xl
        text-black"
    >
      ✓
    </div>
    <h2 class="mb-2 text-xl font-semibold text-white">Model Ready</h2>
    <p class="text-sm text-gray-500">
      {wizardState.surfaces.length} surfaces — {totalSamples} total samples
    </p>

    <div class="mt-8 flex gap-3">
      <a
        href="{base}/train/record"
        class="rounded-lg border border-gray-700 px-5 py-2.5 text-sm text-gray-400
          transition-colors hover:border-gray-500"
      >
        ← Back to Record
      </a>
      <a
        href="{base}/train/try"
        class="rounded-lg bg-green-500 px-6 py-2.5 text-sm font-semibold text-black
          transition-colors hover:bg-green-400"
      >
        Try It →
      </a>
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/routes/train/train/+page.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 3: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/train/train/+page.svelte
git commit -m "feat(wizard): add Train step with model building progress"
```

---

## Task 12: Try It Step

**Files:**
- Create: `src/routes/train/try/+page.svelte`

- [ ] **Step 1: Create the Try It page**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import { startCapture } from '$lib/audio/capture'
  import type { AudioCapture } from '$lib/audio/capture'
  import { classify } from '$lib/classifier/knn'
  import { flattenFeatureVector } from '$lib/classifier/normalize'
  import SurfaceTile from '$lib/components/SurfaceTile.svelte'
  import { wizardState, reset } from '$lib/wizard/state.svelte'

  let capture: AudioCapture | null = $state(null)
  let error = $state<string | null>(null)
  let threshold = $state(0.6)

  // Per-surface flash state: { confidence, unrecognized, timeout }
  let tileStates: Record<string, { confidence: number | null; unrecognized: boolean }> = $state({})

  // Redirect if no model
  $effect(() => {
    if (!wizardState.model) {
      goto(`${base}/train/train`)
    }
  })

  // Initialize tile states
  $effect(() => {
    const states: typeof tileStates = {}
    for (const surface of wizardState.surfaces) {
      states[surface.name] = { confidence: null, unrecognized: false }
    }
    tileStates = states
  })

  // Start mic capture
  $effect(() => {
    let stopped = false
    const timeouts: ReturnType<typeof setTimeout>[] = []

    async function start() {
      try {
        error = null
        const c = await startCapture()
        if (stopped) {
          c.stop()
          return
        }
        capture = c

        capture.onHit((event) => {
          if (!wizardState.model) return
          const features = flattenFeatureVector(event.features)
          const result = classify(wizardState.model, features)

          if (!result || result.confidence < threshold) {
            // Flash unrecognized on all tiles briefly
            for (const surface of wizardState.surfaces) {
              tileStates[surface.name] = { confidence: null, unrecognized: true }
            }
            const t = setTimeout(() => {
              for (const surface of wizardState.surfaces) {
                tileStates[surface.name] = { confidence: null, unrecognized: false }
              }
            }, 300)
            timeouts.push(t)
            return
          }

          // Flash the matched surface
          tileStates[result.surface] = { confidence: result.confidence, unrecognized: false }
          const t = setTimeout(() => {
            tileStates[result.surface] = { confidence: null, unrecognized: false }
          }, 400)
          timeouts.push(t)
        })
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to access microphone'
      }
    }

    start()

    return () => {
      stopped = true
      capture?.stop()
      capture = null
      for (const t of timeouts) clearTimeout(t)
    }
  })

  function handleStartOver() {
    reset()
    goto(`${base}/train/setup`)
  }
</script>

<div class="text-center">
  <h2 class="mb-2 text-2xl font-semibold text-white">Try It!</h2>
  <p class="mb-8 text-sm text-gray-500">Hit your surfaces — see if the classifier recognizes them</p>

  {#if error}
    <div class="mb-6 rounded-lg bg-red-900/30 p-4 text-red-300">
      {error}
    </div>
  {/if}

  <div class="mb-8 flex flex-wrap justify-center gap-4">
    {#each wizardState.surfaces as surface}
      <SurfaceTile
        name={surface.name}
        confidence={tileStates[surface.name]?.confidence ?? null}
        unrecognized={tileStates[surface.name]?.unrecognized ?? false}
      />
    {/each}
  </div>

  <div class="mb-8">
    <label class="mb-2 block text-xs text-gray-500">
      Confidence threshold: {Math.round(threshold * 100)}%
    </label>
    <input
      type="range"
      min="0.3"
      max="0.9"
      step="0.05"
      bind:value={threshold}
      class="w-64 accent-green-500"
    />
  </div>

  <div class="flex justify-center gap-3">
    <a
      href="{base}/train/record"
      class="rounded-lg border border-gray-700 px-5 py-2.5 text-sm text-gray-400
        transition-colors hover:border-gray-500"
    >
      Retrain
    </a>
    <button
      class="rounded-lg border border-gray-700 px-5 py-2.5 text-sm text-gray-400
        transition-colors hover:border-gray-500"
      onclick={handleStartOver}
      type="button"
    >
      Start Over
    </button>
    <button
      class="cursor-not-allowed rounded-lg bg-gray-800 px-6 py-2.5 text-sm text-gray-500"
      disabled
      type="button"
    >
      Done
    </button>
  </div>
  <p class="mt-2 text-[11px] text-gray-600">Mapping coming in a future update</p>
</div>
```

- [ ] **Step 2: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/routes/train/try/+page.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 3: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/train/try/+page.svelte
git commit -m "feat(wizard): add Try It step with live classification demo"
```

---

## Task 13: Integration Verification

- [ ] **Step 1: Run all unit tests**

Run: `bun run test:unit -- --run`
Expected: All tests pass (wizard store + existing audio/classifier specs)

- [ ] **Step 2: Run type check**

Run: `bun run check`
Expected: No errors

- [ ] **Step 3: Run lint and format**

Run: `bun run format && bun run lint`
Expected: No errors

- [ ] **Step 4: Run build**

Run: `bun run build`
Expected: Static build succeeds. All wizard routes are pre-rendered.

Note: The build may fail on routes that require browser APIs (mic, AudioContext) at pre-render time. If so, any code that calls `startCapture()` must be guarded with `$effect` (which only runs in the browser) — this is already the case in the Record and Try It pages. If the build fails due to SSR issues, wrap browser-only imports with dynamic `import()` inside `$effect` blocks.

- [ ] **Step 5: Full manual smoke test**

Run: `bun dev`
Navigate to `http://localhost:5173`

Test the full flow:
1. Home → "New Kit" → Setup page
2. Setup: select 2 surfaces, name them "Desk" and "Book" → "Start Recording"
3. Record: grant mic permission, tap desk ~50+ times, switch to Book, tap ~50+ times
4. "Train Model" → Train page shows progress, then "Model Ready"
5. "Try It" → hit surfaces, verify correct tile lights up
6. Adjust confidence slider — low threshold should match more, high threshold should reject more
7. "Retrain" → back to Record with hits preserved
8. "Start Over" → back to Setup, clean slate

- [ ] **Step 6: Final commit if any fixes were needed**

Stage only the files that were modified to fix issues, then commit:

```bash
git commit -m "chore: fix integration issues from milestone 4"
```

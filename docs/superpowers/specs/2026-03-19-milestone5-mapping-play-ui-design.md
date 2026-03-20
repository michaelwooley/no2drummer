# Milestone 5: Mapping & Play UI — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Parent spec:** `docs/superpowers/specs/2026-03-19-no2drummer-design.md`

## Overview

Build the Mapping screen (`/map`) and Play screen (`/play`) with route guards, completing the app loop: train → map → play. The Mapping screen lets users pair trained surfaces with drum sounds via drag-and-drop. The Play screen provides real-time visual and audio feedback as users hit surfaces.

**Deliverable:** Complete UI for mapping surfaces to drum sounds and playing the drum kit in real time.

**Dependencies:** Milestone 2 (classifier), Milestone 3 (sound player), Milestone 4 (training wizard, home screen). This spec defines the interfaces consumed; implementation follows after M2-M4 land.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Dependency handling | Full spec now, implement after M2-M4 | Spec defines interfaces consumed; no stubs needed |
| Mapping interaction | Drag-and-drop with sound preview | Combines tactile interaction with audition capability |
| Drum pad grid | One tile per surface (2-4) | Surfaces are the primary identity; grid adapts to count |
| Lane stream | Essential, CSS-animated, 5s window | Core visual element; CSS transforms sufficient for hit density |
| Hit intensity encoding | Block height variation | Waveform-like feel; reads as "music" intuitively |
| Play controls | Visible control bar (top) | Confidence slider + Remap/Retrain always accessible for demo |
| Route guards | Yes, in `+page.ts` load functions | Prevents broken states; cheap to implement |
| Default mapping | Pre-filled + "Use defaults & play" shortcut | Power users skip; new users see the mapping first |

## Route Structure & Navigation

### Routes

```
/          — Home (M4 owns, M5 doesn't modify)
/train     — Training wizard (M4 owns)
/map       — Mapping screen (M5)
/play      — Play screen (M5)
```

### Navigation Guards

Guards live in `+page.ts` load functions:

- `/map` — requires a trained `ClassifierModel` in app state. If missing, redirect to `/`.
- `/play` — requires a mapping (surface → DrumId). If missing, redirect to `/map`. If no model either, redirect to `/`.

### State Flow Between Routes

```
/train → completes → passes ClassifierModel to /map
/map   → confirms  → passes ClassifierModel + mapping to /play
/play  → "Remap"   → navigates to /map (preserves model)
/play  → "Retrain" → navigates to /train (starts fresh)
```

### App-Level State

The `ClassifierModel` and mapping live in a shared Svelte 5 reactive store — a module-level `$state` in `src/lib/state/kit.ts`. Route guards read from this store. This avoids URL parameter complexity and works naturally with SvelteKit's client-side navigation.

```ts
import type { ClassifierModel } from '$lib/classifier/model'
import type { DrumId } from '$lib/player/samples'

interface KitState {
  model: ClassifierModel | null
  surfaceNames: string[]
  mapping: Record<string, DrumId> | null
  confidenceThreshold: number
}
```

### Handoff from M4 Wizard

M4's training wizard uses its own transient store (`src/lib/wizard/state.svelte.ts`) with `wizardState.model` and `wizardState.surfaces`. When the user completes the wizard (clicks "Done" on the Try It page), M5 must:

1. Copy `wizardState.model` → `kitState.model`
2. Copy `wizardState.surfaces.map(s => s.name)` → `kitState.surfaceNames`
3. Navigate to `/map`

This requires M5 to modify M4's Try It page (`src/routes/train/try/+page.svelte`) to enable the currently-disabled "Done" button and wire it to populate `KitState` before navigating. The wizard store remains transient — it resets on "Start Over" or when a new training session begins.

### Confidence Threshold

M4's Try It page has its own local `threshold` state (default 0.6) for the live classification demo. M5's `KitState.confidenceThreshold` (default 0.7) is independent — it is the play-mode threshold used in `/play`. The Try It threshold is not carried forward; the Play screen starts fresh at 0.7. Users can adjust the Play threshold via the control bar slider.

## Mapping Screen (`/map`)

### Layout

Two-column layout — surfaces on the left (drop targets), drum sounds on the right (draggable cards with preview buttons).

### Components

- **`MappingPage`** — page component, owns mapping state, renders grid + actions
- **`SurfaceDropZone`** — one per surface. Shows surface name (color-coded), assigned drum sound or "drop here" placeholder. Has ✕ button to unassign.
- **`DrumSoundCard`** — one per drum (kick/snare/hihat/cymbal). Draggable. Shows drum name + ▶ preview button. Dims when assigned, shows which surface it's mapped to.

### State

```ts
// Mapping state — surface name → DrumId
let mapping: Record<string, DrumId> = $state({})
```

Pre-filled with defaults on mount: first surface → snare, second → kick, third → hihat, fourth → cymbal.

### Default Mapping Order

| Surface Index | Default Drum Sound |
|---------------|-------------------|
| 1 | Snare |
| 2 | Kick |
| 3 | Hi-Hat |
| 4 | Cymbal |

### Interactions

| Action | Result |
|--------|--------|
| Drag sound onto surface | Assigns sound to surface. If sound was assigned elsewhere, unassigns from old surface first. |
| Click ▶ on sound card | Plays sound preview via `DrumPlayer.play()` |
| Click ✕ on surface | Unassigns the sound, card becomes available again |
| Click "Start Playing →" | Navigates to `/play` (enabled when all surfaces mapped) |
| Click "Use defaults & play" | Navigates to `/play` immediately with default mapping |

### Edge Cases

- **2 surfaces:** Two drop zones stacked vertically, all 4 sounds available
- **Duplicate mapping:** Not possible — dragging an already-assigned sound auto-unassigns it from the previous surface
- **"Start Playing" button:** Disabled until every surface has an assignment

## Play Screen (`/play`)

Three vertical sections — control bar (top), drum pad grid (middle), lane stream (bottom).

### Control Bar

Fixed at top. Contains:

- **Left:** "← Remap" button (navigates to `/map`, preserves model) and "Retrain" button (navigates to `/train`)
- **Right:** Confidence threshold slider (0.0–1.0, default 0.7) with numeric display

### Drum Pad Grid

Responsive grid of 2-4 tiles, one per surface:

| Surface Count | Layout |
|---------------|--------|
| 2 | Two tiles side by side |
| 3 | 2+1 grid (two on top, one spanning bottom) or 3-column row |
| 4 | 2×2 grid |

Each tile shows:

- **Drum sound name** (large, e.g., "Snare")
- **Surface name** below (smaller, e.g., "Desk")
- **Border color** matches the surface's assigned color

**Hit flash:** On classified hit, tile fills with its surface color and fades back over ~150ms using a CSS transition. Quick successive hits re-trigger the flash.

### Lane Stream

Below the pad grid. One horizontal lane per surface, stacked vertically.

- **Lane label:** Left-aligned, color-coded, showing drum sound name (e.g., "Snare" in blue). The pad grid already shows both drum sound and surface name, so the lane label keeps just the drum name for compactness.
- **Lane track:** Dark background, fixed height (~32px)
- **Hit blocks:** Appear at right edge on each hit, scroll left via CSS `transform: translateX()`, 5-second total travel
- **Block height:** Proportional to hit intensity within the lane (soft = short, hard = full height). Blocks are bottom-aligned.
- **Block fade:** Opacity decreases linearly as blocks age (1.0 at right edge → ~0.15 at left edge before removal)
- **Block width:** Fixed ~6px
- **Block color:** Matches the surface color

**Lifecycle of a hit block:**

1. Classification result arrives with confidence above threshold
2. Block element created at right edge of the correct lane
3. CSS animation: `translateX(0) → translateX(-100%)` over 5s, with opacity `1 → 0.15`
4. Element removed from DOM after animation completes

### Audio Pipeline Integration

The Play screen wires up the full pipeline:

```
AudioCapture.onHit(hitMessage)
  → flattenFeatureVector(hitMessage.features)
  → classify(model, flatFeatures)
  → if result && result.confidence >= threshold:
      → look up mapping[result.surface] → drumId
      → DrumPlayer.play(drumId, hitMessage.intensity)
      → flash pad tile for result.surface
      → add hit block to lane for result.surface
```

This runs on every `WorkletHitMessage` from the audio worklet.

## Surface Colors

Each surface has a consistent color across the pad border, lane label, hit blocks, and mapping UI. Colors are assigned by surface index when `KitState` is populated during the M4→M5 handoff (not during training).

| Surface Index | Color | Hex |
|---------------|-------|-----|
| 1 | Blue | `#4a9eff` |
| 2 | Red | `#ff6b6b` |
| 3 | Yellow | `#ffd93d` |
| 4 | Green | `#6bcb77` |

Defined once in `src/lib/constants/colors.ts` and referenced by all components. M4's wizard UI uses a single green accent throughout — per-surface colors are an M5 concern only.

## File Structure

```
src/lib/state/
└── kit.ts                    — Shared app state (model, mapping, surfaces)

src/lib/constants/
└── colors.ts                 — Surface color palette

src/lib/components/mapping/
├── MappingPage.svelte        — Page layout, owns mapping state
├── SurfaceDropZone.svelte    — Drop target for a surface
└── DrumSoundCard.svelte      — Draggable sound card with preview

src/lib/components/play/
├── PlayPage.svelte           — Page layout, wires audio pipeline
├── ControlBar.svelte         — Remap/Retrain buttons + confidence slider
├── DrumPadGrid.svelte        — Responsive grid of pad tiles
├── DrumPad.svelte            — Single pad tile with flash animation
├── LaneStream.svelte         — Container for all lanes
└── HitLane.svelte            — Single lane with scrolling hit blocks

src/routes/map/
├── +page.svelte              — Route entry, renders MappingPage
└── +page.ts                  — Load function with guard (requires model)

src/routes/play/
├── +page.svelte              — Route entry, renders PlayPage
└── +page.ts                  — Load function with guard (requires mapping)

src/routes/train/try/
└── +page.svelte              — MODIFY: enable "Done" button, wire to KitState → /map
```

**M4 modification:** The Try It page (`src/routes/train/try/+page.svelte`) currently has a disabled "Done" button with placeholder text. M5 enables this button to copy the model and surface names into `KitState` and navigate to `/map`.

**Component boundaries:**

- `MappingPage` and `PlayPage` are the "smart" components that own state and wire integrations
- Everything else is presentational — receives props, emits events
- All components are independently storybook-able via props

## Testing Strategy

### Component Tests (Vitest client project, `*.svelte.{test,spec}.ts`)

- `DrumPad` — renders with props, flash class applied/removed on hit trigger
- `HitLane` — hit blocks appear and have correct height based on intensity
- `SurfaceDropZone` — renders assigned vs unassigned states
- `DrumSoundCard` — renders available vs dimmed states, fires preview event on ▶ click
- `ControlBar` — slider updates threshold value, buttons fire navigation events
- `DrumPadGrid` — adapts grid layout for 2, 3, 4 surfaces

### Unit Tests (Vitest server project, `*.spec.ts`)

- `kit.ts` state helpers — default mapping generation, guard logic (has model, has mapping)
- Color assignment by index

### Storybook Stories (every component)

- `DrumPad.stories.svelte` — idle, hit flash, each surface color
- `HitLane.stories.svelte` — empty, sparse hits, dense hits, varying intensities
- `LaneStream.stories.svelte` — 2-4 lanes
- `DrumPadGrid.stories.svelte` — 2, 3, 4 surface variants
- `SurfaceDropZone.stories.svelte` — empty, assigned
- `DrumSoundCard.stories.svelte` — available, assigned/dimmed
- `ControlBar.stories.svelte` — default state
- `MappingPage.stories.svelte` — full mapping screen
- `PlayPage.stories.svelte` — full play screen with simulated hits

### E2E Tests (Playwright, `*.e2e.ts`)

- Navigate to `/play` without model → redirected to `/`
- Navigate to `/play` without mapping → redirected to `/map`
- Mapping: assign all surfaces, click "Start Playing", arrive at `/play`
- Mapping: click "Use defaults & play", arrive at `/play`

### Not Tested Automatically

- Real audio pipeline, actual drag-and-drop browser interactions (covered by manual testing), real sound playback

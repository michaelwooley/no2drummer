# Milestone 4: Training Wizard UI — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Parent spec:** `docs/superpowers/specs/2026-03-19-no2drummer-design.md`

## Overview

Milestone 4 adds the Training Wizard — a guided multi-step flow that walks the user through recording surface hits, building a classifier, and verifying it works. This is the first real UI beyond the debug page.

**Deliverable:** Full training flow works through the UI, ending with a live "Try It" demo where classified hits light up corresponding surface tiles.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| M2/M3 dependency | Design against interfaces, stub until implemented | M2/M3 interfaces are well-defined. UI is independently testable with mocks. |
| Wizard navigation | Linear with back button | Forward-only is frustrating. Back to Setup resets downstream. Back to Record preserves recordings. |
| Home screen | Included, "Load Saved" disabled | Establishes route structure. Button becomes functional when M6 lands. |
| Post-training experience | "Try It" live classification demo | Most satisfying deliverable — user sees classifier working immediately. No sound needed (M3). |
| Hits per surface | Progress bar to 100, proceed-able at 50 | M2 spec assumes 50-150 samples per surface for reliable classification. |
| Visual style | Dark & minimal, green accents | Music production tool feel. Focused, low-distraction. Consistent with debug page. |
| Routing | Route-per-step with shared store | Each step is its own route under `/train/`. Shared wizard store holds state. |
| Mic permission | Inline on Record step, no dedicated step | Browser's native permission prompt appears naturally on `getUserMedia`. Failure handled inline. |
| Surface count | 2-4 surfaces | M2 spec assumes 3-4 but classifier works fine with 2. Lower barrier to entry. |
| Training accuracy display | None — "Try It" step IS the accuracy test | KNN is a lazy learner with no training-time accuracy metric. Cross-validation adds complexity for questionable value. |

### Divergences from parent spec

- **No separate mic permission step.** The parent spec lists 5 wizard steps (Setup, Mic Permission, Record, Train, Done). We merge mic permission into the Record step and replace "Done" with "Try It", yielding 4 steps: Setup → Record → Train → Try It.
- **50-150 hits per surface instead of 15.** The parent spec says "minimum 15 hits." The M2 classification spec assumes 50-150 per surface for reliable classification. We use 50 as the minimum, 100 as the target.
- **"Try It" replaces "Done → proceed to mapping."** Mapping is Milestone 5. Instead of a dead-end success screen, the user drops into a live classification demo that proves the kit works.

## Routes

```
/              — Home (New Kit / Load Saved disabled)
/train/setup   — Choose surface count (2-4), name each surface
/train/record  — Record hits per surface, one at a time
/train/train   — Build classifier, show progress
/train/try     — Live classification demo
```

## Screen Designs

### Home (`/`)

Minimal landing page:

- App title "No. 2 Drummer"
- **"New Kit"** button — navigates to `/train/setup`, calls `reset()` on wizard store
- **"Load Saved Kit"** button — disabled, "Coming soon" label. Becomes functional in M6.
- Dark background consistent with wizard style

### Setup (`/train/setup`)

- **Surface count selector** — 2, 3, or 4 as radio-style toggle buttons. Default: 3.
- **Surface name inputs** — text fields for each surface, pre-filled with defaults ("Surface 1", "Surface 2", etc.). User can rename freely.
- **"Start Recording →"** button — enabled when at least 2 surfaces have non-empty names. Navigates to `/train/record`.
- **"← Back"** button — returns to `/`.
- Step indicator at top: **Setup** → Record → Train → Try It

### Record (`/train/record`)

The core of the wizard. User records hits one surface at a time.

**Layout:**
- Step indicator at top
- Headline: "Hit the **{surface name}**" with surface name in green
- Subtitle: "Tap repeatedly with your pencil — aim for 100 hits"
- **Hit counter** — large circular element, shows current count, flashes green on each detected hit
- **Progress bar** — fills to 100, with a marker at 50 labeled "min: 50"
- **Surface dots** — one per surface, showing name and hit count. Clickable to switch which surface is being recorded. Active surface is highlighted with green border and glow. Completed surfaces (≥50 hits) show green. Pending surfaces are dimmed.

**Controls:**
- **"← Back"** — returns to `/train/setup`. Shows confirmation: "This will clear all recordings."
- **"Skip to Next Surface"** — advances to next surface with <50 hits, or cycles
- **"Train Model →"** — enabled only when ALL surfaces have ≥50 hits. Navigates to `/train/train`.

**Mic behavior:**
- `startCapture()` called on mount. Requests permission if not yet granted.
- If denied: inline error with instructions and "Try Again" button.
- `onHit()` callback feeds FeatureVectors into wizard store for the current surface.
- Capture stays alive while on this page — switching surfaces just changes storage target.
- Capture stopped on navigation away. Restarted if user returns.

### Train (`/train/train`)

Automated model building step.

**Flow:**
1. On entering, immediately builds model by calling `addSample()` for each recorded hit across all surfaces
2. Shows progress: "Processing surface 1 of 3..."
3. On completion: summary showing number of surfaces and total samples, "ready" confirmation
4. Minimum display time of ~500ms so the step doesn't feel instantaneous

**Controls:**
- **"← Back"** — returns to `/train/record` with all recordings preserved
- **"Try It →"** — navigates to `/train/try`

### Try It (`/train/try`)

Live classification demo. Mic is active, hits are classified in real time.

**Layout:**
- One tile per surface, arranged horizontally
- Each tile shows the surface name
- On classified hit: matching tile flashes green with confidence percentage
- Hits below confidence threshold: brief "?" flash (unrecognized) rather than silent ignore
- **Confidence threshold slider** at bottom (default 0.6, range 0.3–0.9)

**Controls:**
- **"Retrain"** — goes to `/train/record` with recordings preserved
- **"Start Over"** — goes to `/train/setup`, resets everything
- **"Done"** — disabled placeholder ("Mapping coming in a future update"). Routes to `/map` when M5 lands.

## Wizard Store

Shared state module at `src/lib/wizard/state.svelte.ts` using Svelte 5 module-level `$state`.

### State Shape

```ts
interface SurfaceConfig {
  name: string
}

interface WizardStore {
  surfaces: SurfaceConfig[]
  recordings: Record<string, FeatureVector[]>
  currentSurfaceIndex: number
  model: ClassifierModel | null
  step: 'setup' | 'record' | 'train' | 'try'
}
```

### Mutation Functions

- **`reset()`** — clear everything to initial state
- **`setSurfaces(surfaces)`** — set surface configs, clear recordings
- **`addRecording(surface, featureVector)`** — append a hit to a surface's recordings
- **`setCurrentSurface(index)`** — switch which surface is being recorded
- **`buildModel()`** — iterate all recordings, call `addSample()` for each, store result in `model`
- **`getRecordingCount(surface)`** — convenience for progress UI
- **`canProceedToTrain()`** — true when all surfaces have ≥50 hits
- **`canProceedFromSetup()`** — true when ≥2 surfaces have non-empty names

### Why Store Raw FeatureVectors

Recordings store raw `FeatureVector` arrays rather than calling `addSample()` incrementally. Two reasons: (1) the Train step can show progress as it processes them, and (2) if the user goes back to Record and adds more hits, the model is rebuilt from scratch with all recordings — cleaner than incremental updates.

## Route Guards

Each step's `+page.svelte` checks prerequisites on mount and redirects if not met:

- `/train/record` → redirects to `/train/setup` if no surfaces configured
- `/train/train` → redirects to `/train/record` if not all surfaces have ≥50 hits
- `/train/try` → redirects to `/train/train` if no model built

Simple `if` checks + `goto()` in an `$effect`, no layout-level guard logic.

## File Structure

```
src/lib/wizard/
  state.svelte.ts           — Shared wizard store

src/lib/components/
  StepIndicator.svelte      — Step progress bar (Setup → Record → Train → Try It)
  SurfaceDot.svelte         — Clickable surface indicator with name and count
  HitCounter.svelte         — Large circular hit counter with flash animation
  ProgressBar.svelte        — Progress bar with min/target markers
  SurfaceTile.svelte        — Tile that flashes on classification result

src/routes/
  +page.svelte              — Home screen
  train/
    +layout.svelte          — Step indicator (shared across train routes)
    setup/+page.svelte      — Surface count + naming
    record/+page.svelte     — Hit recording with mic capture
    train/+page.svelte      — Model building + progress
    try/+page.svelte        — Live classification demo
```

**`train/+layout.svelte`** renders the step indicator across all wizard routes, avoiding duplication. The wizard store is a module-level `$state` import, not context — any route can import it directly.

## Testing Strategy

### Component Tests (Vitest client project, `*.svelte.spec.ts`)

- `StepIndicator` — renders correct step as active, marks completed steps
- `HitCounter` — displays count, triggers flash animation class
- `ProgressBar` — correct fill width, min marker position
- `SurfaceDot` — shows name/count, fires click event, active/inactive states
- `SurfaceTile` — flashes on classification, shows confidence

### Unit Tests (Vitest server project, `*.spec.ts`)

- Wizard store — `reset()`, `setSurfaces()`, `addRecording()`, `buildModel()`, `canProceedToTrain()`
- Route guard logic — if extracted to pure functions

### Storybook Stories (Svelte CSF)

- Each reusable component gets stories showing its states (empty, in-progress, complete, error)
- Record step gets a story with mocked hit events
- Try It step gets a story with mocked classification results

### E2E Tests (Playwright)

- Happy path: Home → Setup (3 surfaces) → Record (simulated hits via mocked audio) → Train → Try It
- Back navigation: Record → Setup resets state, Train → Record preserves recordings

### Not Tested Automatically

Real mic input, actual hit detection accuracy — same strategy as Milestone 1.

## Dependencies

- **Consumes from Milestone 1:** `startCapture()`, `AudioCapture.onHit()`, `FeatureVector` type
- **Consumes from Milestone 2:** `createModel()`, `addSample()`, `classify()`, `ClassifierModel` type, `ClassificationResult` type (stubbed until M2 implemented)
- **Consumed by Milestone 5:** Route structure (`/train/*`), wizard store (M5 adds `/map` and `/play` routes), `SurfaceTile` component
- **Consumed by Milestone 6:** Wizard store's model (IndexedDB persistence wraps the trained model)

# Milestone 6: Persistence & Polish — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Parent spec:** `docs/superpowers/specs/2026-03-19-no2drummer-design.md`

## Overview

Milestone 6 adds IndexedDB persistence for trained kits, a kit management flow on the home screen, comprehensive error handling, and visual polish to bring the app to demo-ready quality.

**Deliverable:** App state persists between sessions. Users can save multiple kits, load any saved kit, and delete kits they no longer need. Error states are handled gracefully. Layout is responsive and visually consistent.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage library | `idb` (~1KB gzipped) | Wraps IndexedDB with typed Promises. Raw IndexedDB API is callback-heavy and error-prone. Tiny footprint. |
| Test library | `fake-indexeddb` (dev dep) | Full IndexedDB implementation in Node. Standard approach for testing IndexedDB code in Vitest. |
| Kit count | Multiple kits | Parent spec deferred this, but the schema cost is near-zero and the UX improvement is significant. |
| Save strategy | Always create new | Every completed wizard flow creates a new kit. Avoids accidental overwrite. Old kits remain until explicitly deleted. |
| Settings update | Overwrite in-place | Confidence threshold slider on `/play` updates the current kit's settings without creating a new kit. |
| Raw recordings | Not persisted | Consistent with M4 wizard store design and parent spec. Retraining requires re-recording. |
| Storage structure | Single object store | Model, mappings, and settings are embedded in one `SavedKit` record. They're always loaded/saved together. |
| Schema versioning | Version 1 with upgrade path | `idb`'s `upgrade` callback handles future migrations cleanly. |
| Browser support check | Root layout gate | Single check on app mount blocks the entire app if required APIs are missing. |
| Polish scope | CSS-only, no animation library | Transitions, loading states, responsive breakpoints. No Framer Motion / GSAP. |

### Divergences from parent spec

- **Multiple kits instead of single kit.** The parent spec lists "Multiple saved kits" as a future enhancement. We include it because the storage schema already supports it (keyed by `id`) and the home screen needs a list UI regardless — a single-kit "Load" button with no context is a worse UX than showing the kit name and date.

## Data Model

### SavedKit

```ts
interface SavedKit {
  /** Unique identifier, generated via crypto.randomUUID() */
  id: string
  /** User-provided or auto-generated name (e.g., "Kit — Mar 19, 2026") */
  name: string
  /** Date.now() at creation */
  createdAt: number
  /** Date.now() at last save (updated when settings change) */
  updatedAt: number
  /** Surface names from training (e.g., ['Desk', 'Book', 'Bottle']) */
  surfaceNames: string[]
  /** Trained KNN classifier model */
  model: ClassifierModel
  /** Surface name → drum sound mapping */
  mappings: Record<string, DrumId>
  /** User-tunable settings */
  settings: KitSettings
}

interface KitSettings {
  /** Confidence threshold for classification (0.3–0.9, default 0.6) */
  confidenceThreshold: number
}
```

**Why `surfaceNames` is stored explicitly:** It's derivable from `model.surfaces`, but storing it directly makes it easy to display in the kit list and to carry into the wizard store when retraining — without parsing the model.

**Why `ClassifierModel` is stored as a structured object:** IndexedDB handles structured cloning natively. No need to JSON-serialize via `serializeModel`/`deserializeModel` — those remain useful for future export/import features but aren't needed for IndexedDB.

### IndexedDB Schema

- **Database name:** `'no2drummer'`
- **Version:** `1`
- **Object store:** `'kits'` with key path `'id'`
- **No indexes needed** — kit count will be small (single digits). Full scan via `getAll()` is fine for `listKits()`.

## Storage API

Single module at `src/lib/storage/db.ts`:

```ts
/** Save a kit (creates or overwrites by id). */
function saveKit(kit: SavedKit): Promise<void>

/** Load a kit by id. Returns null if not found. */
function loadKit(id: string): Promise<SavedKit | null>

/** Delete a kit by id. No-op if not found. */
function deleteKit(id: string): Promise<void>

/** List all kits (summary fields only), sorted by updatedAt descending. */
function listKits(): Promise<Array<{
  id: string
  name: string
  updatedAt: number
  surfaceNames: string[]
}>>

/** Check if any saved kit exists (for home screen button state). */
function hasAnySavedKit(): Promise<boolean>
```

`listKits()` loads all records via `getAll()` and projects to summary fields in JS. For the expected kit count (single digits), this is efficient. No separate summary store needed.

Types (`SavedKit`, `KitSettings`) are exported from `db.ts` alongside the functions.

## Integration Points

### 1. Save — Wizard completion

When the user finishes the mapping screen (`/map`) and proceeds to `/play`:

1. Generate `id` via `crypto.randomUUID()`
2. Build `SavedKit` from wizard store state (model, surface names) + mapping state + default settings
3. Kit name: auto-generated as `"Kit — {formatted date}"` (can be edited later if we add that feature)
4. Call `saveKit(kit)` — fire-and-forget, show toast on failure
5. Store the kit `id` in a `currentKitId` variable so settings updates can target it

### 2. Settings update — Play screen slider

The confidence threshold slider on `/play` updates in-memory state immediately for responsiveness. A debounced `saveKit()` call (300ms) writes the updated settings to IndexedDB, targeting the current kit by `id`. This is the one case where we overwrite rather than create.

### 3. Load — Home screen

- On mount, call `listKits()` to populate the kit list
- Each kit row shows: name, surface count (from `surfaceNames.length`), relative date
- "Load" action: call `loadKit(id)`, populate wizard store via `loadFromKit(kit)`, navigate to `/play`
- "Delete" action: confirmation dialog ("Delete {name}? This can't be undone."), call `deleteKit(id)`, refresh list

### 4. Wizard store addition

A new function in `src/lib/wizard/state.svelte.ts`:

```ts
function loadFromKit(kit: SavedKit): void
```

Sets `surfaces` from `kit.surfaceNames`, sets `model` from `kit.model`, clears `recordings` (raw recordings aren't persisted), resets `currentSurfaceIndex`. Also stores mappings and settings so the play screen and map screen can access them.

**Note on M5 dependency:** M5 may introduce a separate state module for the play/map screens (distinct from the wizard store). If so, `loadFromKit()` should target whatever state the play screen reads from. The current spec assumes the wizard store is the shared source of truth (consistent with M4). If M5 introduces a different state architecture, this integration point should be updated to match — the storage API itself is unaffected.

## Kit Lifecycle

### New kit
Home → `/train/setup` → `/train/record` → `/train/train` → `/train/try` → `/map` → `/play` (auto-saves new kit)

### Load existing kit
Home → pick kit from list → `/play` (kit loaded into wizard store)

### Revise mappings
`/play` → "Remap" → `/map` (current mappings pre-filled) → `/play` (saves as **new** kit, old kit remains)

### Retrain
`/play` → "Retrain" → `/train/record` (surface names carried over, recordings empty) → `/train/train` → `/train/try` → `/map` → `/play` (saves as **new** kit with auto-generated name, e.g., "Kit — Mar 19, 2026 (2)")

### Delete
Home → delete button on kit row → confirmation → kit removed from IndexedDB

## Error States

### Mic denied

- **Where:** `/train/record` and `/train/try` (the only pages that call `startCapture()`)
- **Detection:** Catch `NotAllowedError` from `getUserMedia`
- **UI:** Inline error banner: "Microphone access denied. Check your browser's site settings to re-enable it." with a "Try Again" button that retries `startCapture()`
- **Existing state:** M4's Record step already catches errors from `startCapture()`. M6 improves the error message specificity.

### Browser unsupported

- **Where:** Root layout (`src/routes/+layout.svelte`)
- **Detection:** Check on mount for required APIs:
  - `navigator.mediaDevices?.getUserMedia`
  - `window.AudioContext || window.webkitAudioContext`
  - `window.AudioWorklet`
  - `window.indexedDB`
- **UI:** Full-page fallback replacing all app content: "Your browser doesn't support the audio features this app needs. Please use a recent version of Chrome, Firefox, or Edge."
- **Rationale:** No point showing a training wizard if the mic or storage won't work. Gate early.

### No saved kit

- **Home screen:** If `listKits()` returns empty, the kit list area shows "No saved kits yet. Create one to get started!" — not an error, just an empty state.
- **Direct URL to `/play`:** If no kit is loaded in the wizard store, redirect to `/` with a query param `?reason=no-kit` that triggers a brief toast: "No kit loaded."

### Storage errors

- **Save failure:** Toast notification: "Failed to save kit." Non-blocking — user can continue playing.
- **Load failure:** Inline error on home screen: "Failed to load kit. Try again or create a new one."
- **Delete failure:** Inline error on home screen: "Failed to delete kit."

## Visual Polish

### Consistent dark theme

Audit all screens for consistent use of:
- Background: `bg-gray-950` (page) / `bg-gray-900` (cards) / `bg-gray-800` (inputs, secondary surfaces)
- Text: `text-white` (primary) / `text-gray-400` (secondary) / `text-gray-500` (tertiary)
- Accents: `text-green-400` / `bg-green-500` (active, success) / `text-red-400` (errors)

The debug page and M4 wizard already establish this palette. M6 audits the remaining screens (home, map, play) for consistency.

### Page transitions

Subtle fade transition between wizard steps. CSS-only using Svelte's `transition:` directive or a shared transition wrapper. No animation library.

### Hit flash animations

Play screen tiles and lane stream blocks get smooth CSS animations (`@keyframes`) for hit feedback rather than abrupt class toggling.

### Loading states

- "Load Saved Kit" → spinner during `loadKit()` call
- Kit deletion → spinner on the delete button during `deleteKit()` call
- No other loading states needed (Train step already has progress from M4)

### Responsive layout

Breakpoints using Tailwind's `sm:` (640px) and `md:` (768px):

- **Home screen:** Kit list stacks vertically (already works). Proper centering on all sizes.
- **Wizard steps:** Step indicator shrinks gracefully. Surface dots and inputs wrap on narrow screens.
- **Map screen:** Grid adjusts columns: 1 column on mobile, 2 on tablet+.
- **Play screen:** Drum pad grid goes from horizontal row to 2×2 grid on mobile. Lane stream narrows but stays horizontal.

### Empty states

- Home with no kits: Helpful prompt text
- Play screen before first hit: Brief instructional text ("Hit a surface to start playing")

## File Structure

```
src/lib/storage/
  db.ts             — IndexedDB wrapper: saveKit, loadKit, deleteKit, listKits, hasAnySavedKit
  db.spec.ts        — Unit tests using fake-indexeddb
```

All other changes are modifications to existing files:
- `src/lib/wizard/state.svelte.ts` — add `loadFromKit()`, add mappings/settings to state
- `src/routes/+page.svelte` — kit list UI, load/delete actions
- `src/routes/+layout.svelte` — browser support check
- `src/routes/play/+page.svelte` — settings persistence, retrain/remap navigation
- `src/routes/map/+page.svelte` — save on proceed to play
- Various components — polish pass (theme consistency, transitions, responsive)

## Testing Strategy

### Unit Tests (Vitest, server project)

- `db.spec.ts` — save/load/delete/list round-trips using `fake-indexeddb`. Test: save and load, list ordering, delete removes, hasAnySavedKit, load nonexistent returns null, overwrite by id (for settings updates).
- `state.spec.ts` — add tests for `loadFromKit()`: sets surfaces, model, clears recordings, sets mappings/settings.

### Component Tests (Vitest, client project)

- Home screen kit list: renders kit names, fires load/delete events
- Delete confirmation dialog: confirm/cancel behavior
- Browser unsupported fallback: renders when APIs are missing (mock `navigator`)

### E2E Tests (Playwright)

- Happy path: train → map → play → refresh page → home shows saved kit → load → play works
- Delete flow: save kit → delete from home → list is empty
- Multiple kits: complete wizard twice → home shows two kits
- Settings persistence: change threshold → refresh → threshold preserved

### Not Tested Automatically

- Real IndexedDB quota limits (won't hit them with kit-sized data)
- Visual polish (manual review)
- Responsive breakpoints (manual or Playwright viewport tests if warranted)

## Dependencies

- **Consumes from M1:** `FeatureVector` type (indirectly via M2's `ClassifierModel`)
- **Consumes from M2:** `ClassifierModel` type, serialization functions (not used for IndexedDB but re-exported for future export/import)
- **Consumes from M3:** `DrumId` type (for mappings)
- **Consumes from M4:** Wizard store (`state.svelte.ts`), wizard routes, components
- **Consumes from M5:** Mapping screen (`/map`), play screen (`/play`), confidence threshold slider
- **New dependency:** `idb` (runtime, ~1KB gzipped), `fake-indexeddb` (dev only)

# Milestone 6: Persistence & Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add IndexedDB persistence for trained kits (save, load, delete, list), integrate persistence into the existing UI flow, add error handling (mic denied, browser unsupported), and polish the app for demo quality.

**Architecture:** A pure TypeScript storage module (`src/lib/storage/db.ts`) wraps IndexedDB via the `idb` library. Kit state integration adds `loadKitIntoState()` to the existing `KitState` store and `prepareRetrain()` to the wizard store. The home screen gets a kit list replacing the disabled "Load Saved Kit" button. Save triggers fire on map→play transitions. Error handling adds a browser support gate in the root layout and improves mic error messages. Polish covers theme consistency, transitions, responsive layout, and loading states.

**Tech Stack:** TypeScript, `idb` (~1KB), `fake-indexeddb` (dev), SvelteKit, Svelte 5 runes, TailwindCSS v4, Vitest (server project)

**Spec:** `docs/superpowers/specs/2026-03-19-milestone6-persistence-polish-design.md`

---

## File Structure

```
src/lib/storage/
  db.ts             — SavedKit/KitSettings types + IndexedDB wrapper functions
  db.spec.ts        — Unit tests using fake-indexeddb

Modifications to existing files:
  src/lib/state/kit.svelte.ts        — add currentKitId, loadKitIntoState()
  src/lib/state/kit.spec.ts          — add tests for loadKitIntoState()
  src/lib/wizard/state.svelte.ts     — add prepareRetrain()
  src/lib/wizard/state.spec.ts       — add tests for prepareRetrain()
  src/lib/components/mapping/MappingPage.svelte  — add saveKit() call on navigate to /play
  src/lib/components/play/PlayPage.svelte        — debounced settings persistence, retrain route change
  src/routes/+page.svelte            — kit list UI replacing disabled button
  src/routes/+layout.svelte          — browser support check
  src/routes/play/+page.svelte       — pass ?reason=no-kit on redirect
```

**Dependency order:** Install deps (Task 1) → Storage module (Tasks 2-3) → State integration (Tasks 4-5) → UI wiring (Tasks 6-8) → Error handling (Task 9) → Polish (Task 10) → Verification (Task 11).

**Existing dependencies (all implemented):**
- `src/lib/state/kit.svelte.ts` — `kitState`, `setModel()`, `setMapping()`, `setThreshold()`, `resetKit()`
- `src/lib/wizard/state.svelte.ts` — `wizardState`, `setSurfaces()`, `reset()`
- `src/lib/classifier/model.ts` — `ClassifierModel` type
- `src/lib/player/samples.ts` — `DrumId` type
- `src/lib/components/mapping/MappingPage.svelte` — `handleStartPlaying()`, `handleUseDefaults()`
- `src/lib/components/play/PlayPage.svelte` — `handleRetrain()`, `handleThresholdChange()`
- `src/routes/+page.svelte` — home screen with disabled "Load Saved Kit" button
- `src/routes/+layout.svelte` — root layout, renders `{@render children()}`

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install idb and fake-indexeddb**

Run: `bun add idb && bun add -D fake-indexeddb`

- [ ] **Step 2: Verify installation**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add idb and fake-indexeddb dependencies"
```

---

## Task 2: Storage Module — Types and Core Operations

**Files:**
- Create: `src/lib/storage/db.ts`
- Create: `src/lib/storage/db.spec.ts`

- [ ] **Step 1: Write failing tests for saveKit and loadKit**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { saveKit, loadKit, deleteKit, listKits, hasAnySavedKit } from './db';
import type { SavedKit } from './db';
import type { ClassifierModel } from '$lib/classifier/model';

function makeMockModel(): ClassifierModel {
  return {
    surfaces: {
      Desk: [{ surface: 'Desk', features: new Array(16).fill(1) }],
      Book: [{ surface: 'Book', features: new Array(16).fill(2) }]
    },
    normalization: { mean: new Array(16).fill(0), std: new Array(16).fill(1) }
  };
}

function makeKit(overrides: Partial<SavedKit> = {}): SavedKit {
  return {
    id: 'test-id-1',
    name: 'Test Kit',
    createdAt: 1000,
    updatedAt: 1000,
    surfaceNames: ['Desk', 'Book'],
    model: makeMockModel(),
    mapping: { Desk: 'snare', Book: 'kick' },
    settings: { confidenceThreshold: 0.7 },
    ...overrides
  };
}

describe('storage', () => {
  beforeEach(() => {
    // Clear IndexedDB between tests
    indexedDB = new IDBFactory();
  });

  describe('saveKit and loadKit', () => {
    it('saves and loads a kit by id', async () => {
      const kit = makeKit();
      await saveKit(kit);
      const loaded = await loadKit('test-id-1');

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe('test-id-1');
      expect(loaded!.name).toBe('Test Kit');
      expect(loaded!.surfaceNames).toEqual(['Desk', 'Book']);
      expect(loaded!.mapping).toEqual({ Desk: 'snare', Book: 'kick' });
      expect(loaded!.settings.confidenceThreshold).toBe(0.7);
    });

    it('returns null for nonexistent id', async () => {
      const loaded = await loadKit('does-not-exist');
      expect(loaded).toBeNull();
    });

    it('overwrites when saving with same id', async () => {
      await saveKit(makeKit({ updatedAt: 1000 }));
      await saveKit(makeKit({ updatedAt: 2000 }));
      const loaded = await loadKit('test-id-1');

      expect(loaded!.updatedAt).toBe(2000);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run --project server src/lib/storage/db.spec.ts`
Expected: FAIL — `saveKit` and `loadKit` not found

- [ ] **Step 3: Implement types and core operations**

```ts
import { openDB as idbOpenDB, type IDBPDatabase } from 'idb';
import type { ClassifierModel } from '$lib/classifier/model';
import type { DrumId } from '$lib/player/samples';

export interface KitSettings {
  confidenceThreshold: number;
}

export interface SavedKit {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  surfaceNames: string[];
  model: ClassifierModel;
  mapping: Record<string, DrumId>;
  settings: KitSettings;
}

const DB_NAME = 'no2drummer';
const DB_VERSION = 1;
const KITS_STORE = 'kits';

function openDB(): Promise<IDBPDatabase> {
  return idbOpenDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(KITS_STORE)) {
        db.createObjectStore(KITS_STORE, { keyPath: 'id' });
      }
    }
  });
}

export async function saveKit(kit: SavedKit): Promise<void> {
  const db = await openDB();
  await db.put(KITS_STORE, kit);
}

export async function loadKit(id: string): Promise<SavedKit | null> {
  const db = await openDB();
  const result = await db.get(KITS_STORE, id);
  return (result as SavedKit) ?? null;
}

export async function deleteKit(id: string): Promise<void> {
  const db = await openDB();
  await db.delete(KITS_STORE, id);
}

export async function listKits(): Promise<
  Array<{ id: string; name: string; updatedAt: number; surfaceNames: string[] }>
> {
  const db = await openDB();
  const all = (await db.getAll(KITS_STORE)) as SavedKit[];
  return all
    .map((kit) => ({
      id: kit.id,
      name: kit.name,
      updatedAt: kit.updatedAt,
      surfaceNames: kit.surfaceNames
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function hasAnySavedKit(): Promise<boolean> {
  const db = await openDB();
  const count = await db.count(KITS_STORE);
  return count > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- --run --project server src/lib/storage/db.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/db.ts src/lib/storage/db.spec.ts
git commit -m "feat(storage): add IndexedDB storage module with saveKit and loadKit"
```

---

## Task 3: Storage Module — Delete, List, HasAny

**Files:**
- Modify: `src/lib/storage/db.spec.ts`

- [ ] **Step 1: Add tests for deleteKit, listKits, hasAnySavedKit**

Append inside the existing `describe('storage')` block:

```ts
  describe('deleteKit', () => {
    it('removes a kit by id', async () => {
      await saveKit(makeKit());
      await deleteKit('test-id-1');
      const loaded = await loadKit('test-id-1');

      expect(loaded).toBeNull();
    });

    it('is a no-op for nonexistent id', async () => {
      await expect(deleteKit('nope')).resolves.toBeUndefined();
    });
  });

  describe('listKits', () => {
    it('returns empty array when no kits', async () => {
      const list = await listKits();
      expect(list).toEqual([]);
    });

    it('returns summary fields sorted by updatedAt descending', async () => {
      await saveKit(makeKit({ id: 'a', name: 'Old', updatedAt: 1000 }));
      await saveKit(makeKit({ id: 'b', name: 'New', updatedAt: 2000 }));
      const list = await listKits();

      expect(list).toHaveLength(2);
      expect(list[0].name).toBe('New');
      expect(list[1].name).toBe('Old');
      expect(list[0].surfaceNames).toEqual(['Desk', 'Book']);
    });

    it('does not include model in summary', async () => {
      await saveKit(makeKit());
      const list = await listKits();

      expect((list[0] as Record<string, unknown>)['model']).toBeUndefined();
    });
  });

  describe('hasAnySavedKit', () => {
    it('returns false when empty', async () => {
      expect(await hasAnySavedKit()).toBe(false);
    });

    it('returns true when kits exist', async () => {
      await saveKit(makeKit());
      expect(await hasAnySavedKit()).toBe(true);
    });

    it('returns false after all kits deleted', async () => {
      await saveKit(makeKit());
      await deleteKit('test-id-1');
      expect(await hasAnySavedKit()).toBe(false);
    });
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `bun run test:unit -- --run --project server src/lib/storage/db.spec.ts`
Expected: All PASS (implementation already exists from Task 2)

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage/db.spec.ts
git commit -m "test(storage): add tests for deleteKit, listKits, hasAnySavedKit"
```

---

## Task 4: Kit State — loadKitIntoState and currentKitId

**Files:**
- Modify: `src/lib/state/kit.svelte.ts`
- Modify: `src/lib/state/kit.spec.ts`

- [ ] **Step 1: Write failing tests for loadKitIntoState**

Append the following imports at the top of `kit.spec.ts` (alongside existing imports):

```ts
import { loadKitIntoState } from './kit.svelte';
import type { SavedKit } from '$lib/storage/db';
```

Then append this test block inside the existing `describe('kit state')`:

```ts
  describe('loadKitIntoState', () => {
    it('populates model, surfaceNames, mapping, threshold, and currentKitId', () => {
      const kit: SavedKit = {
        id: 'kit-123',
        name: 'My Kit',
        createdAt: 1000,
        updatedAt: 2000,
        surfaceNames: ['Desk', 'Book'],
        model: makeMockModel(),
        mapping: { Desk: 'snare', Book: 'kick' },
        settings: { confidenceThreshold: 0.5 }
      };
      loadKitIntoState(kit);

      expect(kitState.model).toBe(kit.model);
      expect(kitState.surfaceNames).toEqual(['Desk', 'Book']);
      expect(kitState.mapping).toEqual({ Desk: 'snare', Book: 'kick' });
      expect(kitState.confidenceThreshold).toBe(0.5);
      expect(kitState.currentKitId).toBe('kit-123');
    });

    it('overwrites previous state', () => {
      setModel(makeMockModel(), ['A']);
      setMapping({ A: 'cymbal' });

      const kit: SavedKit = {
        id: 'kit-456',
        name: 'Other',
        createdAt: 1000,
        updatedAt: 2000,
        surfaceNames: ['X', 'Y'],
        model: makeMockModel(),
        mapping: { X: 'kick', Y: 'hihat' },
        settings: { confidenceThreshold: 0.8 }
      };
      loadKitIntoState(kit);

      expect(kitState.surfaceNames).toEqual(['X', 'Y']);
      expect(kitState.mapping).toEqual({ X: 'kick', Y: 'hihat' });
      expect(kitState.currentKitId).toBe('kit-456');
    });
  });

  describe('currentKitId', () => {
    it('is null by default', () => {
      expect(kitState.currentKitId).toBeNull();
    });

    it('is cleared by resetKit', () => {
      const kit: SavedKit = {
        id: 'kit-789',
        name: 'Test',
        createdAt: 1000,
        updatedAt: 2000,
        surfaceNames: ['A'],
        model: makeMockModel(),
        mapping: { A: 'snare' },
        settings: { confidenceThreshold: 0.7 }
      };
      loadKitIntoState(kit);
      resetKit();

      expect(kitState.currentKitId).toBeNull();
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run --project server src/lib/state/kit.spec.ts`
Expected: FAIL — `loadKitIntoState` not found, `currentKitId` not on type

- [ ] **Step 3: Implement loadKitIntoState and currentKitId**

In `src/lib/state/kit.svelte.ts`:

Add import at top:

```ts
import type { SavedKit } from '$lib/storage/db';
```

Update `KitState` interface to add `currentKitId`:

```ts
export interface KitState {
  model: ClassifierModel | null;
  surfaceNames: string[];
  mapping: Record<string, DrumId> | null;
  confidenceThreshold: number;
  currentKitId: string | null;
}
```

Update the initial state to include `currentKitId: null`:

```ts
export let kitState: KitState = $state({
  model: null,
  surfaceNames: [],
  mapping: null,
  confidenceThreshold: DEFAULT_THRESHOLD,
  currentKitId: null
});
```

Update `resetKit` to clear `currentKitId`:

```ts
export function resetKit(): void {
  kitState.model = null;
  kitState.surfaceNames = [];
  kitState.mapping = null;
  kitState.confidenceThreshold = DEFAULT_THRESHOLD;
  kitState.currentKitId = null;
}
```

Add the new function:

```ts
export function loadKitIntoState(kit: SavedKit): void {
  kitState.model = kit.model;
  kitState.surfaceNames = kit.surfaceNames;
  kitState.mapping = kit.mapping;
  kitState.confidenceThreshold = kit.settings.confidenceThreshold;
  kitState.currentKitId = kit.id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- --run --project server src/lib/state/kit.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/kit.svelte.ts src/lib/state/kit.spec.ts
git commit -m "feat(kit): add loadKitIntoState and currentKitId for persistence"
```

---

## Task 5: Wizard Store — prepareRetrain

**Files:**
- Modify: `src/lib/wizard/state.svelte.ts`
- Modify: `src/lib/wizard/state.spec.ts`

- [ ] **Step 1: Write failing tests for prepareRetrain**

Add import at top of `state.spec.ts`:

```ts
import { prepareRetrain } from './state.svelte';
```

Append inside the existing `describe('wizard store')`:

```ts
  describe('prepareRetrain', () => {
    it('sets surfaces from names and clears recordings', () => {
      // Pre-populate with some data
      setSurfaces([{ name: 'Old' }]);
      addRecording('Old', makeFV(1));

      prepareRetrain(['Desk', 'Book']);

      expect(wizardState.surfaces).toEqual([{ name: 'Desk' }, { name: 'Book' }]);
      expect(Object.keys(wizardState.recordings)).toHaveLength(0);
      expect(wizardState.currentSurfaceIndex).toBe(0);
      expect(wizardState.model).toBeNull();
    });

    it('handles single surface', () => {
      prepareRetrain(['Bottle']);

      expect(wizardState.surfaces).toEqual([{ name: 'Bottle' }]);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run --project server src/lib/wizard/state.spec.ts`
Expected: FAIL — `prepareRetrain` not found

- [ ] **Step 3: Implement prepareRetrain**

Add to `src/lib/wizard/state.svelte.ts`:

```ts
export function prepareRetrain(surfaceNames: string[]): void {
  setSurfaces(surfaceNames.map((name) => ({ name })));
}
```

This delegates to `setSurfaces()` which already clears recordings, resets `currentSurfaceIndex`, and nulls the model.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- --run --project server src/lib/wizard/state.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/wizard/state.svelte.ts src/lib/wizard/state.spec.ts
git commit -m "feat(wizard): add prepareRetrain for retrain-from-loaded-kit flow"
```

---

## Task 6: Save on Map → Play Transition

**Files:**
- Modify: `src/lib/components/mapping/MappingPage.svelte`

- [ ] **Step 1: Add save logic to MappingPage**

In `src/lib/components/mapping/MappingPage.svelte`, add imports at the top of the `<script>` block:

```ts
import { saveKit } from '$lib/storage/db';
import type { SavedKit } from '$lib/storage/db';
```

Add a helper function after the existing handler functions:

```ts
  async function saveCurrentKit(finalMapping: Record<string, DrumId>) {
    try {
      const now = Date.now();
      const kit: SavedKit = {
        id: crypto.randomUUID(),
        name: `Kit — ${new Date(now).toLocaleDateString()}`,
        createdAt: now,
        updatedAt: now,
        surfaceNames: kitState.surfaceNames,
        model: kitState.model!,
        mapping: finalMapping,
        settings: { confidenceThreshold: kitState.confidenceThreshold }
      };
      kitState.currentKitId = kit.id;
      await saveKit(kit);
    } catch {
      // Save failure is non-blocking — user can still play
      console.warn('Failed to save kit');
    }
  }
```

Replace the existing `handleStartPlaying` function:

```ts
  function handleStartPlaying() {
    if (!allMapped) return;
    setMapping(mapping);
    saveCurrentKit(mapping);
    goto(resolve('/play', {}));
  }
```

Replace the existing `handleUseDefaults` function:

```ts
  function handleUseDefaults() {
    const defaults = getDefaultMapping(kitState.surfaceNames);
    setMapping(defaults);
    saveCurrentKit(defaults);
    goto(resolve('/play', {}));
  }
```

- [ ] **Step 2: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/mapping/MappingPage.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 3: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/mapping/MappingPage.svelte
git commit -m "feat(mapping): save kit to IndexedDB on map-to-play transition"
```

---

## Task 7: Play Page — Settings Persistence and Retrain Route

**Files:**
- Modify: `src/lib/components/play/PlayPage.svelte`

- [ ] **Step 1: Add debounced settings persistence**

In `src/lib/components/play/PlayPage.svelte`, add imports at the top of the `<script>` block:

```ts
import { saveKit, loadKit } from '$lib/storage/db';
import { prepareRetrain } from '$lib/wizard/state.svelte';
```

Replace the existing `handleThresholdChange` function:

```ts
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleThresholdChange(value: number) {
    setThreshold(value);

    // Debounced save to IndexedDB
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      if (!kitState.currentKitId) return;
      try {
        const kit = await loadKit(kitState.currentKitId);
        if (!kit) return;
        kit.settings.confidenceThreshold = value;
        kit.updatedAt = Date.now();
        await saveKit(kit);
      } catch {
        // Non-blocking — threshold still works in-memory
      }
    }, 300);
  }
```

- [ ] **Step 2: Update retrain to use prepareRetrain and navigate to /train/record**

Replace the existing `handleRetrain` function:

```ts
  function handleRetrain() {
    prepareRetrain(kitState.surfaceNames);
    goto(resolve('/train/record', {}));
  }
```

- [ ] **Step 3: Clean up save timeout on teardown**

Add cleanup to the existing `$effect` return function. Find the existing cleanup return at the end of the `start()` effect:

```ts
    return () => {
      stopped = true;
      capture?.stop();
      capture = null;
      player?.dispose();
      player = null;
      for (const t of timeouts) clearTimeout(t);
    };
```

Add `if (saveTimeout) clearTimeout(saveTimeout);` inside the return function, before the closing `};`.

- [ ] **Step 4: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/lib/components/play/PlayPage.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 5: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/play/PlayPage.svelte
git commit -m "feat(play): add debounced settings persistence and retrain route fix"
```

---

## Task 8: Home Screen — Kit List

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Rewrite the home screen with kit list**

Replace the entire contents of `src/routes/+page.svelte`. **Note:** This intentionally removes the GIPHY iframe embeds from the current page — they are placeholder content not needed in the final app.

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { reset } from '$lib/wizard/state.svelte';
  import { loadKitIntoState } from '$lib/state/kit.svelte';
  import { listKits, loadKit, deleteKit } from '$lib/storage/db';

  let kits = $state<Array<{ id: string; name: string; updatedAt: number; surfaceNames: string[] }>>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let deletingId = $state<string | null>(null);
  let confirmDeleteId = $state<string | null>(null);
  let toast = $state<string | null>(null);

  // Check for redirect reason
  $effect(() => {
    const reason = page.url.searchParams.get('reason');
    if (reason === 'no-kit') {
      toast = 'No kit loaded.';
      setTimeout(() => { toast = null; }, 3000);
    }
  });

  // Load kit list on mount
  $effect(() => {
    refreshList();
  });

  async function refreshList() {
    try {
      loading = true;
      loadError = null;
      kits = await listKits();
    } catch {
      loadError = 'Failed to load saved kits.';
    } finally {
      loading = false;
    }
  }

  function handleNewKit() {
    reset();
    goto(resolve('/train/setup', {}));
  }

  async function handleLoad(id: string) {
    try {
      loadError = null;
      const kit = await loadKit(id);
      if (!kit) {
        loadError = 'Kit not found. It may have been deleted.';
        await refreshList();
        return;
      }
      loadKitIntoState(kit);
      goto(resolve('/play', {}));
    } catch {
      loadError = 'Failed to load kit. Try again or create a new one.';
    }
  }

  async function handleDelete(id: string) {
    try {
      deletingId = id;
      await deleteKit(id);
      confirmDeleteId = null;
      await refreshList();
    } catch {
      loadError = 'Failed to delete kit.';
    } finally {
      deletingId = null;
    }
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-8">
  <h1 class="mb-2 text-4xl font-bold text-white">No. 2 Drummer</h1>
  <p class="mb-12 text-gray-500">Turn any surface into a drum kit</p>

  {#if toast}
    <div class="mb-4 rounded-lg bg-yellow-900/20 px-4 py-2 text-sm text-yellow-400">
      {toast}
    </div>
  {/if}

  {#if loadError}
    <div class="mb-4 max-w-md rounded-lg bg-red-900/30 p-4 text-sm text-red-300">
      {loadError}
    </div>
  {/if}

  <div class="flex w-full max-w-md flex-col gap-4">
    <button
      class="rounded-lg bg-green-500 px-8 py-3 text-center font-semibold text-black
        transition-colors hover:bg-green-400"
      onclick={handleNewKit}
      type="button"
    >
      New Kit
    </button>

    {#if loading}
      <div class="py-4 text-center text-sm text-gray-500">Loading saved kits...</div>
    {:else if kits.length === 0}
      <div class="py-4 text-center text-sm text-gray-600">
        No saved kits yet. Create one to get started!
      </div>
    {:else}
      <div class="mt-2 space-y-2">
        <div class="text-xs font-semibold tracking-wider text-gray-500 uppercase">Saved Kits</div>
        {#each kits as kit (kit.id)}
          <div class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 p-3">
            <button
              class="flex-1 text-left"
              onclick={() => handleLoad(kit.id)}
              type="button"
            >
              <div class="text-sm font-medium text-white">{kit.name}</div>
              <div class="text-xs text-gray-500">
                {kit.surfaceNames.length} surfaces · {formatDate(kit.updatedAt)}
              </div>
            </button>

            {#if confirmDeleteId === kit.id}
              <div class="flex gap-1">
                <button
                  class="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-900/30"
                  onclick={() => handleDelete(kit.id)}
                  disabled={deletingId === kit.id}
                  type="button"
                >
                  {deletingId === kit.id ? '...' : 'Confirm'}
                </button>
                <button
                  class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-800"
                  onclick={() => { confirmDeleteId = null; }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            {:else}
              <button
                class="rounded px-2 py-1 text-xs text-gray-600 hover:text-red-400"
                onclick={() => { confirmDeleteId = kit.id; }}
                type="button"
              >
                Delete
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
```

- [ ] **Step 2: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/routes/+page.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 3: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(home): add kit list with load and delete actions"
```

---

## Task 9: Error Handling — Browser Support and Mic Denied

**Files:**
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/play/+page.svelte`

- [ ] **Step 1: Add browser support check to root layout**

Replace the contents of `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import './layout.css';

  let { children } = $props();

  let unsupported = $derived(
    browser &&
      (!navigator.mediaDevices?.getUserMedia ||
        (!window.AudioContext && !(window as Record<string, unknown>).webkitAudioContext) ||
        !window.AudioWorklet ||
        !window.indexedDB)
  );
</script>

<svelte:head>
  <title>No. 2 drummer</title>
  <link
    rel="icon"
    href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✏️</text></svg>"
  />
</svelte:head>

{#if unsupported}
  <div class="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-8 text-center">
    <h1 class="mb-4 text-2xl font-bold text-white">Browser Not Supported</h1>
    <p class="max-w-md text-gray-400">
      Your browser doesn't support the audio features this app needs.
      Please use a recent version of Chrome, Firefox, or Edge.
    </p>
  </div>
{:else}
  {@render children()}
{/if}
```

- [ ] **Step 2: Add no-kit redirect reason to play route guard**

In `src/routes/play/+page.svelte`, update the guard redirect to include the reason query param. The current code (from M5) uses `resolve()` for navigation. Change the `!hasModel()` branch from:

```ts
goto(resolve('/', {}));
```

To:

```ts
goto(resolve('/', {}) + '?reason=no-kit');
```

The `!hasMapping()` branch stays unchanged.

- [ ] **Step 3: Run the Svelte autofixer**

Use `mcp__svelte__svelte-autofixer` on `src/routes/+layout.svelte`. Fix any issues and repeat until clean.
Then run on `src/routes/play/+page.svelte`. Fix any issues and repeat until clean.

- [ ] **Step 4: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/routes/+layout.svelte src/routes/play/+page.svelte
git commit -m "feat(errors): add browser support gate and no-kit redirect toast"
```

---

## Task 10: Visual Polish

**Files:**
- Modify: Various components and routes

This task is a polish pass — theme consistency, responsive tweaks, and transitions. Work through each item and commit once at the end.

- [ ] **Step 1: Audit theme consistency**

Check each route page and component for consistent dark theme usage:
- Background: `bg-gray-950` (page level), `bg-gray-900` (cards), `bg-gray-800` (inputs)
- Text: `text-white` (primary), `text-gray-400` (secondary), `text-gray-500` (tertiary)
- Accents: `text-green-400` / `bg-green-500` (success), `text-red-400` (errors)

Files to audit:
- `src/routes/+page.svelte` (home)
- `src/routes/map/+page.svelte` (map wrapper)
- `src/routes/play/+page.svelte` (play wrapper)
- `src/lib/components/mapping/MappingPage.svelte`
- `src/lib/components/play/PlayPage.svelte`
- `src/lib/components/play/ControlBar.svelte`

Fix any inconsistencies.

- [ ] **Step 2: Add responsive breakpoints to play page**

In `src/lib/components/play/DrumPadGrid.svelte`, update the grid classes to be responsive. The grid should use 1 column on small screens and the current layout on `sm:` and above. Check the current `gridCols` derived value and ensure it includes responsive prefixes.

- [ ] **Step 3: Add responsive layout to mapping page**

In `src/lib/components/mapping/MappingPage.svelte`, the two-column flex layout (`flex gap-6`) should stack vertically on narrow screens. Update to:

```html
<div class="flex flex-col gap-6 sm:flex-row">
```

- [ ] **Step 4: Add empty state to play page**

In `src/lib/components/play/PlayPage.svelte`, add a hit counter and instructional text that shows before the first hit is detected. Add a variable after the existing state declarations:

```ts
let hitCount = $state(0);
```

Increment it inside the `capture.onHit()` callback (after the `player?.play()` call):

```ts
hitCount++;
```

Then below the `ControlBar` and above the `DrumPadGrid`, add:

```svelte
{#if !error && hitCount === 0}
  <p class="mb-2 text-center text-xs text-gray-600">Hit a surface to start playing</p>
{/if}
```

- [ ] **Step 5: Run the Svelte autofixer on all modified files**

Use `mcp__svelte__svelte-autofixer` on each modified `.svelte` file. Fix any issues.

- [ ] **Step 6: Verify types compile and lint passes**

Run: `bun run check && bun run format && bun run lint`
Expected: No errors

- [ ] **Step 7: Commit**

Stage only the specific files that were modified during this task, then commit:

```bash
git add src/lib/components/play/DrumPadGrid.svelte src/lib/components/mapping/MappingPage.svelte src/lib/components/play/PlayPage.svelte
git commit -m "style: visual polish — theme consistency, responsive layout, empty states"
```

If additional files were modified during the theme audit, add those specifically as well.

---

## Task 11: Integration Verification

- [ ] **Step 1: Run all unit tests**

Run: `bun run test:unit -- --run`
Expected: All tests pass (storage + kit state + wizard + existing audio/classifier/player specs)

- [ ] **Step 2: Run type check**

Run: `bun run check`
Expected: No errors

- [ ] **Step 3: Run lint and format**

Run: `bun run format && bun run lint`
Expected: No errors

- [ ] **Step 4: Run build**

Run: `bun run build`
Expected: Static build succeeds.

- [ ] **Step 5: Manual smoke test**

Run: `bun dev`
Navigate to `http://localhost:5173`

Test the full flow:
1. Home shows "No saved kits yet" message and "New Kit" button
2. Complete wizard: New Kit → train → map → play
3. Verify kit was saved: navigate to home → kit appears in list
4. Load saved kit: click kit row → arrives at `/play` → classification works
5. Change threshold slider → refresh page → load same kit → threshold preserved
6. Remap: from play → remap → change mapping → play → saves as new kit → home shows 2 kits
7. Retrain: from play → retrain → arrives at `/train/record` (not setup) → surface names preserved
8. Delete: from home → click Delete → Confirm → kit removed from list
9. Direct URL to `/play` with no kit → redirected to home with "No kit loaded" toast
10. Open in unsupported browser simulation: in DevTools console, `delete window.AudioWorklet` then refresh → shows unsupported message

- [ ] **Step 6: Final commit if any fixes were needed**

Stage only the specific files that were fixed, then commit:

```bash
git commit -m "chore: fix lint/type issues from milestone 6 integration"
```

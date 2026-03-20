<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { DrumId } from '$lib/player/samples';
  import { DRUM_IDS } from '$lib/player/samples';
  import { DrumPlayer } from '$lib/player/player';
  import { kitState, setMapping, getDefaultMapping } from '$lib/state/kit.svelte';
  import { getSurfaceColor } from '$lib/constants/colors';
  import SurfaceDropZone from './SurfaceDropZone.svelte';
  import DrumSoundCard from './DrumSoundCard.svelte';

  let mapping: Record<string, DrumId> = $state(getDefaultMapping(kitState.surfaceNames));
  let player: DrumPlayer | null = $state(null);
  let loadError = $state<string | null>(null);

  let allMapped = $derived(kitState.surfaceNames.every((name) => mapping[name] != null));

  // Build reverse lookup: drumId → surface name (or null)
  let drumAssignments = $derived.by(() => {
    const assignments: Record<string, string | null> = {};
    for (const id of DRUM_IDS) {
      assignments[id] = null;
    }
    for (const [surface, drumId] of Object.entries(mapping)) {
      if (drumId) assignments[drumId] = surface;
    }
    return assignments;
  });

  // Load drum player for previews
  $effect(() => {
    let cancelled = false;

    async function load() {
      try {
        const p = new DrumPlayer();
        await p.load();
        if (cancelled) {
          p.dispose();
          return;
        }
        player = p;
      } catch {
        loadError = 'Could not load drum samples';
      }
    }

    load();

    return () => {
      cancelled = true;
      player?.dispose();
      player = null;
    };
  });

  function handleAssign(surface: string, drumId: DrumId) {
    // Unassign drum from any other surface first
    const newMapping = { ...mapping };
    for (const [s, d] of Object.entries(newMapping)) {
      if (d === drumId && s !== surface) {
        delete newMapping[s];
      }
    }
    newMapping[surface] = drumId;
    mapping = newMapping;
  }

  function handleUnassign(surface: string) {
    const newMapping = { ...mapping };
    delete newMapping[surface];
    mapping = newMapping;
  }

  function handlePreview(drumId: DrumId) {
    player?.play(drumId, 0.7);
  }

  function handleStartPlaying() {
    if (!allMapped) return;
    setMapping(mapping);
    goto(resolve('/play', {}));
  }

  function handleUseDefaults() {
    const defaults = getDefaultMapping(kitState.surfaceNames);
    setMapping(defaults);
    goto(resolve('/play', {}));
  }
</script>

<div class="mx-auto max-w-xl p-8">
  <div class="mb-8 text-center">
    <h2 class="mb-2 text-2xl font-semibold text-white">Map Your Surfaces</h2>
    <p class="text-sm text-gray-500">Drag drum sounds onto your surfaces, or use the defaults</p>
  </div>

  {#if loadError}
    <div class="mb-4 rounded-lg bg-yellow-900/20 p-3 text-xs text-yellow-400">
      {loadError} — previews unavailable
    </div>
  {/if}

  <div class="flex gap-6">
    <!-- Surfaces column -->
    <div class="flex-1 space-y-2">
      <div class="mb-2 text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
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
      <div class="mb-2 text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
        Drum Sounds
      </div>
      {#each DRUM_IDS as drumId (drumId)}
        <DrumSoundCard {drumId} assignedTo={drumAssignments[drumId]} onpreview={handlePreview} />
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

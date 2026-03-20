<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { startCapture } from '$lib/audio/capture';
  import type { AudioCapture } from '$lib/audio/capture';
  import { classify } from '$lib/classifier/knn';
  import { flattenFeatureVector } from '$lib/classifier/normalize';
  import { DrumPlayer } from '$lib/player/player';
  import { kitState, setThreshold, DRUM_DISPLAY_NAMES } from '$lib/state/kit.svelte';
  import { getSurfaceColor } from '$lib/constants/colors';
  import ControlBar from './ControlBar.svelte';
  import DrumPadGrid from './DrumPadGrid.svelte';
  import LaneStream from './LaneStream.svelte';

  let capture: AudioCapture | null = $state(null);
  let player: DrumPlayer | null = $state(null);
  let error = $state<string | null>(null);
  let padFlash: Record<string, boolean> = $state({});
  let laneHits: Record<string, Array<{ id: string; intensity: number }>> = $state({});

  // Initialize per-surface state
  $effect(() => {
    const flash: Record<string, boolean> = {};
    const hits: Record<string, Array<{ id: string; intensity: number }>> = {};
    for (const name of kitState.surfaceNames) {
      flash[name] = false;
      hits[name] = [];
    }
    padFlash = flash;
    laneHits = hits;
  });

  // Start audio capture and drum player
  $effect(() => {
    if (!kitState.model || !kitState.mapping) return;

    let stopped = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    async function start() {
      try {
        error = null;

        const p = new DrumPlayer();
        await p.load();
        if (stopped) {
          p.dispose();
          return;
        }
        player = p;

        const c = await startCapture();
        if (stopped) {
          c.stop();
          p.dispose();
          return;
        }
        capture = c;

        capture.onHit((event) => {
          if (!kitState.model || !kitState.mapping) return;

          const features = flattenFeatureVector(event.features);
          const result = classify(kitState.model, features);

          if (!result || result.confidence < kitState.confidenceThreshold) return;

          const drumId = kitState.mapping[result.surface];
          if (!drumId) return;

          // Play drum sound
          player?.play(drumId, event.intensity);

          // Flash pad
          padFlash[result.surface] = true;
          const flashT = setTimeout(() => {
            padFlash[result.surface] = false;
          }, 150);
          timeouts.push(flashT);

          // Add lane hit block
          const hitId = crypto.randomUUID();
          laneHits[result.surface] = [
            ...laneHits[result.surface],
            { id: hitId, intensity: event.intensity }
          ];
          const hitT = setTimeout(() => {
            laneHits[result.surface] = laneHits[result.surface].filter((h) => h.id !== hitId);
          }, 5000);
          timeouts.push(hitT);
        });
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to start audio';
      }
    }

    start();

    return () => {
      stopped = true;
      capture?.stop();
      capture = null;
      player?.dispose();
      player = null;
      for (const t of timeouts) clearTimeout(t);
    };
  });

  let pads = $derived(
    kitState.surfaceNames.map((name, i) => ({
      drumName: kitState.mapping ? (DRUM_DISPLAY_NAMES[kitState.mapping[name]] ?? '') : '',
      surfaceName: name,
      color: getSurfaceColor(i),
      flash: padFlash[name] ?? false
    }))
  );

  let lanes = $derived(
    kitState.surfaceNames.map((name, i) => ({
      label: kitState.mapping ? (DRUM_DISPLAY_NAMES[kitState.mapping[name]] ?? name) : name,
      color: getSurfaceColor(i),
      hits: laneHits[name] ?? []
    }))
  );

  function handleRemap() {
    goto(resolve('/map'));
  }

  function handleRetrain() {
    goto(resolve('/train/setup'));
  }

  function handleThresholdChange(value: number) {
    setThreshold(value);
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

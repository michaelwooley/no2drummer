<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { startCapture } from '$lib/audio/capture';
  import type { AudioCapture } from '$lib/audio/capture';
  import HitCounter from '$lib/components/HitCounter.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import SurfaceDot from '$lib/components/SurfaceDot.svelte';
  import {
    wizardState,
    addRecording,
    setCurrentSurface,
    getRecordingCount,
    canProceedToTrain
  } from '$lib/wizard/state.svelte';

  let capture: AudioCapture | null = $state(null);
  let error = $state<string | null>(null);
  let flash = $state(false);
  let showBackConfirm = $state(false);

  const MIN_HITS = 50;
  const TARGET_HITS = 100;

  let currentSurface = $derived(wizardState.surfaces[wizardState.currentSurfaceIndex]);
  let currentCount = $derived(currentSurface ? getRecordingCount(currentSurface.name) : 0);

  // Redirect if no surfaces configured
  $effect(() => {
    if (wizardState.surfaces.length === 0) {
      goto(resolve('/train/setup/'));
    }
  });

  // Start mic capture on mount
  $effect(() => {
    let stopped = false;

    async function start() {
      try {
        error = null;
        const c = await startCapture();
        if (stopped) {
          c.stop();
          return;
        }
        capture = c;

        capture.onHit((event) => {
          // Read directly from wizardState — not from $derived — so the callback
          // always uses the latest surface even though it's registered once.
          const surface = wizardState.surfaces[wizardState.currentSurfaceIndex];
          if (!surface) return;
          addRecording(surface.name, event.features);
          flash = true;
          setTimeout(() => {
            flash = false;
          }, 100);
        });
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to access microphone';
      }
    }

    start();

    return () => {
      stopped = true;
      capture?.stop();
      capture = null;
    };
  });

  function handleSurfaceClick(index: number) {
    setCurrentSurface(index);
  }

  function handleSkip() {
    const next = wizardState.surfaces.findIndex(
      (s, i) => i !== wizardState.currentSurfaceIndex && getRecordingCount(s.name) < MIN_HITS
    );
    if (next !== -1) {
      setCurrentSurface(next);
    } else {
      // All at min — cycle to next
      setCurrentSurface((wizardState.currentSurfaceIndex + 1) % wizardState.surfaces.length);
    }
  }

  function handleBack() {
    const hasRecordings = Object.values(wizardState.recordings).some((r) => r.length > 0);
    if (hasRecordings && !showBackConfirm) {
      showBackConfirm = true;
      return;
    }
    goto(resolve('/train/setup/'));
  }

  function handleTrain() {
    if (canProceedToTrain()) {
      goto(resolve('/train/train/'));
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
        onclick={() => {
          error = null;
          location.reload();
        }}
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
      {#each wizardState.surfaces as surface, i (surface.name)}
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
          onclick={() => goto(resolve('/train/setup/'))}
          type="button"
        >
          Yes, go back
        </button>
        <button
          class="rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-400
            hover:border-gray-500"
          onclick={() => {
            showBackConfirm = false;
          }}
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
        &larr; Back
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
      Train Model &rarr;
    </button>
  </div>
</div>

{#if !canProceedToTrain()}
  <p class="mt-2 text-center text-[11px] text-gray-600">
    All surfaces need at least {MIN_HITS} hits before training
  </p>
{/if}

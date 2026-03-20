<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import {
    wizardState,
    buildModel,
    canProceedToTrain,
    getRecordingCount
  } from '$lib/wizard/state.svelte';

  let progress = $state('');
  let done = $state(false);
  let totalSamples = $state(0);

  // Redirect if prerequisites not met
  $effect(() => {
    if (!canProceedToTrain()) {
      goto(resolve('/train/record', {}));
    }
  });

  // Build model on mount
  $effect(() => {
    let cancelled = false;

    async function train() {
      // Small delay so the step feels intentional
      await new Promise((r) => setTimeout(r, 200));
      if (cancelled) return;

      let total = 0;
      for (let i = 0; i < wizardState.surfaces.length; i++) {
        const surface = wizardState.surfaces[i];
        progress = `Processing surface ${i + 1} of ${wizardState.surfaces.length}: ${surface.name}`;
        total += getRecordingCount(surface.name);
        // Yield to let UI update
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled) return;
      }

      buildModel();
      totalSamples = total;

      // Brief pause so completion feels satisfying
      await new Promise((r) => setTimeout(r, 300));
      if (cancelled) return;

      done = true;
    }

    train();

    return () => {
      cancelled = true;
    };
  });
</script>

<div class="flex flex-col items-center justify-center py-16 text-center">
  {#if !done}
    <div
      class="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-green-500"
    ></div>
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
        href={resolve('/train/record', {})}
        class="rounded-lg border border-gray-700 px-5 py-2.5 text-sm text-gray-400
          transition-colors hover:border-gray-500"
      >
        ← Back to Record
      </a>
      <a
        href={resolve('/train/try', {})}
        class="rounded-lg bg-green-500 px-6 py-2.5 text-sm font-semibold text-black
          transition-colors hover:bg-green-400"
      >
        Try It →
      </a>
    </div>
  {/if}
</div>

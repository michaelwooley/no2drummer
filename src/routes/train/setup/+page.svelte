<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { setSurfaces, canProceedFromSetup } from '$lib/wizard/state.svelte';

  let surfaceCount = $state(3);
  let names = $state(['Surface 1', 'Surface 2', 'Surface 3', 'Surface 4']);

  // Sync surfaces into wizard state whenever names or count changes
  $effect(() => {
    const configs = names.slice(0, surfaceCount).map((name) => ({ name }));
    setSurfaces(configs);
  });

  function handleCountChange(count: number) {
    surfaceCount = count;
  }

  function handleNext() {
    if (canProceedFromSetup()) {
      goto(resolve('/train/record/'));
    }
  }
</script>

<div class="text-center">
  <h2 class="mb-2 text-2xl font-semibold text-white">Setup Your Kit</h2>
  <p class="mb-8 text-sm text-gray-500">Choose your surfaces and name them</p>
</div>

<div class="mb-8">
  <span class="mb-3 block text-xs tracking-wider text-gray-500 uppercase">
    Number of surfaces
  </span>
  <div class="flex justify-center gap-3" role="group" aria-label="Number of surfaces">
    {#each [2, 3, 4] as count (count)}
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

<fieldset class="mb-8 space-y-3">
  <legend class="mb-3 block text-xs tracking-wider text-gray-500 uppercase"> Surface names </legend>
  {#each Array.from({ length: surfaceCount }, (_, i) => i) as i (i)}
    <input
      type="text"
      bind:value={names[i]}
      placeholder="Surface {i + 1}"
      aria-label="Surface {i + 1} name"
      class="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-white
        placeholder-gray-600 focus:border-green-500 focus:ring-1 focus:ring-green-500
        focus:outline-none"
    />
  {/each}
</fieldset>

<div class="flex justify-between">
  <a
    href={resolve('/')}
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

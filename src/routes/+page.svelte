<script lang="ts">
  import { resolve } from '$app/paths';
  import { reset } from '$lib/wizard/state.svelte';

  function handleNewKit() {
    reset();
  }
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-8">
  <h1 class="mb-2 text-4xl font-bold text-white">No. 2 Drummer</h1>
  <p class="mb-12 text-gray-500">Turn any surface into a drum kit</p>

  <div class="flex flex-col gap-4">
    <a
      href={resolve('/train/setup', {})}
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

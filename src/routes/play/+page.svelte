<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { kitState, hasModel, hasMapping } from '$lib/state/kit.svelte';
  import PlayPage from '$lib/components/play/PlayPage.svelte';

  // Guard: redirect if prerequisites missing
  $effect(() => {
    if (!hasModel()) {
      goto(resolve('/', {}));
    } else if (!hasMapping()) {
      goto(resolve('/map', {}));
    }
  });
</script>

<div class="min-h-screen bg-gray-950">
  {#if kitState.model && kitState.mapping}
    <PlayPage />
  {/if}
</div>

<script lang="ts">
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import { kitState, hasModel, hasMapping } from '$lib/state/kit.svelte'
  import PlayPage from '$lib/components/play/PlayPage.svelte'

  // Guard: redirect if prerequisites missing
  $effect(() => {
    if (!hasModel()) {
      goto(`${base}/`)
    } else if (!hasMapping()) {
      goto(`${base}/map`)
    }
  })
</script>

<div class="min-h-screen bg-gray-950">
  {#if kitState.model && kitState.mapping}
    <PlayPage />
  {/if}
</div>

<script lang="ts">
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import { kitState, hasModel } from '$lib/state/kit.svelte'
  import MappingPage from '$lib/components/mapping/MappingPage.svelte'

  // Guard: redirect if no model
  $effect(() => {
    if (!hasModel()) {
      goto(`${base}/`)
    }
  })
</script>

<div class="min-h-screen bg-gray-950">
  {#if kitState.model}
    <MappingPage />
  {/if}
</div>

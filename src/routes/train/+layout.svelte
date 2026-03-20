<script lang="ts">
  import StepIndicator from '$lib/components/StepIndicator.svelte'
  import { page } from '$app/state'

  interface Props {
    children: import('svelte').Snippet
  }

  let { children }: Props = $props()

  let currentStep = $derived(
    page.url.pathname.endsWith('/setup') ? 'setup' as const
    : page.url.pathname.endsWith('/record') ? 'record' as const
    : page.url.pathname.endsWith('/train') ? 'train' as const
    : 'try' as const
  )
</script>

<div class="min-h-screen bg-gray-950 p-8">
  <div class="mx-auto max-w-xl">
    <div class="mb-8">
      <StepIndicator {currentStep} />
    </div>
    {@render children()}
  </div>
</div>

<script lang="ts">
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import { startCapture } from '$lib/audio/capture'
  import type { AudioCapture } from '$lib/audio/capture'
  import { classify } from '$lib/classifier/knn'
  import { flattenFeatureVector } from '$lib/classifier/normalize'
  import SurfaceTile from '$lib/components/SurfaceTile.svelte'
  import { wizardState, reset } from '$lib/wizard/state.svelte'

  let capture: AudioCapture | null = $state(null)
  let error = $state<string | null>(null)
  let threshold = $state(0.6)

  // Per-surface flash state: { confidence, unrecognized, timeout }
  let tileStates: Record<string, { confidence: number | null; unrecognized: boolean }> = $state({})

  // Redirect if no model
  $effect(() => {
    if (!wizardState.model) {
      goto(`${base}/train/train`)
    }
  })

  // Initialize tile states
  $effect(() => {
    const states: typeof tileStates = {}
    for (const surface of wizardState.surfaces) {
      states[surface.name] = { confidence: null, unrecognized: false }
    }
    tileStates = states
  })

  // Start mic capture
  $effect(() => {
    let stopped = false
    const timeouts: ReturnType<typeof setTimeout>[] = []

    async function start() {
      try {
        error = null
        const c = await startCapture()
        if (stopped) {
          c.stop()
          return
        }
        capture = c

        capture.onHit((event) => {
          if (!wizardState.model) return
          const features = flattenFeatureVector(event.features)
          const result = classify(wizardState.model, features)

          if (!result || result.confidence < threshold) {
            // Flash unrecognized on all tiles briefly
            for (const surface of wizardState.surfaces) {
              tileStates[surface.name] = { confidence: null, unrecognized: true }
            }
            const t = setTimeout(() => {
              for (const surface of wizardState.surfaces) {
                tileStates[surface.name] = { confidence: null, unrecognized: false }
              }
            }, 300)
            timeouts.push(t)
            return
          }

          // Flash the matched surface
          tileStates[result.surface] = { confidence: result.confidence, unrecognized: false }
          const t = setTimeout(() => {
            tileStates[result.surface] = { confidence: null, unrecognized: false }
          }, 400)
          timeouts.push(t)
        })
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to access microphone'
      }
    }

    start()

    return () => {
      stopped = true
      capture?.stop()
      capture = null
      for (const t of timeouts) clearTimeout(t)
    }
  })

  function handleStartOver() {
    reset()
    goto(`${base}/train/setup`)
  }
</script>

<div class="text-center">
  <h2 class="mb-2 text-2xl font-semibold text-white">Try It!</h2>
  <p class="mb-8 text-sm text-gray-500">Hit your surfaces — see if the classifier recognizes them</p>

  {#if error}
    <div class="mb-6 rounded-lg bg-red-900/30 p-4 text-red-300">
      {error}
    </div>
  {/if}

  <div class="mb-8 flex flex-wrap justify-center gap-4">
    {#each wizardState.surfaces as surface (surface.name)}
      <SurfaceTile
        name={surface.name}
        confidence={tileStates[surface.name]?.confidence ?? null}
        unrecognized={tileStates[surface.name]?.unrecognized ?? false}
      />
    {/each}
  </div>

  <div class="mb-8">
    <label class="mb-2 block text-xs text-gray-500">
      Confidence threshold: {Math.round(threshold * 100)}%
      <input
        type="range"
        min="0.3"
        max="0.9"
        step="0.05"
        bind:value={threshold}
        class="mt-2 block w-64 accent-green-500"
      />
    </label>
  </div>

  <div class="flex justify-center gap-3">
    <a
      href="{base}/train/record"
      class="rounded-lg border border-gray-700 px-5 py-2.5 text-sm text-gray-400
        transition-colors hover:border-gray-500"
    >
      Retrain
    </a>
    <button
      class="rounded-lg border border-gray-700 px-5 py-2.5 text-sm text-gray-400
        transition-colors hover:border-gray-500"
      onclick={handleStartOver}
      type="button"
    >
      Start Over
    </button>
    <button
      class="cursor-not-allowed rounded-lg bg-gray-800 px-6 py-2.5 text-sm text-gray-500"
      disabled
      type="button"
    >
      Done
    </button>
  </div>
  <p class="mt-2 text-[11px] text-gray-600">Mapping coming in a future update</p>
</div>

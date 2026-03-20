<script lang="ts">
  interface Props {
    threshold: number
    onthresholdchange: (value: number) => void
    onremap: () => void
    onretrain: () => void
  }

  let { threshold, onthresholdchange, onremap, onretrain }: Props = $props()

  function handleSlider(e: Event) {
    const target = e.target as HTMLInputElement
    onthresholdchange(parseFloat(target.value))
  }
</script>

<div
  class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/80 px-4 py-2.5"
>
  <div class="flex gap-2">
    <button
      class="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400
        transition-colors hover:border-gray-500"
      onclick={onremap}
      type="button"
    >
      ← Remap
    </button>
    <button
      class="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400
        transition-colors hover:border-gray-500"
      onclick={onretrain}
      type="button"
    >
      Retrain
    </button>
  </div>
  <div class="flex items-center gap-3">
    <span class="text-xs text-gray-500">Confidence</span>
    <input
      type="range"
      min="0"
      max="1"
      step="0.05"
      value={threshold}
      oninput={handleSlider}
      class="w-28 accent-blue-500"
    />
    <span class="min-w-[2rem] text-right text-xs text-blue-400">
      {threshold.toFixed(2)}
    </span>
  </div>
</div>

<script lang="ts">
  import type { DrumId } from '$lib/player/samples'
  import { DRUM_DISPLAY_NAMES } from '$lib/state/kit.svelte'

  interface Props {
    drumId: DrumId
    assignedTo: string | null
    onpreview: (drumId: DrumId) => void
  }

  let { drumId, assignedTo, onpreview }: Props = $props()

  let isAssigned = $derived(assignedTo !== null)

  function handleDragStart(e: DragEvent) {
    e.dataTransfer?.setData('text/plain', drumId)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
    }
  }

  function handlePreview(e: Event) {
    e.stopPropagation()
    onpreview(drumId)
  }
</script>

<div
  class="flex items-center gap-2 rounded-lg border px-3 py-2
    {isAssigned ? 'border-gray-800 opacity-40' : 'cursor-grab border-gray-600'}"
  draggable="true"
  ondragstart={handleDragStart}
  role="listitem"
>
  <button
    class="flex h-7 w-7 items-center justify-center rounded-full text-xs text-white
      {isAssigned ? 'bg-gray-700' : 'bg-blue-500 hover:bg-blue-400'}"
    onclick={handlePreview}
    type="button"
    aria-label="Preview {DRUM_DISPLAY_NAMES[drumId]}"
  >
    ▶
  </button>
  <div class="flex-1">
    <div class="text-xs font-semibold text-gray-200">
      {DRUM_DISPLAY_NAMES[drumId]}
    </div>
    {#if isAssigned}
      <div class="text-[9px]" style="color: #4a9eff;">→ {assignedTo}</div>
    {:else}
      <div class="text-[9px] text-gray-500">available</div>
    {/if}
  </div>
  <div class="text-[10px] text-gray-600">⠿</div>
</div>

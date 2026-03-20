<script lang="ts">
  import type { DrumId } from '$lib/player/samples';
  import { DRUM_DISPLAY_NAMES } from '$lib/state/kit.svelte';

  interface Props {
    surfaceName: string;
    color: string;
    assignedDrum: DrumId | null;
    onassign: (drumId: DrumId) => void;
    onunassign: () => void;
  }

  let { surfaceName, color, assignedDrum, onassign, onunassign }: Props = $props();

  let dragover = $state(false);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragover = true;
  }

  function handleDragLeave() {
    dragover = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragover = false;
    const drumId = e.dataTransfer?.getData('text/plain') as DrumId;
    if (drumId) onassign(drumId);
  }
</script>

<div
  class="flex items-center gap-3 rounded-lg p-3
    {assignedDrum ? 'border-2 border-solid' : 'border-2 border-dashed'}
    {dragover ? 'border-white/50 bg-white/5' : assignedDrum ? '' : 'border-gray-700'}"
  style="{assignedDrum ? `border-color: ${color};` : ''} background: {assignedDrum
    ? `${color}10`
    : 'rgb(37 37 64)'}"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="listitem"
>
  <div
    class="rounded-md px-2.5 py-1 text-xs font-semibold"
    style="background: {color}; color: {color === '#ffd93d' ? '#1a1a2e' : 'white'};"
  >
    {surfaceName}
  </div>
  <span class="text-xs text-gray-600">→</span>
  {#if assignedDrum}
    <div class="flex-1 rounded-md bg-gray-800 px-2.5 py-1 text-xs text-green-400">
      {DRUM_DISPLAY_NAMES[assignedDrum]}
    </div>
    <button
      class="text-xs text-gray-600 transition-colors hover:text-gray-400"
      onclick={onunassign}
      type="button"
    >
      ✕
    </button>
  {:else}
    <div class="flex-1 text-center text-xs text-gray-600">drop a sound here</div>
  {/if}
</div>

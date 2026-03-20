<script lang="ts">
  interface Props {
    name: string;
    confidence?: number | null;
    unrecognized?: boolean;
  }

  let { name, confidence = null, unrecognized = false }: Props = $props();

  let isActive = $derived(confidence !== null);
</script>

<div
  class="flex min-h-[120px] min-w-[120px] flex-col items-center justify-center rounded-lg border-2 p-4
    {isActive
    ? 'border-green-400 bg-green-500/10 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
    : unrecognized
      ? 'border-yellow-500/50 bg-yellow-500/5'
      : 'border-gray-700 bg-gray-900'}"
  style="transition: border-color 150ms, background-color 150ms, box-shadow 150ms;"
>
  <div
    class="text-lg font-semibold
      {isActive ? 'text-green-400' : unrecognized ? 'text-yellow-500' : 'text-gray-400'}"
  >
    {#if unrecognized}
      ?
    {:else}
      {name}
    {/if}
  </div>
  {#if confidence !== null}
    <div class="mt-1 text-xs text-green-300">{Math.round(confidence * 100)}%</div>
  {/if}
</div>

<script lang="ts">
  interface HitBlock {
    id: string
    intensity: number
  }

  interface Props {
    label: string
    color: string
    hits: HitBlock[]
  }

  let { label, color, hits }: Props = $props()
</script>

<div class="flex items-center gap-2">
  <div class="min-w-[52px] text-right text-[10px] font-medium" style="color: {color};">
    {label}
  </div>
  <div
    class="relative flex-1 overflow-hidden rounded border border-gray-800 bg-[#1a1a2e]"
    style="height: 32px;"
  >
    {#each hits as hit (hit.id)}
      <div
        class="hit-block absolute bottom-0 w-1.5 rounded-sm"
        style="background: {color}; height: {Math.max(4, hit.intensity * 32)}px;"
      ></div>
    {/each}
  </div>
</div>

<style>
  .hit-block {
    right: 0;
    animation: slide-left 5s linear forwards;
  }

  @keyframes slide-left {
    from {
      right: 0;
      opacity: 1;
    }
    to {
      right: 100%;
      opacity: 0.15;
    }
  }
</style>

<script lang="ts">
  interface Props {
    count: number;
    flash?: boolean;
  }

  let { count, flash = false }: Props = $props();
</script>

<div
  class="relative mx-auto flex h-40 w-40 items-center justify-center rounded-full border-2
    {flash ? 'border-green-400 shadow-[0_0_24px_rgba(34,197,94,0.4)]' : 'border-gray-800'}"
  style="background: radial-gradient(circle, {flash
    ? 'rgba(34,197,94,0.15)'
    : 'rgba(34,197,94,0.05)'} 0%, transparent 70%);
    transition: border-color 100ms, box-shadow 100ms;"
>
  <div class="text-center">
    <div class="text-5xl font-bold text-white">{count}</div>
    <div class="mt-1 text-xs text-gray-500">hits</div>
  </div>
</div>

<script lang="ts">
  interface Props {
    drumName: string;
    surfaceName: string;
    color: string;
    flash?: boolean;
  }

  let { drumName, surfaceName, color, flash = false }: Props = $props();
</script>

<div
  class="flex min-h-[100px] flex-col items-center justify-center rounded-xl border-2 p-4 text-center"
  style="
    border-color: {color};
    background: {flash ? color : 'transparent'};
    box-shadow: {flash ? `0 0 20px ${color}66` : 'none'};
    transition: background-color 150ms ease-out, box-shadow 150ms ease-out;
  "
>
  <div
    class="text-xl font-bold"
    style="color: {flash ? 'white' : color}; transition: color 150ms ease-out;"
  >
    {drumName}
  </div>
  <div class="mt-1 text-xs text-gray-500">{surfaceName}</div>
</div>

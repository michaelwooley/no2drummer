<script lang="ts">
  interface Props {
    value: number;
    min: number;
    max: number;
  }

  let { value, min, max }: Props = $props();

  let percent = $derived(Math.min(100, (value / max) * 100));
  let minPercent = $derived((min / max) * 100);
</script>

<div class="mx-auto max-w-md">
  <div class="relative h-1.5 overflow-visible rounded-full bg-gray-800">
    <div
      class="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-green-500 to-green-400"
      style="width: {percent}%; transition: width 100ms;"
    ></div>
    <div class="absolute top-[-3px] h-3 w-px bg-gray-600" style="left: {minPercent}%;"></div>
  </div>
  <div class="mt-1.5 flex justify-between text-[11px]">
    <span class="text-gray-500">{value}</span>
    <span class="text-green-400" style="position: relative; left: -{50 - minPercent}%;">
      min: {min}
    </span>
    <span class="text-gray-500">{max}</span>
  </div>
</div>

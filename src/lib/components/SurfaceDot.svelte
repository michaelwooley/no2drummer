<script lang="ts">
  interface Props {
    name: string;
    count: number;
    active?: boolean;
    complete?: boolean;
    onclick?: () => void;
  }

  let { name, count, active = false, complete = false, onclick }: Props = $props();

  let borderColor = $derived(
    active
      ? 'border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.3)]'
      : complete
        ? 'border-green-500'
        : 'border-gray-700'
  );
  let textColor = $derived(
    active ? 'text-green-500' : complete ? 'text-green-500' : 'text-gray-500'
  );
  let opacity = $derived(active || complete ? 'opacity-100' : 'opacity-50');
</script>

<button class="text-center {opacity}" {onclick} type="button">
  <div
    class="mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 bg-gray-950
      {borderColor}"
  >
    <span class="{textColor} text-[10px] font-semibold">{count}</span>
  </div>
  <div class="{textColor} mt-1.5 text-[11px] {active ? 'font-semibold' : ''}">{name}</div>
</button>

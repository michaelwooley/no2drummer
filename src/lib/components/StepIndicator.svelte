<script lang="ts">
  interface Props {
    currentStep: 'setup' | 'record' | 'train' | 'try';
  }

  let { currentStep }: Props = $props();

  const steps = [
    { id: 'setup' as const, label: 'Setup' },
    { id: 'record' as const, label: 'Record' },
    { id: 'train' as const, label: 'Train' },
    { id: 'try' as const, label: 'Try It' }
  ];

  const stepIndex = $derived(steps.findIndex((s) => s.id === currentStep));
</script>

<div class="flex items-center justify-center gap-2">
  {#each steps as step, i (step.id)}
    {#if i > 0}
      <div class="h-px w-6 {i <= stepIndex ? 'bg-green-500' : 'bg-gray-700'}"></div>
    {/if}
    <div class="flex items-center gap-1.5">
      <div
        class="flex h-5 w-5 items-center justify-center rounded-full text-[10px]
          {i < stepIndex
          ? 'bg-green-500 text-white'
          : i === stepIndex
            ? 'bg-white font-bold text-black'
            : 'bg-gray-800 text-gray-500'}"
      >
        {#if i < stepIndex}
          ✓
        {:else}
          {i + 1}
        {/if}
      </div>
      <span
        class="text-xs
          {i < stepIndex
          ? 'text-green-500'
          : i === stepIndex
            ? 'font-semibold text-white'
            : 'text-gray-500'}"
      >
        {step.label}
      </span>
    </div>
  {/each}
</div>

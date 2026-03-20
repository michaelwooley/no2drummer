<script lang="ts">
  import HitLane from './HitLane.svelte'

  interface HitBlock {
    id: string
    intensity: number
  }

  interface LaneData {
    label: string
    color: string
    hits: HitBlock[]
  }

  interface Props {
    lanes: LaneData[]
  }

  let { lanes }: Props = $props()
</script>

<div>
  <div class="mb-2 text-[10px] uppercase tracking-wider text-gray-600">
    Hit Stream
  </div>
  <div class="space-y-1.5">
    {#each lanes as lane (lane.label)}
      <HitLane label={lane.label} color={lane.color} hits={lane.hits} />
    {/each}
  </div>
</div>

<script lang="ts">
  import DrumPad from './DrumPad.svelte'

  interface PadData {
    drumName: string
    surfaceName: string
    color: string
    flash: boolean
  }

  interface Props {
    pads: PadData[]
  }

  let { pads }: Props = $props()

  let gridCols = $derived(
    pads.length <= 2 ? 'grid-cols-2'
    : pads.length === 3 ? 'grid-cols-3'
    : 'grid-cols-2'
  )
</script>

<div class="grid gap-3 {gridCols}">
  {#each pads as pad (pad.surfaceName)}
    <DrumPad
      drumName={pad.drumName}
      surfaceName={pad.surfaceName}
      color={pad.color}
      flash={pad.flash}
    />
  {/each}
</div>

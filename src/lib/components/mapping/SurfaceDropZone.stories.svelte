<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SurfaceDropZone from './SurfaceDropZone.svelte'
  import { fn } from 'storybook/test'

  const { Story } = defineMeta({
    title: 'Mapping/SurfaceDropZone',
    component: SurfaceDropZone,
    tags: ['autodocs'],
    args: { onassign: fn(), onunassign: fn() },
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8" style="max-width: 400px;"><slot /></div>'
      })
    ]
  })
</script>

<Story name="Empty" args={{ surfaceName: 'Desk', color: '#4a9eff', assignedDrum: null }} />
<Story name="Assigned (Snare)" args={{ surfaceName: 'Desk', color: '#4a9eff', assignedDrum: 'snare' }} />
<Story name="Assigned (Kick)" args={{ surfaceName: 'Book', color: '#ff6b6b', assignedDrum: 'kick' }} />
<Story name="Empty (Yellow)" args={{ surfaceName: 'Bottle', color: '#ffd93d', assignedDrum: null }} />

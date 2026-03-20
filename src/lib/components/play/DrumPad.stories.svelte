<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import DrumPad from './DrumPad.svelte'

  const { Story } = defineMeta({
    title: 'Play/DrumPad',
    component: DrumPad,
    tags: ['autodocs'],
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8" style="max-width: 200px;"><slot /></div>'
      })
    ]
  })
</script>

<Story name="Idle (Blue)" args={{ drumName: 'Snare', surfaceName: 'Desk', color: '#4a9eff' }} />
<Story name="Flash (Blue)" args={{ drumName: 'Snare', surfaceName: 'Desk', color: '#4a9eff', flash: true }} />
<Story name="Idle (Red)" args={{ drumName: 'Kick', surfaceName: 'Book', color: '#ff6b6b' }} />
<Story name="Flash (Red)" args={{ drumName: 'Kick', surfaceName: 'Book', color: '#ff6b6b', flash: true }} />
<Story name="Idle (Yellow)" args={{ drumName: 'Hi-Hat', surfaceName: 'Bottle', color: '#ffd93d' }} />
<Story name="Idle (Green)" args={{ drumName: 'Cymbal', surfaceName: 'Case', color: '#6bcb77' }} />

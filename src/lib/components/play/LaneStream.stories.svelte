<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import LaneStream from './LaneStream.svelte'

  const { Story } = defineMeta({
    title: 'Play/LaneStream',
    component: LaneStream,
    tags: ['autodocs'],
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8" style="max-width: 500px;"><slot /></div>'
      })
    ]
  })
</script>

<Story name="2 Lanes" args={{
  lanes: [
    { label: 'Snare', color: '#4a9eff', hits: [{ id: '1', intensity: 0.7 }] },
    { label: 'Kick', color: '#ff6b6b', hits: [{ id: '2', intensity: 0.9 }] }
  ]
}} />
<Story name="4 Lanes" args={{
  lanes: [
    { label: 'Snare', color: '#4a9eff', hits: [{ id: '1', intensity: 0.8 }, { id: '2', intensity: 0.5 }] },
    { label: 'Kick', color: '#ff6b6b', hits: [{ id: '3', intensity: 0.9 }] },
    { label: 'Hi-Hat', color: '#ffd93d', hits: [{ id: '4', intensity: 0.3 }, { id: '5', intensity: 0.6 }, { id: '6', intensity: 0.4 }] },
    { label: 'Cymbal', color: '#6bcb77', hits: [] }
  ]
}} />
<Story name="Empty" args={{
  lanes: [
    { label: 'Snare', color: '#4a9eff', hits: [] },
    { label: 'Kick', color: '#ff6b6b', hits: [] },
    { label: 'Hi-Hat', color: '#ffd93d', hits: [] }
  ]
}} />

<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import DrumPadGrid from './DrumPadGrid.svelte';

  const { Story } = defineMeta({
    title: 'Play/DrumPadGrid',
    component: DrumPadGrid,
    tags: ['autodocs']
  });
</script>

<Story
  name="Two Surfaces"
  args={{
    pads: [
      { drumName: 'Snare', surfaceName: 'Desk', color: '#4a9eff', flash: false },
      { drumName: 'Kick', surfaceName: 'Book', color: '#ff6b6b', flash: false }
    ]
  }}
/>
<Story
  name="Three Surfaces"
  args={{
    pads: [
      { drumName: 'Snare', surfaceName: 'Desk', color: '#4a9eff', flash: false },
      { drumName: 'Kick', surfaceName: 'Book', color: '#ff6b6b', flash: false },
      { drumName: 'Hi-Hat', surfaceName: 'Bottle', color: '#ffd93d', flash: true }
    ]
  }}
/>
<Story
  name="Four Surfaces"
  args={{
    pads: [
      { drumName: 'Snare', surfaceName: 'Desk', color: '#4a9eff', flash: true },
      { drumName: 'Kick', surfaceName: 'Book', color: '#ff6b6b', flash: false },
      { drumName: 'Hi-Hat', surfaceName: 'Bottle', color: '#ffd93d', flash: false },
      { drumName: 'Cymbal', surfaceName: 'Case', color: '#6bcb77', flash: false }
    ]
  }}
/>

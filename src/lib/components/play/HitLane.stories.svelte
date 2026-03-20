<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import HitLane from './HitLane.svelte';

  const { Story } = defineMeta({
    title: 'Play/HitLane',
    component: HitLane,
    tags: ['autodocs']
  });
</script>

<Story name="Empty" args={{ label: 'Snare', color: '#4a9eff', hits: [] }} />
<Story
  name="Sparse Hits"
  args={{
    label: 'Kick',
    color: '#ff6b6b',
    hits: [
      { id: '1', intensity: 0.8 },
      { id: '2', intensity: 0.5 }
    ]
  }}
/>
<Story
  name="Dense Hits"
  args={{
    label: 'Hi-Hat',
    color: '#ffd93d',
    hits: [
      { id: '1', intensity: 0.3 },
      { id: '2', intensity: 0.6 },
      { id: '3', intensity: 0.9 },
      { id: '4', intensity: 0.4 },
      { id: '5', intensity: 0.7 },
      { id: '6', intensity: 0.5 }
    ]
  }}
/>
<Story
  name="Varying Intensity"
  args={{
    label: 'Cymbal',
    color: '#6bcb77',
    hits: [
      { id: '1', intensity: 0.1 },
      { id: '2', intensity: 0.5 },
      { id: '3', intensity: 1.0 }
    ]
  }}
/>

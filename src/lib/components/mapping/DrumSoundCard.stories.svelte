<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import DrumSoundCard from './DrumSoundCard.svelte';
  import { fn } from 'storybook/test';

  const { Story } = defineMeta({
    title: 'Mapping/DrumSoundCard',
    component: DrumSoundCard,
    tags: ['autodocs'],
    args: { onpreview: fn() }
  });
</script>

<Story name="Available (Snare)" args={{ drumId: 'snare', assignedTo: null }} />
<Story name="Available (Kick)" args={{ drumId: 'kick', assignedTo: null }} />
<Story name="Assigned" args={{ drumId: 'snare', assignedTo: 'Desk' }} />
<Story name="Available (Hi-Hat)" args={{ drumId: 'hihat', assignedTo: null }} />
<Story name="Available (Cymbal)" args={{ drumId: 'cymbal', assignedTo: null }} />

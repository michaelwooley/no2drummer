<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import SurfaceTile from './SurfaceTile.svelte';

  const { Story } = defineMeta({
    title: 'Wizard/SurfaceTile',
    component: SurfaceTile,
    tags: ['autodocs']
  });
</script>

<Story name="Idle" args={{ name: 'Desk' }} />
<Story name="Active (high confidence)" args={{ name: 'Desk', confidence: 0.95 }} />
<Story name="Active (low confidence)" args={{ name: 'Book', confidence: 0.62 }} />
<Story name="Unrecognized" args={{ name: 'Desk', unrecognized: true }} />

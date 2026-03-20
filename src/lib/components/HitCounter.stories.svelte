<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import HitCounter from './HitCounter.svelte';

  const { Story } = defineMeta({
    title: 'Wizard/HitCounter',
    component: HitCounter,
    tags: ['autodocs']
  });
</script>

<Story name="Empty" args={{ count: 0 }} />
<Story name="In Progress" args={{ count: 67 }} />
<Story name="Flashing" args={{ count: 68, flash: true }} />
<Story name="Complete" args={{ count: 100 }} />

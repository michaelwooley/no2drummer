<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import SurfaceDot from './SurfaceDot.svelte';
  import { fn } from 'storybook/test';

  const { Story } = defineMeta({
    title: 'Wizard/SurfaceDot',
    component: SurfaceDot,
    tags: ['autodocs'],
    args: { onclick: fn() },
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8"><slot /></div>'
      })
    ]
  });
</script>

<Story name="Pending" args={{ name: 'Surface 1', count: 0 }} />
<Story name="Active" args={{ name: 'Desk', count: 67, active: true }} />
<Story name="Complete" args={{ name: 'Book', count: 102, complete: true }} />

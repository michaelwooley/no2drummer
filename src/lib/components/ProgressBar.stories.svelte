<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import ProgressBar from './ProgressBar.svelte';

  const { Story } = defineMeta({
    title: 'Wizard/ProgressBar',
    component: ProgressBar,
    tags: ['autodocs'],
    decorators: [
      () => ({
        Component: undefined,
        template: '<div class="bg-gray-950 p-8"><slot /></div>'
      })
    ]
  });
</script>

<Story name="Empty" args={{ value: 0, min: 50, max: 100 }} />
<Story name="Below Minimum" args={{ value: 30, min: 50, max: 100 }} />
<Story name="At Minimum" args={{ value: 50, min: 50, max: 100 }} />
<Story name="Above Minimum" args={{ value: 67, min: 50, max: 100 }} />
<Story name="Full" args={{ value: 100, min: 50, max: 100 }} />

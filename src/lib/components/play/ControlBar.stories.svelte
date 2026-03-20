<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import ControlBar from './ControlBar.svelte'
  import { fn } from 'storybook/test'

  const { Story } = defineMeta({
    title: 'Play/ControlBar',
    component: ControlBar,
    tags: ['autodocs'],
    args: {
      onthresholdchange: fn(),
      onremap: fn(),
      onretrain: fn()
    }
  })
</script>

<Story name="Default" args={{ threshold: 0.7 }} />
<Story name="Low Threshold" args={{ threshold: 0.3 }} />
<Story name="High Threshold" args={{ threshold: 0.95 }} />

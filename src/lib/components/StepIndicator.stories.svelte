<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import StepIndicator from './StepIndicator.svelte';

  const { Story } = defineMeta({
    title: 'Wizard/StepIndicator',
    component: StepIndicator,
    tags: ['autodocs']
  });
</script>

<Story name="Setup" args={{ currentStep: 'setup' }} />
<Story name="Record" args={{ currentStep: 'record' }} />
<Story name="Train" args={{ currentStep: 'train' }} />
<Story name="Try It" args={{ currentStep: 'try' }} />

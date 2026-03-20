<script lang="ts">
  import { browser } from '$app/environment';
  import './layout.css';

  let { children } = $props();

  let unsupported = $derived(
    browser &&
      (!navigator.mediaDevices?.getUserMedia ||
        (!window.AudioContext &&
          !(window as unknown as Record<string, unknown>).webkitAudioContext) ||
        !window.AudioWorklet ||
        !window.indexedDB)
  );
</script>

<svelte:head>
  <title>No. 2 drummer</title>
  <link
    rel="icon"
    href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✏️</text></svg>"
  />
</svelte:head>

{#if unsupported}
  <div class="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-8 text-center">
    <h1 class="mb-4 text-2xl font-bold text-white">Browser Not Supported</h1>
    <p class="max-w-md text-gray-400">
      Your browser doesn't support the audio features this app needs. Please use a recent version of
      Chrome, Firefox, or Edge.
    </p>
  </div>
{:else}
  {@render children()}
{/if}

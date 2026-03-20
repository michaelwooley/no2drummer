<script lang="ts">
  import { startCapture, type AudioCapture } from '$lib/audio/capture';
  import type { WorkletHitMessage } from '$lib/audio/types';

  interface HitRecord {
    id: number;
    timestamp: number;
    energy: number;
    spectralCentroid: number;
    zcr: number;
    mfcc: number[];
  }

  let capture: AudioCapture | null = $state(null);
  let isListening = $state(false);
  let error = $state<string | null>(null);
  let hits = $state<HitRecord[]>([]);
  let hitCount = $state(0);

  async function startListening() {
    try {
      error = null;
      capture = await startCapture();
      isListening = true;

      capture.onHit((event: WorkletHitMessage) => {
        hitCount++;
        const record: HitRecord = {
          id: hitCount,
          timestamp: event.timestamp,
          energy: event.features.energy,
          spectralCentroid: event.features.spectralCentroid,
          zcr: event.features.zcr,
          mfcc: Array.from(event.features.mfcc)
        };
        // Keep last 20 hits
        hits = [record, ...hits.slice(0, 19)];
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to start mic';
      isListening = false;
    }
  }

  function stopListening() {
    capture?.stop();
    capture = null;
    isListening = false;
  }
</script>

<div class="mx-auto max-w-2xl p-8">
  <h1 class="mb-4 text-3xl font-bold">Audio Debug</h1>
  <p class="mb-6 text-gray-400">Milestone 1: Hit detection and feature extraction</p>

  {#if error}
    <div class="mb-4 rounded-lg bg-red-900/30 p-4 text-red-300">
      {error}
    </div>
  {/if}

  <div class="mb-6">
    {#if isListening}
      <button
        class="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
        onclick={stopListening}
      >
        Stop Listening
      </button>
      <span class="ml-4 text-green-400">Listening... hit something!</span>
    {:else}
      <button
        class="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
        onclick={startListening}
      >
        Start Listening
      </button>
    {/if}
  </div>

  <div class="mb-2 text-sm text-gray-500">
    Hits detected: {hitCount}
  </div>

  {#if hits.length > 0}
    <div class="space-y-3">
      {#each hits as hit (hit.id)}
        <div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <div class="mb-2 flex items-center justify-between">
            <span class="font-mono text-sm text-gray-400">
              Hit #{hit.id}
            </span>
            <span class="text-sm text-gray-500">
              {hit.timestamp.toFixed(0)}ms
            </span>
          </div>
          <div class="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span class="text-gray-500">Energy</span>
              <div class="font-mono text-yellow-400">{hit.energy.toFixed(4)}</div>
            </div>
            <div>
              <span class="text-gray-500">Centroid</span>
              <div class="font-mono text-blue-400">{hit.spectralCentroid.toFixed(0)} Hz</div>
            </div>
            <div>
              <span class="text-gray-500">ZCR</span>
              <div class="font-mono text-green-400">{hit.zcr.toFixed(3)}</div>
            </div>
          </div>
          <div class="mt-2">
            <span class="text-xs text-gray-500">MFCCs</span>
            <div class="font-mono text-xs text-gray-400">
              [{hit.mfcc.map((c) => c.toFixed(1)).join(', ')}]
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

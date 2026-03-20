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

  // Live audio level meter (uses capture's AudioContext)
  let micLevel = $state(0);
  let micPeak = $state(0);
  let analyserCleanup: (() => void) | null = null;

  // Worklet debug
  let workletStatus = $state<string>('not started');
  let debugMessages = $state<string[]>([]);

  function startLevelMeter(audioContext: AudioContext, stream: MediaStream) {
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    let raf = 0;

    function update() {
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sum / buffer.length);
      micLevel = rms;
      if (rms > micPeak) micPeak = rms;
      raf = requestAnimationFrame(update);
    }
    update();

    analyserCleanup = () => {
      cancelAnimationFrame(raf);
      analyser.disconnect();
      source.disconnect();
    };
  }

  async function startListening() {
    try {
      error = null;

      capture = await startCapture();
      isListening = true;
      workletStatus = 'started, waiting for worklet init...';

      // Use capture's AudioContext and stream for level meter (single mic stream)
      startLevelMeter(capture.audioContext, capture.stream);

      capture.onDebug((message: string) => {
        workletStatus = message;
        debugMessages = [message, ...debugMessages.slice(0, 9)];
      });

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
    analyserCleanup?.();
    analyserCleanup = null;
    isListening = false;
    micLevel = 0;
    micPeak = 0;
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

  {#if isListening}
    <div class="mb-6 rounded-lg border border-gray-700 bg-gray-800 p-4">
      <div class="mb-1 flex items-center justify-between text-sm">
        <span class="text-gray-400">Mic Level</span>
        <span class="font-mono text-gray-500">
          RMS: {micLevel.toFixed(4)} | Peak: {micPeak.toFixed(4)}
        </span>
      </div>
      <div class="h-4 overflow-hidden rounded-full bg-gray-900">
        <div
          class="h-full rounded-full transition-all duration-75"
          class:bg-green-500={micLevel < 0.05}
          class:bg-yellow-500={micLevel >= 0.05 && micLevel < 0.2}
          class:bg-red-500={micLevel >= 0.2}
          style="width: {Math.min(micLevel * 500, 100)}%"
        ></div>
      </div>
      <div class="mt-1 text-xs text-gray-600">
        {#if micPeak < 0.001}
          No signal — check your mic input in System Settings
        {:else if micPeak < 0.01}
          Very low signal — try speaking or tapping near the mic
        {:else}
          Signal detected — try hitting a surface!
        {/if}
      </div>
    </div>
  {/if}

  {#if isListening}
    <div class="mb-4 rounded-lg border border-gray-700 bg-gray-900 p-3">
      <div class="mb-1 text-xs font-semibold text-gray-500">Worklet Debug</div>
      <div class="font-mono text-xs text-gray-400">
        Status: {workletStatus}
      </div>
      {#if debugMessages.length > 0}
        <div class="mt-1 space-y-0.5 font-mono text-xs text-gray-600">
          {#each debugMessages as msg}
            <div>{msg}</div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

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

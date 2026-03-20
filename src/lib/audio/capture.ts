import type { WorkletHitMessage } from './types';
import workletUrl from './worklet-processor.ts?worker&url';

export interface AudioCapture {
  /** Subscribe to hit events from the worklet */
  onHit: (callback: (event: WorkletHitMessage) => void) => void;
  /** Subscribe to debug messages from the worklet */
  onDebug: (callback: (message: string) => void) => void;
  /** Update sensitivity (forwarded to worklet) */
  setSensitivity: (value: number) => void;
  /** The AudioContext used for capture (for connecting analyzers, etc.) */
  audioContext: AudioContext;
  /** The mic MediaStream (for connecting level meters, etc.) */
  stream: MediaStream;
  /** Stop capturing and release resources */
  stop: () => void;
}

/**
 * Start capturing audio from the microphone.
 * Registers the AudioWorklet and returns a handle for receiving hits.
 *
 * Throws if mic permission is denied or AudioWorklet is unsupported.
 */
export async function startCapture(): Promise<AudioCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  });

  const audioContext = new AudioContext({ sampleRate: 44100 });

  // Ensure the context is running (browsers may start it suspended)
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  const source = audioContext.createMediaStreamSource(stream);

  // Load the worklet processor module.
  // ?worker&url tells Vite to bundle the worklet + its dependencies into a standalone JS file.
  await audioContext.audioWorklet.addModule(workletUrl);

  const workletNode = new AudioWorkletNode(audioContext, 'hit-detector');

  source.connect(workletNode);

  // Connect to destination through a silent gain node.
  // Without this, some browsers stop calling process() on the worklet.
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  workletNode.connect(silentGain);
  silentGain.connect(audioContext.destination);

  let hitCallback: ((event: WorkletHitMessage) => void) | null = null;
  let debugCallback: ((message: string) => void) | null = null;

  workletNode.port.onmessage = (
    event: MessageEvent<WorkletHitMessage | { type: 'debug'; message: string }>
  ) => {
    if (event.data.type === 'hit' && hitCallback) {
      hitCallback(event.data as WorkletHitMessage);
    } else if (event.data.type === 'debug' && debugCallback) {
      debugCallback((event.data as { type: 'debug'; message: string }).message);
    }
  };

  workletNode.onprocessorerror = (event) => {
    console.error('AudioWorklet processor error:', event);
  };

  return {
    onHit(callback) {
      hitCallback = callback;
    },
    onDebug(callback: (message: string) => void) {
      debugCallback = callback;
    },
    setSensitivity(value) {
      workletNode.port.postMessage({ type: 'config', sensitivityMultiplier: value });
    },
    audioContext,
    stream,
    stop() {
      workletNode.disconnect();
      silentGain.disconnect();
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      audioContext.close();
    }
  };
}

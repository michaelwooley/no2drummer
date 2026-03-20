import type { WorkletHitMessage } from './types'

export interface AudioCapture {
  /** Subscribe to hit events from the worklet */
  onHit: (callback: (event: WorkletHitMessage) => void) => void
  /** Update sensitivity (forwarded to worklet) */
  setSensitivity: (value: number) => void
  /** Stop capturing and release resources */
  stop: () => void
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
  })

  const audioContext = new AudioContext({ sampleRate: 44100 })
  const source = audioContext.createMediaStreamSource(stream)

  // Load the worklet processor module.
  // Vite handles the URL resolution for .ts files via import.meta.url.
  const workletUrl = new URL('./worklet-processor.ts', import.meta.url).href
  await audioContext.audioWorklet.addModule(workletUrl)

  const workletNode = new AudioWorkletNode(audioContext, 'hit-detector')

  source.connect(workletNode)

  let hitCallback: ((event: WorkletHitMessage) => void) | null = null

  workletNode.port.onmessage = (event: MessageEvent<WorkletHitMessage>) => {
    if (event.data.type === 'hit' && hitCallback) {
      hitCallback(event.data)
    }
  }

  return {
    onHit(callback) {
      hitCallback = callback
    },
    setSensitivity(value) {
      workletNode.port.postMessage({ type: 'config', sensitivityMultiplier: value })
    },
    stop() {
      workletNode.disconnect()
      source.disconnect()
      stream.getTracks().forEach((track) => track.stop())
      audioContext.close()
    }
  }
}

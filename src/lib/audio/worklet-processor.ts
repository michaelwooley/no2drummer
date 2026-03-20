import { OnsetDetector } from './onset'
import { extractFeatures } from './features'
import type { WorkletHitMessage, WorkletConfigMessage } from './types'

const SAMPLE_RATE = 44100
const BUFFER_SIZE = 512

class HitDetectorProcessor extends AudioWorkletProcessor {
  private ringBuffer = new Float32Array(BUFFER_SIZE)
  private writeIndex = 0
  private detector = new OnsetDetector()

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<WorkletConfigMessage>) => {
      if (event.data.type === 'config') {
        this.detector.setSensitivity(event.data.sensitivityMultiplier)
      }
    }
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0]
    if (!input) return true

    // Fill ring buffer
    for (let i = 0; i < input.length; i++) {
      this.ringBuffer[this.writeIndex] = input[i]
      this.writeIndex++

      // When buffer is full, check for onset
      if (this.writeIndex >= BUFFER_SIZE) {
        this.writeIndex = 0

        if (this.detector.process(this.ringBuffer)) {
          const features = extractFeatures(this.ringBuffer, SAMPLE_RATE)
          const message: WorkletHitMessage = {
            type: 'hit',
            features,
            intensity: features.energy,
            timestamp: performance.now()
          }
          this.port.postMessage(message)
        }
      }
    }

    return true
  }
}

registerProcessor('hit-detector', HitDetectorProcessor)

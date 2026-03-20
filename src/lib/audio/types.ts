/** Feature vector extracted from a single hit */
export interface FeatureVector {
  /** 13 Mel-frequency cepstral coefficients */
  mfcc: Float64Array
  /** Spectral centroid in Hz — "brightness" of the sound */
  spectralCentroid: number
  /** Zero-crossing rate — noisy vs tonal */
  zcr: number
  /** RMS energy — hit intensity */
  energy: number
}

/** Message posted from AudioWorklet to main thread */
export interface WorkletHitMessage {
  type: 'hit'
  features: FeatureVector
  /** RMS energy of the hit, used for volume scaling */
  intensity: number
  /** Timestamp from performance.now() at detection time */
  timestamp: number
}

/** Message posted from main thread to AudioWorklet */
export interface WorkletConfigMessage {
  type: 'config'
  /** Energy threshold multiplier for onset detection (higher = less sensitive) */
  sensitivityMultiplier: number
}

export type WorkletMessage = WorkletHitMessage | WorkletConfigMessage

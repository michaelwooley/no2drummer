// Type declarations for the AudioWorklet processor scope.
// These globals are available inside an AudioWorkletProcessor file but are not
// included in TypeScript's standard DOM lib.

declare class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor()
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor
): void

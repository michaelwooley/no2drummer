import type { ClassifierModel } from '$lib/classifier/model'
import type { DrumId } from '$lib/player/samples'

export interface KitState {
  model: ClassifierModel | null
  surfaceNames: string[]
  mapping: Record<string, DrumId> | null
  confidenceThreshold: number
}

const DEFAULT_THRESHOLD = 0.7
const DEFAULT_DRUMS: DrumId[] = ['snare', 'kick', 'hihat', 'cymbal']

export const DRUM_DISPLAY_NAMES: Record<DrumId, string> = {
  kick: 'Kick',
  snare: 'Snare',
  hihat: 'Hi-Hat',
  cymbal: 'Cymbal'
}

// eslint-disable-next-line prefer-const -- Svelte 5 $state() requires `let` for reactive proxy
export let kitState: KitState = $state({
  model: null,
  surfaceNames: [],
  mapping: null,
  confidenceThreshold: DEFAULT_THRESHOLD
})

export function resetKit(): void {
  kitState.model = null
  kitState.surfaceNames = []
  kitState.mapping = null
  kitState.confidenceThreshold = DEFAULT_THRESHOLD
}

export function setModel(model: ClassifierModel, surfaceNames: string[]): void {
  kitState.model = model
  kitState.surfaceNames = surfaceNames
  kitState.mapping = null
}

export function setMapping(mapping: Record<string, DrumId>): void {
  kitState.mapping = mapping
}

export function setThreshold(value: number): void {
  kitState.confidenceThreshold = Math.max(0, Math.min(1, value))
}

export function getDefaultMapping(surfaceNames: string[]): Record<string, DrumId> {
  const mapping: Record<string, DrumId> = {}
  for (let i = 0; i < surfaceNames.length; i++) {
    mapping[surfaceNames[i]] = DEFAULT_DRUMS[i]
  }
  return mapping
}

export function hasModel(): boolean {
  return kitState.model !== null
}

export function hasMapping(): boolean {
  return kitState.mapping !== null
}

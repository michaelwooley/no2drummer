import type { FeatureVector } from '$lib/audio/types';
import type { ClassifierModel } from '$lib/classifier/model';
import { createModel, addSample } from '$lib/classifier/trainer';

export interface SurfaceConfig {
  name: string;
}

interface WizardState {
  surfaces: SurfaceConfig[];
  recordings: Record<string, FeatureVector[]>;
  currentSurfaceIndex: number;
  model: ClassifierModel | null;
}

// eslint-disable-next-line prefer-const -- Svelte 5 $state() requires `let` for reactive proxy
export let wizardState: WizardState = $state({
  surfaces: [],
  recordings: {},
  currentSurfaceIndex: 0,
  model: null
});

export function reset(): void {
  wizardState.surfaces = [];
  wizardState.recordings = {};
  wizardState.currentSurfaceIndex = 0;
  wizardState.model = null;
}

export function setSurfaces(surfaces: SurfaceConfig[]): void {
  wizardState.surfaces = surfaces;
  wizardState.recordings = {};
  wizardState.currentSurfaceIndex = 0;
  wizardState.model = null;
}

export function addRecording(surface: string, fv: FeatureVector): void {
  if (!wizardState.recordings[surface]) {
    wizardState.recordings[surface] = [];
  }
  wizardState.recordings[surface].push(fv);
}

export function setCurrentSurface(index: number): void {
  wizardState.currentSurfaceIndex = index;
}

export function getRecordingCount(surface: string): number {
  return wizardState.recordings[surface]?.length ?? 0;
}

export function canProceedFromSetup(): boolean {
  const named = wizardState.surfaces.filter((s) => s.name.trim().length > 0);
  const uniqueNames = new Set(named.map((s) => s.name.trim()));
  return uniqueNames.size >= 2 && uniqueNames.size === named.length;
}

export function canProceedToTrain(): boolean {
  if (wizardState.surfaces.length < 2) return false;
  return wizardState.surfaces.every((s) => getRecordingCount(s.name) >= 50);
}

export function buildModel(): void {
  let model = createModel();
  for (const [surface, recordings] of Object.entries(wizardState.recordings)) {
    for (const fv of recordings) {
      model = addSample(model, surface, fv);
    }
  }
  wizardState.model = model;
}

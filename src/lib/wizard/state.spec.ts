import { describe, it, expect, beforeEach } from 'vitest';
import type { FeatureVector } from '$lib/audio/types';
import {
  wizardState,
  reset,
  setSurfaces,
  addRecording,
  setCurrentSurface,
  buildModel,
  getRecordingCount,
  canProceedToTrain,
  canProceedFromSetup,
  prepareRetrain
} from './state.svelte';

function makeFV(seed: number): FeatureVector {
  return {
    mfcc: new Float64Array([
      seed,
      seed + 1,
      seed + 2,
      seed + 3,
      seed + 4,
      seed + 5,
      seed + 6,
      seed + 7,
      seed + 8,
      seed + 9,
      seed + 10,
      seed + 11,
      seed + 12
    ]),
    spectralCentroid: seed * 100,
    zcr: seed * 0.1,
    energy: seed * 0.05
  };
}

describe('wizard store', () => {
  beforeEach(() => {
    reset();
  });

  describe('reset', () => {
    it('returns to initial state', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }]);
      addRecording('Desk', makeFV(1));
      reset();

      expect(wizardState.surfaces).toHaveLength(0);
      expect(Object.keys(wizardState.recordings)).toHaveLength(0);
      expect(wizardState.currentSurfaceIndex).toBe(0);
      expect(wizardState.model).toBeNull();
    });
  });

  describe('setSurfaces', () => {
    it('sets surface configs and clears recordings', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }]);
      addRecording('Desk', makeFV(1));

      setSurfaces([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);

      expect(wizardState.surfaces).toHaveLength(3);
      expect(wizardState.surfaces[0].name).toBe('A');
      expect(Object.keys(wizardState.recordings)).toHaveLength(0);
      expect(wizardState.currentSurfaceIndex).toBe(0);
      expect(wizardState.model).toBeNull();
    });
  });

  describe('addRecording', () => {
    it('appends a FeatureVector to the named surface', () => {
      setSurfaces([{ name: 'Desk' }]);
      addRecording('Desk', makeFV(1));
      addRecording('Desk', makeFV(2));

      expect(wizardState.recordings['Desk']).toHaveLength(2);
    });

    it('creates entry if surface not yet recorded', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }]);
      addRecording('Book', makeFV(1));

      expect(wizardState.recordings['Book']).toHaveLength(1);
      expect(wizardState.recordings['Desk']).toBeUndefined();
    });
  });

  describe('setCurrentSurface', () => {
    it('updates currentSurfaceIndex', () => {
      setSurfaces([{ name: 'A' }, { name: 'B' }]);
      setCurrentSurface(1);

      expect(wizardState.currentSurfaceIndex).toBe(1);
    });
  });

  describe('getRecordingCount', () => {
    it('returns 0 for unrecorded surface', () => {
      setSurfaces([{ name: 'Desk' }]);

      expect(getRecordingCount('Desk')).toBe(0);
    });

    it('returns correct count', () => {
      setSurfaces([{ name: 'Desk' }]);
      addRecording('Desk', makeFV(1));
      addRecording('Desk', makeFV(2));
      addRecording('Desk', makeFV(3));

      expect(getRecordingCount('Desk')).toBe(3);
    });
  });

  describe('canProceedFromSetup', () => {
    it('returns false with no surfaces', () => {
      expect(canProceedFromSetup()).toBe(false);
    });

    it('returns false with only 1 named surface', () => {
      setSurfaces([{ name: 'Desk' }]);

      expect(canProceedFromSetup()).toBe(false);
    });

    it('returns true with 2+ named surfaces', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }]);

      expect(canProceedFromSetup()).toBe(true);
    });

    it('returns false if any surface has empty name', () => {
      setSurfaces([{ name: 'Desk' }, { name: '' }]);

      expect(canProceedFromSetup()).toBe(false);
    });

    it('returns false if surfaces have duplicate names', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Desk' }]);

      expect(canProceedFromSetup()).toBe(false);
    });
  });

  describe('canProceedToTrain', () => {
    it('returns false when no recordings', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }]);

      expect(canProceedToTrain()).toBe(false);
    });

    it('returns false when not all surfaces have 50+ hits', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }]);
      for (let i = 0; i < 50; i++) addRecording('Desk', makeFV(i));
      for (let i = 0; i < 10; i++) addRecording('Book', makeFV(i));

      expect(canProceedToTrain()).toBe(false);
    });

    it('returns true when all surfaces have 50+ hits', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }]);
      for (let i = 0; i < 50; i++) addRecording('Desk', makeFV(i));
      for (let i = 0; i < 50; i++) addRecording('Book', makeFV(i));

      expect(canProceedToTrain()).toBe(true);
    });
  });

  describe('buildModel', () => {
    it('creates a ClassifierModel from all recordings', () => {
      setSurfaces([{ name: 'Desk' }, { name: 'Book' }]);
      for (let i = 0; i < 5; i++) addRecording('Desk', makeFV(i));
      for (let i = 0; i < 5; i++) addRecording('Book', makeFV(i + 10));

      buildModel();

      expect(wizardState.model).not.toBeNull();
      expect(wizardState.model!.normalization).not.toBeNull();
    });

    it('model has samples for each surface', () => {
      setSurfaces([{ name: 'A' }, { name: 'B' }]);
      for (let i = 0; i < 3; i++) addRecording('A', makeFV(i));
      for (let i = 0; i < 3; i++) addRecording('B', makeFV(i + 10));

      buildModel();

      expect(wizardState.model!.surfaces['A']).toHaveLength(3);
      expect(wizardState.model!.surfaces['B']).toHaveLength(3);
    });
  });

  describe('prepareRetrain', () => {
    it('sets surfaces from names and clears recordings', () => {
      // Pre-populate with some data
      setSurfaces([{ name: 'Old' }]);
      addRecording('Old', makeFV(1));

      prepareRetrain(['Desk', 'Book']);

      expect(wizardState.surfaces).toEqual([{ name: 'Desk' }, { name: 'Book' }]);
      expect(Object.keys(wizardState.recordings)).toHaveLength(0);
      expect(wizardState.currentSurfaceIndex).toBe(0);
      expect(wizardState.model).toBeNull();
    });

    it('handles single surface', () => {
      prepareRetrain(['Bottle']);

      expect(wizardState.surfaces).toEqual([{ name: 'Bottle' }]);
    });
  });
});

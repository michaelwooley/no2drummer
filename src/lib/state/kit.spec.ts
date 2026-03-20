import { describe, it, expect, beforeEach } from 'vitest';
import {
  kitState,
  resetKit,
  setModel,
  setMapping,
  setThreshold,
  getDefaultMapping,
  hasModel,
  hasMapping,
  DRUM_DISPLAY_NAMES
} from './kit.svelte';
import { loadKitIntoState } from './kit.svelte';
import type { ClassifierModel } from '$lib/classifier/model';
import type { DrumId } from '$lib/player/samples';
import type { SavedKit } from '$lib/storage/db';

function makeMockModel(): ClassifierModel {
  return {
    surfaces: {
      Desk: [{ surface: 'Desk', features: new Array(16).fill(1) }],
      Book: [{ surface: 'Book', features: new Array(16).fill(2) }]
    },
    normalization: { mean: new Array(16).fill(0), std: new Array(16).fill(1) }
  };
}

describe('kit state', () => {
  beforeEach(() => {
    resetKit();
  });

  describe('resetKit', () => {
    it('returns to initial state', () => {
      setModel(makeMockModel(), ['Desk', 'Book']);
      setMapping({ Desk: 'snare', Book: 'kick' });
      setThreshold(0.5);
      resetKit();

      expect(kitState.model).toBeNull();
      expect(kitState.surfaceNames).toHaveLength(0);
      expect(kitState.mapping).toBeNull();
      expect(kitState.confidenceThreshold).toBe(0.7);
    });
  });

  describe('setModel', () => {
    it('sets model and surface names', () => {
      const model = makeMockModel();
      setModel(model, ['Desk', 'Book']);

      expect(kitState.model).toBe(model);
      expect(kitState.surfaceNames).toEqual(['Desk', 'Book']);
    });

    it('clears mapping when model changes', () => {
      setModel(makeMockModel(), ['Desk', 'Book']);
      setMapping({ Desk: 'snare', Book: 'kick' });
      setModel(makeMockModel(), ['A', 'B']);

      expect(kitState.mapping).toBeNull();
    });
  });

  describe('setMapping', () => {
    it('sets the mapping', () => {
      const mapping: Record<string, DrumId> = { Desk: 'snare', Book: 'kick' };
      setMapping(mapping);

      expect(kitState.mapping).toEqual(mapping);
    });
  });

  describe('setThreshold', () => {
    it('updates confidence threshold', () => {
      setThreshold(0.5);

      expect(kitState.confidenceThreshold).toBe(0.5);
    });

    it('clamps to [0, 1]', () => {
      setThreshold(1.5);
      expect(kitState.confidenceThreshold).toBe(1);

      setThreshold(-0.1);
      expect(kitState.confidenceThreshold).toBe(0);
    });
  });

  describe('getDefaultMapping', () => {
    it('maps surfaces to drums in order: snare, kick, hihat, cymbal', () => {
      const mapping = getDefaultMapping(['Desk', 'Book', 'Bottle', 'Case']);

      expect(mapping).toEqual({
        Desk: 'snare',
        Book: 'kick',
        Bottle: 'hihat',
        Case: 'cymbal'
      });
    });

    it('handles 2 surfaces', () => {
      const mapping = getDefaultMapping(['A', 'B']);

      expect(mapping).toEqual({ A: 'snare', B: 'kick' });
    });

    it('handles 3 surfaces', () => {
      const mapping = getDefaultMapping(['A', 'B', 'C']);

      expect(mapping).toEqual({ A: 'snare', B: 'kick', C: 'hihat' });
    });
  });

  describe('hasModel', () => {
    it('returns false when no model', () => {
      expect(hasModel()).toBe(false);
    });

    it('returns true when model is set', () => {
      setModel(makeMockModel(), ['Desk', 'Book']);

      expect(hasModel()).toBe(true);
    });
  });

  describe('hasMapping', () => {
    it('returns false when no mapping', () => {
      expect(hasMapping()).toBe(false);
    });

    it('returns true when mapping is set', () => {
      setMapping({ Desk: 'snare' });

      expect(hasMapping()).toBe(true);
    });
  });

  describe('DRUM_DISPLAY_NAMES', () => {
    it('has display names for all drum types', () => {
      expect(DRUM_DISPLAY_NAMES.kick).toBe('Kick');
      expect(DRUM_DISPLAY_NAMES.snare).toBe('Snare');
      expect(DRUM_DISPLAY_NAMES.hihat).toBe('Hi-Hat');
      expect(DRUM_DISPLAY_NAMES.cymbal).toBe('Cymbal');
    });
  });

  describe('loadKitIntoState', () => {
    it('populates model, surfaceNames, mapping, threshold, and currentKitId', () => {
      const kit: SavedKit = {
        id: 'kit-123',
        name: 'My Kit',
        createdAt: 1000,
        updatedAt: 2000,
        surfaceNames: ['Desk', 'Book'],
        model: makeMockModel(),
        mapping: { Desk: 'snare', Book: 'kick' },
        settings: { confidenceThreshold: 0.5 }
      };
      loadKitIntoState(kit);

      expect(kitState.model).toBe(kit.model);
      expect(kitState.surfaceNames).toEqual(['Desk', 'Book']);
      expect(kitState.mapping).toEqual({ Desk: 'snare', Book: 'kick' });
      expect(kitState.confidenceThreshold).toBe(0.5);
      expect(kitState.currentKitId).toBe('kit-123');
    });

    it('overwrites previous state', () => {
      setModel(makeMockModel(), ['A']);
      setMapping({ A: 'cymbal' });

      const kit: SavedKit = {
        id: 'kit-456',
        name: 'Other',
        createdAt: 1000,
        updatedAt: 2000,
        surfaceNames: ['X', 'Y'],
        model: makeMockModel(),
        mapping: { X: 'kick', Y: 'hihat' },
        settings: { confidenceThreshold: 0.8 }
      };
      loadKitIntoState(kit);

      expect(kitState.surfaceNames).toEqual(['X', 'Y']);
      expect(kitState.mapping).toEqual({ X: 'kick', Y: 'hihat' });
      expect(kitState.currentKitId).toBe('kit-456');
    });
  });

  describe('currentKitId', () => {
    it('is null by default', () => {
      expect(kitState.currentKitId).toBeNull();
    });

    it('is cleared by resetKit', () => {
      const kit: SavedKit = {
        id: 'kit-789',
        name: 'Test',
        createdAt: 1000,
        updatedAt: 2000,
        surfaceNames: ['A'],
        model: makeMockModel(),
        mapping: { A: 'snare' },
        settings: { confidenceThreshold: 0.7 }
      };
      loadKitIntoState(kit);
      resetKit();

      expect(kitState.currentKitId).toBeNull();
    });
  });
});

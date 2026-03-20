import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { saveKit, loadKit, deleteKit, listKits, hasAnySavedKit } from './db';
import type { SavedKit } from './db';
import type { ClassifierModel } from '$lib/classifier/model';

function makeMockModel(): ClassifierModel {
  return {
    surfaces: {
      Desk: [{ surface: 'Desk', features: new Array(16).fill(1) }],
      Book: [{ surface: 'Book', features: new Array(16).fill(2) }]
    },
    normalization: { mean: new Array(16).fill(0), std: new Array(16).fill(1) }
  };
}

function makeKit(overrides: Partial<SavedKit> = {}): SavedKit {
  return {
    id: 'test-id-1',
    name: 'Test Kit',
    createdAt: 1000,
    updatedAt: 1000,
    surfaceNames: ['Desk', 'Book'],
    model: makeMockModel(),
    mapping: { Desk: 'snare', Book: 'kick' },
    settings: { confidenceThreshold: 0.7 },
    ...overrides
  };
}

describe('storage', () => {
  beforeEach(() => {
    // Clear IndexedDB between tests
    indexedDB = new IDBFactory();
  });

  describe('saveKit and loadKit', () => {
    it('saves and loads a kit by id', async () => {
      const kit = makeKit();
      await saveKit(kit);
      const loaded = await loadKit('test-id-1');

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe('test-id-1');
      expect(loaded!.name).toBe('Test Kit');
      expect(loaded!.surfaceNames).toEqual(['Desk', 'Book']);
      expect(loaded!.mapping).toEqual({ Desk: 'snare', Book: 'kick' });
      expect(loaded!.settings.confidenceThreshold).toBe(0.7);
    });

    it('returns null for nonexistent id', async () => {
      const loaded = await loadKit('does-not-exist');
      expect(loaded).toBeNull();
    });

    it('overwrites when saving with same id', async () => {
      await saveKit(makeKit({ updatedAt: 1000 }));
      await saveKit(makeKit({ updatedAt: 2000 }));
      const loaded = await loadKit('test-id-1');

      expect(loaded!.updatedAt).toBe(2000);
    });
  });
});

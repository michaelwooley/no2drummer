import { describe, it, expect } from 'vitest';
import { serializeModel, deserializeModel } from './model';
import type { ClassifierModel } from './model';

describe('serializeModel', () => {
  it('returns a valid JSON string', () => {
    const model: ClassifierModel = {
      surfaces: {
        desk: [{ surface: 'desk', features: [1, 2, 3] }]
      },
      normalization: { mean: [1], std: [0.5] }
    };
    const json = serializeModel(model);

    expect(typeof json).toBe('string');
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe('deserializeModel', () => {
  it('round-trips a model correctly', () => {
    const model: ClassifierModel = {
      surfaces: {
        desk: [
          { surface: 'desk', features: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] }
        ],
        book: [
          { surface: 'book', features: [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] }
        ]
      },
      normalization: {
        mean: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        std: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
      }
    };
    const restored = deserializeModel(serializeModel(model));

    expect(restored.surfaces['desk']).toHaveLength(1);
    expect(restored.surfaces['desk'][0].features).toEqual(model.surfaces['desk'][0].features);
    expect(restored.surfaces['book']).toHaveLength(1);
    expect(restored.normalization).toEqual(model.normalization);
  });

  it('round-trips a model with null normalization', () => {
    const model: ClassifierModel = {
      surfaces: {},
      normalization: null
    };
    const restored = deserializeModel(serializeModel(model));

    expect(Object.keys(restored.surfaces)).toHaveLength(0);
    expect(restored.normalization).toBeNull();
  });

  it('throws on invalid JSON', () => {
    expect(() => deserializeModel('not json')).toThrow();
  });

  it('throws on missing surfaces field', () => {
    expect(() => deserializeModel(JSON.stringify({ normalization: null }))).toThrow();
  });

  it('throws on invalid surfaces type', () => {
    expect(() =>
      deserializeModel(JSON.stringify({ surfaces: 'not an object', normalization: null }))
    ).toThrow();
  });
});

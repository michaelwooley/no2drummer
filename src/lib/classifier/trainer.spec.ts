import { describe, it, expect } from 'vitest';
import { createModel, addSample } from './trainer';
import type { FeatureVector } from '$lib/audio/types';

function makeFV(values: number[]): FeatureVector {
  return {
    mfcc: new Float64Array(values.slice(0, 13)),
    spectralCentroid: values[13] ?? 0,
    zcr: values[14] ?? 0,
    energy: values[15] ?? 0
  };
}

describe('createModel', () => {
  it('returns empty model with null normalization', () => {
    const model = createModel();

    expect(Object.keys(model.surfaces)).toHaveLength(0);
    expect(model.normalization).toBeNull();
  });
});

describe('addSample', () => {
  it('adds a sample to the correct surface', () => {
    const model = createModel();
    const fv = makeFV([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 100, 0.5, 0.8]);
    const updated = addSample(model, 'desk', fv);

    expect(Object.keys(updated.surfaces)).toHaveLength(1);
    expect(updated.surfaces['desk']).toHaveLength(1);
    expect(updated.surfaces['desk'][0].surface).toBe('desk');
    expect(updated.surfaces['desk'][0].features).toHaveLength(16);
  });

  it('creates new surface entry if not present', () => {
    const model = createModel();
    const fv = makeFV(new Array(16).fill(1));

    const step1 = addSample(model, 'desk', fv);
    const step2 = addSample(step1, 'book', fv);

    expect(Object.keys(step2.surfaces)).toHaveLength(2);
    expect(step2.surfaces['desk']).toHaveLength(1);
    expect(step2.surfaces['book']).toHaveLength(1);
  });

  it('recomputes normalization after adding', () => {
    const model = createModel();
    const fv1 = makeFV([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const fv2 = makeFV([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);

    const step1 = addSample(model, 'a', fv1);
    expect(step1.normalization).not.toBeNull();

    const step2 = addSample(step1, 'a', fv2);
    expect(step2.normalization).not.toBeNull();
    // Mean should be 1 for each dimension
    expect(step2.normalization!.mean[0]).toBeCloseTo(1, 5);
  });

  it('returns a new model (immutability)', () => {
    const model = createModel();
    const fv = makeFV(new Array(16).fill(1));
    const updated = addSample(model, 'desk', fv);

    expect(updated).not.toBe(model);
    expect(Object.keys(model.surfaces)).toHaveLength(0);
    expect(Object.keys(updated.surfaces)).toHaveLength(1);
  });
});

import { removeSurface, getSurfaceNames, getSampleCount } from './trainer';

describe('removeSurface', () => {
  it('removes a surface and its samples', () => {
    let model = createModel();
    const fv = makeFV(new Array(16).fill(1));

    model = addSample(model, 'desk', fv);
    model = addSample(model, 'book', fv);
    const updated = removeSurface(model, 'desk');

    expect(Object.keys(updated.surfaces)).toHaveLength(1);
    expect(updated.surfaces['desk']).toBeUndefined();
    expect(updated.surfaces['book']).toHaveLength(1);
  });

  it('recomputes normalization after removing', () => {
    let model = createModel();
    const fv1 = makeFV([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const fv2 = makeFV([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);

    model = addSample(model, 'a', fv1);
    model = addSample(model, 'b', fv2);
    const updated = removeSurface(model, 'b');

    // Only surface 'a' remains with [0,...0], so mean should be 0
    expect(updated.normalization!.mean[0]).toBe(0);
  });

  it('returns a new model (immutability)', () => {
    let model = createModel();
    const fv = makeFV(new Array(16).fill(1));
    model = addSample(model, 'desk', fv);
    const updated = removeSurface(model, 'desk');

    expect(updated).not.toBe(model);
    expect(Object.keys(model.surfaces)).toHaveLength(1);
    expect(Object.keys(updated.surfaces)).toHaveLength(0);
  });
});

describe('getSurfaceNames', () => {
  it('returns empty array for empty model', () => {
    const model = createModel();
    expect(getSurfaceNames(model)).toEqual([]);
  });

  it('returns surface names', () => {
    let model = createModel();
    const fv = makeFV(new Array(16).fill(1));
    model = addSample(model, 'desk', fv);
    model = addSample(model, 'book', fv);

    const names = getSurfaceNames(model);
    expect(names).toHaveLength(2);
    expect(names).toContain('desk');
    expect(names).toContain('book');
  });
});

describe('getSampleCount', () => {
  it('returns 0 for unknown surface', () => {
    const model = createModel();
    expect(getSampleCount(model, 'desk')).toBe(0);
  });

  it('returns correct count', () => {
    let model = createModel();
    const fv = makeFV(new Array(16).fill(1));
    model = addSample(model, 'desk', fv);
    model = addSample(model, 'desk', fv);
    model = addSample(model, 'desk', fv);

    expect(getSampleCount(model, 'desk')).toBe(3);
  });
});

# Milestone 2: Classification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a KNN classifier that takes feature vectors from Milestone 1's audio pipeline and predicts which surface was hit, with confidence scoring.

**Architecture:** Functional API with pure functions and external state. Four modules under `src/lib/classifier/`: types + serialization (`model.ts`), z-score normalization (`normalize.ts`), KNN classifier (`knn.ts`), and model construction (`trainer.ts`). The classifier consumes `FeatureVector` from `src/lib/audio/types.ts`, flattens to `number[]` at the boundary, and uses inverse-distance-weighted KNN with k=5.

**Tech Stack:** TypeScript, Vitest (server project)

**Spec:** `docs/superpowers/specs/2026-03-19-milestone-2-classification-design.md`

---

## File Structure

```
src/lib/classifier/
├── model.ts            — Type definitions (ClassifierModel, etc.) + JSON serialization
├── model.spec.ts       — Serialization round-trip tests
├── normalize.ts        — flattenFeatureVector, computeNormalization, normalize
├── normalize.spec.ts   — Normalization tests
├── knn.ts              — euclideanDistance, classify
├── knn.spec.ts         — Classification tests + integration test
├── trainer.ts          — createModel, addSample, removeSurface, helpers
└── trainer.spec.ts     — Training pipeline tests
```

**Dependency order:** `model.ts` (types) → `normalize.ts` → `knn.ts` + `trainer.ts` → `model.ts` (serialization). Tests are written before implementation (TDD).

**Existing dependency:** `FeatureVector` from `src/lib/audio/types.ts` — already implemented in Milestone 1. The `FeatureVector` has `mfcc: Float64Array` (13 values), `spectralCentroid: number`, `zcr: number`, `energy: number`.

---

## Task 1: Type Definitions

**Files:**
- Create: `src/lib/classifier/model.ts`

- [ ] **Step 1: Create type definitions**

```ts
import type { FeatureVector } from '$lib/audio/types';

/** Number of features in a flattened FeatureVector (13 MFCCs + centroid + ZCR + energy) */
export const FEATURE_COUNT = 16;

/** A labeled training sample — flattened feature vector with surface label */
export interface LabeledSample {
  surface: string;
  features: number[];
}

/** Z-score normalization parameters */
export interface NormalizationParams {
  mean: number[];
  std: number[];
}

/** The complete classifier model */
export interface ClassifierModel {
  surfaces: Record<string, LabeledSample[]>;
  normalization: NormalizationParams | null;
}

/** Classification result */
export interface ClassificationResult {
  surface: string;
  confidence: number;
}
```

- [ ] **Step 2: Verify types compile**

Run: `bun run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/classifier/model.ts
git commit -m "feat(classifier): add type definitions for classification model"
```

---

## Task 2: Feature Vector Flattening

**Files:**
- Create: `src/lib/classifier/normalize.ts`
- Create: `src/lib/classifier/normalize.spec.ts`

- [ ] **Step 1: Write failing tests for flattenFeatureVector**

```ts
import { describe, it, expect } from 'vitest';
import { flattenFeatureVector } from './normalize';
import type { FeatureVector } from '$lib/audio/types';

describe('flattenFeatureVector', () => {
  it('produces 16 elements in correct order', () => {
    const fv: FeatureVector = {
      mfcc: new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
      spectralCentroid: 100,
      zcr: 0.5,
      energy: 0.8
    };
    const flat = flattenFeatureVector(fv);

    expect(flat).toHaveLength(16);
    // First 13: MFCCs
    expect(flat.slice(0, 13)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    // Then centroid, ZCR, energy
    expect(flat[13]).toBe(100);
    expect(flat[14]).toBe(0.5);
    expect(flat[15]).toBe(0.8);
  });

  it('converts Float64Array MFCCs to plain numbers', () => {
    const fv: FeatureVector = {
      mfcc: new Float64Array(13).fill(0),
      spectralCentroid: 0,
      zcr: 0,
      energy: 0
    };
    const flat = flattenFeatureVector(fv);

    expect(flat).toHaveLength(16);
    expect(Array.isArray(flat)).toBe(true);
    for (const val of flat) {
      expect(typeof val).toBe('number');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- src/lib/classifier/normalize.spec.ts`
Expected: FAIL — `flattenFeatureVector` not found

- [ ] **Step 3: Implement flattenFeatureVector**

```ts
import type { FeatureVector } from '$lib/audio/types';
import type { ClassifierModel, NormalizationParams } from './model';

/**
 * Flatten a FeatureVector into a plain number array for the classifier.
 * Order: 13 MFCCs, spectral centroid, ZCR, energy (16 elements total).
 */
export function flattenFeatureVector(fv: FeatureVector): number[] {
  return [...fv.mfcc, fv.spectralCentroid, fv.zcr, fv.energy];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- src/lib/classifier/normalize.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/classifier/normalize.ts src/lib/classifier/normalize.spec.ts
git commit -m "feat(classifier): add feature vector flattening"
```

---

## Task 3: Z-Score Normalization

**Files:**
- Modify: `src/lib/classifier/normalize.ts`
- Modify: `src/lib/classifier/normalize.spec.ts`

- [ ] **Step 1: Write failing tests for computeNormalization and normalize**

Append to `normalize.spec.ts`:

```ts
import { computeNormalization, normalize } from './normalize';
import type { ClassifierModel } from './model';

describe('computeNormalization', () => {
  it('computes correct mean and std for known data', () => {
    const model: ClassifierModel = {
      surfaces: {
        a: [
          { surface: 'a', features: [2, 4] },
          { surface: 'a', features: [4, 6] }
        ],
        b: [
          { surface: 'b', features: [6, 8] }
        ]
      },
      normalization: null
    };
    const params = computeNormalization(model);

    // Mean of [2, 4, 6] = 4, Mean of [4, 6, 8] = 6
    expect(params.mean[0]).toBeCloseTo(4, 5);
    expect(params.mean[1]).toBeCloseTo(6, 5);

    // Std of [2, 4, 6] = sqrt(((2-4)^2 + (4-4)^2 + (6-4)^2) / 3) = sqrt(8/3)
    expect(params.std[0]).toBeCloseTo(Math.sqrt(8 / 3), 5);
    // Std of [4, 6, 8] = sqrt(((4-6)^2 + (6-6)^2 + (8-6)^2) / 3) = sqrt(8/3)
    expect(params.std[1]).toBeCloseTo(Math.sqrt(8 / 3), 5);
  });

  it('returns zero std when all values are identical', () => {
    const model: ClassifierModel = {
      surfaces: {
        a: [
          { surface: 'a', features: [5, 5] },
          { surface: 'a', features: [5, 5] }
        ]
      },
      normalization: null
    };
    const params = computeNormalization(model);

    expect(params.mean[0]).toBe(5);
    expect(params.std[0]).toBe(0);
  });
});

describe('normalize', () => {
  it('produces z-scored values', () => {
    const params = { mean: [10, 20], std: [2, 5] };
    const result = normalize([12, 25], params);

    // (12 - 10) / 2 = 1, (25 - 20) / 5 = 1
    expect(result[0]).toBeCloseTo(1, 5);
    expect(result[1]).toBeCloseTo(1, 5);
  });

  it('returns 0 when std is 0', () => {
    const params = { mean: [5], std: [0] };
    const result = normalize([5], params);

    expect(result[0]).toBe(0);
  });

  it('does not produce NaN', () => {
    const params = { mean: [0], std: [0] };
    const result = normalize([100], params);

    expect(result[0]).toBe(0);
    expect(Number.isNaN(result[0])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- src/lib/classifier/normalize.spec.ts`
Expected: FAIL — `computeNormalization` and `normalize` not found

- [ ] **Step 3: Implement computeNormalization and normalize**

Add to `normalize.ts`:

```ts
/**
 * Compute z-score normalization parameters (mean, std) across all samples in the model.
 * Uses population std (divide by N, not N-1) since we want to normalize training data itself.
 */
export function computeNormalization(model: ClassifierModel): NormalizationParams {
  const allSamples: number[][] = [];
  for (const samples of Object.values(model.surfaces)) {
    for (const sample of samples) {
      allSamples.push(sample.features);
    }
  }

  if (allSamples.length === 0) {
    return { mean: [], std: [] };
  }

  const numFeatures = allSamples[0].length;
  const mean = new Array<number>(numFeatures).fill(0);
  const std = new Array<number>(numFeatures).fill(0);

  // Compute mean
  for (const features of allSamples) {
    for (let i = 0; i < numFeatures; i++) {
      mean[i] += features[i];
    }
  }
  for (let i = 0; i < numFeatures; i++) {
    mean[i] /= allSamples.length;
  }

  // Compute std (population)
  for (const features of allSamples) {
    for (let i = 0; i < numFeatures; i++) {
      const diff = features[i] - mean[i];
      std[i] += diff * diff;
    }
  }
  for (let i = 0; i < numFeatures; i++) {
    std[i] = Math.sqrt(std[i] / allSamples.length);
  }

  return { mean, std };
}

/**
 * Apply z-score normalization to a feature vector.
 * Returns 0 for dimensions where std is 0 (avoids NaN).
 */
export function normalize(features: number[], params: NormalizationParams): number[] {
  return features.map((val, i) => {
    if (params.std[i] === 0) return 0;
    return (val - params.mean[i]) / params.std[i];
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- src/lib/classifier/normalize.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/classifier/normalize.ts src/lib/classifier/normalize.spec.ts
git commit -m "feat(classifier): add z-score normalization"
```

---

## Task 4: Euclidean Distance

**Files:**
- Create: `src/lib/classifier/knn.ts`
- Create: `src/lib/classifier/knn.spec.ts`

- [ ] **Step 1: Write failing tests for euclideanDistance**

```ts
import { describe, it, expect } from 'vitest';
import { euclideanDistance } from './knn';

describe('euclideanDistance', () => {
  it('returns 0 for identical vectors', () => {
    expect(euclideanDistance([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('returns correct distance for known vectors', () => {
    // Distance between [0, 0] and [3, 4] = 5
    expect(euclideanDistance([0, 0], [3, 4])).toBeCloseTo(5, 5);
  });

  it('returns correct distance for single dimension', () => {
    expect(euclideanDistance([0], [7])).toBeCloseTo(7, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- src/lib/classifier/knn.spec.ts`
Expected: FAIL — `euclideanDistance` not found

- [ ] **Step 3: Implement euclideanDistance**

```ts
import type { ClassifierModel, ClassificationResult } from './model';
import { normalize } from './normalize';

/**
 * Euclidean distance between two feature vectors.
 */
export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- src/lib/classifier/knn.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/classifier/knn.ts src/lib/classifier/knn.spec.ts
git commit -m "feat(classifier): add euclidean distance function"
```

---

## Task 5: KNN Classify

**Files:**
- Modify: `src/lib/classifier/knn.ts`
- Modify: `src/lib/classifier/knn.spec.ts`

- [ ] **Step 1: Write failing tests for classify**

Append to `knn.spec.ts`:

```ts
import { classify } from './knn';
import type { ClassifierModel } from './model';

describe('classify', () => {
  // Helper: build a model with pre-normalized samples and matching normalization params
  function makeModel(surfaces: Record<string, number[][]>): ClassifierModel {
    const model: ClassifierModel = { surfaces: {}, normalization: null };
    const allFeatures: number[][] = [];

    for (const [name, featureSets] of Object.entries(surfaces)) {
      model.surfaces[name] = featureSets.map((features) => ({ surface: name, features }));
      allFeatures.push(...featureSets);
    }

    // Compute normalization
    if (allFeatures.length === 0) return model;
    const numFeatures = allFeatures[0].length;
    const mean = new Array<number>(numFeatures).fill(0);
    const std = new Array<number>(numFeatures).fill(0);

    for (const f of allFeatures) {
      for (let i = 0; i < numFeatures; i++) mean[i] += f[i];
    }
    for (let i = 0; i < numFeatures; i++) mean[i] /= allFeatures.length;

    for (const f of allFeatures) {
      for (let i = 0; i < numFeatures; i++) {
        const diff = f[i] - mean[i];
        std[i] += diff * diff;
      }
    }
    for (let i = 0; i < numFeatures; i++) std[i] = Math.sqrt(std[i] / allFeatures.length);

    model.normalization = { mean, std };
    return model;
  }

  it('returns null for empty model', () => {
    const model: ClassifierModel = { surfaces: {}, normalization: null };
    expect(classify(model, [1, 2])).toBeNull();
  });

  it('classifies correctly with well-separated clusters', () => {
    // Surface A clusters around [0, 0], Surface B around [10, 10]
    const model = makeModel({
      a: [[0, 0], [0.1, 0.1], [0, 0.1], [0.1, 0], [-0.1, 0]],
      b: [[10, 10], [10.1, 10.1], [10, 10.1], [10.1, 10], [9.9, 10]]
    });

    const resultA = classify(model, [0.05, 0.05]);
    expect(resultA).not.toBeNull();
    expect(resultA!.surface).toBe('a');

    const resultB = classify(model, [10.05, 10.05]);
    expect(resultB).not.toBeNull();
    expect(resultB!.surface).toBe('b');
  });

  it('returns high confidence when all neighbors agree', () => {
    const model = makeModel({
      a: [[0, 0], [0.1, 0.1], [0, 0.1], [0.1, 0], [-0.1, 0]],
      b: [[10, 10], [10.1, 10.1], [10, 10.1], [10.1, 10], [9.9, 10]]
    });

    const result = classify(model, [0, 0]);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThan(0.9);
  });

  it('returns lower confidence when neighbors are mixed', () => {
    // Surfaces overlap at the boundary
    const model = makeModel({
      a: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]],
      b: [[3, 3], [4, 4], [5, 5], [6, 6], [7, 7]]
    });

    // Query right at the overlap zone
    const result = classify(model, [3.5, 3.5]);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeLessThan(0.9);
  });

  it('handles exact match without division errors', () => {
    const model = makeModel({
      a: [[0, 0], [0.1, 0.1], [0, 0.1], [0.1, 0], [-0.1, 0]],
      b: [[10, 10], [10.1, 10.1], [10, 10.1], [10.1, 10], [9.9, 10]]
    });

    // Query exactly matches a training sample (after normalization, may not be exact 0)
    const result = classify(model, [0, 0]);
    expect(result).not.toBeNull();
    expect(result!.surface).toBe('a');
    expect(Number.isNaN(result!.confidence)).toBe(false);
  });

  it('uses k parameter', () => {
    // With k=1, nearest neighbor wins
    const model = makeModel({
      a: [[0, 0], [0.1, 0.1]],
      b: [[0.2, 0.2], [10, 10], [10.1, 10.1]]
    });

    const resultK1 = classify(model, [0.15, 0.15], 1);
    expect(resultK1).not.toBeNull();
    // With k=1, the single nearest neighbor decides
    expect(resultK1!.confidence).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- src/lib/classifier/knn.spec.ts`
Expected: FAIL — `classify` not found

- [ ] **Step 3: Implement classify**

Add to `knn.ts`:

```ts
const DEFAULT_K = 5;

/**
 * Classify a feature vector using inverse-distance-weighted KNN.
 *
 * 1. Normalizes the input using the model's normalization params
 * 2. Finds the k nearest training samples by Euclidean distance
 * 3. Weights each neighbor's vote by 1/distance
 * 4. Returns the surface with the highest total weight + confidence score
 *
 * Returns null if the model has no samples or no normalization params.
 */
export function classify(
  model: ClassifierModel,
  features: number[],
  k: number = DEFAULT_K
): ClassificationResult | null {
  if (!model.normalization) return null;

  // Collect all samples
  const allSamples: { surface: string; features: number[] }[] = [];
  for (const samples of Object.values(model.surfaces)) {
    for (const sample of samples) {
      allSamples.push(sample);
    }
  }
  if (allSamples.length === 0) return null;

  // Normalize the query
  const normalizedQuery = normalize(features, model.normalization);

  // Compute distances to all samples
  const distances: { surface: string; distance: number }[] = allSamples.map((sample) => ({
    surface: sample.surface,
    distance: euclideanDistance(
      normalizedQuery,
      normalize(sample.features, model.normalization!)
    )
  }));

  // Sort by distance and take k nearest
  distances.sort((a, b) => a.distance - b.distance);
  const neighbors = distances.slice(0, Math.min(k, distances.length));

  // Check for exact match (distance = 0)
  if (neighbors[0].distance === 0) {
    return { surface: neighbors[0].surface, confidence: 1 };
  }

  // Inverse-distance weighting
  const weights: Record<string, number> = {};
  let totalWeight = 0;

  for (const neighbor of neighbors) {
    const weight = 1 / neighbor.distance;
    weights[neighbor.surface] = (weights[neighbor.surface] ?? 0) + weight;
    totalWeight += weight;
  }

  // Find winner
  let bestSurface = '';
  let bestWeight = -1;
  for (const [surface, weight] of Object.entries(weights)) {
    if (weight > bestWeight) {
      bestWeight = weight;
      bestSurface = surface;
    }
  }

  return {
    surface: bestSurface,
    confidence: bestWeight / totalWeight
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- src/lib/classifier/knn.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/classifier/knn.ts src/lib/classifier/knn.spec.ts
git commit -m "feat(classifier): add KNN classify with inverse-distance weighting"
```

---

## Task 6: Trainer — Create Model and Add Sample

**Files:**
- Create: `src/lib/classifier/trainer.ts`
- Create: `src/lib/classifier/trainer.spec.ts`

- [ ] **Step 1: Write failing tests for createModel and addSample**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- src/lib/classifier/trainer.spec.ts`
Expected: FAIL — `createModel` and `addSample` not found

- [ ] **Step 3: Implement createModel and addSample**

```ts
import type { FeatureVector } from '$lib/audio/types';
import type { ClassifierModel } from './model';
import { flattenFeatureVector, computeNormalization } from './normalize';

/**
 * Create an empty classifier model.
 */
export function createModel(): ClassifierModel {
  return {
    surfaces: {},
    normalization: null
  };
}

/**
 * Add a training sample to the model. Returns a new model (immutable).
 * Flattens the FeatureVector and recomputes normalization.
 */
export function addSample(
  model: ClassifierModel,
  surface: string,
  fv: FeatureVector
): ClassifierModel {
  const flat = flattenFeatureVector(fv);
  const existingSamples = model.surfaces[surface] ?? [];
  const newSurfaces = {
    ...model.surfaces,
    [surface]: [...existingSamples, { surface, features: flat }]
  };
  const newModel: ClassifierModel = {
    surfaces: newSurfaces,
    normalization: null
  };
  newModel.normalization = computeNormalization(newModel);
  return newModel;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- src/lib/classifier/trainer.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/classifier/trainer.ts src/lib/classifier/trainer.spec.ts
git commit -m "feat(classifier): add createModel and addSample"
```

---

## Task 7: Trainer — Remove Surface and Helpers

**Files:**
- Modify: `src/lib/classifier/trainer.ts`
- Modify: `src/lib/classifier/trainer.spec.ts`

- [ ] **Step 1: Write failing tests for removeSurface, getSurfaceNames, getSampleCount**

Append to `trainer.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- src/lib/classifier/trainer.spec.ts`
Expected: FAIL — `removeSurface`, `getSurfaceNames`, `getSampleCount` not found

- [ ] **Step 3: Implement removeSurface, getSurfaceNames, getSampleCount**

Add to `trainer.ts`:

```ts
/**
 * Remove a surface and all its samples. Returns a new model (immutable).
 * Recomputes normalization from remaining surfaces.
 */
export function removeSurface(model: ClassifierModel, surface: string): ClassifierModel {
  const { [surface]: _, ...remainingSurfaces } = model.surfaces;
  const newModel: ClassifierModel = {
    surfaces: remainingSurfaces,
    normalization: null
  };
  newModel.normalization = computeNormalization(newModel);
  return newModel;
}

/**
 * Get the names of all surfaces in the model.
 */
export function getSurfaceNames(model: ClassifierModel): string[] {
  return Object.keys(model.surfaces);
}

/**
 * Get the number of training samples for a surface. Returns 0 if surface doesn't exist.
 */
export function getSampleCount(model: ClassifierModel, surface: string): number {
  return model.surfaces[surface]?.length ?? 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- src/lib/classifier/trainer.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/classifier/trainer.ts src/lib/classifier/trainer.spec.ts
git commit -m "feat(classifier): add removeSurface and model helpers"
```

---

## Task 8: Model Serialization

**Files:**
- Modify: `src/lib/classifier/model.ts`
- Create: `src/lib/classifier/model.spec.ts`

- [ ] **Step 1: Write failing tests for serializeModel and deserializeModel**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- src/lib/classifier/model.spec.ts`
Expected: FAIL — `serializeModel` and `deserializeModel` not found

- [ ] **Step 3: Implement serializeModel and deserializeModel**

Add to `model.ts`:

```ts
/**
 * Serialize a classifier model to a JSON string.
 */
export function serializeModel(model: ClassifierModel): string {
  return JSON.stringify(model);
}

/**
 * Deserialize a classifier model from a JSON string.
 * Throws if the JSON is malformed or has an unexpected structure.
 */
export function deserializeModel(json: string): ClassifierModel {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Model must be an object');
  }

  const obj = parsed as Record<string, unknown>;

  if (!('surfaces' in obj) || typeof obj.surfaces !== 'object' || obj.surfaces === null) {
    throw new Error('Model must have a surfaces object');
  }

  if (obj.normalization !== null && typeof obj.normalization !== 'object') {
    throw new Error('Model normalization must be an object or null');
  }

  return obj as unknown as ClassifierModel;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- src/lib/classifier/model.spec.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/classifier/model.ts src/lib/classifier/model.spec.ts
git commit -m "feat(classifier): add model serialization and deserialization"
```

---

## Task 9: Integration Test

**Files:**
- Modify: `src/lib/classifier/knn.spec.ts`

This test is the Milestone 2 deliverable: build a model via `trainer.ts`, classify with `knn.ts`, verify correctness.

- [ ] **Step 1: Write integration test**

Append these imports at the top of `knn.spec.ts` (alongside the existing imports):

```ts
import { flattenFeatureVector } from './normalize';
import { createModel, addSample } from './trainer';
import type { FeatureVector } from '$lib/audio/types';
```

Then append this test at the bottom of the file:

```ts
describe('integration: train and classify', () => {
  function makeFV(values: number[]): FeatureVector {
    return {
      mfcc: new Float64Array(values.slice(0, 13)),
      spectralCentroid: values[13] ?? 0,
      zcr: values[14] ?? 0,
      energy: values[15] ?? 0
    };
  }

  it('classifies hits correctly after training with FeatureVectors', () => {
    let model = createModel();

    // Train surface "desk" — low energy, low centroid
    for (let i = 0; i < 10; i++) {
      const noise = (Math.random() - 0.5) * 0.1;
      model = addSample(
        model,
        'desk',
        makeFV([1 + noise, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 200, 0.3, 0.2])
      );
    }

    // Train surface "book" — high energy, high centroid
    for (let i = 0; i < 10; i++) {
      const noise = (Math.random() - 0.5) * 0.1;
      model = addSample(
        model,
        'book',
        makeFV([10 + noise, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 5000, 0.8, 0.9])
      );
    }

    // Classify a desk-like hit
    const deskHit = flattenFeatureVector(
      makeFV([1.05, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 200, 0.3, 0.2])
    );
    const deskResult = classify(model, deskHit);
    expect(deskResult).not.toBeNull();
    expect(deskResult!.surface).toBe('desk');
    expect(deskResult!.confidence).toBeGreaterThan(0.8);

    // Classify a book-like hit
    const bookHit = flattenFeatureVector(
      makeFV([10.05, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 5000, 0.8, 0.9])
    );
    const bookResult = classify(model, bookHit);
    expect(bookResult).not.toBeNull();
    expect(bookResult!.surface).toBe('book');
    expect(bookResult!.confidence).toBeGreaterThan(0.8);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun run test:unit -- src/lib/classifier/knn.spec.ts`
Expected: All PASS (this is a test that should pass immediately since all functions are already implemented)

- [ ] **Step 3: Commit**

```bash
git add src/lib/classifier/knn.spec.ts
git commit -m "feat(classifier): add integration test for train-and-classify pipeline"
```

---

## Task 10: Integration Verification

- [ ] **Step 1: Run all unit tests**

Run: `bun run test:unit`
Expected: All tests pass (classifier specs + existing audio specs)

- [ ] **Step 2: Run type check**

Run: `bun run check`
Expected: No errors

- [ ] **Step 3: Run lint and format**

Run: `bun run format && bun run lint`
Expected: No errors

- [ ] **Step 4: Run build**

Run: `bun run build`
Expected: Static build succeeds

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: fix lint/type issues from milestone 2 integration"
```

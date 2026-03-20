# Milestone 2: Classification — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Parent spec:** `docs/superpowers/specs/2026-03-19-no2drummer-design.md`

## Overview

Milestone 2 adds a KNN classifier that takes feature vectors from Milestone 1's audio pipeline and predicts which surface was hit. The classifier is a pure TypeScript library — no UI, no browser APIs, no ML framework. The deliverable is a passing integration test that trains a model and classifies hits correctly.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Algorithm | KNN, brute-force | ~600 vectors x 16 dimensions = <0.1ms lookup. No optimization needed at this scale. |
| k | Fixed at 5 | Standard default for moderate datasets. Odd number reduces ties. One-line change if testing shows a better value. |
| Normalization | Z-score (per-feature mean/std) | MFCCs, spectral centroid, ZCR, and energy live in different numeric ranges. Without normalization, Euclidean distance is dominated by the largest-magnitude feature. |
| Distance weighting | Inverse-distance (1/d) | Closer neighbors contribute more than distant ones. Naturally breaks ties. Produces more meaningful confidence scores than plain majority voting. |
| Confidence score | Winner's weight / total weight | Bounded 0-1. Intuitive: "what fraction of nearby evidence supports this classification?" |
| Training samples | 50-150 per surface | Rich enough to capture hit variation, small enough for instant brute-force search. ~600 total vectors across 3-4 surfaces. |
| Storage granularity | Per-surface | Users can retrain one surface without losing others ("your hi-hat sounds muddy, re-record just that one"). |
| API style | Functional with external state | Pure functions take and return a model object. Caller owns state via Svelte 5 `$state()`. Trivially testable, naturally reactive. |
| Serialization | JSON (no IndexedDB) | Milestone 2 only needs serialize/deserialize. IndexedDB persistence comes in Milestone 6 per the parent spec. |
| Normalization recomputation | Eager, on any change | Recomputed inside `addSample` and `removeSurface`. Cost is negligible (mean/std over ~600 numbers). Avoids stale-params bugs. |

### Divergences from parent spec

These decisions refine or extend the parent spec's description of Milestone 2:

- **Normalization added** — the parent spec doesn't mention feature normalization, but it's necessary for KNN with mixed-range features.
- **Inverse-distance weighting** — the parent spec says "confidence = proportion of K neighbors that agree" (plain majority). We use inverse-distance-weighted ratio instead for better accuracy with small k.
- **Functional API** — the parent spec's module structure implies class-based design. We use pure functions with external state for better Svelte 5 integration and testability.

## Module Structure

```
src/lib/classifier/
  knn.ts              — KNN classifier: distance calc, weighted voting, confidence
  knn.spec.ts         — classification tests + integration test
  normalize.ts        — z-score normalization, feature vector flattening
  normalize.spec.ts   — normalization tests
  trainer.ts          — model construction: add/remove samples, create model
  trainer.spec.ts     — training pipeline tests
  model.ts            — type definitions, JSON serialization/deserialization
  model.spec.ts       — round-trip serialization tests
```

Aligns with the parent spec's `src/lib/classifier/` directory. File names match the spec (`knn.ts`, `trainer.ts`, `model.ts`) with `normalize.ts` added.

**No storage module in Milestone 2.** The parent spec places IndexedDB in Milestone 6. Serialization here is JSON string export/import only.

## Types

Defined in `model.ts`:

```ts
/** A labeled training sample — flattened feature vector with surface label */
interface LabeledSample {
  surface: string          // e.g. "desk", "book"
  features: number[]       // 16 floats: 13 MFCCs + centroid + ZCR + energy
}

/** Z-score normalization parameters */
interface NormalizationParams {
  mean: number[]           // per-feature mean (length 16)
  std: number[]            // per-feature std dev (length 16)
}

/** The complete classifier model */
interface ClassifierModel {
  surfaces: Record<string, LabeledSample[]>  // per-surface sample storage
  normalization: NormalizationParams | null   // null until first computed
}

/** Classification result */
interface ClassificationResult {
  surface: string          // predicted surface name
  confidence: number       // 0-1, ratio of winning weight to total weight
}
```

**`FeatureVector` from `src/lib/audio/types.ts` is the input type.** It uses `Float64Array` for MFCCs. The classifier flattens it to `number[]` at the boundary (in `normalize.ts`) for JSON-safe storage and uniform distance calculation across all 16 dimensions.

The `surfaces` field uses `Record<string, LabeledSample[]>` — this is what enables per-surface storage. Deleting or replacing one surface's samples doesn't touch the others.

## Module Details

### `normalize.ts`

Three pure functions:

- **`flattenFeatureVector(fv: FeatureVector): number[]`** — converts `FeatureVector` to 16-element `number[]`. Order: 13 MFCCs, spectral centroid, ZCR, energy. This is the boundary function called when ingesting feature vectors from the audio pipeline.

- **`computeNormalization(model: ClassifierModel): NormalizationParams`** — iterates all samples across all surfaces, computes mean and std per feature dimension.

- **`normalize(features: number[], params: NormalizationParams): number[]`** — applies z-score: `(x - mean) / std`. If std is 0 for a dimension (all values identical), returns 0 to avoid division by zero.

### `knn.ts`

Two functions:

- **`classify(model: ClassifierModel, features: number[], k?: number): ClassificationResult | null`** — the core classifier.
  1. Normalizes the input features using the model's normalization params
  2. Computes Euclidean distance to every sample across all surfaces
  3. Picks the k nearest neighbors (default k=5)
  4. Inverse-distance weighting: each neighbor votes with weight `1/distance`. Exact match (distance=0) wins outright.
  5. Sums weights per surface. Winner takes all.
  6. Confidence = winner's weight sum / total weight sum
  7. Returns `null` if the model has no samples

- **`euclideanDistance(a: number[], b: number[]): number`** — exported for testing. Sqrt of sum of squared differences.

The confidence threshold check is NOT in the classifier. The caller decides whether `result.confidence >= threshold` — the threshold lives in the UI layer (Milestone 5).

### `trainer.ts`

Pure functions for building up the model:

- **`createModel(): ClassifierModel`** — returns empty model (no surfaces, null normalization).

- **`addSample(model: ClassifierModel, surface: string, fv: FeatureVector): ClassifierModel`** — flattens the feature vector, appends to the surface's sample list (creates entry if new), recomputes normalization. Returns a new model (immutable).

- **`removeSurface(model: ClassifierModel, surface: string): ClassifierModel`** — drops all samples for a surface, recomputes normalization. Returns a new model.

- **`getSurfaceNames(model: ClassifierModel): string[]`** — convenience accessor.

- **`getSampleCount(model: ClassifierModel, surface: string): number`** — for the training wizard's progress indicator.

**Immutable returns:** every mutation function returns a new `ClassifierModel`. This means `let model = $state(createModel())` in Svelte works — `model = addSample(model, ...)` triggers reactivity automatically.

### `model.ts`

Type definitions (above) plus two serialization functions:

- **`serializeModel(model: ClassifierModel): string`** — `JSON.stringify`. Works directly because the model uses plain `number[]` arrays.

- **`deserializeModel(json: string): ClassifierModel`** — `JSON.parse` with runtime validation. Checks structure has expected shape (surfaces record, normalization params with correct array lengths). Throws descriptive error on malformed input.

No versioning or migration. If the format changes in Milestone 6, migration can be handled then.

## Testing Strategy

All tests run in the Vitest `server` project (Node.js). All tests must contain at least one assertion per the project's `expect.requireAssertions: true` setting.

### `normalize.spec.ts`

- `computeNormalization` returns correct mean/std for known data
- `normalize` produces zero-mean unit-variance output
- std=0 dimension returns 0, not NaN
- `flattenFeatureVector` produces 16 elements in correct order (MFCCs, centroid, ZCR, energy)

### `knn.spec.ts`

- Classifies correctly with well-separated synthetic clusters
- Returns the closer surface when query is nearer to one cluster
- High confidence (~1.0) when all k neighbors are same class
- Lower confidence when neighbors are mixed
- Returns `null` for empty model
- Exact match (distance=0) handled without division errors

### `trainer.spec.ts`

- `createModel` returns empty model with null normalization
- `addSample` adds to correct surface and recomputes normalization
- `addSample` to new surface creates the entry
- `removeSurface` drops samples and recomputes normalization
- Immutability: original model unchanged after `addSample`

### `model.spec.ts`

- Round-trip: `deserializeModel(serializeModel(model))` equals original
- `deserializeModel` throws on malformed JSON
- `deserializeModel` throws on structurally invalid data

### Integration test (in `knn.spec.ts`)

End-to-end: build a model via `trainer.ts` functions with synthetic `FeatureVector` inputs, then classify an unknown hit via `knn.ts`, verify correct surface and reasonable confidence. This test IS the milestone deliverable.

## Deliverable

The passing integration test demonstrates: create model, add labeled samples per surface, classify an unknown hit, get correct surface with high confidence. No UI — the tests are the deliverable. UI integration happens in Milestone 4 (training wizard) and Milestone 5 (play screen).

## Dependencies

- **Consumes from Milestone 1:** `FeatureVector` type from `src/lib/audio/types.ts`
- **Consumed by Milestone 4:** `trainer.ts` functions (training wizard collects hits and calls `addSample`)
- **Consumed by Milestone 5:** `knn.ts` `classify()` (play screen classifies each detected hit)
- **Consumed by Milestone 6:** `model.ts` serialization (IndexedDB layer wraps `serializeModel`/`deserializeModel`)

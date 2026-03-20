# no2drummer — Design Spec

**Date:** 2026-03-19
**Status:** Draft

## Overview

no2drummer is a browser-based app that turns any surface into a drum kit. A user hits surfaces (desk, book, water bottle, pencil case) with pencils, and the app classifies each hit and plays the corresponding drum sound in real time.

**Target:** Demo/portfolio quality initially, architected toward a shareable tool.
**Platform:** Desktop-first, mobile-friendly. Runs entirely in the browser — no server.

## Constraints

- **3-4 surfaces** per kit (compact drum kit: snare, kick, hi-hat, cymbal)
- **<20ms latency** from hit to drum sound (real instrument feel)
- **No ML framework** — plain TypeScript feature extraction and classification
- **Bundled drum samples** only (user uploads deferred)
- **Trainable in-app** via a guided wizard

## System Architecture

### Audio Pipeline

```
Mic (getUserMedia)
  → AudioWorklet (audio thread)
      1. Ring buffer collects samples
      2. Onset detector spots energy spike
      3. Extract features (MFCCs, spectral centroid, ZCR, energy)
      4. Post feature vector via MessagePort (~1-3ms)
  → Classifier (main thread)
      5. KNN or tiny dense net → surface ID + confidence
      6. Check confidence > tunable threshold
  → Sound Player (main thread)
      7. Look up surface → drum sound mapping
      8. Play pre-loaded AudioBuffer
      9. Scale volume by hit intensity
```

**Why this split:** The AudioWorklet stays lightweight (onset detection and feature extraction are cheap), avoiding audio glitches. The classifier runs on the main thread where it's easy to test and swap. The ~1-3ms MessagePort cost is negligible within the <20ms budget. A Web Worker is not needed — our classifier completes in <1ms.

**Fallback:** If classification accuracy is insufficient with hand-crafted features + KNN, we can increase the audio buffer to 1024 samples and bring in TensorFlow.js (moves to 20-50ms budget). This only requires swapping the classifier module — no architectural changes.

### Module Structure

```
src/lib/
├── audio/
│   ├── capture.ts        — getUserMedia, AudioContext setup
│   ├── worklet.ts        — AudioWorkletProcessor (onset + features)
│   └── features.ts       — MFCC, spectral centroid, ZCR extraction
│                            (pure functions, shared by worklet and training)
├── classifier/
│   ├── knn.ts            — K-nearest neighbors classifier
│   ├── trainer.ts        — Collects features during training, builds model
│   └── model.ts          — Serialization/deserialization for IndexedDB
├── player/
│   ├── player.ts         — Pre-loads drum samples, plays on demand
│   └── samples.ts        — Sample manifest, maps drum names to files
└── storage/
    └── db.ts             — IndexedDB wrapper for model + mappings + settings
```

**Key principle:** Each module is a pure TypeScript library with no Svelte dependency. UI components consume these libraries. All audio/ML logic is independently testable with plain Vitest.

### Feature Extraction

Audio features extracted per hit (from a 256-512 sample window at 44.1kHz):

- **MFCCs** (13 coefficients) — compact representation of spectral shape
- **Spectral centroid** — "brightness" of the sound
- **Zero-crossing rate** — distinguishes noisy vs tonal
- **Energy** — hit intensity (also used for volume scaling)

These features are computed as pure functions in `features.ts`, shared between the AudioWorklet (real-time) and the training pipeline (batch).

### Classification

**KNN (K-Nearest Neighbors):** Store feature vectors from training. On a new hit, find the K closest training samples by Euclidean distance. The majority class wins. Confidence = proportion of K neighbors that agree.

- K to be determined during testing (likely 3-5)
- Confidence threshold is user-tunable via slider
- Hits below threshold are ignored (no sound played)
- Entire classifier is a few dozen lines of TypeScript — no framework

### Persistence

**IndexedDB** stores:
- Trained model (KNN reference vectors + labels)
- Surface-to-drum mappings
- Settings (confidence threshold)

**Not stored:** Raw audio samples. Retraining requires re-recording, which is fast for 3-4 surfaces. Raw sample storage can be added later to support incremental surface addition or multiple saved kits.

## App Screens & User Flow

```
Home (/) → Train (/train) → Map (/map) → Play (/play)
```

### Home — `/`

- **New Kit** button → starts training wizard
- **Load Saved Kit** button → loads from IndexedDB, goes to Play screen
- Load button only shown if a saved kit exists

### Training Wizard — `/train`

Step-by-step guided flow:

1. **Setup** — choose number of surfaces (2-4), name each one (defaults: "Surface 1", etc.)
2. **Mic Permission** — request `getUserMedia`, handle denial gracefully
3. **Record** — one surface at a time: "Hit the [desk] 15 times"
   - Progress bar showing hits recorded vs target
   - Dot indicators for each surface (done / in-progress / pending)
   - Minimum hit count enforced before proceeding
4. **Train** — build classifier from collected features, show accuracy feedback
5. **Done** — proceed to mapping

### Mapping — `/map`

- Grid of surfaces, each paired with a drum sound dropdown/selector
- Tap a drum sound to preview it
- Default mapping provided (e.g., first surface → snare, second → kick, etc.)
- Proceed to Play when satisfied

### Play — `/play`

Two sections:

**Drum Pad Grid (top):**
- One tile per mapped sound (e.g., Snare, Kick, Hi-Hat, Cymbal)
- Tiles light up on hit with visual feedback
- Each tile shows drum sound name and surface name

**Lane Stream (bottom):**
- Each surface gets a horizontal lane
- Hits appear as blocks that scroll left over time
- Lane labels show "Snare → Desk" (drum sound → surface name)
- Each lane is color-coded
- Hit blocks encode intensity via size or opacity
- Blocks fade as they age and scroll off the left edge

**Controls:**
- Confidence threshold slider
- Back to mapping / retrain buttons

## Milestones

Each milestone is independently shippable and builds on the previous.

### Milestone 1 — Audio Foundation

- Mic capture via `getUserMedia` + AudioContext setup
- AudioWorklet with ring buffer and onset detection
- Feature extraction (MFCCs, spectral centroid, ZCR, energy)
- Visual feedback: simple page showing "hit detected" with feature values
- **Deliverable:** Hit a surface and see the app recognize it with feature data

### Milestone 2 — Classification

- KNN classifier (train with labeled feature vectors, predict)
- Training pipeline: collect features per surface, build model
- Confidence scoring and threshold
- Model serialization/deserialization
- Unit tests for classifier
- **Deliverable:** Train the model in a test harness and it classifies hits correctly

### Milestone 3 — Sound Playback

- Pre-load bundled drum samples into AudioBuffers
- Trigger playback on classification result
- Volume scaling based on hit intensity
- Sample manifest and loading system
- **Deliverable:** End-to-end pipeline works — hit a surface, hear a drum sound (wired up manually, no UI)

### Milestone 4 — Training Wizard UI

- Home screen (new kit / load saved)
- Wizard: setup step (count + naming), record step, train step (progress + accuracy)
- Mic permission handling
- Svelte components with Storybook stories
- **Deliverable:** Full training flow works through the UI

### Milestone 5 — Mapping & Play UI

- Mapping screen: grid of surfaces → drum sounds, with previews
- Play screen: drum pad grid + lane stream with visual hit feedback
- Confidence threshold slider
- Route structure (`/`, `/train`, `/map`, `/play`)
- **Deliverable:** Complete app loop — train, map, play

### Milestone 6 — Persistence & Polish

- IndexedDB storage for model, mappings, settings
- Load saved kit from home screen
- Error states (mic denied, no saved kit, browser unsupported)
- Visual polish, responsive layout
- **Deliverable:** App is demo-ready, state persists between sessions

## Testing Strategy

### Unit Tests (Vitest, server project)

- `features.ts` — pure functions tested with known input signals
- `knn.ts` — train with synthetic data, assert classification results
- `model.ts` — serialization round-trips
- `player.ts` — mock AudioContext, verify correct sample triggered
- `db.ts` — mock IndexedDB (e.g., `fake-indexeddb`)

### Component Tests (Vitest, client project)

- Training wizard: step progression, hit counter updates
- Mapping grid: surface-to-sound assignment
- Play screen: visual feedback on simulated hit events

### E2E Tests (Playwright)

- Happy path: home → train (simulated) → map → play
- Load saved kit flow

### Not Automatically Testable

- AudioWorklet processing (test the feature extraction functions it calls, not the worklet itself)
- Real mic input (use pre-recorded audio fixtures for integration tests)
- Classification accuracy (manual testing — hit stuff and observe)

## Future Enhancements (Not in Scope)

- User-uploaded drum samples
- Multiple saved kits
- Raw audio sample persistence (enables incremental retraining)
- Mobile-optimized UI
- Sharing kits with others
- Recording and exporting performances
- Web Worker for heavier ML models

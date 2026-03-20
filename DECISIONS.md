# Decisions

Tracking key project decisions made during planning and development.

## 2026-03-19 — Target audience

**Decision:** Build toward a shareable tool (C) but start at demo/portfolio quality (B).

**Implications:**
- Architecture should be solid from the start — clean interfaces, testable modules
- Defer onboarding flows, advanced error handling, and multi-device polish to later milestones
- UI should look good and work smoothly, but doesn't need to be bullet-proof for all edge cases yet

## 2026-03-19 — Target devices

**Decision:** Desktop-first, mobile-friendly (B).

**Implications:**
- Design and test primarily for laptop/desktop with built-in or external mic
- Responsive layout that doesn't break on mobile, but don't optimize tap targets or mobile mic quirks yet
- Audio latency expectations based on desktop hardware

## 2026-03-19 — Number of surfaces

**Decision:** Support 3-4 surfaces (a compact kit).

**Implications:**
- Simpler classification model — fewer classes means higher accuracy and less training data needed
- Training UX can be straightforward — small number of slots to fill
- Mapping UI is a simple grid, not a scrollable list
- ~10-20 hits per surface should be sufficient for training
- Keeps the "time to rocking out" short

## 2026-03-19 — Unrecognized sounds

**Decision:** Ignore unrecognized hits (A), but make the confidence threshold tunable.

**Implications:**
- Model outputs a confidence score per classification; only trigger a sound above the threshold
- Expose a slider or similar control so users can adjust sensitivity
- Lower threshold = more responsive but more false positives; higher = fewer mistakes but might miss soft hits
- Good default threshold to be determined during testing

## 2026-03-19 — Drum sound source

**Decision:** Bundled samples only (A) for now. User-uploaded samples can be added later.

**Implications:**
- Ship a default drum kit with high-quality WAV/MP3 samples (kick, snare, hi-hat, cymbal at minimum)
- Playback layer should accept any AudioBuffer — makes adding user uploads easy later
- Need to source or create royalty-free drum samples
- Samples bundled as static assets

## 2026-03-19 — Persistence

**Decision:** Save trained model and settings to IndexedDB. Don't store raw audio samples initially.

**Implications:**
- Persist: trained model weights, surface-to-drum mappings, settings (confidence threshold, etc.)
- Don't persist: raw audio samples (user re-records if they need to retrain)
- IndexedDB as storage backend — plenty of capacity, async, handles binary model weights
- Retraining means re-recording all surfaces, which is fast for 3-4 surfaces
- Raw sample storage can be added later to support adding surfaces incrementally or saving multiple kits

## 2026-03-19 — Latency target and ML approach

**Decision:** Target <20ms end-to-end latency. Use hand-crafted audio features (MFCCs, spectral centroid, etc.) with KNN or a tiny dense neural net. No ML framework — plain TypeScript math on Float32Arrays.

**Implications:**
- Audio buffer size: 256-512 samples (~6-12ms at 44.1kHz)
- Feature extraction + classification must complete in <8-14ms remaining budget
- No TensorFlow.js, ONNX, or ml5.js dependency — keeps bundle small and latency low
- Framework-free approach means we implement feature extraction and model inference ourselves
- Fallback plan: if accuracy is insufficient, can increase buffer to 1024 and bring in TensorFlow.js (moves to 20-50ms budget) without rearchitecting — just swap the classifier module

## 2026-03-19 — Training flow

**Decision:** Guided wizard (A). Step-by-step flow walking the user through training each surface.

**Implications:**
- Clear phases: setup (pick count 2-4, name each surface) → mic permission → record hits one surface at a time → train model → accuracy feedback
- Progress indicators showing how many hits recorded, which surfaces are done
- Wizard can enforce minimum sample count per surface before allowing next step
- Natural place to show accuracy feedback after training completes

## 2026-03-19 — Play screen hit visualization

**Decision:** Lane stream (A). Each surface gets a horizontal lane, hits appear as blocks that scroll left and fade over time.

**Implications:**
- Play screen has two sections: drum pad grid (top) + lane stream (bottom)
- Lane labels show drum sound → surface name (e.g., "Snare → Desk") since during play you think in drum sounds
- Each lane is color-coded per surface
- Hit blocks can encode intensity via size or opacity
- Scrolls continuously — gives visual rhythm feedback
- Part of Milestone 5 (Play UI)

## 2026-03-19 — Audio pipeline architecture

**Decision:** AudioWorklet + Main Thread Split (B).

**Implications:**
- AudioWorklet handles onset detection and feature extraction (lightweight, stays in audio thread)
- Feature vectors posted to main thread via MessagePort (~1-3ms cost)
- Main thread runs classification (KNN/tiny net) and triggers playback via AudioContext
- Classifier is easy to test and swap — runs in normal JS, no worklet context
- No Web Worker needed for now — classifier is <1ms, won't block UI
- If we later need heavier models, can insert a Web Worker between worklet and main thread without rearchitecting

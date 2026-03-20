# Architecture

High-level architecture for no2drummer. Updated as design decisions are made.

## Concept

A browser-based app that:
1. Captures audio from a microphone (pencil hits on surfaces)
2. Classifies each hit into a trained surface category (desk, book, water bottle, etc.)
3. Maps each category to a drum kit sound
4. Plays the mapped sound in real time

**Key constraints:**
- Runs entirely in the browser — no server
- Real-time processing — minimal latency from hit to sound
- Trainable in-app — user can retrain when their setup changes

## Stack

- **SvelteKit** (static adapter) — UI framework
- **Svelte 5 runes** — reactive state management
- **TailwindCSS v4** — styling
- **TypeScript** — type safety
- **Web Audio API** — audio capture and playback
- **ML model** — sound classification (library TBD)

## System layers (TBD)

Details to be filled in during design phase:
- Audio capture pipeline
- Feature extraction
- Classification model
- Sound mapping & playback
- UI components & state management

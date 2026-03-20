import { describe, it, expect } from 'vitest';
import { OnsetDetector } from './onset';

describe('OnsetDetector', () => {
  it('does not trigger on silence', () => {
    const detector = new OnsetDetector();
    const silence = new Float32Array(512);

    for (let i = 0; i < 10; i++) {
      expect(detector.process(silence)).toBe(false);
    }
  });

  it('triggers on a sudden energy spike', () => {
    const detector = new OnsetDetector();
    const silence = new Float32Array(512);
    const loud = new Float32Array(512).fill(0.5);

    for (let i = 0; i < 10; i++) {
      detector.process(silence);
    }

    expect(detector.process(loud)).toBe(true);
  });

  it('does not re-trigger immediately after a hit (cooldown)', () => {
    const detector = new OnsetDetector();
    const silence = new Float32Array(512);
    const loud = new Float32Array(512).fill(0.5);

    for (let i = 0; i < 10; i++) {
      detector.process(silence);
    }

    expect(detector.process(loud)).toBe(true);
    expect(detector.process(loud)).toBe(false);
  });

  it('re-triggers after cooldown period', () => {
    const detector = new OnsetDetector();
    const silence = new Float32Array(512);
    const loud = new Float32Array(512).fill(0.5);

    for (let i = 0; i < 10; i++) {
      detector.process(silence);
    }

    expect(detector.process(loud)).toBe(true);

    for (let i = 0; i < 10; i++) {
      detector.process(silence);
    }

    expect(detector.process(loud)).toBe(true);
  });

  it('adapts to a noisy environment', () => {
    const detector = new OnsetDetector();
    const noise = new Float32Array(512).fill(0.05);
    const hit = new Float32Array(512).fill(0.5);

    for (let i = 0; i < 20; i++) {
      detector.process(noise);
    }

    expect(detector.process(hit)).toBe(true);
  });

  it('triggers on a short transient peak (tap-like)', () => {
    const detector = new OnsetDetector();
    const silence = new Float32Array(512);

    // Build noise floor
    for (let i = 0; i < 10; i++) {
      detector.process(silence);
    }

    // Simulate a tap: most samples are silent but a few have a sharp peak
    const tap = new Float32Array(512);
    for (let i = 0; i < 20; i++) {
      tap[i] = 0.3; // short burst at start of buffer
    }
    // RMS is low (~0.03) but peak is 0.3
    expect(detector.process(tap)).toBe(true);
  });
});

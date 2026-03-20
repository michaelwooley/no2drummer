import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { intensityToGain, DrumPlayer } from './player';
import { DRUM_IDS } from './samples';

describe('intensityToGain', () => {
  it('maps 0 to 0', () => {
    expect(intensityToGain(0)).toBe(0);
  });

  it('maps 1 to 1', () => {
    expect(intensityToGain(1)).toBeCloseTo(1, 5);
  });

  it('maps 0.5 above 0.5 (log curve boosts quiet hits)', () => {
    const gain = intensityToGain(0.5);
    expect(gain).toBeGreaterThan(0.5);
    expect(gain).toBeLessThan(1);
  });

  it('is monotonically increasing', () => {
    const values = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const gains = values.map(intensityToGain);
    for (let i = 1; i < gains.length; i++) {
      expect(gains[i]).toBeGreaterThanOrEqual(gains[i - 1]);
    }
  });

  it('clamps negative values to 0', () => {
    expect(intensityToGain(-0.5)).toBe(0);
  });

  it('clamps values above 1 to gain of 1', () => {
    expect(intensityToGain(2)).toBeCloseTo(1, 5);
  });
});

describe('DrumPlayer', () => {
  function createMockAudioContext() {
    const bufferMap = new Map<string, object>();
    let fetchCallIndex = 0;
    const fetchOrder: string[] = [];

    const context = {
      createBufferSource: vi.fn(),
      createGain: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      decodeAudioData: vi.fn((_arrayBuffer: ArrayBuffer) => {
        const url = fetchOrder[fetchCallIndex++] ?? 'unknown';
        const mockBuffer = { __drumUrl: url };
        bufferMap.set(url, mockBuffer);
        return Promise.resolve(mockBuffer as unknown as AudioBuffer);
      }),
      destination: {},
      close: vi.fn()
    };

    const mockFetch = vi.fn((url: string) => {
      fetchOrder.push(url);
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      });
    });

    return { context, mockFetch, bufferMap };
  }

  let mockSetup: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    mockSetup = createMockAudioContext();
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        return mockSetup.context;
      })
    );
    vi.stubGlobal('fetch', mockSetup.mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('load', () => {
    it('fetches all 4 sample URLs', async () => {
      const player = new DrumPlayer();
      await player.load();

      expect(mockSetup.mockFetch).toHaveBeenCalledTimes(4);
      for (const id of DRUM_IDS) {
        expect(mockSetup.mockFetch).toHaveBeenCalledWith(`/samples/${id}.wav`);
      }
    });

    it('decodes all 4 fetched ArrayBuffers', async () => {
      const player = new DrumPlayer();
      await player.load();

      expect(mockSetup.context.decodeAudioData).toHaveBeenCalledTimes(4);
    });

    it('throws with sample name when fetch fails', async () => {
      mockSetup.mockFetch.mockImplementation((url: string) => {
        if (url.includes('snare')) {
          return Promise.resolve({
            ok: false,
            status: 404,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
          });
        }
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
        });
      });

      const player = new DrumPlayer();
      await expect(player.load()).rejects.toThrow('snare');
    });

    it('throws with sample name when decodeAudioData fails', async () => {
      mockSetup.context.decodeAudioData.mockImplementationOnce(() => {
        return Promise.reject(new Error('decode error'));
      });

      const player = new DrumPlayer();
      await expect(player.load()).rejects.toThrow(/Failed to decode sample/);
    });
  });

  describe('play', () => {
    it('creates a BufferSource and GainNode connected to destination', async () => {
      const mockGainNode = {
        gain: { value: 0 },
        connect: vi.fn()
      };
      const mockSource = {
        buffer: null as unknown,
        connect: vi.fn().mockReturnValue(mockGainNode),
        start: vi.fn()
      };
      mockSetup.context.createBufferSource.mockReturnValue(mockSource);
      mockSetup.context.createGain.mockReturnValue(mockGainNode);

      const player = new DrumPlayer();
      await player.load();
      player.play('snare', 0.5);

      expect(mockSetup.context.createBufferSource).toHaveBeenCalled();
      expect(mockSetup.context.createGain).toHaveBeenCalled();
      expect(mockSource.connect).toHaveBeenCalledWith(mockGainNode);
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockSetup.context.destination);
      expect(mockSource.start).toHaveBeenCalled();
    });

    it('sets gain using logarithmic intensity scaling', async () => {
      const mockGainNode = {
        gain: { value: 0 },
        connect: vi.fn()
      };
      const mockSource = {
        buffer: null as unknown,
        connect: vi.fn().mockReturnValue(mockGainNode),
        start: vi.fn()
      };
      mockSetup.context.createBufferSource.mockReturnValue(mockSource);
      mockSetup.context.createGain.mockReturnValue(mockGainNode);

      const player = new DrumPlayer();
      await player.load();
      player.play('kick', 0.5);

      // Log curve: 0.5 maps to above 0.5 (boosts quiet hits)
      expect(mockGainNode.gain.value).toBeGreaterThan(0.5);
      expect(mockGainNode.gain.value).toBeLessThan(1);
    });

    it('does not throw when called before load', () => {
      const player = new DrumPlayer();
      expect(() => player.play('kick', 0.5)).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('closes the AudioContext after load', async () => {
      const player = new DrumPlayer();
      await player.load();
      player.dispose();

      expect(mockSetup.context.close).toHaveBeenCalled();
    });

    it('does not throw if called before load', () => {
      const player = new DrumPlayer();
      expect(() => player.dispose()).not.toThrow();
    });
  });
});

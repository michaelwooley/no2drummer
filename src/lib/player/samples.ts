export type DrumId = 'kick' | 'snare' | 'hihat' | 'cymbal';

export const DRUM_IDS: DrumId[] = ['kick', 'snare', 'hihat', 'cymbal'];

export const SAMPLES: Record<DrumId, string> = {
  kick: '/samples/kick.wav',
  snare: '/samples/snare.wav',
  hihat: '/samples/hihat.wav',
  cymbal: '/samples/cymbal.wav'
} as const;

const WHITE_POS_BY_CHROMA: Record<number, number> = {
  0: 0, 1: 0.5, 2: 1, 3: 1.5, 4: 2,
  5: 3, 6: 3.5, 7: 4, 8: 4.5, 9: 5, 10: 5.5, 11: 6,
};

const BLACK_CHROMA = new Set([1, 3, 6, 8, 10]);

export const FINGER_OFFSET: Record<number, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
};

export const midiToWhitePos = (midi: number): number =>
  (Math.floor(midi / 12) - 1) * 7 + WHITE_POS_BY_CHROMA[midi % 12];

export const isBlackKey = (midi: number): boolean => BLACK_CHROMA.has(midi % 12);

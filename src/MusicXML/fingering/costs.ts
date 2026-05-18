import type { NoteInfo } from "./types";

export const fingerKeyCost = (finger: number, isBlack: boolean): number => {
  if (finger === 1 && isBlack) return 10;
  if (finger === 5 && isBlack) return 3;
  return 0;
};

export const handShiftCost = (from: number, to: number): number => {
  const diff = Math.abs(to - from);
  if (diff === 0) return 0;
  if (diff <= 0.5) return 0.5;
  if (diff <= 1) return 1;
  if (diff <= 2) return 3;
  if (diff <= 3) return 6;
  return 12 + (diff - 3) * 3;
};

export const sameFingerPenalty = (prevPos: number, curPos: number): number => {
  const dist = Math.abs(curPos - prevPos);
  if (dist === 0) return 0;
  if (dist <= 1) return 3;
  if (dist <= 2) return 6;
  return 10;
};

export const melodicTransitionCost = (
  prevNote: NoteInfo,
  curNote: NoteInfo,
  prevFinger: number,
  curFinger: number,
): number => {
  const delta = curNote.whitePos - prevNote.whitePos;
  const absDelta = Math.abs(delta);

  if (absDelta === 0) return 0;

  const ascending = delta > 0;
  const descending = delta < 0;

  if (prevFinger === curFinger) {
    return sameFingerPenalty(prevNote.whitePos, curNote.whitePos);
  }

  if (
    ascending &&
    curFinger === 1 &&
    (prevFinger === 3 || prevFinger === 4) &&
    absDelta <= 1.5
  ) {
    return -1;
  }

  if (
    descending &&
    prevFinger === 1 &&
    (curFinger === 3 || curFinger === 4) &&
    absDelta <= 1.5
  ) {
    return -1;
  }

  if (ascending && curFinger > prevFinger) return 0;
  if (descending && curFinger < prevFinger) return 0;

  if (ascending && curFinger < prevFinger) return 5;
  if (descending && curFinger > prevFinger) return 5;

  return 0;
};

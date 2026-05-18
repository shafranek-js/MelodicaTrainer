import { FINGER_OFFSET } from "./geometry";
import { fingerKeyCost } from "./costs";
import type { Candidate, NoteGroup } from "./types";

const increasingFingerCombos = (
  count: number,
  startFinger = 1,
  current: number[] = [],
  result: number[][] = [],
): number[][] => {
  if (current.length === count) {
    result.push([...current]);
    return result;
  }
  for (let f = startFinger; f <= 5; f += 1) {
    current.push(f);
    increasingFingerCombos(count, f + 1, current, result);
    current.pop();
  }
  return result;
};

export const generateCandidates = (group: NoteGroup): Candidate[] => {
  const n = group.length;

  if (n === 0) return [];
  if (n > 5) return []; // one hand, 5 fingers. TODO v8: skip or partial fallback

  if (n === 1) {
    const ni = group[0];
    return [1, 2, 3, 4, 5].map((f) => ({
      fingers: [f],
      handPos: ni.whitePos - FINGER_OFFSET[f],
      cost: fingerKeyCost(f, ni.isBlack),
    }));
  }

  const indexed = group.map((note, idx) => ({ note, originalIndex: idx }));
  indexed.sort((a, b) => a.note.whitePos - b.note.whitePos);

  const combos = increasingFingerCombos(n);
  const candidates: Candidate[] = [];

  for (const fingersSorted of combos) {
    let sumHand = 0;
    let sumCost = 0;

    for (let i = 0; i < n; i += 1) {
      const { note } = indexed[i];
      const f = fingersSorted[i];
      sumHand += note.whitePos - FINGER_OFFSET[f];
      sumCost += fingerKeyCost(f, note.isBlack);
    }

    const handPos = Math.round((sumHand / n) * 2) / 2;

    let stretchCost = 0;
    for (let i = 0; i < n; i += 1) {
      const { note } = indexed[i];
      const f = fingersSorted[i];
      const ideal = handPos + FINGER_OFFSET[f];
      stretchCost += Math.abs(note.whitePos - ideal) * 2;
    }

    const fingersByOriginal = new Array<number>(n);
    for (let i = 0; i < n; i += 1) {
      fingersByOriginal[indexed[i].originalIndex] = fingersSorted[i];
    }

    candidates.push({
      fingers: fingersByOriginal,
      handPos,
      cost: sumCost + stretchCost,
    });
  }

  candidates.sort((a, b) => a.cost - b.cost);
  return candidates;
};

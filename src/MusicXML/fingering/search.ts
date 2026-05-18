import { FINGER_OFFSET } from "./geometry";
import {
  handShiftCost,
  melodicTransitionCost,
  sameFingerPenalty,
} from "./costs";
import type {
  Candidate,
  FingerAssignment,
  GroupDpState,
  NoteGroup,
} from "./types";

const getInitialBias = (groups: NoteGroup[], candidate: Candidate) => {
  let initBias = 0;
  if (groups[0].length === 1) {
    const f = candidate.fingers[0];
    const nextGroup = groups.length > 1 ? groups[1] : null;
    const nextNote = nextGroup?.length === 1 ? nextGroup[0] : null;
    const delta = nextNote ? nextNote.whitePos - groups[0][0].whitePos : 0;

    if (delta > 0) {
      if (f === 1) initBias = 0;
      else if (f === 2) initBias = 0.3;
      else if (f === 3) initBias = 0.6;
      else if (f === 4) initBias = 1.5;
      else initBias = 3;
    } else if (delta < 0) {
      if (f === 5) initBias = 0;
      else if (f === 4) initBias = 0.3;
      else if (f === 3) initBias = 0.6;
      else if (f === 2) initBias = 1.5;
      else initBias = 3;
    } else if (f === 2 || f === 3) {
      initBias = 0;
    } else if (f === 4) {
      initBias = 0.5;
    } else {
      initBias = 1;
    }
  }
  return initBias;
};

const getPhraseReach = (
  groups: NoteGroup[],
  groupIndex: number,
  rightEdge: number,
  leftEdge: number,
) => {
  let phraseExceedsRight = false;
  let phraseExceedsLeft = false;

  for (let look = groupIndex + 1; look < Math.min(groups.length, groupIndex + 5); look += 1) {
    const fwd = groups[look];
    if (fwd.length !== 1) continue;
    if (fwd[0].whitePos > rightEdge) {
      phraseExceedsRight = true;
      break;
    }
    if (fwd[0].whitePos < leftEdge) {
      phraseExceedsLeft = true;
      break;
    }
  }

  return { phraseExceedsLeft, phraseExceedsRight };
};

const getTransitionCost = ({
  cand,
  curGroup,
  groupIndex,
  groups,
  prev,
  prevGroup,
}: {
  cand: Candidate;
  curGroup: NoteGroup;
  groupIndex: number;
  groups: NoteGroup[];
  prev: GroupDpState;
  prevGroup: NoteGroup;
}) => {
  const bothSingles = prevGroup.length === 1 && curGroup.length === 1;
  const absDelta = bothSingles
    ? Math.abs(curGroup[0].whitePos - prevGroup[0].whitePos)
    : 0;

  const isClose = absDelta <= 1.5;
  const rightEdge = prev.candidate.handPos + FINGER_OFFSET[5];
  const leftEdge = prev.candidate.handPos + FINGER_OFFSET[1];
  const noteReachable =
    bothSingles && curGroup[0].whitePos >= leftEdge && curGroup[0].whitePos <= rightEdge;

  const { phraseExceedsLeft, phraseExceedsRight } = bothSingles && noteReachable
    ? getPhraseReach(groups, groupIndex, rightEdge, leftEdge)
    : { phraseExceedsLeft: false, phraseExceedsRight: false };

  const ascending = curGroup[0].whitePos > prevGroup[0].whitePos;
  const needsThumbUnder =
    bothSingles && isClose && ascending &&
    (!noteReachable || phraseExceedsRight) &&
    cand.fingers[0] === 1 &&
    (prev.candidate.fingers[0] === 3 || prev.candidate.fingers[0] === 4);

  const descending = curGroup[0].whitePos < prevGroup[0].whitePos;
  const needsFingerOver =
    bothSingles && isClose && descending &&
    (!noteReachable || phraseExceedsLeft) &&
    prev.candidate.fingers[0] === 1 &&
    (cand.fingers[0] === 3 || cand.fingers[0] === 4);

  const earlyShiftBonus =
    (needsThumbUnder && phraseExceedsRight) || (needsFingerOver && phraseExceedsLeft)
      ? -0.1 : 0;

  const shift = (needsThumbUnder || needsFingerOver)
    ? 1
    : handShiftCost(prev.candidate.handPos, cand.handPos);

  let sfPenalty = 0;
  if (!bothSingles) {
    for (let fi = 0; fi < prev.candidate.fingers.length; fi += 1) {
      for (let fj = 0; fj < cand.fingers.length; fj += 1) {
        if (prev.candidate.fingers[fi] === cand.fingers[fj]) {
          sfPenalty += sameFingerPenalty(
            prevGroup[fi]?.whitePos ?? 0,
            curGroup[fj]?.whitePos ?? 0,
          );
        }
      }
    }
  }

  const melodicCost = bothSingles
    ? melodicTransitionCost(
      prevGroup[0],
      curGroup[0],
      prev.candidate.fingers[0],
      cand.fingers[0],
    )
    : 0;

  return shift + earlyShiftBonus + sfPenalty + melodicCost;
};

export const findBestFingerAssignments = (
  groups: NoteGroup[],
  groupCandidates: Candidate[][],
): FingerAssignment[] => {
  const G = groups.length;
  const dp: GroupDpState[][] = [];

  for (let g = 0; g < G; g += 1) {
    const candidates = groupCandidates[g];
    const stepStates: GroupDpState[] = [];

    for (let ci = 0; ci < candidates.length; ci += 1) {
      const cand = candidates[ci];

      if (g === 0) {
        stepStates.push({
          cost: cand.cost + getInitialBias(groups, cand),
          prevCandidate: -1,
          candidate: cand,
        });
        continue;
      }

      let bestPrevCost = Infinity;
      let bestPrevCi = -1;
      const prevStates = dp[g - 1];
      const prevGroup = groups[g - 1];
      const curGroup = groups[g];

      for (let pi = 0; pi < prevStates.length; pi += 1) {
        const prev = prevStates[pi];
        const total = prev.cost + getTransitionCost({
          cand,
          curGroup,
          groupIndex: g,
          groups,
          prev,
          prevGroup,
        });

        if (total < bestPrevCost) {
          bestPrevCost = total;
          bestPrevCi = pi;
        }
      }

      if (bestPrevCost < Infinity) {
        stepStates.push({
          cost: cand.cost + bestPrevCost,
          prevCandidate: bestPrevCi,
          candidate: cand,
        });
      }
    }

    dp.push(stepStates);
  }

  const lastStates = dp[G - 1];
  let bestIdx = 0;
  let bestCost = Infinity;
  for (let i = 0; i < lastStates.length; i += 1) {
    if (lastStates[i].cost < bestCost) {
      bestCost = lastStates[i].cost;
      bestIdx = i;
    }
  }

  const assignments: FingerAssignment[] = [];

  for (let g = G - 1; g >= 0; g -= 1) {
    const state = dp[g][bestIdx];
    for (let i = 0; i < groups[g].length; i += 1) {
      assignments.unshift({
        eventIndex: groups[g][i].eventIndex,
        noteIndex: groups[g][i].noteIndex,
        finger: state.candidate.fingers[i],
      });
    }
    bestIdx = state.prevCandidate;
  }

  assignments.sort((a, b) =>
    a.eventIndex !== b.eventIndex
      ? a.eventIndex - b.eventIndex
      : a.noteIndex - b.noteIndex,
  );

  return assignments;
};

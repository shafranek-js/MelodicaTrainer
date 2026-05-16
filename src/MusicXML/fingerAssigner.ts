import { Note } from "tonal";
import { generateMelodicaLayout, getMelodicaKeyboardGeometry } from "../utils/utils";
import type { MelodicaKeyCount } from "../utils/utils";
import type { PlaybackEvent } from "./types";

export type FingerAssignment = {
  eventIndex: number;
  noteIndex: number;
  finger: number; // 1–5
};

// ── White-key coordinate system ──
//
//   C  C#  D  D#  E  F  F#  G  G#  A  A#  B
//   0  0.5 1  1.5 2  3  3.5 4  4.5 5  5.5 6   (+ octave × 7)

const WHITE_POS_BY_CHROMA: Record<number, number> = {
  0: 0, 1: 0.5, 2: 1, 3: 1.5, 4: 2,
  5: 3, 6: 3.5, 7: 4, 8: 4.5, 9: 5, 10: 5.5, 11: 6,
};

const BLACK_CHROMA = new Set([1, 3, 6, 8, 10]);

const midiToWhitePos = (midi: number): number =>
  (Math.floor(midi / 12) - 1) * 7 + WHITE_POS_BY_CHROMA[midi % 12];

const isBlackKey = (midi: number): boolean => BLACK_CHROMA.has(midi % 12);

// Finger 1 (thumb) at offset 0, finger 5 (pinky) at offset 4.
const FINGER_OFFSET: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };

// ── Cost functions ──

const fingerKeyCost = (finger: number, isBlack: boolean): number => {
  if (finger === 1 && isBlack) return 10;
  if (finger === 5 && isBlack) return 3;
  return 0;
};

const handShiftCost = (from: number, to: number): number => {
  const diff = Math.abs(to - from);
  if (diff === 0) return 0;
  if (diff <= 0.5) return 0.5;
  if (diff <= 1) return 1;
  if (diff <= 2) return 3;
  if (diff <= 3) return 6;
  return 12 + (diff - 3) * 3;
};

const sameFingerPenalty = (prevPos: number, curPos: number): number => {
  const dist = Math.abs(curPos - prevPos);
  if (dist === 0) return 0;       // repeating the same key — fine
  if (dist <= 1) return 3;        // neighbour with same finger — awkward
  if (dist <= 2) return 6;        // small skip with same finger — bad
  return 10;                       // leap with same finger — very bad
};

/**
 * Musical transition cost between two consecutive single-note groups.
 * Rewards natural patterns (thumb-under, finger-over) and
 * penalises counter-intuitive finger changes.
 */
const melodicTransitionCost = (
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

  // Same finger on different notes — apply distance-based penalty
  if (prevFinger === curFinger) {
    return sameFingerPenalty(prevNote.whitePos, curNote.whitePos);
  }

  // Thumb-under ascending: E→F = 3→1 or 4→1 — essential technique
  if (
    ascending &&
    curFinger === 1 &&
    (prevFinger === 3 || prevFinger === 4) &&
    absDelta <= 1.5
  ) {
    return -1;
  }

  // Finger-over descending: F→E = 1→3 or 1→4 — also natural
  if (
    descending &&
    prevFinger === 1 &&
    (curFinger === 3 || curFinger === 4) &&
    absDelta <= 1.5
  ) {
    return -1;
  }

  // Natural: fingers move in the same direction as the melody
  if (ascending && curFinger > prevFinger) return 0;
  if (descending && curFinger < prevFinger) return 0;

  // Counter-movement: finger moves against the melody
  if (ascending && curFinger < prevFinger) return 5;
  if (descending && curFinger > prevFinger) return 5;

  return 0;
};

// ── Types ──

type NoteInfo = {
  eventIndex: number;
  noteIndex: number;
  midi: number;
  whitePos: number;
  isBlack: boolean;
};

/** One group = all playable notes in a single PlaybackEvent. */
type NoteGroup = NoteInfo[];

/** A candidate fingering for a NoteGroup.
 *  fingers[i] corresponds to group[i] — preserves original order. */
type Candidate = {
  fingers: number[];
  handPos: number;
  cost: number;
};

/** DP state for a group step. */
type GroupDpState = {
  cost: number;
  prevCandidate: number;
  candidate: Candidate;
};

// ── Candidate generation ──

/**
 * Generate all strictly-increasing finger combinations of length `count`
 * from {1..5}.  E.g. count=3 → [1,2,3], [1,2,4], ..., [3,4,5]  (10 total).
 *
 * This matches real hand anatomy: lower notes get lower fingers.
 */
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
  for (let f = startFinger; f <= 5; f++) {
    current.push(f);
    increasingFingerCombos(count, f + 1, current, result);
    current.pop();
  }
  return result;
};

const generateCandidates = (group: NoteGroup): Candidate[] => {
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

  // Sort by pitch to generate ascending finger combos,
  // then map back to original group order.
  const indexed = group.map((note, idx) => ({ note, originalIndex: idx }));
  indexed.sort((a, b) => a.note.whitePos - b.note.whitePos);

  const combos = increasingFingerCombos(n);
  const candidates: Candidate[] = [];

  for (const fingersSorted of combos) {
    let sumHand = 0;
    let sumCost = 0;

    for (let i = 0; i < n; i++) {
      const { note } = indexed[i];
      const f = fingersSorted[i];
      sumHand += note.whitePos - FINGER_OFFSET[f];
      sumCost += fingerKeyCost(f, note.isBlack);
    }

    const handPos = Math.round((sumHand / n) * 2) / 2; // snap to 0.5 grid

    let stretchCost = 0;
    for (let i = 0; i < n; i++) {
      const { note } = indexed[i];
      const f = fingersSorted[i];
      const ideal = handPos + FINGER_OFFSET[f];
      stretchCost += Math.abs(note.whitePos - ideal) * 2;
    }

    // Map fingers back to original group order
    const fingersByOriginal = new Array<number>(n);
    for (let i = 0; i < n; i++) {
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

/**
 * Production-ready MVP baseline for automatic fingering assignment.
 *
 * Handles: single notes, chords, white-key positioning, thumb-under,
 * finger-over, same-finger penalties, direction-aware starting bias,
 * and melodica range validation.
 *
 * Architecture: PlaybackEvent[] → NoteGroup[] → Candidate[][] → DP → backtrack.
 *
 * TODO v8:
 *  - Limit lookahead by distance to avoid false preparation before large leaps.
 *  - Add phrase-break logic based on time gaps between events.
 *  - Add arpeggio-specific thumb-under handling (wider absDelta tolerance).
 *  - Improve wide chord hand-position candidates.
 */

/**
 * DP-optimised finger assignment across NoteGroups.
 *
 * Each PlaybackEvent becomes one NoteGroup (single note or chord).
 * For each group we generate finger candidates, then DP picks the
 * globally optimal path minimising hand shifts + finger penalties.
 */
export const assignFingers = (
  events: PlaybackEvent[],
  keyCount: MelodicaKeyCount = 32,
): FingerAssignment[] => {
  if (events.length === 0) return [];

  // Build melodica key map for range validation
  const layout = generateMelodicaLayout(keyCount);
  const geometry = getMelodicaKeyboardGeometry(layout);
  const validMidi = new Set(geometry.keys.map((k) => k.midi));

  // ── 1. Build groups (one per event) ──
  const groups: NoteGroup[] = [];

  for (let eventIdx = 0; eventIdx < events.length; eventIdx++) {
    const event = events[eventIdx];
    const group: NoteGroup = [];

    event.notes.forEach((note, noteIndex) => {
      if (!note.shouldPlay) return;
      const midi = Note.midi(note.name);
      if (typeof midi !== "number") return;        // safer null-check
      if (!validMidi.has(midi)) return;             // outside melodica range
      group.push({
        eventIndex: eventIdx,
        noteIndex,
        midi,
        whitePos: midiToWhitePos(midi),
        isBlack: isBlackKey(midi),
      });
    });

    if (group.length > 0) groups.push(group);
  }

  if (groups.length === 0) return [];

  // ── 2. Generate candidates for every group ──
  const groupCandidates: Candidate[][] = groups.map(generateCandidates);

  // If any group has zero candidates, bail out.
  // TODO v8: skip impossible groups instead of failing all assignments.
  if (groupCandidates.some((c) => c.length === 0)) return [];

  // ── 3. DP across groups ──
  const G = groups.length;
  const dp: GroupDpState[][] = [];

  for (let g = 0; g < G; g++) {
    const candidates = groupCandidates[g];
    const stepStates: GroupDpState[] = [];

    for (let ci = 0; ci < candidates.length; ci++) {
      const cand = candidates[ci];

      if (g === 0) {
        // Direction-aware initial bias:
        //   Ascending phrase  → prefer lower fingers (1,2)
        //   Descending phrase → prefer higher fingers (4,5)
        //   Isolated note    → prefer middle fingers (2,3)
        let initBias = 0;
        if (groups[g].length === 1) {
          const f = cand.fingers[0];
          const nextGroup = groups.length > 1 ? groups[1] : null;
          const nextNote = nextGroup?.length === 1 ? nextGroup[0] : null;
          const delta = nextNote ? nextNote.whitePos - groups[0][0].whitePos : 0;

          if (delta > 0) {
            // Ascending — start lower to leave room
            if (f === 1) initBias = 0;
            else if (f === 2) initBias = 0.3;
            else if (f === 3) initBias = 0.6;
            else if (f === 4) initBias = 1.5;
            else initBias = 3; // f === 5
          } else if (delta < 0) {
            // Descending — start higher
            if (f === 5) initBias = 0;
            else if (f === 4) initBias = 0.3;
            else if (f === 3) initBias = 0.6;
            else if (f === 2) initBias = 1.5;
            else initBias = 3; // f === 1
          } else {
            // Isolated — prefer middle
            if (f === 2 || f === 3) initBias = 0;
            else if (f === 4) initBias = 0.5;
            else initBias = 1;
          }
        }
        stepStates.push({
          cost: cand.cost + initBias,
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

      for (let pi = 0; pi < prevStates.length; pi++) {
        const prev = prevStates[pi];

        // ── Hand shift cost ──
        const bothSingles = prevGroup.length === 1 && curGroup.length === 1;
        const absDelta = bothSingles
          ? Math.abs(curGroup[0].whitePos - prevGroup[0].whitePos)
          : 0;

        // Only allow thumb-under/finger-over on close notes (≤1.5 white-key units).
        const isClose = absDelta <= 1.5;

        const rightEdge = prev.candidate.handPos + FINGER_OFFSET[5];
        const leftEdge = prev.candidate.handPos + FINGER_OFFSET[1];
        const noteReachable =
          bothSingles && curGroup[0].whitePos >= leftEdge && curGroup[0].whitePos <= rightEdge;

        // Lookahead: will the phrase exit this hand position soon?
        // TODO v8: limit by distance (MAX_LOOKAHEAD_EXTENSION) to avoid
        // preparing for unreasonably large leaps.
        let phraseExceedsRight = false;
        let phraseExceedsLeft = false;
        if (bothSingles && noteReachable) {
          for (let look = g + 1; look < Math.min(G, g + 5); look++) {
            const fwd = groups[look];
            if (fwd.length !== 1) continue;
            if (fwd[0].whitePos > rightEdge) { phraseExceedsRight = true; break; }
            if (fwd[0].whitePos < leftEdge)  { phraseExceedsLeft = true; break; }
          }
        }

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

        // ── Same-finger penalty ──
        // For single→single, same-finger lives inside melodicTransitionCost.
        // Here we only apply it for chord→chord or mixed transitions.
        let sfPenalty = 0;
        if (!bothSingles) {
          for (let fi = 0; fi < prev.candidate.fingers.length; fi++) {
            for (let fj = 0; fj < cand.fingers.length; fj++) {
              if (prev.candidate.fingers[fi] === cand.fingers[fj]) {
                sfPenalty += sameFingerPenalty(
                  prevGroup[fi]?.whitePos ?? 0,
                  curGroup[fj]?.whitePos ?? 0,
                );
              }
            }
          }
        }

        // ── Melodic transition (single → single only) ──
        let melodicCost = 0;
        if (bothSingles) {
          melodicCost = melodicTransitionCost(
            prevGroup[0],
            curGroup[0],
            prev.candidate.fingers[0],
            cand.fingers[0],
          );
        }

        const total = prev.cost + shift + earlyShiftBonus + sfPenalty + melodicCost;
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

  // ── 4. Backtrack ──
  const lastStates = dp[G - 1];
  let bestIdx = 0;
  let bestCost = Infinity;
  for (let i = 0; i < lastStates.length; i++) {
    if (lastStates[i].cost < bestCost) {
      bestCost = lastStates[i].cost;
      bestIdx = i;
    }
  }

  const assignments: FingerAssignment[] = [];

  for (let g = G - 1; g >= 0; g--) {
    const state = dp[g][bestIdx];
    for (let i = 0; i < groups[g].length; i++) {
      assignments.unshift({
        eventIndex: groups[g][i].eventIndex,
        noteIndex: groups[g][i].noteIndex,
        finger: state.candidate.fingers[i],
      });
    }
    bestIdx = state.prevCandidate;
  }

  // Sort by (eventIndex, noteIndex) to match original score order
  assignments.sort((a, b) =>
    a.eventIndex !== b.eventIndex
      ? a.eventIndex - b.eventIndex
      : a.noteIndex - b.noteIndex,
  );

  return assignments;
};

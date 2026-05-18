import { Note } from "tonal";
import { generateMelodicaLayout, getMelodicaKeyboardGeometry } from "../utils/utils";
import type { MelodicaKeyCount } from "../utils/utils";
import type { PlaybackEvent } from "./types";
import { generateCandidates } from "./fingering/candidates";
import { isBlackKey, midiToWhitePos } from "./fingering/geometry";
import { findBestFingerAssignments } from "./fingering/search";
import type { FingerAssignment, NoteGroup } from "./fingering/types";

export type { FingerAssignment } from "./fingering/types";

const getPlayableMelodicaMidi = (keyCount: MelodicaKeyCount) => {
  const layout = generateMelodicaLayout(keyCount);
  const geometry = getMelodicaKeyboardGeometry(layout);
  return new Set(geometry.keys.map((key) => key.midi));
};

const buildNoteGroups = (
  events: PlaybackEvent[],
  validMidi: ReadonlySet<number>,
): NoteGroup[] => {
  const groups: NoteGroup[] = [];

  for (let eventIdx = 0; eventIdx < events.length; eventIdx += 1) {
    const event = events[eventIdx];
    const group: NoteGroup = [];

    event.notes.forEach((note, noteIndex) => {
      if (!note.shouldPlay) return;
      const midi = Note.midi(note.name);
      if (typeof midi !== "number") return;
      if (!validMidi.has(midi)) return;
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

  return groups;
};

export const assignFingers = (
  events: PlaybackEvent[],
  keyCount: MelodicaKeyCount = 32,
): FingerAssignment[] => {
  if (events.length === 0) return [];

  const groups = buildNoteGroups(events, getPlayableMelodicaMidi(keyCount));
  if (groups.length === 0) return [];

  const groupCandidates = groups.map(generateCandidates);

  // TODO v8: skip impossible groups instead of failing all assignments.
  if (groupCandidates.some((candidates) => candidates.length === 0)) return [];

  return findBestFingerAssignments(groups, groupCandidates);
};

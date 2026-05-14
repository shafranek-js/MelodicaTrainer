import { Note } from "tonal";

export function freqToNoteAndCents(freq: number) {
  const noteName = Note.fromFreq(freq); // e.g. "C4"
  if (!noteName) return null;

  const baseFreq = Note.freq(noteName);
  if (!baseFreq) return null;

  const cents = 1200 * Math.log2(freq / baseFreq);

  // Extract pitch class (C, D#, etc.)
  const noteNoOctave = Note.pitchClass(noteName); // e.g., "C"
  return {
    note: noteName, // full note with octave, e.g., "C4"
    pitchClass: noteNoOctave, // just "C"
    cents,
  };
}

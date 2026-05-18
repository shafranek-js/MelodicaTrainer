import { useMemo } from "react";
import { Note } from "tonal";
import { freqToNoteAndCents } from "../utils/utils";
import type { MelodicaLayout } from "../utils/utils";

type UseMelodicaViewModelOptions = {
  layout: MelodicaLayout;
  pitch: string | null;
};

export const useMelodicaViewModel = ({
  layout,
  pitch,
}: UseMelodicaViewModelOptions) => {
  const detectedNote = useMemo(
    () => (pitch ? freqToNoteAndCents(Number(pitch)) : null),
    [pitch],
  );
  const detectedMidi = detectedNote ? Note.midi(detectedNote.note) : null;
  const rangeSummary = `${layout.startNote}-${layout.endNote} range, ${layout.keys.length} keys`;
  const keyboardRangeLabel = `${layout.startNote} to ${layout.endNote}`;

  return {
    detectedMidi,
    detectedNote,
    keyboardRangeLabel,
    rangeSummary,
  };
};

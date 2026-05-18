import { useMemo } from "react";
import { Chord, Note } from "tonal";
import type { MelodicaLayout } from "../utils/utils";
import {
  bluesBars,
  getLayoutTargets,
  getPitchClassSet,
  getPracticeTargets,
} from "./practiceTargets";
import type { PracticeScaleValue } from "./practiceTargets";

export const trainerModes = [
  { label: "Explore", value: "explore" },
  { label: "Notes", value: "practice" },
  { label: "Scale", value: "scale" },
  { label: "Chord tones", value: "chords" },
  { label: "12-bar", value: "blues" },
] as const;

export type TrainerMode = (typeof trainerModes)[number]["value"];

type DetectedNote = {
  cents: number;
  note: string;
} | null;

type UsePracticeViewModelOptions = {
  barIndex: number;
  detectedMidi: number | null;
  detectedNote: DetectedNote;
  layout: MelodicaLayout;
  scaleValue: PracticeScaleValue;
  targetIndex: number;
  tonic: string;
  trainerMode: TrainerMode;
};

export const usePracticeViewModel = ({
  barIndex,
  detectedMidi,
  detectedNote,
  layout,
  scaleValue,
  targetIndex,
  tonic,
  trainerMode,
}: UsePracticeViewModelOptions) => {
  const { scale, scaleLabel, activePitchClasses, practiceTargets } = useMemo(
    () => getPracticeTargets({ layout, tonic, scaleValue }),
    [layout, scaleValue, tonic],
  );

  const bluesRoots = useMemo(
    () => ({
      I: tonic,
      IV: Note.transpose(tonic, "4P"),
      V: Note.transpose(tonic, "5P"),
    }),
    [tonic],
  );
  const currentBluesRoot =
    bluesRoots[bluesBars[barIndex] as keyof typeof bluesRoots];
  const currentBluesNotes = useMemo(
    () => Chord.get(`${currentBluesRoot}7`).notes,
    [currentBluesRoot],
  );
  const chordNotes = useMemo(() => Chord.get(`${tonic}maj7`).notes, [tonic]);
  const chordPitchClasses = useMemo(
    () => getPitchClassSet(chordNotes),
    [chordNotes],
  );
  const bluesPitchClasses = useMemo(
    () => getPitchClassSet(currentBluesNotes),
    [currentBluesNotes],
  );
  const chordTargets = useMemo(
    () => getLayoutTargets(layout, chordPitchClasses),
    [chordPitchClasses, layout],
  );

  const targets = trainerMode === "chords" ? chordTargets : practiceTargets;
  const target = targets[targetIndex % Math.max(targets.length, 1)];
  const activeTarget =
    trainerMode === "practice" ||
    trainerMode === "scale" ||
    trainerMode === "chords"
      ? target
      : undefined;
  const isTargetHit = Boolean(
    activeTarget &&
      detectedMidi === activeTarget.midi &&
      Math.abs(detectedNote?.cents ?? 99) <= 25,
  );

  return {
    activePitchClasses,
    activeTarget,
    bluesPitchClasses,
    chordPitchClasses,
    currentBluesNotes,
    currentBluesRoot,
    isTargetHit,
    scale,
    scaleLabel,
    targets,
  };
};

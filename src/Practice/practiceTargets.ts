import { Note, Scale } from "tonal";
import type { MelodicaLayout } from "../utils/utils";

export const tonicOptions = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

export const scaleOptions = [
  { label: "Major", value: "major" },
  { label: "Natural minor", value: "minor" },
  { label: "Major pentatonic", value: "major pentatonic" },
  { label: "Minor pentatonic", value: "minor pentatonic" },
  { label: "Blues", value: "blues" },
  { label: "Major blues", value: "major blues" },
] as const;

export const bluesBars = ["I", "I", "I", "I", "IV", "IV", "I", "I", "V", "IV", "I", "V"];

export type PracticeScaleValue = (typeof scaleOptions)[number]["value"];

export type PracticeTarget = {
  label: string;
  midi: number;
  noteName: string;
  row: string;
};

type PracticeScaleInput = {
  tonic: string;
  scaleValue: PracticeScaleValue;
};

type PracticeTargetsInput = PracticeScaleInput & {
  layout: MelodicaLayout;
};

export const getPitchClassSet = (notes: string[]) =>
  new Set(notes.map((note) => Note.chroma(note)).filter((chroma) => chroma >= 0));

export const getPracticeScale = ({ tonic, scaleValue }: PracticeScaleInput) => {
  const scale = Scale.get(`${tonic} ${scaleValue}`).notes;
  const scaleLabel =
    scaleOptions.find((option) => option.value === scaleValue)?.label ?? scaleValue;

  return {
    tonic,
    scale,
    scaleLabel,
  };
};

export const getLayoutTargets = (
  layout: MelodicaLayout,
  activePitchClasses: Set<number>
): PracticeTarget[] =>
  layout.keys.flatMap((key) => {
    const chroma = Note.chroma(key.name);
    if (!activePitchClasses.has(chroma)) return [];

    return [
      {
        label: `Key ${key.index}`,
        midi: key.midi,
        noteName: key.name,
        row: key.isBlack ? "Black key" : "White key",
      },
    ];
  });

export const getPracticeTargets = ({
  layout,
  tonic,
  scaleValue,
}: PracticeTargetsInput) => {
  const practiceScale = getPracticeScale({ tonic, scaleValue });
  const activePitchClasses = getPitchClassSet(practiceScale.scale);
  const practiceTargets = getLayoutTargets(layout, activePitchClasses);

  return {
    ...practiceScale,
    activePitchClasses,
    practiceTargets,
  };
};

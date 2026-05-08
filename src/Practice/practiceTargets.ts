import { Note, Scale } from "tonal";
import { harmonicaLayoutDisplayRows } from "../utils/utils";
import type { HarmonicaLayout } from "../utils/utils";

export const positionOptions = [
  { label: "1st", name: "Ionian", degree: 1 },
  { label: "2nd", name: "Mixolydian", degree: 5 },
  { label: "3rd", name: "Dorian", degree: 2 },
  { label: "4th", name: "Aeolian", degree: 6 },
  { label: "5th", name: "Phrygian", degree: 3 },
  { label: "12th", name: "Lydian", degree: 4 },
] as const;

export const scaleOptions = [
  { label: "Position mode", value: "mode" },
  { label: "Major", value: "major" },
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
  harmonicaKey: string;
  positionIndex: number;
  scaleValue: PracticeScaleValue;
};

type PracticeTargetsInput = PracticeScaleInput & {
  layout: HarmonicaLayout;
};

export const getPitchClassSet = (notes: string[]) =>
  new Set(notes.map((note) => Note.chroma(note)).filter((chroma) => chroma >= 0));

export const getPracticeScale = ({
  harmonicaKey,
  positionIndex,
  scaleValue,
}: PracticeScaleInput) => {
  const keyScale = Scale.get(`${Note.pitchClass(harmonicaKey)} major`).notes;
  const position = positionOptions[positionIndex] ?? positionOptions[0];
  const tonic = keyScale[position.degree - 1] ?? Note.pitchClass(harmonicaKey);
  const modeScale = [
    ...keyScale.slice(position.degree - 1),
    ...keyScale.slice(0, position.degree - 1),
  ];
  const scale =
    scaleValue === "mode" ? modeScale : Scale.get(`${tonic} ${scaleValue}`).notes;
  const scaleLabel =
    scaleValue === "mode"
      ? position.name
      : scaleOptions.find((option) => option.value === scaleValue)?.label ?? position.name;

  return {
    keyScale,
    position,
    tonic,
    modeScale,
    scale,
    scaleLabel,
  };
};

export const getLayoutTargets = (
  layout: HarmonicaLayout,
  activePitchClasses: Set<number>,
  bendsOnly = false
): PracticeTarget[] =>
  harmonicaLayoutDisplayRows.flatMap(({ key, practiceLabel, isBend }) =>
    layout[key].flatMap((note, index) => {
      if (!note) return [];

      const midi = Note.midi(note.name);
      const chroma = Note.chroma(note.name);

      if (midi === null || !activePitchClasses.has(chroma)) return [];
      if (bendsOnly && !isBend) return [];

      return [
        {
          label: `${practiceLabel} ${index + 1}`,
          midi,
          noteName: note.name,
          row: practiceLabel,
        },
      ];
    })
  );

export const getPracticeTargets = ({
  layout,
  harmonicaKey,
  positionIndex,
  scaleValue,
}: PracticeTargetsInput) => {
  const practiceScale = getPracticeScale({ harmonicaKey, positionIndex, scaleValue });
  const activePitchClasses = getPitchClassSet(practiceScale.scale);
  const practiceTargets = getLayoutTargets(layout, activePitchClasses);
  const bendTargets = getLayoutTargets(layout, activePitchClasses, true);

  return {
    ...practiceScale,
    activePitchClasses,
    practiceTargets,
    bendTargets,
  };
};

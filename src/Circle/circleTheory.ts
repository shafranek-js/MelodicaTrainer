import { Chord, Note, Scale } from "tonal";

export const modes = [
  { name: "Ionian", degree: 1, harmonicaPosition: "1st", harmonicaOrder: 1 },
  {
    name: "Mixolydian",
    degree: 5,
    harmonicaPosition: "2nd",
    harmonicaOrder: 2,
  },
  { name: "Dorian", degree: 2, harmonicaPosition: "3rd", harmonicaOrder: 3 },
  { name: "Aeolian", degree: 6, harmonicaPosition: "4th", harmonicaOrder: 4 },
  { name: "Phrygian", degree: 3, harmonicaPosition: "5th", harmonicaOrder: 5 },
  { name: "Locrian", degree: 7, harmonicaPosition: "6th", harmonicaOrder: 6 },
  { name: "Lydian", degree: 4, harmonicaPosition: "12th", harmonicaOrder: 12 },
] as const;

export const modeNames = modes.map((mode) => mode.name);

export const scaleOptions = [
  { label: "Position mode", value: "mode" },
  { label: "Major", value: "major" },
  { label: "Major pentatonic", value: "major pentatonic" },
  { label: "Minor pentatonic", value: "minor pentatonic" },
  { label: "Blues", value: "blues" },
  { label: "Major blues", value: "major blues" },
] as const;

export type CircleScaleValue = (typeof scaleOptions)[number]["value"];

export const chordQualityColors: Record<string, string> = {
  major: "bg-yellow-400 text-black",
  minor: "bg-blue-600 text-white",
  diminished: "bg-red-500 text-white",
  scale: "bg-emerald-500 text-black",
  none: "bg-gray-800 text-white hover:bg-green-600",
};

export type CircleTriad = {
  root: string;
  notes: string[];
  quality: string;
};

type CircleTheoryInput = {
  selectedRoot: string;
  selectedMode: number;
  selectedScale: CircleScaleValue;
};

export const getCircleOfFifths = () => {
  const notes: string[] = [];
  let note = "C";

  for (let i = 0; i < 12; i++) {
    notes.push(Note.simplify(note));
    note = Note.transpose(note, "5P");
  }

  return notes;
};

export const getTriadsForScale = (scale: string[]): CircleTriad[] => {
  if (scale.length !== 7) return [];

  return scale.map((root, index) => {
    const notes = [
      root,
      scale[(index + 2) % scale.length],
      scale[(index + 4) % scale.length],
    ];
    const qualities = Chord.detect(notes);
    const quality = qualities.length > 0 ? qualities[0] : "none";

    return { root, notes, quality };
  });
};

export const getCircleNoteColors = (
  circleOfFifths: string[],
  scale: string[],
  triads: CircleTriad[]
) => {
  const map: Record<number, string> = {};
  const normalizeNote = (note: string) => Note.chroma(note);

  circleOfFifths.forEach((note) => {
    map[normalizeNote(note)] = "none";
  });

  scale.forEach((note) => {
    map[normalizeNote(note)] = "scale";
  });

  triads.forEach(({ root, notes, quality }) => {
    const rootNorm = normalizeNote(root);
    map[rootNorm] = quality;
    notes.forEach((note) => {
      const noteNorm = normalizeNote(note);
      if (noteNorm !== rootNorm && map[noteNorm] === "none") {
        map[noteNorm] = quality;
      }
    });
  });

  return map;
};

export const getCircleTheory = ({
  selectedRoot,
  selectedMode,
  selectedScale,
}: CircleTheoryInput) => {
  const circleOfFifths = getCircleOfFifths();
  const mode = modes[selectedMode] ?? modes[0];
  const modeName = mode.name;
  const majorScaleNotes = Scale.get(`${selectedRoot} major`).notes;
  const modeStartIndex = mode.degree - 1;
  const modeTonic = majorScaleNotes[modeStartIndex];
  const modeScale = [
    ...majorScaleNotes.slice(modeStartIndex),
    ...majorScaleNotes.slice(0, modeStartIndex),
  ];
  const scale =
    selectedScale === "mode"
      ? modeScale
      : Scale.get(`${modeTonic} ${selectedScale}`).notes;
  const scaleLabel =
    selectedScale === "mode"
      ? modeName
      : scaleOptions.find((option) => option.value === selectedScale)?.label ||
        modeName;
  const triads = getTriadsForScale(scale);
  const noteColors = getCircleNoteColors(circleOfFifths, scale, triads);

  return {
    circleOfFifths,
    modeName,
    modeTonic,
    scale,
    scaleLabel,
    triads,
    noteColors,
  };
};

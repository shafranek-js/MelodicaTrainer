import { Note, Interval } from "tonal";
import { normalizeHarmonicaKey } from "./noteNaming";

const safeTranspose = (note: string | null, interval: string) =>
  note ? Note.get(Note.transpose(note, interval)) : null;

export function generateLayout(key: string) {
  const normalizedKey = normalizeHarmonicaKey(key);
  const blowDegrees = [
    "1P",
    "3M",
    "5P",
    "8P",
    "10M",
    "12P",
    "15P",
    "17M",
    "19P",
    "22P",
  ];
  const blowRoots = blowDegrees.map((interval) =>
    Note.transpose(normalizedKey, interval)
  );
  const drawDegrees = [
    "2M",
    "5P",
    "7M",
    "9M",
    "11m",
    "13M",
    "14M",
    "16M",
    "18m",
    "20M",
  ];
  const drawRoots = drawDegrees.map((interval) =>
    Note.transpose(normalizedKey, interval)
  );
  const blow = blowRoots.map(Note.get);
  const draw = drawRoots.map(Note.get);

  // Define where each bend/overblow is allowed
  const wholeStepBlowBendHoles = [10]; // hole 10 only
  const halfStepBlowBendHoles = [8, 9, 10]; // holes that support
  const halfStepDrawBendHoles = [1, 2, 3, 4, 6];
  const wholeStepDrawBendHoles = [2, 3]; // only hole 2 and 3
  const oneAndHalfStepDrawBendHoles = [3]; // only hole 3

  // Not used because the seminotes vary for each hole
  // const overblowHoles = [1, 4, 5, 6];
  // const overdrawHoles = [7, 9, 10];

  const overblowinterval146 = Interval.fromSemitones(3);
  const overblowinterval5 = Interval.fromSemitones(2);

  const overdraw7 = Interval.fromSemitones(2);
  const overdraw9 = Interval.fromSemitones(3);
  const overdraw10 = Interval.fromSemitones(4);

  const overblowNotes = blowRoots.map((note, i) => {
    const hole = i + 1;
    if ([1, 4, 6].includes(hole)) {
      return safeTranspose(note, overblowinterval146);
    }
    if (hole === 5) {
      return safeTranspose(note, overblowinterval5);
    }
    return null;
  });

  const overdrawNotes = drawRoots.map((note, i) => {
    const hole = i + 1;
    if (hole === 7) {
      return safeTranspose(note, overdraw7);
    }
    if (hole === 9) {
      return safeTranspose(note, overdraw9);
    }
    if (hole === 10) {
      return safeTranspose(note, overdraw10);
    }
    return null;
  });

  return {
    blow,
    draw,

    wholeStepBlowBend: blowRoots.map((n, i) =>
      wholeStepBlowBendHoles.includes(i + 1) ? safeTranspose(n, "-2M") : null
    ),

    HalfStepBlowBend: blowRoots.map((n, i) =>
      halfStepBlowBendHoles.includes(i + 1) ? safeTranspose(n, "-2m") : null
    ),

    halfStepDrawBendOverdraw: drawRoots.map((n, i) =>
      halfStepDrawBendHoles.includes(i + 1) ? safeTranspose(n, "-2m") : null
    ),

    wholeStepDrawBend: drawRoots.map((n, i) =>
      wholeStepDrawBendHoles.includes(i + 1) ? safeTranspose(n, "-2M") : null
    ),

    oneAndHalfStepDrawBend: drawRoots.map((n, i) =>
      oneAndHalfStepDrawBendHoles.includes(i + 1)
        ? safeTranspose(n, "-3m")
        : null
    ),
    overblow: overblowNotes,
    overdraw: overdrawNotes,
  };
}

export type HarmonicaLayout = ReturnType<typeof generateLayout>;

export type HarmonicaLayoutDisplayRowMetadata = {
  key: keyof HarmonicaLayout;
  label: string;
  practiceLabel: string;
  isBend: boolean;
};

export const harmonicaLayoutDisplayRows = [
  {
    key: "wholeStepBlowBend",
    label: "Whole Step Blow Bend",
    practiceLabel: "Blow bend",
    isBend: true,
  },
  {
    key: "HalfStepBlowBend",
    label: "Half Step Blow Bend",
    practiceLabel: "Blow bend",
    isBend: true,
  },
  {
    key: "blow",
    label: "Blow",
    practiceLabel: "Blow",
    isBend: false,
  },
  {
    key: "draw",
    label: "Draw",
    practiceLabel: "Draw",
    isBend: false,
  },
  {
    key: "halfStepDrawBendOverdraw",
    label: "Half Step Draw Bend + Overdraw",
    practiceLabel: "Draw bend",
    isBend: true,
  },
  {
    key: "wholeStepDrawBend",
    label: "Whole Step Draw Bend",
    practiceLabel: "Draw bend",
    isBend: true,
  },
  {
    key: "oneAndHalfStepDrawBend",
    label: "1.5 Step Draw Bend",
    practiceLabel: "Draw bend",
    isBend: true,
  },
] as const satisfies readonly HarmonicaLayoutDisplayRowMetadata[];

export type HarmonicaLayoutDisplayRow =
  (typeof harmonicaLayoutDisplayRows)[number];
export type HarmonicaLayoutDisplayRowKey = HarmonicaLayoutDisplayRow["key"];

export function getLayoutMidiNumbers(layout: HarmonicaLayout): number[] {
  return Object.values(layout).flatMap((row) =>
    row.flatMap((note) => {
      if (!note) return [];

      const midi = Note.midi(note.name);
      return midi === null ? [] : [midi];
    })
  );
}

export function getHarmonicaHoleForNote(
  key: string, // e.g. "C4"
  targetNote: string
): string | null {
  const layout = generateLayout(key);
  const noteMidi = Note.midi(targetNote);

  if (noteMidi === null) return null;

  const formatHole = (
    index: number,
    bend: number,
    isBlow: boolean,
    isOverdrawOrOverblow: boolean
  ) => {
    const hole = isBlow ? index + 1 : -(index + 1);
    const apostrophes = `'`.repeat(bend);
    const overnote = isOverdrawOrOverblow ? "o" : "";
    return `${hole}${apostrophes}${overnote}`;
  };

  for (let i = 0; i < 10; i++) {
    if (layout.blow[i] && Note.midi(layout.blow[i]!.name) === noteMidi)
      return formatHole(i, 0, true, false);
    if (
      layout.wholeStepBlowBend[i] &&
      Note.midi(layout.wholeStepBlowBend[i]!.name) === noteMidi
    )
      return formatHole(i, 2, true, false);
    if (
      layout.HalfStepBlowBend[i] &&
      Note.midi(layout.HalfStepBlowBend[i]!.name) === noteMidi
    )
      return formatHole(i, 1, true, false);

    if (layout.draw[i] && Note.midi(layout.draw[i]!.name) === noteMidi)
      return formatHole(i, 0, false, false);
    if (
      layout.halfStepDrawBendOverdraw[i] &&
      Note.midi(layout.halfStepDrawBendOverdraw[i]!.name) === noteMidi
    )
      return formatHole(i, 1, false, false);
    if (
      layout.wholeStepDrawBend[i] &&
      Note.midi(layout.wholeStepDrawBend[i]!.name) === noteMidi
    )
      return formatHole(i, 2, false, false);
    if (
      layout.oneAndHalfStepDrawBend[i] &&
      Note.midi(layout.oneAndHalfStepDrawBend[i]!.name) === noteMidi
    )
      return formatHole(i, 3, false, false);

    if (layout.overblow[i] && Note.midi(layout.overblow[i]!.name) === noteMidi)
      return formatHole(i, 0, true, true);
    if (layout.overdraw[i] && Note.midi(layout.overdraw[i]!.name) === noteMidi)
      return formatHole(i, 0, false, true);
  }

  return null;
}

import { Note } from "tonal";

export const melodicaRangeOptions = [
  { label: "25 keys", value: 25, startNote: "F3", endNote: "F5" },
  { label: "27 keys", value: 27, startNote: "F3", endNote: "G5" },
  { label: "32 keys", value: 32, startNote: "F3", endNote: "C6" },
  { label: "37 keys", value: 37, startNote: "F3", endNote: "F6" },
  { label: "44 keys (Hammond 44)", value: 44, startNote: "C3", endNote: "G6" },
] as const;

export type MelodicaKeyCount = (typeof melodicaRangeOptions)[number]["value"];
export type MelodicaRangeOption = (typeof melodicaRangeOptions)[number];

export type MelodicaKey = {
  index: number;
  midi: number;
  name: string;
  pitchClass: string;
  octave: number;
  isBlack: boolean;
};

export type MelodicaKeyGeometry = MelodicaKey & {
  centerPct: number;
  leftPct: number;
  widthPct: number;
  whiteIndex: number | null;
};

export type MelodicaLayout = {
  keyCount: MelodicaKeyCount;
  startNote: string;
  endNote: string;
  keys: MelodicaKey[];
};

export type MelodicaKeyboardGeometry = {
  blackKeyWidthPct: number;
  keys: MelodicaKeyGeometry[];
  whiteKeyCount: number;
  whiteKeyWidthPct: number;
};

const DEFAULT_KEY_COUNT: MelodicaKeyCount = 32;

const getRangeOption = (keyCount: MelodicaKeyCount = DEFAULT_KEY_COUNT) =>
  melodicaRangeOptions.find((option) => option.value === keyCount) ??
  melodicaRangeOptions[2];

export const normalizeMelodicaKeyCount = (
  keyCount: number | string | null | undefined
): MelodicaKeyCount => {
  const parsed =
    typeof keyCount === "string" ? Number.parseInt(keyCount, 10) : keyCount;

  return (
    melodicaRangeOptions.find((option) => option.value === parsed)?.value ??
    DEFAULT_KEY_COUNT
  );
};

export const generateMelodicaLayout = (
  keyCount: MelodicaKeyCount = DEFAULT_KEY_COUNT
): MelodicaLayout => {
  const option = getRangeOption(keyCount);
  const startMidi = Note.midi(option.startNote);
  const endMidi = Note.midi(option.endNote);

  if (startMidi === null || endMidi === null) {
    throw new Error(`Invalid melodica range: ${option.startNote}-${option.endNote}`);
  }

  const keys = Array.from({ length: endMidi - startMidi + 1 }, (_, keyIndex) => {
    const midi = startMidi + keyIndex;
    const name = Note.fromMidiSharps(midi);
    const note = Note.get(name);
    const pitchClass = Note.pitchClass(name);

    return {
      index: keyIndex + 1,
      midi,
      name,
      pitchClass,
      octave: note.oct ?? 0,
      isBlack: pitchClass.includes("#"),
    };
  });

  return {
    keyCount: option.value,
    startNote: option.startNote,
    endNote: option.endNote,
    keys,
  };
};

export const getMelodicaMidiNumbers = (layout: MelodicaLayout): number[] =>
  layout.keys.map((key) => key.midi);

export const getMelodicaKeyboardGeometry = (
  layout: MelodicaLayout
): MelodicaKeyboardGeometry => {
  const whiteKeys = layout.keys.filter((key) => !key.isBlack);
  const whiteKeyCount = Math.max(1, whiteKeys.length);
  const whiteKeyWidthPct = 100 / whiteKeyCount;
  const blackKeyWidthPct = whiteKeyWidthPct * 0.62;
  const whiteIndexByMidi = new Map<number, number>();

  whiteKeys.forEach((key, index) => {
    whiteIndexByMidi.set(key.midi, index);
  });

  const keys = layout.keys.map((key): MelodicaKeyGeometry => {
    if (!key.isBlack) {
      const whiteIndex = whiteIndexByMidi.get(key.midi) ?? 0;
      const leftPct = whiteIndex * whiteKeyWidthPct;

      return {
        ...key,
        centerPct: leftPct + whiteKeyWidthPct / 2,
        leftPct,
        widthPct: whiteKeyWidthPct,
        whiteIndex,
      };
    }

    const previousWhite = [...whiteKeys]
      .reverse()
      .find((whiteKey) => whiteKey.midi < key.midi);
    const previousWhiteIndex =
      previousWhite ? whiteIndexByMidi.get(previousWhite.midi) : undefined;
    const centerPct =
      previousWhiteIndex === undefined
        ? whiteKeyWidthPct / 2
        : (previousWhiteIndex + 1) * whiteKeyWidthPct;

    return {
      ...key,
      centerPct,
      leftPct: centerPct - blackKeyWidthPct / 2,
      widthPct: blackKeyWidthPct,
      whiteIndex: null,
    };
  });

  return {
    blackKeyWidthPct,
    keys,
    whiteKeyCount,
    whiteKeyWidthPct,
  };
};

export const getMelodicaKeyForNote = (
  keyCount: MelodicaKeyCount,
  targetNote: string
): MelodicaKey | null => {
  const targetMidi = Note.midi(targetNote);
  if (targetMidi === null) return null;

  return (
    generateMelodicaLayout(keyCount).keys.find((key) => key.midi === targetMidi) ??
    null
  );
};

export const getMelodicaKeyLabelForNote = (
  keyCount: MelodicaKeyCount,
  targetNote: string,
  mode: "note" | "keyNumber" = "note"
) => {
  const key = getMelodicaKeyForNote(keyCount, targetNote);
  if (!key) return null;

  return mode === "keyNumber" ? String(key.index) : key.name;
};

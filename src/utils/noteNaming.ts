import { Note } from "tonal";

export type TonalNote = ReturnType<typeof Note.get>;

export const harmonicaKeys = [
  { label: "C", value: "C4" },
  { label: "D", value: "D4" },
  { label: "E", value: "E4" },
  { label: "F", value: "F4" },
  { label: "G", value: "G3" },
  { label: "A", value: "A3" },
  { label: "B", value: "B3" },
  { label: "Db", value: "Db4" },
  { label: "Eb", value: "Eb4" },
  { label: "F#", value: "F#4" },
  { label: "Ab", value: "Ab3" },
  { label: "Bb", value: "Bb3" },
];

export function normalizeHarmonicaKey(key: string) {
  return harmonicaKeys.find((candidate) =>
    candidate.value === key || candidate.label === key
  )?.value ?? key;
}

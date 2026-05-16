import { Note } from "tonal";

const suzukiColorByLetter: Record<string, string> = {
  C: "#ef4444",
  D: "#f97316",
  E: "#facc15",
  F: "#22c55e",
  G: "#38bdf8",
  A: "#2563eb",
  B: "#8b5cf6",
};

export const getSuzukiNoteColor = (noteName: string) => {
  const letter = Note.get(noteName).letter;
  return suzukiColorByLetter[letter] ?? "#64748b";
};

/** Candy wrapper palette — bright shell + darker body for each note letter */
const candyColorByLetter: Record<string, { shell: string; body: string }> = {
  C: { shell: "#ff6b6b", body: "#e03131" }, // Strawberry
  D: { shell: "#ff922b", body: "#e8590c" }, // Tangerine
  E: { shell: "#ffe066", body: "#f59f00" }, // Lemon drop
  F: { shell: "#51cf66", body: "#2f9e44" }, // Lime
  G: { shell: "#66d9e8", body: "#0c8599" }, // Blue raspberry
  A: { shell: "#748ffc", body: "#4c6ef5" }, // Blueberry
  B: { shell: "#cc5de8", body: "#9c36b5" }, // Grape
};

export type CandyColor = { shell: string; body: string };

/** Returns candy shell + body colours for the note highway. */
export const getCandyNoteColor = (noteName: string): CandyColor => {
  const letter = Note.get(noteName).letter;
  return candyColorByLetter[letter] ?? { shell: "#94d82d", body: "#5c940d" };
};

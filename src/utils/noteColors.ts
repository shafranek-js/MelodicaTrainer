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

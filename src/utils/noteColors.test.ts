import { describe, expect, it } from "vitest";
import { getSuzukiNoteColor } from "./noteColors";

describe("getSuzukiNoteColor", () => {
  it("maps note letters to the Suzuki color spectrum", () => {
    expect(getSuzukiNoteColor("C4")).toBe("#ef4444");
    expect(getSuzukiNoteColor("D4")).toBe("#f97316");
    expect(getSuzukiNoteColor("E4")).toBe("#facc15");
    expect(getSuzukiNoteColor("F4")).toBe("#22c55e");
    expect(getSuzukiNoteColor("G4")).toBe("#38bdf8");
    expect(getSuzukiNoteColor("A4")).toBe("#2563eb");
    expect(getSuzukiNoteColor("B4")).toBe("#8b5cf6");
  });

  it("uses the note letter for chromatic notes", () => {
    expect(getSuzukiNoteColor("C#4")).toBe("#ef4444");
    expect(getSuzukiNoteColor("Bb4")).toBe("#8b5cf6");
  });
});

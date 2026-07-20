import { describe, expect, it } from "vitest";
import { getKeyboardOverlayKeyState } from "./noteHighwayKeyboardState";

describe("Note Highway keyboard state", () => {
  it("uses Candy fill for a user-held target and disables the target ring", () => {
    expect(getKeyboardOverlayKeyState(
      60,
      new Map([[60, "#f43f5e"]]),
      new Set([60]),
    )).toEqual({
      activeColor: "#ff6b6b",
      isActive: true,
      isTarget: false,
      targetColor: undefined,
    });
  });

  it("assigns a new pulse id to every playback attack of the same note", () => {
    const target = new Map([[60, "#f43f5e"]]);
    expect(getKeyboardOverlayKeyState(60, target, undefined, {
      midiNumbers: [60],
      sequence: 4,
    }).playbackPulseId).toBe(4);
    expect(getKeyboardOverlayKeyState(60, target, undefined, {
      midiNumbers: [60],
      sequence: 5,
    }).playbackPulseId).toBe(5);
  });

  it("keeps the score color when the user is not holding the target", () => {
    expect(getKeyboardOverlayKeyState(60, new Map([[60, "#f43f5e"]]))).toEqual({
      activeColor: "#f43f5e",
      isActive: true,
      isTarget: false,
      targetColor: undefined,
    });
  });
});

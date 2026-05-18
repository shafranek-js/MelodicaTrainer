import { describe, expect, it } from "vitest";
import { shouldReplacePersistedDefaultScore } from "./useScoreFileLoader";

describe("score file loader defaults", () => {
  it("replaces persisted legacy default scores", () => {
    expect(shouldReplacePersistedDefaultScore("<score />", "IntroSong.musicxml")).toBe(true);
    expect(shouldReplacePersistedDefaultScore(new Uint8Array([1]), "IntroSong-notebender.musicxml")).toBe(true);
  });

  it("preserves user-loaded scores", () => {
    expect(shouldReplacePersistedDefaultScore("<score />", "My Song.musicxml")).toBe(false);
    expect(shouldReplacePersistedDefaultScore(new Uint8Array([1]), "custom.gp")).toBe(false);
  });

  it("loads the default when no score is persisted", () => {
    expect(shouldReplacePersistedDefaultScore(null, null)).toBe(false);
  });
});

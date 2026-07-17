import { describe, expect, it } from "vitest";
import { shouldReplacePersistedDefaultScore } from "./useScoreFileLoader";
import { getScoreFormat } from "./scoreFormat";

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

describe("score format detection", () => {
  it("recognizes supported score formats", () => {
    expect(getScoreFormat("score.musicxml")).toBe("musicxml");
    expect(getScoreFormat("score.GP5")).toBe("guitar-pro");
    expect(getScoreFormat("score.mid")).toBe("midi");
    expect(getScoreFormat("score.MIDI")).toBe("midi");
  });

  it("rejects unsupported extensions", () => {
    expect(getScoreFormat("score.kar")).toBeNull();
    expect(getScoreFormat("score.pdf")).toBeNull();
  });
});

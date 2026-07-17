import { describe, expect, it } from "vitest";
import {
  getScoreLibraryDownloadUrl,
  MUSETRAINER_SCORE_BASE_URL,
  SCORE_LIBRARY,
} from "./scoreLibrary";

describe("score library catalog", () => {
  it("uses unique IDs and supported file names", () => {
    const ids = SCORE_LIBRARY.map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
    SCORE_LIBRARY.forEach((entry) => {
      expect(entry.fileName).toMatch(/\.(musicxml|mxl|xml)$/i);
    });
  });

  it("builds approved MuseTrainer download URLs", () => {
    SCORE_LIBRARY.forEach((entry) => {
      expect(getScoreLibraryDownloadUrl(entry)).toBe(
        `${MUSETRAINER_SCORE_BASE_URL}${entry.fileName}`,
      );
    });
  });
});

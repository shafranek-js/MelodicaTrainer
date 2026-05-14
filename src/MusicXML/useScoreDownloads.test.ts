import { describe, expect, it } from "vitest";
import {
  getHarpTabsDownloadFileName,
  getTransposedXmlDownloadFileName,
} from "./useScoreDownloads";

describe("score download file names", () => {
  it("uses fallback names when no source file name is known", () => {
    expect(getTransposedXmlDownloadFileName(null)).toBe("transposed.musicxml");
    expect(getHarpTabsDownloadFileName(null)).toBe("tabs.txt");
  });

  it("prefixes transposed MusicXML exports", () => {
    expect(getTransposedXmlDownloadFileName("song.musicxml")).toBe(
      "transposed_song.musicxml"
    );
  });

  it("replaces the source extension for HarpTabs exports", () => {
    expect(getHarpTabsDownloadFileName("song.musicxml")).toBe("song_tabs.txt");
    expect(getHarpTabsDownloadFileName("folder.name/song.xml")).toBe(
      "folder.name/song_tabs.txt"
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  getMelodicaNotesDownloadFileName,
  getTransposedXmlDownloadFileName,
} from "./useScoreDownloads";

describe("score download file names", () => {
  it("uses fallback names when no source file name is known", () => {
    expect(getTransposedXmlDownloadFileName(null)).toBe("transposed.musicxml");
    expect(getMelodicaNotesDownloadFileName(null)).toBe("melodica_notes.txt");
  });

  it("prefixes transposed MusicXML exports", () => {
    expect(getTransposedXmlDownloadFileName("song.musicxml")).toBe(
      "transposed_song.musicxml"
    );
  });

  it("replaces the source extension for melodica note exports", () => {
    expect(getMelodicaNotesDownloadFileName("song.musicxml")).toBe(
      "song_melodica_notes.txt"
    );
    expect(getMelodicaNotesDownloadFileName("folder.name/song.xml")).toBe(
      "folder.name/song_melodica_notes.txt"
    );
  });
});

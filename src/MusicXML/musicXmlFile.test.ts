import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  getMusicXmlFileErrorMessage,
  MAX_MUSIC_XML_FILE_BYTES,
  MAX_MXL_SCORE_BYTES,
  MusicXmlFileError,
  readMusicXmlFile,
} from "./musicXmlFile";

const validScoreXml =
  "<score-partwise><part><measure /></part></score-partwise>";

const createMxlFile = async (entries: Record<string, string>) => {
  const zip = new JSZip();
  Object.entries(entries).forEach(([path, content]) => {
    zip.file(path, content);
  });

  const content = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
  });

  return new File([content], "score.mxl", {
    type: "application/vnd.recordare.musicxml",
  });
};

const expectMusicXmlFileError = async (
  promise: Promise<unknown>,
  reason: MusicXmlFileError["reason"]
) => {
  try {
    await promise;
  } catch (error) {
    if (!(error instanceof MusicXmlFileError)) throw error;

    expect(error.reason).toBe(reason);
    expect(getMusicXmlFileErrorMessage(error)).toBe(error.userMessage);
    return;
  }

  throw new Error(`Expected ${reason} to throw.`);
};

describe("readMusicXmlFile", () => {
  it("reads plain MusicXML files", async () => {
    const file = new File([validScoreXml], "score.musicxml");

    await expect(readMusicXmlFile(file)).resolves.toBe(validScoreXml);
  });

  it("uses the score path from an MXL container file", async () => {
    const file = await createMxlFile({
      "META-INF/container.xml":
        '<container><rootfiles><rootfile full-path="scores/main.musicxml" /></rootfiles></container>',
      "decoy.xml": "<not-a-score />",
      "scores/main.musicxml": validScoreXml,
    });

    await expect(readMusicXmlFile(file)).resolves.toBe(validScoreXml);
  });

  it("falls back to a MusicXML candidate when the MXL has no container", async () => {
    const file = await createMxlFile({
      "docs/readme.txt": "not a score",
      "score.xml": validScoreXml,
    });

    await expect(readMusicXmlFile(file)).resolves.toBe(validScoreXml);
  });

  it("rejects MXL archives with no MusicXML score candidate", async () => {
    const file = await createMxlFile({
      "META-INF/container.xml": "<container><rootfiles /></container>",
      "docs/readme.txt": "not a score",
    });

    await expectMusicXmlFileError(
      readMusicXmlFile(file),
      "missing-score-in-archive"
    );
  });

  it("rejects oversized uploads before reading the file", async () => {
    const file = new File(
      [new ArrayBuffer(MAX_MUSIC_XML_FILE_BYTES + 1)],
      "large.musicxml"
    );

    await expectMusicXmlFileError(readMusicXmlFile(file), "file-too-large");
  });

  it("rejects oversized uncompressed scores inside MXL files", async () => {
    const oversizedScoreXml = `<score-partwise><part>${" ".repeat(
      MAX_MXL_SCORE_BYTES
    )}</part></score-partwise>`;
    const file = await createMxlFile({
      "META-INF/container.xml":
        '<container><rootfiles><rootfile full-path="score.musicxml" /></rootfiles></container>',
      "score.musicxml": oversizedScoreXml,
    });

    await expectMusicXmlFileError(readMusicXmlFile(file), "mxl-score-too-large");
  });
});

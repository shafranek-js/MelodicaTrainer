import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import {
  convertMsczFile,
  MAX_MSCX_SCORE_BYTES,
  MsczFileError,
} from "./msczFile";
import { MAX_MUSIC_XML_FILE_BYTES } from "./musicXmlFile";
import { parsePlaybackEvents } from "./playbackParser";

class BinaryTestFile extends File {
  private readonly testBuffer: ArrayBuffer;

  constructor(bytes: Uint8Array, name: string) {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    super([buffer], name, { type: "application/vnd.musescore.score" });
    this.testBuffer = buffer;
  }

  override async arrayBuffer() {
    return this.testBuffer.slice(0);
  }
}

const basicMscx = (body: string, metadata = "") => `<?xml version="1.0" encoding="UTF-8"?>
<museScore version="4.60">
  <Score>
    <Division>480</Division>
    ${metadata}
    <Staff id="1">
      <Measure>
        <voice>${body}</voice>
      </Measure>
    </Staff>
  </Score>
</museScore>`;

const pitchedQuarter = `
  <Chord>
    <durationType>quarter</durationType>
    <Note><pitch>60</pitch></Note>
  </Chord>`;

const makeMscz = async (
  entries: Record<string, string>,
  name = "Practice.mscz",
) => {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) zip.file(path, content);
  const bytes = await zip.generateAsync({ compression: "DEFLATE", type: "uint8array" });
  return new BinaryTestFile(bytes, name);
};

describe("convertMsczFile", () => {
  it("converts a root MSCX locally and uses the file name for placeholder metadata", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const file = await makeMscz({ "Practice.mscx": basicMscx(pitchedQuarter) });

    const result = await convertMsczFile(file);

    expect(result.metadata.title).toBe("Practice");
    expect(result.musicXml).toContain("<score-partwise");
    expect(result.musicXml).toContain("<work-title>Practice</work-title>");
    expect(result.musicXml).not.toContain("mks:diag:");
    expect(result.musicXml).not.toContain("mks:src:");
    expect(
      parsePlaybackEvents(result.musicXml).events.some((event) =>
        event.notes.some((note) => note.name === "C4"),
      ),
    ).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  }, 15_000);

  it("preserves reliable MuseScore title and composer metadata", async () => {
    const metadata = `
      <metaTag name="workTitle">MuseScore title</metaTag>
      <metaTag name="composer">Test Composer</metaTag>`;
    const file = await makeMscz({ "Practice.mscx": basicMscx(pitchedQuarter, metadata) });

    await expect(convertMsczFile(file)).resolves.toMatchObject({
      metadata: { composer: "Test Composer", title: "MuseScore title" },
    });
  });

  it("keeps MuseScore 3 time signatures and ties in the normalized MusicXML", async () => {
    const legacyMscx = `
      <museScore version="3.02"><Score><Division>480</Division><Staff id="1"><Measure><voice>
        <TimeSig><sigN>4</sigN><sigD>4</sigD></TimeSig>
        <Chord><durationType>quarter</durationType><Note><pitch>60</pitch><Tie /></Note></Chord>
        <Chord><durationType>quarter</durationType><Note><pitch>60</pitch><endSpanner /></Note></Chord>
      </voice></Measure></Staff></Score></museScore>`;
    const file = await makeMscz({ "Legacy.mscx": legacyMscx }, "Legacy.mscz");

    const result = await convertMsczFile(file);
    const document = new DOMParser().parseFromString(result.musicXml, "application/xml");

    expect(document.querySelector("time > beats")?.textContent).toBe("4");
    expect(document.querySelector('note tie[type="start"]')).not.toBeNull();
    expect(document.querySelector('note tie[type="stop"]')).not.toBeNull();
  });

  it("rejects archives without one unambiguous root MSCX", async () => {
    const missing = await makeMscz({ "assets/readme.txt": "not a score" });
    const ambiguous = await makeMscz({
      "first.mscx": basicMscx(pitchedQuarter),
      "second.mscx": basicMscx(pitchedQuarter),
    });

    await expect(convertMsczFile(missing)).rejects.toMatchObject({
      reason: "missing-score-in-archive",
    });
    await expect(convertMsczFile(ambiguous)).rejects.toMatchObject({
      reason: "ambiguous-score-in-archive",
    });
  });

  it("rejects damaged archives and archives above the upload limit", async () => {
    await expect(
      convertMsczFile(new BinaryTestFile(new Uint8Array([1, 2, 3]), "broken.mscz")),
    ).rejects.toMatchObject({ reason: "invalid-archive" });

    await expect(
      convertMsczFile(
        new BinaryTestFile(new Uint8Array(MAX_MUSIC_XML_FILE_BYTES + 1), "large.mscz"),
      ),
    ).rejects.toMatchObject({ reason: "file-too-large" });
  });

  it("rejects an oversized unpacked MSCX score", async () => {
    const oversizedMscx = `${basicMscx(pitchedQuarter)}${" ".repeat(
      MAX_MSCX_SCORE_BYTES + 1,
    )}`;
    const file = await makeMscz({ "Practice.mscx": oversizedMscx });
    await expect(convertMsczFile(file)).rejects.toMatchObject({
      reason: "mscx-score-too-large",
    });
  });

  it("blocks a converted score when note duration data is lost", async () => {
    const invalidDuration = `
      <Chord>
        <durationType>not-a-duration</durationType>
        <Note><pitch>60</pitch></Note>
      </Chord>`;
    const file = await makeMscz({ "Practice.mscx": basicMscx(invalidDuration) });

    await expect(convertMsczFile(file)).rejects.toBeInstanceOf(MsczFileError);
    await expect(convertMsczFile(file)).rejects.toMatchObject({
      reason: "conversion-loss",
    });
  });

  it("returns non-critical converter warnings with a playable score", async () => {
    const file = await makeMscz({
      "Practice.mscx": basicMscx(`${pitchedQuarter}<UnsupportedDecoration />`),
    });
    const result = await convertMsczFile(file);
    expect(result.warnings.join(" ")).toContain("unsupported MuseScore elements skipped");
    expect(
      parsePlaybackEvents(result.musicXml).events.some((event) =>
        event.notes.some((note) => note.name === "C4"),
      ),
    ).toBe(true);
  });
});

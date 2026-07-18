import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import {
  convertMsczWithHighFidelity,
  HIGH_FIDELITY_MSCZ_WARNING,
} from "./msczHighFidelity";

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

const makeMscz = async (name = "Compatibility.mscz") => {
  const zip = new JSZip();
  zip.file("Compatibility.mscx", `
    <museScore version="4.60"><Score><Division>480</Division><Staff id="1"><Measure><voice>
      <Chord><durationType>quarter</durationType><Note><pitch>60</pitch></Note></Chord>
    </voice></Measure></Staff></Score></museScore>`);
  return new BinaryTestFile(
    await zip.generateAsync({ type: "uint8array" }),
    name,
  );
};

const playableMusicXml = `<?xml version="1.0" encoding="UTF-8"?>
  <score-partwise version="4.0">
    <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
    <part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure></part>
  </score-partwise>`;

describe("convertMsczWithHighFidelity", () => {
  it("loads the optional engine, validates its MusicXML, and releases the worker", async () => {
    const destroy = vi.fn();
    const saveXml = vi.fn().mockResolvedValue(playableMusicXml);
    const load = vi.fn().mockResolvedValue({ destroy, saveXml });
    const file = await makeMscz();

    const result = await convertMsczWithHighFidelity(file, {
      loadModule: async () => ({ default: { load } }),
    });

    expect(load).toHaveBeenCalledWith("mscz", expect.any(Uint8Array), [], true);
    expect(destroy).toHaveBeenCalledWith(false);
    expect(result.metadata.title).toBe("Compatibility");
    expect(result.musicXml).toContain("<work-title>Compatibility</work-title>");
    expect(result.warnings).toEqual([HIGH_FIDELITY_MSCZ_WARNING]);
  });

  it("rejects an engine result without playable first-staff notes", async () => {
    const destroy = vi.fn();
    const file = await makeMscz();

    await expect(convertMsczWithHighFidelity(file, {
      loadModule: async () => ({
        default: {
          load: async () => ({
            destroy,
            saveXml: async () => "<score-partwise><part-list /><part id=\"P1\" /></score-partwise>",
          }),
        },
      }),
    })).rejects.toMatchObject({ reason: "no-playable-notes" });
    expect(destroy).toHaveBeenCalledWith(false);
  });

  it("wraps engine failures without hiding the manual-export guidance", async () => {
    const file = await makeMscz();

    await expect(convertMsczWithHighFidelity(file, {
      loadModule: async () => ({
        default: { load: async () => { throw new Error("unsupported version"); } },
      }),
    })).rejects.toMatchObject({
      reason: "conversion-failed",
      message: expect.stringContaining("unsupported version"),
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { parsePlaybackEvents } from "./playbackParser";
import {
  generateMidiNotation,
  quantizeMidiPart,
} from "./midiNotation";
import type {
  MidiNoteData,
  MidiPartInfo,
  ParsedMidiScore,
} from "./midiParser";

const PPQ = 480;

const note = (
  midi: number,
  startTick: number,
  durationTicks: number,
  velocity = 0.8,
): MidiNoteData => ({
  durationSeconds: durationTicks / PPQ / 2,
  durationTicks,
  midi,
  startSeconds: startTick / PPQ / 2,
  startTick,
  velocity,
});

const makePart = (notes: MidiNoteData[]): MidiPartInfo => ({
  channel: 0,
  durationSeconds: Math.max(
    ...notes.map((entry) => entry.startSeconds + entry.durationSeconds),
  ),
  id: "channel-0",
  name: "Lead",
  noteCount: notes.length,
  notes,
  originalMidiNumbers: [...new Set(notes.map((entry) => entry.midi))],
});

const makeScore = (
  notes: MidiNoteData[],
  overrides: Partial<ParsedMidiScore> = {},
): ParsedMidiScore => ({
  durationSeconds: 4,
  fileName: "notation.mid",
  initialTempoBpm: 120,
  keySignatures: [{ fifths: 0, mode: "major", ticks: 0 }],
  parts: [makePart(notes)],
  tempoChanges: [{ bpm: 120, seconds: 0, ticks: 0 }],
  ticksPerQuarter: PPQ,
  timeSignatures: [{ denominator: 4, numerator: 4, ticks: 0 }],
  ...overrides,
});

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");

describe("MIDI notation", () => {
  it("selects the coarsest acceptable Auto grid for humanized eighth notes", () => {
    const part = makePart([
      note(60, 4, 236),
      note(62, 242, 238),
      note(64, 484, 236),
    ]);

    expect(quantizeMidiPart(part, PPQ, "auto").mode).toBe("eighth");
  });

  it("creates MusicXML 4.0 with leading rests, chords, and cursor mappings", () => {
    const score = makeScore([
      note(60, 480, 480),
      note(64, 482, 478),
      note(67, 960, 480),
    ]);
    const result = generateMidiNotation(score, "channel-0", "sixteenth");
    const xml = parseXml(result.musicXml);

    expect(xml.documentElement.getAttribute("version")).toBe("4.0");
    expect(xml.querySelector("parsererror")).toBeNull();
    expect(xml.querySelector("attributes > divisions")?.textContent).toBe("24");
    expect(xml.querySelectorAll("note > chord")).toHaveLength(1);
    expect(xml.querySelector("note > rest")).not.toBeNull();
    expect(result.cursorIndexByStartTick.get(480)).toBe(
      result.cursorIndexByStartTick.get(482),
    );
    expect(result.visualBoundaryTicks).toContain(0);
    expect(() => parsePlaybackEvents(result.musicXml)).not.toThrow();
  });

  it("splits a note at a barline and writes MusicXML ties", () => {
    const result = generateMidiNotation(
      makeScore([note(60, 3 * PPQ, 2 * PPQ)]),
      "channel-0",
      "eighth",
    );
    const xml = parseXml(result.musicXml);

    expect(xml.querySelectorAll("measure")).toHaveLength(2);
    expect(xml.querySelectorAll('tie[type="start"]')).toHaveLength(1);
    expect(xml.querySelectorAll('tie[type="stop"]')).toHaveLength(1);
    expect(xml.querySelectorAll('tied[type="start"]')).toHaveLength(1);
    expect(xml.querySelectorAll('tied[type="stop"]')).toHaveLength(1);
  });

  it("writes tuplets and preserves tempo, time, and key metadata", () => {
    const result = generateMidiNotation(
      makeScore(
        [note(70, 0, 160), note(72, 160, 160), note(74, 320, 160)],
        {
          keySignatures: [{ fifths: -2, mode: "minor", ticks: 0 }],
          tempoChanges: [
            { bpm: 90, seconds: 0, ticks: 0 },
            { bpm: 120, seconds: 1, ticks: 960 },
          ],
          timeSignatures: [{ denominator: 8, numerator: 6, ticks: 0 }],
        },
      ),
      "channel-0",
      "triplets",
    );
    const xml = parseXml(result.musicXml);

    expect(xml.querySelector("time > beats")?.textContent).toBe("6");
    expect(xml.querySelector("time > beat-type")?.textContent).toBe("8");
    expect(xml.querySelector("key > fifths")?.textContent).toBe("-2");
    expect(xml.querySelectorAll("direction sound")).toHaveLength(2);
    expect(xml.querySelector("time-modification > actual-notes")?.textContent).toBe("3");
  });

  it("uses two voices for overlaps and simplifies a deterministic third line", () => {
    const result = generateMidiNotation(
      makeScore([
        note(72, 0, 4 * PPQ),
        note(60, PPQ, 3 * PPQ),
        note(67, 2 * PPQ, 2 * PPQ),
      ]),
      "channel-0",
      "eighth",
    );
    const xml = parseXml(result.musicXml);

    expect(xml.querySelector("backup")).not.toBeNull();
    expect(xml.querySelector('voice')?.textContent).toBe("1");
    expect([...xml.querySelectorAll("voice")].some((voice) => voice.textContent === "2")).toBe(true);
    expect(result.warnings).toContain("Complex overlaps simplified.");
  });

  it("moves mid-measure signature changes to a barline with a warning", () => {
    const result = generateMidiNotation(
      makeScore([note(60, 0, 6 * PPQ)], {
        timeSignatures: [
          { denominator: 4, numerator: 4, ticks: 0 },
          { denominator: 4, numerator: 3, ticks: 2 * PPQ },
        ],
      }),
      "channel-0",
      "eighth",
    );

    expect(result.warnings).toContain(
      "A time signature change was moved to the next barline.",
    );
    expect(parseXml(result.musicXml).querySelectorAll("time")).toHaveLength(2);
  });

  it("loads and renders the generated score in OSMD", async () => {
    const result = generateMidiNotation(
      makeScore([note(60, 0, PPQ), note(64, PPQ, PPQ)]),
      "channel-0",
      "eighth",
    );
    const container = document.createElement("div");
    document.body.appendChild(container);
    const canvasContext = new Proxy({
      canvas: document.createElement("canvas"),
      font: "",
      getImageData: (_x: number, _y: number, width: number, height: number) => ({
        data: new Uint8ClampedArray(Math.max(1, width * height * 4)),
        height,
        width,
      }),
      measureText: () => ({ width: 10 }),
    }, {
      get: (target, property) => property in target
        ? target[property as keyof typeof target]
        : () => undefined,
    });
    const getContext = vi.spyOn(
      HTMLCanvasElement.prototype,
      "getContext",
    ).mockReturnValue(canvasContext as unknown as CanvasRenderingContext2D);
    const consoleWarning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const osmd = new OpenSheetMusicDisplay(container, {
      backend: "svg",
      autoResize: false,
    });

    try {
      await osmd.load(result.musicXml);
      osmd.render();
      expect(container.querySelector("svg")).not.toBeNull();
    } finally {
      osmd.clear();
      container.remove();
      getContext.mockRestore();
      consoleWarning.mockRestore();
    }
  });
});

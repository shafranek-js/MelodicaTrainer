import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parsePlaybackEvents } from "../src/MusicXML/playbackParser.ts";

const catalog = JSON.parse(await readFile("public/score-library/catalog.json", "utf8"));
const musicXmlEntries = catalog.entries.filter((entry) => entry.format === "musicxml");

const readMusicXml = async (entry) => {
  const bytes = await readFile(path.resolve("public/score-library", ...entry.assetPath.split("/")));
  if (!entry.fileName.toLowerCase().endsWith(".mxl")) return bytes.toString("utf8");
  const zip = await JSZip.loadAsync(bytes);
  const score = Object.values(zip.files).find(
    (file) => !file.dir && /\.(musicxml|xml)$/i.test(file.name) && !file.name.startsWith("META-INF/"),
  );
  if (!score) throw new Error(`${entry.id}: no MusicXML document in MXL`);
  return score.async("string");
};

describe("committed MusicXML library content", () => {
  it("contains exactly 126 scores with first-staff playback events", async () => {
    expect(musicXmlEntries).toHaveLength(126);
    for (const entry of musicXmlEntries) {
      const xml = await readMusicXml(entry);
      const { events } = parsePlaybackEvents(xml, { addLeadIn: false });
      expect(events.some((event) => event.notes.some((note) => note.shouldPlay)), entry.id).toBe(true);
    }
  }, 45_000);

  it("preserves the reviewed Pec nám spadla melody", async () => {
    const entry = musicXmlEntries.find(({ id }) => id === "cc0-pec-nam-spadla");
    expect(entry).toBeDefined();

    const xml = await readMusicXml(entry);
    const { detectedTempo, events } = parsePlaybackEvents(xml, { addLeadIn: false });
    const notes = events.flatMap((event) => event.notes.filter((note) => note.shouldPlay));

    const verseNames = [
      "G4", "E4", "E4", "E4",
      "G4", "E4", "E4", "E4",
      "G4", "G4", "A4", "G4",
      "G4", "F4", "F4",
      "F4", "D4", "D4", "D4",
      "F4", "D4", "D4", "D4",
      "F4", "F4", "G4", "F4",
      "F4", "E4", "E4",
    ];
    const verseDurations = [
      0.5, 0.5, 0.5, 0.5,
      0.5, 0.5, 0.5, 0.5,
      0.5, 0.5, 0.5, 0.5,
      0.5, 0.5, 1,
      0.5, 0.5, 0.5, 0.5,
      0.5, 0.5, 0.5, 0.5,
      0.5, 0.5, 0.5, 0.5,
      0.5, 0.5, 1,
    ];

    expect(notes.map(({ name }) => name)).toEqual([...verseNames, ...verseNames]);
    expect(notes.map(({ durationBeats }) => durationBeats)).toEqual([
      ...verseDurations,
      ...verseDurations,
    ]);
    expect(detectedTempo).toBe(60);
  });

  it("preserves the reviewed Skákal pes melody", async () => {
    const entry = musicXmlEntries.find(({ id }) => id === "cc0-skakal-pes");
    expect(entry).toBeDefined();

    const xml = await readMusicXml(entry);
    const { events } = parsePlaybackEvents(xml, { addLeadIn: false });
    const notes = events.flatMap((event) => event.notes.filter((note) => note.shouldPlay));

    expect(notes.map(({ name }) => name)).toEqual([
      "C5", "C5", "A4",
      "C5", "C5", "A4",
      "C5", "C5", "D5", "C5",
      "C5", "Bb4",
      "Bb4", "Bb4", "G4",
      "Bb4", "Bb4", "G4",
      "Bb4", "Bb4", "C5", "Bb4",
      "Bb4", "A4",
    ]);
    expect(notes.map(({ durationBeats }) => durationBeats)).toEqual([
      1, 1, 2,
      1, 1, 2,
      1, 1, 1, 1,
      2, 2,
      1, 1, 2,
      1, 1, 2,
      1, 1, 1, 1,
      2, 2,
    ]);
  });

  it("preserves the reviewed Kočka leze dírou melody", async () => {
    const entry = musicXmlEntries.find(({ id }) => id === "cc0-kocka-leze-dirou");
    expect(entry).toBeDefined();

    const xml = await readMusicXml(entry);
    const { events } = parsePlaybackEvents(xml, { addLeadIn: false });
    const notes = events.flatMap((event) => event.notes.filter((note) => note.shouldPlay));
    const verseNames = [
      "C4", "D4", "E4", "F4", "G4", "G4",
      "A4", "A4", "G4",
      "A4", "A4", "G4",
      "F4", "F4", "F4", "F4", "E4", "E4",
      "D4", "D4", "G4",
      "F4", "F4", "F4", "F4", "E4", "E4",
      "D4", "D4", "C4",
    ];
    const verseDurations = [
      0.5, 0.5, 0.5, 0.5, 1, 1,
      1, 1, 2,
      1, 1, 2,
      0.5, 0.5, 0.5, 0.5, 1, 1,
      1, 1, 2,
      0.5, 0.5, 0.5, 0.5, 1, 1,
      1, 1, 2,
    ];

    expect(notes.map(({ name }) => name)).toEqual([...verseNames, ...verseNames]);
    expect(notes.map(({ durationBeats }) => durationBeats)).toEqual([
      ...verseDurations,
      ...verseDurations,
    ]);
  });
});

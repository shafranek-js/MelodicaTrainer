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
  it("contains exactly 60 scores with first-staff playback events", async () => {
    expect(musicXmlEntries).toHaveLength(60);
    for (const entry of musicXmlEntries) {
      const xml = await readMusicXml(entry);
      const { events } = parsePlaybackEvents(xml, { addLeadIn: false });
      expect(events.some((event) => event.notes.some((note) => note.shouldPlay)), entry.id).toBe(true);
    }
  }, 30_000);
});

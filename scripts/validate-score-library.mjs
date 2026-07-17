import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import * as alphaTab from "@coderline/alphatab";
import {
  CATALOG_PATH,
  readCatalog,
  resolveAssetPath,
  sha256,
  validateEntryShape,
} from "./score-library-common.mjs";

const fail = (message) => {
  throw new Error(`Score library check failed: ${message}`);
};

export const parseMusicXml = async (entry, bytes) => {
  let xml;
  if (entry.fileName.toLowerCase().endsWith(".mxl")) {
    let zip;
    try {
      zip = await JSZip.loadAsync(bytes);
    } catch {
      fail(`${entry.id}: damaged MXL archive`);
    }
    const candidates = Object.values(zip.files).filter(
      (file) => !file.dir && /\.(musicxml|xml)$/i.test(file.name) && !file.name.startsWith("META-INF/"),
    );
    if (!candidates.length) fail(`${entry.id}: MXL has no MusicXML document`);
    xml = await candidates[0].async("string");
  } else {
    xml = bytes.toString("utf8");
  }

  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length) {
    fail(`${entry.id}: invalid MusicXML`);
  }
  const firstPart = document.getElementsByTagName("part")[0];
  if (!firstPart) fail(`${entry.id}: no first part`);
  const playableNotes = Array.from(firstPart.getElementsByTagName("note")).filter(
    (note) => !note.getElementsByTagName("rest").length && note.getElementsByTagName("pitch").length,
  );
  if (!playableNotes.length) fail(`${entry.id}: no playable first-part notes`);

  const staffValues = playableNotes
    .map((note) => note.getElementsByTagName("staff")[0]?.textContent?.trim() ?? "1")
    .filter((staff) => staff === "1");
  if (!staffValues.length) fail(`${entry.id}: no playable first-staff notes`);

  const midi = playableNotes.flatMap((note) => {
    const pitch = note.getElementsByTagName("pitch")[0];
    const step = pitch?.getElementsByTagName("step")[0]?.textContent?.trim();
    const octave = Number(pitch?.getElementsByTagName("octave")[0]?.textContent);
    const alter = Number(pitch?.getElementsByTagName("alter")[0]?.textContent ?? 0);
    const semitone = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[step];
    return semitone === undefined || !Number.isFinite(octave)
      ? []
      : [(octave + 1) * 12 + semitone + alter];
  });
  return { notes: playableNotes.length, minMidi: Math.min(...midi), maxMidi: Math.max(...midi) };
};

export const parseGuitarPro = (entry, bytes) => {
  let score;
  try {
    score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(bytes));
  } catch (error) {
    fail(`${entry.id}: alphaTab could not import GP (${error instanceof Error ? error.message : error})`);
  }
  const beats = score.tracks.flatMap((track) => track.staves).flatMap((staff) => staff.bars).flatMap((bar) => bar.voices).flatMap((voice) => voice.beats);
  if (!score.tracks.length || !beats.some((beat) => beat.notes.length)) {
    fail(`${entry.id}: GP has no track/playback notes`);
  }
  return { tracks: score.tracks.length, notes: beats.reduce((sum, beat) => sum + beat.notes.length, 0) };
};

export const assertCatalogMetadata = (catalog) => {
  if (!Number.isInteger(catalog.catalogVersion) || catalog.catalogVersion < 1) fail("catalogVersion must be a positive integer");
  if (!Array.isArray(catalog.entries)) fail("entries must be an array");
  const ids = new Set();
  const paths = new Set();
  for (const [index, entry] of catalog.entries.entries()) {
    validateEntryShape(entry, index);
    if (ids.has(entry.id)) fail(`duplicate id: ${entry.id}`);
    if (paths.has(entry.assetPath)) fail(`duplicate assetPath: ${entry.assetPath}`);
    ids.add(entry.id);
    paths.add(entry.assetPath);
  }
};

export const assertAssetIntegrity = (entry, bytes, actualSize = bytes.length) => {
  if (actualSize !== entry.bytes) fail(`${entry.id}: bytes mismatch (${actualSize} != ${entry.bytes})`);
  if (sha256(bytes) !== entry.sha256) fail(`${entry.id}: SHA-256 mismatch`);
};

export const validateScoreLibrary = async () => {
  const catalog = await readCatalog();
  assertCatalogMetadata(catalog);
  const results = [];
  for (const entry of catalog.entries) {
    const asset = resolveAssetPath(entry.assetPath);
    const info = await stat(asset).catch(() => fail(`${entry.id}: missing ${path.relative(process.cwd(), asset)}`));
    const bytes = await readFile(asset);
    assertAssetIntegrity(entry, bytes, info.size);
    const report = entry.format === "musicxml" ? await parseMusicXml(entry, bytes) : parseGuitarPro(entry, bytes);
    results.push({ id: entry.id, difficulty: entry.difficulty, format: entry.format, ...report });
  }

  const musicXml = catalog.entries.filter((entry) => entry.format === "musicxml");
  const gp = catalog.entries.filter((entry) => entry.format === "guitar-pro");
  if (musicXml.length !== 75) fail(`expected 75 MusicXML entries, found ${musicXml.length}`);
  if (gp.length !== 12) fail(`expected 12 Guitar Pro entries, found ${gp.length}`);
  for (const [source, expected] of [["MuseTrainer", 12], ["OpenScore Lieder", 18], ["PDMX", 45]]) {
    const actual = musicXml.filter((entry) => entry.source.name === source).length;
    if (actual !== expected) fail(`expected ${expected} ${source} MusicXML entries, found ${actual}`);
  }
  const approachable = musicXml.filter((entry) => entry.difficulty === "beginner" || entry.tags.includes("familiar"));
  if (approachable.length < 64) fail(`expected at least 64 beginner/familiar MusicXML entries, found ${approachable.length}`);

  console.log(`Score library OK: ${catalog.entries.length} entries (${musicXml.length} MusicXML, ${gp.length} GP).`);
  console.log(`Beginner or familiar MusicXML: ${approachable.length}/75.`);
  console.table(results);
  console.log(`Catalog: ${path.relative(process.cwd(), CATALOG_PATH)}`);
};

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await validateScoreLibrary();
}

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { JSDOM } from "jsdom";
import { DOMParser } from "@xmldom/xmldom";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const htmlPath = args.get("--html");
const outputPath = args.get("--output") ?? "scripts/library-selections/zpevnik-czech.json";
if (!htmlPath) {
  throw new Error("Usage: node scripts/import-zpevnik-czech.mjs --html <links.html> [--output <selection.json>]");
}

const toId = (title) => `cc0-czech-${title
  .normalize("NFD")
  .replaceAll(/\p{Mark}/gu, "")
  .toLowerCase()
  .replaceAll(/[^a-z0-9]+/g, "-")
  .replaceAll(/(^-|-$)/g, "")}`;

const parsePitch = (name, octaveMarks) => {
  const match = /^([a-g])(is|es)?$/.exec(name);
  if (!match) throw new Error(`Unsupported LilyPond pitch: ${name}`);
  const [, step, accidental] = match;
  const octave = 3
    + [...octaveMarks].filter((mark) => mark === "'").length
    - [...octaveMarks].filter((mark) => mark === ",").length;
  return `${step.toUpperCase()}${accidental === "is" ? "#" : accidental === "es" ? "b" : ""}${octave}`;
};

const parseLilyPondScore = (score, slug) => {
  const keyMatch = /\\key\s+([a-g](?:is|es)?)\s+\\(major|minor)/.exec(score);
  const timeMatch = /\\time\s+(\d+)\/(\d+)/.exec(score);
  if (!keyMatch || !timeMatch || keyMatch[2] !== "major") {
    throw new Error(`${slug}: unsupported or missing key/time signature`);
  }

  const keyFifths = { c: 0, d: 2, e: 4 }[keyMatch[1]];
  if (keyFifths === undefined) throw new Error(`${slug}: unsupported key ${keyMatch[1]} major`);

  const lines = score.split(/\r?\n/).flatMap((line) => {
    const content = line.replace(/%.*/, "").trim();
    if (content === "}") return ["|"];
    if (!content || content === "{" || /^\\(?:key|time|repeat|set)\b/.test(content)) return [];
    return [content.replaceAll(/\\bar\s+"[^"]+"/g, "|")];
  });

  let inheritedDuration = 4;
  let measures = lines.join(" ").split("|").flatMap((measureText) => {
    const notes = [];
    const tokenPattern = /(?:^|\s)([a-gr](?:is|es)?)([',]*)(\d+)?(?=\s|$)/g;
    for (const match of measureText.matchAll(tokenPattern)) {
      const [, name, octaveMarks, explicitDuration] = match;
      if (explicitDuration) inheritedDuration = Number(explicitDuration);
      if (![1, 2, 4, 8, 16].includes(inheritedDuration)) {
        throw new Error(`${slug}: unsupported duration denominator ${inheritedDuration}`);
      }
      notes.push([name === "r" ? null : parsePitch(name, octaveMarks), 4 / inheritedDuration]);
    }
    return notes.length ? [notes] : [];
  });

  let time = { beats: Number(timeMatch[1]), beatType: Number(timeMatch[2]) };
  if (slug === "L12_pasla_ovecky") time = { beats: 3, beatType: 4 };
  if (slug === "L09_ja_jsem_z_kutne_hory") {
    measures = [...measures.slice(0, 5), ...measures.slice(0, 5), ...measures.slice(5)];
  }
  if (slug === "vyletela_holubicka") {
    measures = [...measures.slice(0, 6), ...measures.slice(6, 10), ...measures.slice(6, 9), measures[10]];
  }

  const expectedMeasureLength = time.beats * (4 / time.beatType);
  for (const [index, measure] of measures.entries()) {
    const actual = measure.reduce((sum, [, duration]) => sum + duration, 0);
    if (actual < expectedMeasureLength) {
      measure.push([null, expectedMeasureLength - actual]);
    } else if (actual > expectedMeasureLength) {
      throw new Error(`${slug}: measure ${index + 1} has ${actual} beats, expected ${expectedMeasureLength}`);
    }
  }

  return { keyFifths, measures, time };
};

const html = await readFile(path.resolve(htmlPath), "utf8");
const document = new JSDOM(html).window.document;
const rows = [...document.querySelectorAll("tbody tr")];
const candidates = rows.flatMap((row) => {
  const zipLink = [...row.querySelectorAll("a")].find(({ href }) => href.endsWith(".zip"));
  const cardLink = [...row.querySelectorAll("a")].find(({ href }) => !href.endsWith(".zip") && !href.endsWith(".midi"));
  const title = row.querySelector("strong")?.textContent?.trim();
  return zipLink && cardLink && title ? [{ title, zipUrl: zipLink.href, sourceUrl: cardLink.href }] : [];
});

const entries = [];
const skipped = [];
for (const candidate of candidates) {
  const response = await fetch(candidate.zipUrl);
  if (!response.ok) throw new Error(`${candidate.zipUrl}: HTTP ${response.status}`);
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const songFile = Object.values(zip.files).find((file) => !file.dir);
  if (!songFile) throw new Error(`${candidate.zipUrl}: empty ZIP archive`);
  const xml = await songFile.async("string");
  const song = new DOMParser().parseFromString(xml, "application/xml");
  if (song.getElementsByTagName("parsererror").length) throw new Error(`${candidate.zipUrl}: malformed song XML`);
  const score = song.getElementsByTagName("score")[0]?.textContent?.trim();
  if (!score) {
    skipped.push(`${candidate.title} (no melody score)`);
    continue;
  }
  if (candidate.title === "Pec nám spadla") {
    skipped.push(`${candidate.title} (already present)`);
    continue;
  }

  const slug = path.basename(songFile.name, path.extname(songFile.name));
  const parsed = parseLilyPondScore(score, slug);
  entries.push({
    id: toId(candidate.title),
    title: candidate.title,
    composer: "Traditional Czech",
    difficulty: "beginner",
    tags: ["children", "folk", "czech", "country:czechia", "familiar"],
    ...parsed,
    tempo: 108,
    sourceName: "zpevnik.beil.cz melody reference",
    sourceUrl: candidate.sourceUrl,
  });
}

await writeFile(path.resolve(outputPath), `${JSON.stringify(entries, null, 2)}\n`);
console.log(`Imported ${entries.length} Czech melody transcriptions to ${outputPath}.`);
console.log(`Skipped ${skipped.length}: ${skipped.join("; ")}.`);

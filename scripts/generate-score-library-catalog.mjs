import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { sha256 } from "./score-library-common.mjs";

const reviewedAt = "2026-07-17";
const readSelection = async (name) =>
  JSON.parse(await readFile(path.resolve(`scripts/library-selections/${name}.json`), "utf8"));

const countryGroups = JSON.parse(await readFile(path.resolve("scripts/library-country-tags.json"), "utf8"));
const countryTagsById = new Map();
for (const [tag, ids] of Object.entries(countryGroups)) {
  for (const id of ids) countryTagsById.set(id, [...(countryTagsById.get(id) ?? []), tag]);
}
const withCountryTags = (id, tags) => [...new Set([...tags, ...(countryTagsById.get(id) ?? [])])];

const withAssetData = async (entry) => {
  const asset = path.resolve("public/score-library", ...entry.assetPath.split("/"));
  const bytes = await readFile(asset);
  return { ...entry, bytes: (await stat(asset)).size, sha256: sha256(bytes) };
};

const museTrainer = await readSelection("musetrainer");
const openScore = await readSelection("openscore-lieder");
const pdmx = await readSelection("pdmx");
const cc0Melodies = [
  ...await readSelection("cc0-melodies"),
  ...await readSelection("zpevnik-czech"),
];

const entries = [];
for (const entry of museTrainer) {
  entries.push(await withAssetData({
    id: entry.id,
    title: entry.title,
    composer: entry.composer,
    format: "musicxml",
    assetPath: `assets/musetrainer/${entry.fileName}`,
    fileName: entry.fileName,
    difficulty: entry.difficulty,
    tags: withCountryTags(entry.id, entry.tags),
    source: {
      name: "MuseTrainer",
      url: `https://musetrainer.github.io/library/scores/${encodeURIComponent(entry.fileName)}`,
    },
    license: {
      kind: "PUBLIC_DOMAIN",
      url: "https://creativecommons.org/publicdomain/mark/1.0/",
      basis: "source-declared",
    },
    rightsReviewedAt: reviewedAt,
  }));
}

for (const entry of openScore) {
  entries.push(await withAssetData({
    id: entry.id,
    title: entry.title,
    composer: entry.composer,
    format: "musicxml",
    assetPath: `assets/openscore-lieder/${entry.id}.mxl`,
    fileName: `${entry.id}.mxl`,
    difficulty: entry.difficulty,
    tags: withCountryTags(entry.id, entry.tags),
    source: {
      name: "OpenScore Lieder",
      url: `https://github.com/OpenScore/Lieder/blob/main/${entry.path.split("/").map(encodeURIComponent).join("/")}`,
      recordId: path.basename(entry.path, ".mscx"),
    },
    license: {
      kind: "CC0-1.0",
      url: "https://creativecommons.org/publicdomain/zero/1.0/",
      basis: "repository-license",
    },
    rightsReviewedAt: reviewedAt,
  }));
}

for (const entry of pdmx) {
  entries.push(await withAssetData({
    id: entry.id,
    title: entry.title,
    composer: entry.composer,
    ...(entry.arranger ? { arranger: entry.arranger } : {}),
    format: "musicxml",
    assetPath: `assets/pdmx/${entry.id}.mxl`,
    fileName: `${entry.id}.mxl`,
    difficulty: entry.difficulty,
    tags: withCountryTags(entry.id, entry.tags),
    source: {
      name: "PDMX",
      url: "https://zenodo.org/records/15571083",
      recordId: entry.recordId,
    },
    license: {
      kind: entry.licenseKind,
      url: entry.licenseKind === "CC0-1.0"
        ? "https://creativecommons.org/publicdomain/zero/1.0/"
        : "https://creativecommons.org/publicdomain/mark/1.0/",
      basis: "pdmx-filtered-and-manually-reviewed",
    },
    rightsReviewedAt: reviewedAt,
  }));
}

for (const entry of cc0Melodies) {
  entries.push(await withAssetData({
    id: entry.id,
    title: entry.title,
    composer: entry.composer,
    arranger: "Melodica Trainer",
    format: "musicxml",
    assetPath: `assets/cc0/${entry.id}.mxl`,
    fileName: `${entry.id}.mxl`,
    difficulty: entry.difficulty,
    tags: withCountryTags(entry.id, entry.tags),
    source: {
      name: "Melodica Trainer CC0",
      url: entry.sourceUrl,
    },
    license: {
      kind: "CC0-1.0",
      url: "https://creativecommons.org/publicdomain/zero/1.0/",
      basis: "original-transcription-of-public-domain-melody",
    },
    rightsReviewedAt: reviewedAt,
  }));
}

const pdmxById = new Map(pdmx.map((entry) => [entry.id, entry]));
const gpMelodies = [
  ["gp-scarborough-fair", "Scarborough Fair", "pdmx-scarborough-fair"],
  ["gp-mary-lamb", "Mary Had a Little Lamb", "pdmx-mary-lamb"],
  ["gp-row-your-boat", "Row, Row, Row Your Boat", "pdmx-row-your-boat"],
  ["gp-frere-jacques", "Frère Jacques", "pdmx-frere-jacques"],
  ["gp-hot-cross-buns", "Hot Cross Buns", "pdmx-hot-cross-buns"],
  ["gp-auld-lang-syne", "Auld Lang Syne", "pdmx-auld-lang-syne"],
];
for (const [id, title, sourceId] of gpMelodies) {
  const sourceEntry = pdmxById.get(sourceId);
  entries.push(await withAssetData({
    id,
    title,
    composer: sourceEntry.composer,
    arranger: "alphaTab conversion for Melodica Trainer",
    format: "guitar-pro",
    assetPath: `assets/guitar-pro/${id}.gp`,
    fileName: `${id}.gp`,
    difficulty: "beginner",
    tags: withCountryTags(sourceId, ["melody", "familiar", "guitar-pro"]),
    source: { name: "PDMX", url: "https://zenodo.org/records/15571083", recordId: sourceEntry.recordId },
    license: {
      kind: sourceEntry.licenseKind,
      url: sourceEntry.licenseKind === "CC0-1.0"
        ? "https://creativecommons.org/publicdomain/zero/1.0/"
        : "https://creativecommons.org/publicdomain/mark/1.0/",
      basis: "derived-from-reviewed-public-domain-score",
    },
    rightsReviewedAt: reviewedAt,
  }));
}

const exercises = [
  ["gp-exercise-c-major-scale", "C Major Scale", ["exercise", "scale", "guitar-pro"]],
  ["gp-exercise-arpeggios", "Major Arpeggios", ["exercise", "arpeggio", "guitar-pro"]],
  ["gp-exercise-intervals", "Interval Study", ["exercise", "intervals", "guitar-pro"]],
  ["gp-exercise-rhythm", "Rhythm and Articulation", ["exercise", "rhythm", "guitar-pro"]],
  ["gp-exercise-chords", "Major and Minor Chords", ["exercise", "chords", "guitar-pro"]],
  ["gp-exercise-key-changes", "Changing Keys", ["exercise", "keys", "guitar-pro"]],
];
for (const [id, title, tags] of exercises) {
  entries.push(await withAssetData({
    id,
    title,
    composer: "Melodica Trainer",
    format: "guitar-pro",
    assetPath: `assets/guitar-pro/${id}.gp`,
    fileName: `${id}.gp`,
    difficulty: id.includes("chords") || id.includes("key-changes") ? "intermediate" : "beginner",
    tags,
    source: { name: "Melodica Trainer", url: "https://github.com/shafranek-js/MelodicaTrainer" },
    license: {
      kind: "CC0-1.0",
      url: "https://creativecommons.org/publicdomain/zero/1.0/",
      basis: "original-work-dedicated-to-cc0",
    },
    rightsReviewedAt: reviewedAt,
  }));
}

await writeFile(
  path.resolve("public/score-library/catalog.json"),
  `${JSON.stringify({ catalogVersion: 1, entries }, null, 2)}\n`,
);
console.log(`Generated catalog with ${entries.length} entries.`);

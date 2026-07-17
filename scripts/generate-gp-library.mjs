import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as alphaTab from "@coderline/alphatab";

const destination = path.resolve("public/score-library/assets/guitar-pro");
await mkdir(destination, { recursive: true });

const exportGp = async (id, bytes) => {
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(bytes));
  const exported = new alphaTab.exporter.Gp7Exporter().export(score);
  const roundTrip = alphaTab.importer.ScoreLoader.loadScoreFromBytes(exported);
  const notes = roundTrip.tracks
    .flatMap((track) => track.staves)
    .flatMap((staff) => staff.bars)
    .flatMap((bar) => bar.voices)
    .flatMap((voice) => voice.beats)
    .reduce((sum, beat) => sum + beat.notes.length, 0);
  if (!roundTrip.tracks.length || !notes) throw new Error(`${id}: GP round-trip has no playback notes`);
  await writeFile(path.join(destination, `${id}.gp`), exported);
};

const melodies = [
  ["gp-scarborough-fair", "public/score-library/assets/pdmx/pdmx-scarborough-fair.mxl"],
  ["gp-mary-lamb", "public/score-library/assets/pdmx/pdmx-mary-lamb.mxl"],
  ["gp-row-your-boat", "public/score-library/assets/pdmx/pdmx-row-your-boat.mxl"],
  ["gp-frere-jacques", "public/score-library/assets/pdmx/pdmx-frere-jacques.mxl"],
  ["gp-hot-cross-buns", "public/score-library/assets/pdmx/pdmx-hot-cross-buns.mxl"],
  ["gp-auld-lang-syne", "public/score-library/assets/pdmx/pdmx-auld-lang-syne.mxl"],
];
for (const [id, source] of melodies) await exportGp(id, await readFile(source));

const pitchXml = (pitch, chord = false) => {
  const [, step, accidental, octave] = /^([A-G])([#b]?)(\d)$/.exec(pitch) ?? [];
  const alter = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  return `<note>${chord ? "<chord/>" : ""}<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${octave}</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>`;
};

const measureXml = (events, number, keyFifths = null) =>
  `<measure number="${number}">${number === 1 || keyFifths !== null ? `<attributes>${number === 1 ? "<divisions>4</divisions>" : ""}${keyFifths !== null ? `<key><fifths>${keyFifths}</fifths></key>` : ""}${number === 1 ? "<time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef>" : ""}</attributes>` : ""}${events.map((event) => event.map((pitch, index) => pitchXml(pitch, index > 0)).join("")).join("")}</measure>`;

const scoreXml = (title, measures) => `<?xml version="1.0" encoding="UTF-8" standalone="no"?><score-partwise version="3.1"><work><work-title>${title}</work-title></work><identification><creator type="composer">Melodica Trainer</creator><rights>CC0 1.0</rights></identification><part-list><score-part id="P1"><part-name>Melodica</part-name><score-instrument id="P1-I1"><instrument-name>Melodica</instrument-name></score-instrument><midi-instrument id="P1-I1"><midi-channel>1</midi-channel><midi-program>22</midi-program></midi-instrument></score-part></part-list><part id="P1">${measures.join("")}</part></score-partwise>`;

const quarterMeasures = (notes) => {
  const result = [];
  for (let index = 0; index < notes.length; index += 4) {
    result.push(measureXml(notes.slice(index, index + 4).map((note) => [note]), result.length + 1));
  }
  return result;
};

const exercises = [
  ["gp-exercise-c-major-scale", "C Major Scale", quarterMeasures(["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "B4", "A4", "G4", "F4", "E4", "D4", "C4", "C4"])],
  ["gp-exercise-arpeggios", "Major Arpeggios", quarterMeasures(["C4", "E4", "G4", "C5", "G4", "E4", "C4", "C4", "G3", "B3", "D4", "G4", "D4", "B3", "G3", "G3"])],
  ["gp-exercise-intervals", "Interval Study", quarterMeasures(["C4", "D4", "C4", "E4", "C4", "F4", "C4", "G4", "D4", "F4", "D4", "A4", "E4", "G4", "E4", "B4"])],
  ["gp-exercise-rhythm", "Rhythm and Articulation", quarterMeasures(["C4", "C4", "C4", "C4", "D4", "E4", "D4", "E4", "G4", "G4", "E4", "E4", "C4", "D4", "E4", "C4"])],
  ["gp-exercise-chords", "Major and Minor Chords", [measureXml([["C4", "E4", "G4"], ["D4", "F4", "A4"], ["E4", "G4", "B4"], ["F4", "A4", "C5"]], 1), measureXml([["G4", "B4", "D5"], ["A4", "C5", "E5"], ["B4", "D5", "F5"], ["C4", "E4", "G4"]], 2)]],
  ["gp-exercise-key-changes", "Changing Keys", [measureXml([["C4"], ["D4"], ["E4"], ["G4"]], 1, 0), measureXml([["G4"], ["A4"], ["B4"], ["D5"]], 2, 1), measureXml([["F4"], ["G4"], ["A4"], ["C5"]], 3, -1)]],
];
for (const [id, title, measures] of exercises) {
  await exportGp(id, Buffer.from(scoreXml(title, measures), "utf8"));
}

console.log(`Generated ${melodies.length + exercises.length} Guitar Pro files with alphaTab round-trip checks.`);

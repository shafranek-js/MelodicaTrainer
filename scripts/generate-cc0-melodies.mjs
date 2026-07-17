import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const DIVISIONS = 4;
const ZIP_DATE = new Date("1980-01-01T00:00:00.000Z");
const selectionPaths = [
  "scripts/library-selections/cc0-melodies.json",
  "scripts/library-selections/zpevnik-czech.json",
].map((selectionPath) => path.resolve(selectionPath));
const destination = path.resolve("public/score-library/assets/cc0");

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const durationDetails = new Map([
  [0.25, ["16th", false]],
  [0.5, ["eighth", false]],
  [0.75, ["eighth", true]],
  [1, ["quarter", false]],
  [1.5, ["quarter", true]],
  [2, ["half", false]],
  [3, ["half", true]],
  [4, ["whole", false]],
]);

const pitchXml = (pitch) => {
  const match = /^([A-G])([#b]?)(\d)$/.exec(pitch);
  if (!match) throw new Error(`Unsupported pitch: ${pitch}`);
  const [, step, accidental, octave] = match;
  const alter = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${octave}</octave></pitch>`;
};

const noteXml = ([pitch, quarterLength]) => {
  const details = durationDetails.get(quarterLength);
  if (!details) throw new Error(`Unsupported duration: ${quarterLength}`);
  const [type, dotted] = details;
  const duration = Math.round(quarterLength * DIVISIONS);
  return `      <note>${pitch ? pitchXml(pitch) : "<rest/>"}<duration>${duration}</duration><voice>1</voice><type>${type}</type>${dotted ? "<dot/>" : ""}<staff>1</staff></note>`;
};

const scoreXml = (entry) => {
  const measures = entry.measures.map((measure, index) => {
    const attributes = index === 0
      ? `\n      <attributes><divisions>${DIVISIONS}</divisions><key><fifths>${entry.keyFifths}</fifths></key><time><beats>${entry.time.beats}</beats><beat-type>${entry.time.beatType}</beat-type></time><staves>1</staves><clef number="1"><sign>G</sign><line>2</line></clef></attributes>\n      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${entry.tempo}</per-minute></metronome></direction-type><sound tempo="${entry.tempo}"/></direction>`
      : "";
    return `    <measure number="${index + 1}">${attributes}\n${measure.map(noteXml).join("\n")}\n    </measure>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>${escapeXml(entry.title)}</work-title></work>
  <identification>
    <creator type="composer">${escapeXml(entry.composer)}</creator>
    <encoding><software>Melodica Trainer CC0 melody generator</software><encoding-date>2026-07-17</encoding-date></encoding>
    <rights>CC0 1.0 Universal</rights>
  </identification>
  <part-list><score-part id="P1"><part-name>Melodica</part-name></score-part></part-list>
  <part id="P1">
${measures}
  </part>
</score-partwise>
`;
};

const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="score.musicxml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles>
</container>
`;

const selection = (await Promise.all(
  selectionPaths.map(async (selectionPath) => JSON.parse(await readFile(selectionPath, "utf8"))),
)).flat();
await mkdir(destination, { recursive: true });

let generatedCount = 0;
let preservedCount = 0;
for (const entry of selection) {
  const outputPath = path.join(destination, `${entry.id}.mxl`);
  if (entry.prebuiltAsset) {
    await readFile(outputPath);
    preservedCount += 1;
    continue;
  }

  const zip = new JSZip();
  zip.file("META-INF/", null, { createFolders: false, date: ZIP_DATE, dir: true });
  zip.file("META-INF/container.xml", containerXml, { createFolders: false, date: ZIP_DATE });
  zip.file("score.musicxml", scoreXml(entry), { createFolders: false, date: ZIP_DATE });
  const bytes = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "DOS",
  });
  await writeFile(outputPath, bytes);
  generatedCount += 1;
}

console.log(
  `Generated ${generatedCount} CC0 MusicXML files; preserved ${preservedCount} prebuilt asset.`,
);

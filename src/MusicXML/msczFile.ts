import JSZip from "jszip";
import { MAX_MUSIC_XML_FILE_BYTES } from "./musicXmlFile";
import { parseMusicXmlDocument } from "./musicXmlParser";
import { getFirstStaffNoteElements } from "./musicXmlSelection";

export const MAX_MSCX_SCORE_BYTES = 10 * 1024 * 1024;

export type MsczConversionMetadata = {
  composer?: string;
  title?: string;
};

export type MsczConversionResult = {
  metadata: MsczConversionMetadata;
  musicXml: string;
  warnings: string[];
};

export type MsczFileErrorReason =
  | "file-too-large"
  | "mscx-score-too-large"
  | "invalid-archive"
  | "missing-score-in-archive"
  | "ambiguous-score-in-archive"
  | "conversion-failed"
  | "conversion-loss"
  | "no-playable-notes";

const userMessages: Record<MsczFileErrorReason, string> = {
  "file-too-large": "That file is too large. Choose a file up to 10 MB.",
  "mscx-score-too-large": "The MuseScore score inside that MSCZ file is too large.",
  "invalid-archive": "That MSCZ file could not be opened.",
  "missing-score-in-archive": "That MSCZ file doesn't contain a MuseScore score.",
  "ambiguous-score-in-archive": "That MSCZ file contains more than one possible MuseScore score.",
  "conversion-failed": "That MSCZ file could not be converted to MusicXML.",
  "conversion-loss": "Important notes or durations could not be converted from that MSCZ file.",
  "no-playable-notes": "That MSCZ file doesn't contain playable notes in its first score part.",
};

export class MsczFileError extends Error {
  reason: MsczFileErrorReason;
  userMessage: string;

  constructor(reason: MsczFileErrorReason, details?: string) {
    const userMessage = userMessages[reason];
    super(details ? `${userMessage} ${details}` : userMessage);
    Object.setPrototypeOf(this, MsczFileError.prototype);
    this.name = "MsczFileError";
    this.reason = reason;
    this.userMessage = userMessage;
  }
}

type SizedZipObject = JSZip.JSZipObject & {
  _data?: { uncompressedSize?: unknown };
};

type ParsedDiagnostic = {
  action?: string;
  message: string;
  reason?: string;
};

const getUncompressedSize = (entry: JSZip.JSZipObject) => {
  const size = (entry as SizedZipObject)._data?.uncompressedSize;
  return typeof size === "number" ? size : null;
};

export const getMsczFileTitle = (fileName: string) =>
  fileName.replace(/\.mscz$/i, "").trim() || fileName;

const normalizeArchivePath = (value: string) =>
  value.replace(/\\/g, "/").replace(/^\.\//, "");

const getRootMscxEntry = (zip: JSZip) => {
  const candidates = Object.values(zip.files).filter((entry) => {
    const path = normalizeArchivePath(entry.name);
    return !entry.dir && !path.includes("/") && /\.mscx$/i.test(path);
  });
  if (candidates.length === 0) {
    throw new MsczFileError("missing-score-in-archive");
  }
  return candidates;
};

const chooseMscxEntry = (zip: JSZip, fileName: string) => {
  const candidates = getRootMscxEntry(zip);
  if (candidates.length === 1) return candidates[0];

  const expectedName = `${getMsczFileTitle(fileName)}.mscx`.toLocaleLowerCase();
  const matching = candidates.filter(
    (entry) => normalizeArchivePath(entry.name).toLocaleLowerCase() === expectedName,
  );
  if (matching.length === 1) return matching[0];
  throw new MsczFileError("ambiguous-score-in-archive");
};

const parseDiagnosticPayload = (payload: string): ParsedDiagnostic => {
  const fields = new Map<string, string>();
  for (const item of payload.split(/;(?=[a-z][\w-]*=)/i)) {
    const separator = item.indexOf("=");
    if (separator > 0) fields.set(item.slice(0, separator), item.slice(separator + 1));
  }
  return {
    action: fields.get("action"),
    message: fields.get("message") || "Some MuseScore content could not be converted exactly.",
    reason: fields.get("reason"),
  };
};

const extractDiagnostics = (xmlDoc: XMLDocument) => {
  const diagnostics: ParsedDiagnostic[] = [];
  const fields = Array.from(xmlDoc.getElementsByTagName("miscellaneous-field"));
  for (const field of fields) {
    const name = field.getAttribute("name") ?? "";
    if (!/^mks:diag:\d{4}$/.test(name)) continue;
    diagnostics.push(parseDiagnosticPayload(field.textContent?.trim() ?? ""));
  }
  return diagnostics;
};

const removeMikuscoreMetadata = (xmlDoc: XMLDocument) => {
  for (const field of Array.from(xmlDoc.getElementsByTagName("miscellaneous-field"))) {
    if (field.getAttribute("name")?.startsWith("mks:")) field.remove();
  }
  for (const miscellaneous of Array.from(xmlDoc.getElementsByTagName("miscellaneous"))) {
    if (miscellaneous.children.length === 0) miscellaneous.remove();
  }
};

const hasBlockingDiagnostic = (diagnostic: ParsedDiagnostic) =>
  diagnostic.action === "placeholder-created" ||
  diagnostic.action === "dropped" ||
  diagnostic.reason === "unknown-duration" ||
  diagnostic.reason === "missing-pitch";

const getMetadata = (xmlDoc: XMLDocument): MsczConversionMetadata => {
  const text = (selector: string) =>
    xmlDoc.querySelector(selector)?.textContent?.trim() || undefined;
  return {
    composer: text('identification creator[type="composer"]'),
    title: text("work work-title") ?? text("movement-title"),
  };
};

const replacePlaceholderTitle = (xmlDoc: XMLDocument, fileName: string) => {
  const title = xmlDoc.querySelector("work work-title");
  const currentTitle = title?.textContent?.trim();
  if (currentTitle && currentTitle !== "Imported MuseScore") return;

  const replacement = getMsczFileTitle(fileName);
  if (title) {
    title.textContent = replacement;
    return;
  }
  const root = xmlDoc.documentElement;
  const work = xmlDoc.createElement("work");
  const workTitle = xmlDoc.createElement("work-title");
  workTitle.textContent = replacement;
  work.appendChild(workTitle);
  root.insertBefore(work, root.firstChild);
};

const readMscxText = async (file: File) => {
  if (file.size > MAX_MUSIC_XML_FILE_BYTES) {
    throw new MsczFileError("file-too-large");
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch (error) {
    throw new MsczFileError(
      "invalid-archive",
      error instanceof Error ? error.message : undefined,
    );
  }

  const scoreEntry = chooseMscxEntry(zip, file.name);
  const declaredSize = getUncompressedSize(scoreEntry);
  if (declaredSize !== null && declaredSize > MAX_MSCX_SCORE_BYTES) {
    throw new MsczFileError("mscx-score-too-large");
  }
  const bytes = await scoreEntry.async("uint8array");
  if (bytes.byteLength > MAX_MSCX_SCORE_BYTES) {
    throw new MsczFileError("mscx-score-too-large");
  }
  return new TextDecoder().decode(bytes);
};

export const validateMsczArchiveForConversion = async (file: File) => {
  await readMscxText(file);
};

export const validateMsczConversionOutput = (
  convertedXml: string,
  fileName: string,
) => {
  const xmlDoc = parseMusicXmlDocument(convertedXml);
  const playableNotes = getFirstStaffNoteElements(xmlDoc).filter(
    (note) => note.getElementsByTagName("pitch")[0],
  );
  if (playableNotes.length === 0) {
    throw new MsczFileError("no-playable-notes");
  }

  replacePlaceholderTitle(xmlDoc, fileName);
  removeMikuscoreMetadata(xmlDoc);
  const musicXml = new XMLSerializer().serializeToString(xmlDoc);
  parseMusicXmlDocument(musicXml);
  return { metadata: getMetadata(xmlDoc), musicXml };
};

export const convertMsczFile = async (file: File): Promise<MsczConversionResult> => {
  const mscxSource = await readMscxText(file);
  let xmlDoc: XMLDocument;
  try {
    const { convertMuseScoreToMusicXml } = await import(
      "../vendor/mikuscore/src/ts/musescore-io"
    );
    const convertedXml = convertMuseScoreToMusicXml(mscxSource, {
      applyImplicitBeams: true,
      debugMetadata: true,
      normalizeCutTimeToTwoTwo: false,
      sourceMetadata: false,
    });
    xmlDoc = parseMusicXmlDocument(convertedXml);
  } catch (error) {
    if (error instanceof MsczFileError) throw error;
    throw new MsczFileError(
      "conversion-failed",
      error instanceof Error ? error.message : undefined,
    );
  }
  const diagnostics = extractDiagnostics(xmlDoc);
  const blocking = diagnostics.find(hasBlockingDiagnostic);
  if (blocking) {
    throw new MsczFileError("conversion-loss", blocking.message);
  }

  const validated = validateMsczConversionOutput(
    new XMLSerializer().serializeToString(xmlDoc),
    file.name,
  );

  return {
    ...validated,
    warnings: diagnostics.map((diagnostic) => diagnostic.message),
  };
};

export const canRetryMsczWithHighFidelity = (error: unknown) =>
  error instanceof MsczFileError && (
    error.reason === "conversion-failed" ||
    error.reason === "conversion-loss" ||
    error.reason === "no-playable-notes"
  );

export const getMsczFileErrorMessage = (error: unknown) =>
  error instanceof MsczFileError
    ? `${error.userMessage} Export the score as MusicXML or MXL in MuseScore Desktop and try again.`
    : null;

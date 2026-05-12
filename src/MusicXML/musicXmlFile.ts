import JSZip from "jszip";
import { parseMusicXmlDocument } from "./musicXmlParser";

const BYTES_PER_MEGABYTE = 1024 * 1024;

export const MAX_MUSIC_XML_FILE_BYTES = 10 * BYTES_PER_MEGABYTE;
export const MAX_MXL_SCORE_BYTES = 10 * BYTES_PER_MEGABYTE;

export type MusicXmlFileErrorReason =
  | "file-too-large"
  | "mxl-score-too-large"
  | "missing-score-in-archive";

const userMessages: Record<MusicXmlFileErrorReason, string> = {
  "file-too-large": "That file is too large. Choose a file up to 10 MB.",
  "mxl-score-too-large":
    "The MusicXML score inside that MXL file is too large.",
  "missing-score-in-archive":
    "That MXL file doesn't contain a MusicXML score.",
};

export class MusicXmlFileError extends Error {
  reason: MusicXmlFileErrorReason;
  userMessage: string;

  constructor(reason: MusicXmlFileErrorReason) {
    const userMessage = userMessages[reason];
    super(userMessage);
    Object.setPrototypeOf(this, MusicXmlFileError.prototype);

    this.name = "MusicXmlFileError";
    this.reason = reason;
    this.userMessage = userMessage;
  }
}

type SizedZipObject = JSZip.JSZipObject & {
  _data?: { uncompressedSize?: unknown };
};

const getUncompressedSize = (entry: JSZip.JSZipObject) => {
  const size = (entry as SizedZipObject)._data?.uncompressedSize;
  return typeof size === "number" ? size : null;
};

const assertUploadSize = (file: File) => {
  if (file.size > MAX_MUSIC_XML_FILE_BYTES) {
    throw new MusicXmlFileError("file-too-large");
  }
};

const assertMxlScoreSize = (size: number) => {
  if (size > MAX_MXL_SCORE_BYTES) {
    throw new MusicXmlFileError("mxl-score-too-large");
  }
};

export const getContainerScorePath = (containerXml: string) => {
  const xmlDoc = parseMusicXmlDocument(containerXml, {
    requireScorePart: false,
  });
  const rootFile = xmlDoc.getElementsByTagName("rootfile")[0];

  return rootFile?.getAttribute("full-path") || null;
};

const readCompressedMusicXmlEntry = async (entry: JSZip.JSZipObject) => {
  const declaredSize = getUncompressedSize(entry);
  if (declaredSize !== null) assertMxlScoreSize(declaredSize);

  const contentBytes = await entry.async("uint8array");
  assertMxlScoreSize(contentBytes.byteLength);

  return new TextDecoder().decode(contentBytes);
};

const extractCompressedMusicXml = async (file: File) => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const containerFile = zip.file("META-INF/container.xml");
  const containerScorePath = containerFile
    ? getContainerScorePath(await containerFile.async("text"))
    : null;
  const candidatePaths = [
    containerScorePath,
    ...Object.values(zip.files)
      .filter(
        (entry) =>
          !entry.dir &&
          /\.(musicxml|xml)$/i.test(entry.name) &&
          entry.name !== "META-INF/container.xml"
      )
      .map((entry) => entry.name),
  ].filter((path, index, paths): path is string =>
    Boolean(path && paths.indexOf(path) === index)
  );

  for (const path of candidatePaths) {
    const scoreFile = zip.file(path);
    if (scoreFile) return readCompressedMusicXmlEntry(scoreFile);
  }

  throw new MusicXmlFileError("missing-score-in-archive");
};

export const readMusicXmlFile = async (file: File) => {
  assertUploadSize(file);

  const isMxl = /\.mxl$/i.test(file.name);
  const isGp = /\.(gp|gp3|gp4|gp5|gpx)$/i.test(file.name);

  if (isGp) {
    return new Uint8Array(await file.arrayBuffer());
  }

  const content = await (isMxl
    ? extractCompressedMusicXml(file)
    : file.text());

  if (!isGp) {
    parseMusicXmlDocument(content);
  }
  return content;
};

export const getMusicXmlFileErrorMessage = (error: unknown) =>
  error instanceof MusicXmlFileError ? error.userMessage : null;

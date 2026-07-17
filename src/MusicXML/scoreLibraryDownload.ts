import { MAX_MUSIC_XML_FILE_BYTES } from "./musicXmlFile";
import { getScoreLibraryAssetUrl } from "./scoreLibrary";
import type { ScoreLibraryEntry } from "./scoreLibrary";

export type ScoreLibraryDownloadErrorReason =
  | "cancelled"
  | "file-too-large"
  | "http-error"
  | "invalid-source"
  | "network-error"
  | "unsupported-format";

const errorMessages: Record<ScoreLibraryDownloadErrorReason, string> = {
  cancelled: "Score download cancelled.",
  "file-too-large": "That library score is too large to load.",
  "http-error": "The library score is temporarily unavailable.",
  "invalid-source": "That score does not use an approved local library path.",
  "network-error": "Could not load the score. Check your connection and try again.",
  "unsupported-format": "That library entry is not a supported score file.",
};

export class ScoreLibraryDownloadError extends Error {
  reason: ScoreLibraryDownloadErrorReason;
  userMessage: string;

  constructor(reason: ScoreLibraryDownloadErrorReason) {
    const userMessage = errorMessages[reason];
    super(userMessage);
    Object.setPrototypeOf(this, ScoreLibraryDownloadError.prototype);
    this.name = "ScoreLibraryDownloadError";
    this.reason = reason;
    this.userMessage = userMessage;
  }
}

type DownloadScoreLibraryFileOptions = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

const assertSupportedEntry = (entry: ScoreLibraryEntry) => {
  if (
    entry.assetPath.startsWith("/") ||
    entry.assetPath.includes("\\") ||
    entry.assetPath.split("/").includes("..") ||
    !entry.assetPath.startsWith("assets/") ||
    /^[a-z][a-z\d+.-]*:/i.test(entry.assetPath)
  ) {
    throw new ScoreLibraryDownloadError("invalid-source");
  }
  const extensionPattern =
    entry.format === "musicxml"
      ? /\.(musicxml|mxl|xml)$/i
      : /\.(gp|gp3|gp4|gp5|gpx)$/i;
  if (
    !extensionPattern.test(entry.fileName) ||
    !extensionPattern.test(entry.assetPath) ||
    entry.assetPath.split("/").slice(-1)[0] !== entry.fileName
  ) {
    throw new ScoreLibraryDownloadError("unsupported-format");
  }
  try {
    return getScoreLibraryAssetUrl(entry);
  } catch {
    throw new ScoreLibraryDownloadError("invalid-source");
  }
};

const assertDownloadSize = (size: number) => {
  if (size > MAX_MUSIC_XML_FILE_BYTES) {
    throw new ScoreLibraryDownloadError("file-too-large");
  }
};

export const downloadScoreLibraryFile = async (
  entry: ScoreLibraryEntry,
  options: DownloadScoreLibraryFileOptions = {},
) => {
  const downloadUrl = assertSupportedEntry(entry);
  assertDownloadSize(entry.bytes);
  const fetchImpl = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(downloadUrl, { signal: options.signal });
  } catch (error) {
    if (options.signal?.aborted || isAbortError(error)) {
      throw new ScoreLibraryDownloadError("cancelled");
    }
    throw new ScoreLibraryDownloadError("network-error");
  }
  if (!response.ok) throw new ScoreLibraryDownloadError("http-error");

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength)) assertDownloadSize(declaredLength);

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch (error) {
    if (options.signal?.aborted || isAbortError(error)) {
      throw new ScoreLibraryDownloadError("cancelled");
    }
    throw new ScoreLibraryDownloadError("network-error");
  }
  assertDownloadSize(blob.size);

  return new File([blob], entry.fileName, { type: blob.type || "application/octet-stream" });
};

export const getScoreLibraryDownloadErrorMessage = (error: unknown) =>
  error instanceof ScoreLibraryDownloadError
    ? error.userMessage
    : "Could not load that library score.";

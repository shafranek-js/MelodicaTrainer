import { MAX_MUSIC_XML_FILE_BYTES } from "./musicXmlFile";
import {
  getScoreLibraryDownloadUrl,
  MUSETRAINER_SCORE_BASE_URL,
} from "./scoreLibrary";
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
  "invalid-source": "That score does not use an approved library URL.",
  "network-error": "Could not download the score. Check your connection and try again.",
  "unsupported-format": "That library entry is not a supported MusicXML file.",
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
  if (!/\.(musicxml|mxl|xml)$/i.test(entry.fileName)) {
    throw new ScoreLibraryDownloadError("unsupported-format");
  }

  const downloadUrl = new URL(getScoreLibraryDownloadUrl(entry));
  const approvedBaseUrl = new URL(MUSETRAINER_SCORE_BASE_URL);
  if (
    downloadUrl.protocol !== "https:" ||
    downloadUrl.origin !== approvedBaseUrl.origin ||
    !downloadUrl.pathname.startsWith(approvedBaseUrl.pathname)
  ) {
    throw new ScoreLibraryDownloadError("invalid-source");
  }

  return downloadUrl.toString();
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

  if (!response.ok) {
    throw new ScoreLibraryDownloadError("http-error");
  }

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

  return new File([blob], entry.fileName, {
    type: blob.type || "application/vnd.recordare.musicxml",
  });
};

export const getScoreLibraryDownloadErrorMessage = (error: unknown) =>
  error instanceof ScoreLibraryDownloadError
    ? error.userMessage
    : "Could not load that library score.";

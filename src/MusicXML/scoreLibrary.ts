import type { ScoreFileFormat } from "./scoreFormat";
import type { UserScoreLibraryEntry } from "./userScoreLibrary";

export type ScoreLibraryFormat = ScoreFileFormat;
export type ScoreLibraryDifficulty = "beginner" | "intermediate" | "advanced";
export type ScoreLibraryLicenseKind = "CC0-1.0" | "PUBLIC_DOMAIN";

export type PublicScoreLibraryEntry = {
  arranger?: string;
  assetPath: string;
  bytes: number;
  composer: string;
  difficulty: ScoreLibraryDifficulty;
  fileName: string;
  format: Exclude<ScoreLibraryFormat, "midi" | "musescore">;
  id: string;
  license: {
    basis: string;
    kind: ScoreLibraryLicenseKind;
    url: string;
  };
  rightsReviewedAt: string;
  sha256: string;
  source: {
    name: string;
    recordId?: string;
    url: string;
  };
  sourceKind: "public";
  tags: readonly string[];
  title: string;
};

export type ScoreLibraryEntry = PublicScoreLibraryEntry;
export type LibraryEntry = PublicScoreLibraryEntry | UserScoreLibraryEntry;

export type ScoreLibraryCatalog = {
  catalogVersion: number;
  entries: readonly PublicScoreLibraryEntry[];
};

export class ScoreLibraryCatalogError extends Error {
  constructor(message = "The score library catalog could not be loaded.") {
    super(message);
    Object.setPrototypeOf(this, ScoreLibraryCatalogError.prototype);
    this.name = "ScoreLibraryCatalogError";
  }
}

const formats = new Set<PublicScoreLibraryEntry["format"]>(["musicxml", "guitar-pro"]);
const difficulties = new Set<ScoreLibraryDifficulty>([
  "beginner",
  "intermediate",
  "advanced",
]);
const licenseKinds = new Set<ScoreLibraryLicenseKind>([
  "CC0-1.0",
  "PUBLIC_DOMAIN",
]);
const MAX_LIBRARY_SCORE_BYTES = 10 * 1024 * 1024;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSafeAssetPath = (value: string) =>
  value.startsWith("assets/") &&
  !value.startsWith("/") &&
  !value.includes("\\") &&
  !value.split("/").includes("..") &&
  !/^[a-z][a-z\d+.-]*:/i.test(value);

const entryFileMatchesFormat = (
  format: PublicScoreLibraryEntry["format"],
  assetPath: string,
  fileName: string,
) => {
  const extensionPattern =
    format === "musicxml"
      ? /\.(musicxml|mxl|xml)$/i
      : /\.(gp|gp3|gp4|gp5|gpx)$/i;
  return (
    extensionPattern.test(fileName) &&
    extensionPattern.test(assetPath) &&
    assetPath.split("/").slice(-1)[0] === fileName
  );
};

type RawPublicScoreLibraryEntry = Omit<PublicScoreLibraryEntry, "sourceKind">;

const isEntry = (value: unknown): value is RawPublicScoreLibraryEntry => {
  if (!isRecord(value) || !isRecord(value.source) || !isRecord(value.license)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.composer === "string" &&
    (value.arranger === undefined || typeof value.arranger === "string") &&
    typeof value.format === "string" &&
    formats.has(value.format as PublicScoreLibraryEntry["format"]) &&
    typeof value.assetPath === "string" &&
    isSafeAssetPath(value.assetPath) &&
    typeof value.fileName === "string" &&
    entryFileMatchesFormat(
      value.format as PublicScoreLibraryEntry["format"],
      value.assetPath,
      value.fileName,
    ) &&
    Number.isInteger(value.bytes) &&
    (value.bytes as number) > 0 &&
    (value.bytes as number) <= MAX_LIBRARY_SCORE_BYTES &&
    typeof value.sha256 === "string" &&
    /^[a-f\d]{64}$/.test(value.sha256) &&
    typeof value.difficulty === "string" &&
    difficulties.has(value.difficulty as ScoreLibraryDifficulty) &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    typeof value.source.name === "string" &&
    typeof value.source.url === "string" &&
    (value.source.recordId === undefined || typeof value.source.recordId === "string") &&
    typeof value.license.kind === "string" &&
    licenseKinds.has(value.license.kind as ScoreLibraryLicenseKind) &&
    typeof value.license.basis === "string" &&
    typeof value.license.url === "string" &&
    typeof value.rightsReviewedAt === "string"
  );
};

export const parseScoreLibraryCatalog = (value: unknown): ScoreLibraryCatalog => {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.catalogVersion) ||
    !Array.isArray(value.entries) ||
    !value.entries.every(isEntry) ||
    new Set(value.entries.map((entry) => entry.id)).size !== value.entries.length
  ) {
    throw new ScoreLibraryCatalogError("The score library catalog is invalid.");
  }
  return {
    catalogVersion: value.catalogVersion as number,
    entries: (value.entries as RawPublicScoreLibraryEntry[]).map((entry) => ({
      ...entry,
      sourceKind: "public",
    })),
  };
};

let catalogPromise: Promise<ScoreLibraryCatalog> | null = null;

export const getScoreLibraryCatalogUrl = () =>
  `${import.meta.env.BASE_URL}score-library/catalog.json`;

export const loadScoreLibraryCatalog = (
  fetchImpl: typeof fetch = fetch,
): Promise<ScoreLibraryCatalog> => {
  if (catalogPromise) return catalogPromise;

  const request = fetchImpl(getScoreLibraryCatalogUrl(), { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new ScoreLibraryCatalogError();
      return parseScoreLibraryCatalog(await response.json());
    })
    .catch((error: unknown) => {
      catalogPromise = null;
      if (error instanceof ScoreLibraryCatalogError) throw error;
      throw new ScoreLibraryCatalogError();
    });
  catalogPromise = request;
  return request;
};

export const clearScoreLibraryCatalogCache = () => {
  catalogPromise = null;
};

export const resetScoreLibraryCatalogCacheForTests = clearScoreLibraryCatalogCache;

export const getScoreLibraryAssetUrl = (entry: PublicScoreLibraryEntry) => {
  if (!isSafeAssetPath(entry.assetPath)) throw new ScoreLibraryCatalogError();
  return `${import.meta.env.BASE_URL}score-library/${entry.assetPath}?v=${entry.sha256}`;
};

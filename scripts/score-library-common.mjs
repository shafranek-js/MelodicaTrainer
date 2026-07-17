import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const LIBRARY_ROOT = path.resolve("public/score-library");
export const CATALOG_PATH = path.join(LIBRARY_ROOT, "catalog.json");
export const MAX_SCORE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_LICENSES = new Set(["CC0-1.0", "PUBLIC_DOMAIN"]);
export const ALLOWED_DIFFICULTIES = new Set([
  "beginner",
  "intermediate",
  "advanced",
]);
export const ALLOWED_FORMATS = new Set(["musicxml", "guitar-pro"]);

export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

export const readCatalog = async (catalogPath = CATALOG_PATH) =>
  JSON.parse(await readFile(catalogPath, "utf8"));

export const resolveAssetPath = (assetPath, root = LIBRARY_ROOT) => {
  if (
    typeof assetPath !== "string" ||
    !assetPath.startsWith("assets/") ||
    assetPath.includes("\\") ||
    assetPath.split("/").includes("..") ||
    /^[a-z][a-z\d+.-]*:/i.test(assetPath) ||
    assetPath.startsWith("/")
  ) {
    throw new Error(`Unsafe assetPath: ${assetPath}`);
  }

  const resolved = path.resolve(root, ...assetPath.split("/"));
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`assetPath escapes the library: ${assetPath}`);
  }
  return resolved;
};

export const validateEntryShape = (entry, index) => {
  const prefix = `entries[${index}]`;
  const requiredStrings = [
    "id",
    "title",
    "composer",
    "assetPath",
    "fileName",
    "sha256",
    "rightsReviewedAt",
  ];
  for (const field of requiredStrings) {
    if (typeof entry?.[field] !== "string" || !entry[field].trim()) {
      throw new Error(`${prefix}.${field} must be a non-empty string`);
    }
  }
  if (entry.arranger !== undefined && typeof entry.arranger !== "string") {
    throw new Error(`${prefix}.arranger must be a string`);
  }
  if (!ALLOWED_FORMATS.has(entry.format)) {
    throw new Error(`${prefix}.format is invalid`);
  }
  if (!ALLOWED_DIFFICULTIES.has(entry.difficulty)) {
    throw new Error(`${prefix}.difficulty is invalid`);
  }
  if (!Number.isInteger(entry.bytes) || entry.bytes <= 0 || entry.bytes > MAX_SCORE_BYTES) {
    throw new Error(`${prefix}.bytes must be between 1 and ${MAX_SCORE_BYTES}`);
  }
  if (!/^[a-f\d]{64}$/.test(entry.sha256)) {
    throw new Error(`${prefix}.sha256 must be lowercase SHA-256`);
  }
  if (!Array.isArray(entry.tags) || entry.tags.some((tag) => typeof tag !== "string")) {
    throw new Error(`${prefix}.tags must be a string array`);
  }
  if (
    typeof entry.source?.name !== "string" ||
    typeof entry.source?.url !== "string" ||
    !/^https:\/\//.test(entry.source.url)
  ) {
    throw new Error(`${prefix}.source is invalid`);
  }
  if (
    !ALLOWED_LICENSES.has(entry.license?.kind) ||
    typeof entry.license?.url !== "string" ||
    typeof entry.license?.basis !== "string"
  ) {
    throw new Error(`${prefix}.license is invalid`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.rightsReviewedAt)) {
    throw new Error(`${prefix}.rightsReviewedAt must be YYYY-MM-DD`);
  }
  resolveAssetPath(entry.assetPath);

  const extension = path.extname(entry.fileName).toLowerCase();
  const expected = entry.format === "musicxml" ? new Set([".mxl", ".musicxml", ".xml"]) : new Set([".gp", ".gp3", ".gp4", ".gp5", ".gpx"]);
  if (!expected.has(extension) || path.basename(entry.assetPath) !== entry.fileName) {
    throw new Error(`${prefix} file name or extension does not match its format`);
  }
};

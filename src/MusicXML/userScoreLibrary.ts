import { parseMidiFile } from "./midiParser";
import { MAX_MUSIC_XML_FILE_BYTES, readMusicXmlFile } from "./musicXmlFile";
import { convertMsczFile } from "./msczFile";
import { getScoreFileFormat } from "./scoreFormat";
import type { ScoreFileFormat } from "./scoreFormat";

export type UserScoreLibraryEntry = {
  bytes: number;
  composer?: string;
  conversionWarnings?: readonly string[];
  fileName: string;
  format: ScoreFileFormat;
  id: string;
  lastModified: number;
  relativePath: string;
  sha256: string;
  sourceKind: "user";
  title: string;
};

export type UserScoreLibraryIssue = {
  message: string;
  relativePath: string;
  severity: "error" | "warning";
};

export type UserScoreLibraryIndex = {
  entries: readonly UserScoreLibraryEntry[];
  issues: readonly UserScoreLibraryIssue[];
  lastScanAt: string | null;
};

export type UserScoreLibraryScanSummary = {
  added: number;
  errors: number;
  removed: number;
  skipped: number;
  updated: number;
  warnings: number;
};

export type UserScoreLibraryScanResult = UserScoreLibraryIndex & {
  summary: UserScoreLibraryScanSummary;
};

export type UserScoreLibraryImportResult = {
  copied: number;
  errors: readonly string[];
  skipped: number;
};

export type UserScoreLibraryPermission = PermissionState | "unsupported";

type StoredState = {
  directoryHandle?: FileSystemDirectoryHandle;
  index?: UserScoreLibraryIndex;
};

const DB_NAME = "melodicatrainer-user-score-library";
const DB_VERSION = 1;
const STORE_NAME = "state";
const STATE_KEY = "library";
const EMPTY_INDEX: UserScoreLibraryIndex = {
  entries: [],
  issues: [],
  lastScanAt: null,
};

export const USER_SCORE_FILE_ACCEPT =
  ".xml,.musicxml,.mxl,.gp,.gp3,.gp4,.gp5,.gpx,.mid,.midi,.mscz";

const getIndexedDb = () => globalThis.indexedDB;

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = getIndexedDb().open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local library storage."));
  });

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not access local library storage."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Local library storage was interrupted."));
    });
  } finally {
    database.close();
  }
};

export const isUserScoreLibrarySupported = () =>
  typeof window !== "undefined" &&
  typeof window.showDirectoryPicker === "function" &&
  typeof indexedDB !== "undefined";

export const loadStoredUserScoreLibrary = async (): Promise<StoredState> => {
  if (typeof indexedDB === "undefined") return {};
  try {
    return (await runTransaction("readonly", (store) => store.get(STATE_KEY))) ?? {};
  } catch {
    return {};
  }
};

export const saveStoredUserScoreLibrary = async (state: StoredState) => {
  await runTransaction("readwrite", (store) => store.put(state, STATE_KEY));
};

export const clearStoredUserScoreLibrary = async () => {
  if (typeof indexedDB === "undefined") return;
  await runTransaction("readwrite", (store) => store.delete(STATE_KEY));
};

const permissionDescriptor = { mode: "readwrite" as const };

export const queryUserScoreLibraryPermission = async (
  handle: FileSystemDirectoryHandle | null,
): Promise<UserScoreLibraryPermission> => {
  if (!isUserScoreLibrarySupported()) return "unsupported";
  if (!handle) return "prompt";
  return handle.queryPermission(permissionDescriptor);
};

export const requestUserScoreLibraryPermission = async (
  handle: FileSystemDirectoryHandle,
) => handle.requestPermission(permissionDescriptor);

export const chooseUserScoreLibraryFolder = async () => {
  if (!isUserScoreLibrarySupported()) {
    throw new Error("Folder libraries are not supported by this browser.");
  }
  return window.showDirectoryPicker({
    id: "melodicatrainer-score-library",
    mode: "readwrite",
  });
};

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");

export const hashUserScoreFile = async (file: File) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(await file.arrayBuffer()),
  );
  return bytesToHex(new Uint8Array(digest));
};

const fileTitle = (fileName: string) => fileName.replace(/\.[^.]+$/, "").trim() || fileName;

const extractMusicXmlMetadata = (content: string) => {
  const document = new DOMParser().parseFromString(content, "application/xml");
  const text = (selector: string) => document.querySelector(selector)?.textContent?.trim() || undefined;
  return {
    composer: text('identification creator[type="composer"]'),
    title: text("work work-title") ?? text("movement-title"),
  };
};

type ExtractedScoreMetadata = {
  composer?: string;
  title?: string;
  warnings: string[];
};

const validateUserScoreFile = async (
  file: File,
  format: ScoreFileFormat,
): Promise<ExtractedScoreMetadata> => {
  if (file.size <= 0) throw new Error("The file is empty.");
  if (file.size > MAX_MUSIC_XML_FILE_BYTES) throw new Error("The file is larger than 10 MB.");

  if (format === "midi") {
    parseMidiFile(new Uint8Array(await file.arrayBuffer()), file.name);
    return { warnings: [] };
  }
  if (format === "musicxml") {
    const content = await readMusicXmlFile(file);
    return {
      ...(typeof content === "string" ? extractMusicXmlMetadata(content) : {}),
      warnings: [],
    };
  }
  if (format === "musescore") {
    const converted = await convertMsczFile(file);
    return { ...converted.metadata, warnings: converted.warnings };
  }
  await file.slice(0, Math.min(file.size, 16)).arrayBuffer();
  return { warnings: [] };
};

type DiscoveredFile = {
  file: File;
  relativePath: string;
};

const collectFiles = async (
  directory: FileSystemDirectoryHandle,
  prefix = "",
): Promise<DiscoveredFile[]> => {
  const files: DiscoveredFile[] = [];
  for await (const handle of directory.values()) {
    const relativePath = prefix ? `${prefix}/${handle.name}` : handle.name;
    if (handle.kind === "directory") {
      files.push(...await collectFiles(handle, relativePath));
    } else {
      files.push({ file: await handle.getFile(), relativePath });
    }
  }
  return files;
};

const emptySummary = (): UserScoreLibraryScanSummary => ({
  added: 0,
  errors: 0,
  removed: 0,
  skipped: 0,
  updated: 0,
  warnings: 0,
});

export const scanUserScoreLibrary = async (
  directory: FileSystemDirectoryHandle,
  previous: UserScoreLibraryIndex = EMPTY_INDEX,
): Promise<UserScoreLibraryScanResult> => {
  const summary = emptySummary();
  const issues: UserScoreLibraryIssue[] = [];
  const previousByPath = new Map(previous.entries.map((entry) => [entry.relativePath, entry]));
  const discovered = (await collectFiles(directory)).sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
  const entries: UserScoreLibraryEntry[] = [];
  const hashes = new Set<string>();

  for (const { file, relativePath } of discovered) {
    const format = getScoreFileFormat(file.name);
    if (!format) {
      summary.skipped += 1;
      continue;
    }

    const previousEntry = previousByPath.get(relativePath);
    try {
      let entry: UserScoreLibraryEntry;
      if (
        previousEntry &&
        previousEntry.bytes === file.size &&
        previousEntry.lastModified === file.lastModified
      ) {
        entry = previousEntry;
      } else {
        const metadata = await validateUserScoreFile(file, format);
        const sha256 = await hashUserScoreFile(file);
        entry = {
          bytes: file.size,
          composer: metadata.composer,
          conversionWarnings: metadata.warnings,
          fileName: file.name,
          format,
          id: `user:${sha256}`,
          lastModified: file.lastModified,
          relativePath,
          sha256,
          sourceKind: "user",
          title: metadata.title ?? fileTitle(file.name),
        };
      }

      if (hashes.has(entry.sha256)) {
        summary.skipped += 1;
        continue;
      }
      hashes.add(entry.sha256);
      entries.push(entry);
      for (const warning of entry.conversionWarnings ?? []) {
        summary.warnings += 1;
        issues.push({ message: warning, relativePath, severity: "warning" });
      }
      if (!previousEntry) summary.added += 1;
      else if (entry !== previousEntry) summary.updated += 1;
    } catch (error) {
      summary.errors += 1;
      issues.push({
        message: error instanceof Error ? error.message : "The file could not be checked.",
        relativePath,
        severity: "error",
      });
    }
  }

  const retainedPaths = new Set(entries.map((entry) => entry.relativePath));
  summary.removed = previous.entries.filter((entry) => !retainedPaths.has(entry.relativePath)).length;

  return {
    entries,
    issues,
    lastScanAt: new Date().toISOString(),
    summary,
  };
};

const splitFileName = (fileName: string) => {
  const match = /^(.*?)(\.[^.]+)?$/.exec(fileName);
  return { base: match?.[1] || fileName, extension: match?.[2] || "" };
};

export const importUserScoreFiles = async (
  directory: FileSystemDirectoryHandle,
  files: readonly File[],
  existingEntries: readonly UserScoreLibraryEntry[],
): Promise<UserScoreLibraryImportResult> => {
  let copied = 0;
  let skipped = 0;
  const errors: string[] = [];
  const knownHashes = new Set(existingEntries.map((entry) => entry.sha256));

  for (const file of files) {
    const format = getScoreFileFormat(file.name);
    try {
      if (!format) throw new Error("Unsupported score file format.");
      await validateUserScoreFile(file, format);
      const hash = await hashUserScoreFile(file);
      if (knownHashes.has(hash)) {
        skipped += 1;
        continue;
      }

      const { base, extension } = splitFileName(file.name);
      let candidate = file.name;
      let suffix = 2;
      while (true) {
        try {
          const existing = await directory.getFileHandle(candidate);
          const existingFile = await existing.getFile();
          if (await hashUserScoreFile(existingFile) === hash) {
            skipped += 1;
            candidate = "";
            break;
          }
          candidate = `${base} (${suffix})${extension}`;
          suffix += 1;
        } catch (error) {
          if (error instanceof DOMException && error.name === "NotFoundError") break;
          throw error;
        }
      }
      if (!candidate) continue;

      const handle = await directory.getFileHandle(candidate, { create: true });
      const writable = await handle.createWritable();
      try {
        await writable.write(file);
        await writable.close();
      } catch (writeError) {
        await writable.abort().catch(() => undefined);
        throw writeError;
      }
      knownHashes.add(hash);
      copied += 1;
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : "Could not copy the file."}`);
    }
  }

  return { copied, errors, skipped };
};

export const getUserScoreFile = async (
  directory: FileSystemDirectoryHandle,
  entry: UserScoreLibraryEntry,
) => {
  const parts = entry.relativePath.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName || parts.some((part) => part === "." || part === "..")) {
    throw new Error("The local score path is invalid.");
  }
  let current = directory;
  for (const part of parts) current = await current.getDirectoryHandle(part);
  return (await current.getFileHandle(fileName)).getFile();
};

export const emptyUserScoreLibraryIndex = () => ({ ...EMPTY_INDEX });

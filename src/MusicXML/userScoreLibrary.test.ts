import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  chooseUserScoreLibraryFolder,
  clearStoredUserScoreLibrary,
  getUserScoreFile,
  importUserScoreFiles,
  isUserScoreLibrarySupported,
  loadStoredUserScoreLibrary,
  saveStoredUserScoreLibrary,
  scanUserScoreLibrary,
} from "./userScoreLibrary";
import type { UserScoreLibraryEntry } from "./userScoreLibrary";

class TestFile extends File {
  private readonly testData: Uint8Array;

  constructor(parts: BlobPart[], name: string, options?: FilePropertyBag) {
    super(parts, name, options);
    const text = parts.map((part) => typeof part === "string" ? part : "").join("");
    this.testData = new TextEncoder().encode(text);
  }

  override async arrayBuffer() {
    return this.testData.slice().buffer;
  }

  override slice(start = 0, end = this.testData.length) {
    const bytes = this.testData.slice(start, end);
    return { arrayBuffer: async () => bytes.buffer } as Blob;
  }
}

class FakeFileHandle {
  readonly kind = "file" as const;
  file: File;
  name: string;

  constructor(file: File) {
    this.file = file;
    this.name = file.name;
  }

  async getFile() {
    return this.file;
  }

  async createWritable() {
    return {
      close: async () => undefined,
      write: async (value: FileSystemWriteChunkType) => {
        const content = value instanceof File
          ? new TextDecoder().decode(await value.arrayBuffer())
          : String(value);
        this.file = new TestFile([content], this.name, { lastModified: Date.now() });
      },
    } as FileSystemWritableFileStream;
  }
}

class FakeDirectoryHandle {
  readonly kind = "directory" as const;
  readonly name: string;
  readonly children = new Map<string, FakeFileHandle | FakeDirectoryHandle>();

  constructor(name: string) {
    this.name = name;
  }

  addFile(file: File) {
    const handle = new FakeFileHandle(file);
    this.children.set(file.name, handle);
    return handle;
  }

  addDirectory(directory: FakeDirectoryHandle) {
    this.children.set(directory.name, directory);
    return directory;
  }

  async *values() {
    yield* this.children.values();
  }

  async getDirectoryHandle(name: string) {
    const handle = this.children.get(name);
    if (handle?.kind !== "directory") throw new DOMException("Not found", "NotFoundError");
    return handle as unknown as FileSystemDirectoryHandle;
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    const handle = this.children.get(name);
    if (handle?.kind === "file") return handle as unknown as FileSystemFileHandle;
    if (!options?.create) throw new DOMException("Not found", "NotFoundError");
    return this.addFile(new File([], name)) as unknown as FileSystemFileHandle;
  }
}

const asDirectoryHandle = (directory: FakeDirectoryHandle) =>
  directory as unknown as FileSystemDirectoryHandle;

const scoreFile = (name: string, content: string, lastModified = 1) =>
  new TestFile([content], name, { lastModified, type: "application/octet-stream" });

describe("user score library", () => {
  beforeEach(async () => {
    await clearStoredUserScoreLibrary();
  });

  it("requires a callable directory picker for persistent folder support", () => {
    Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: undefined });
    expect(isUserScoreLibrarySupported()).toBe(false);
    Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: async () => undefined });
    expect(isUserScoreLibrarySupported()).toBe(true);
    Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: undefined });
  });

  it("opens the system folder picker without restricting it to Music", async () => {
    const selected = { kind: "directory", name: "Any folder" } as FileSystemDirectoryHandle;
    const picker = vi.fn().mockResolvedValue(selected);
    Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: picker });

    await expect(chooseUserScoreLibraryFolder()).resolves.toBe(selected);
    expect(picker).toHaveBeenCalledWith({
      id: "melodicatrainer-score-library",
      mode: "readwrite",
    });
    expect(picker.mock.calls[0][0]).not.toHaveProperty("startIn");
  });

  it("stores and restores the local index and directory handle", async () => {
    const handle = { kind: "directory", name: "Scores" } as FileSystemDirectoryHandle;
    await saveStoredUserScoreLibrary({
      directoryHandle: handle,
      index: { entries: [], issues: [], lastScanAt: "2026-07-18T12:00:00.000Z" },
    });
    await expect(loadStoredUserScoreLibrary()).resolves.toMatchObject({
      directoryHandle: { kind: "directory", name: "Scores" },
      index: { lastScanAt: "2026-07-18T12:00:00.000Z" },
    });
  });

  it("scans subfolders, ignores unsupported files, and deduplicates exact content", async () => {
    const root = new FakeDirectoryHandle("Scores");
    const nested = root.addDirectory(new FakeDirectoryHandle("Folk"));
    root.addFile(scoreFile("Tune.gp", "same-score"));
    nested.addFile(scoreFile("Copy.gp5", "same-score"));
    nested.addFile(scoreFile("notes.txt", "not a score"));

    const result = await scanUserScoreLibrary(asDirectoryHandle(root));
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      format: "guitar-pro",
      sourceKind: "user",
    });
    expect(["Tune.gp", "Folk/Copy.gp5"]).toContain(result.entries[0].relativePath);
    expect(result.summary).toMatchObject({ added: 1, errors: 0, skipped: 2 });
  });

  it("updates changed files and removes missing paths from the index", async () => {
    const root = new FakeDirectoryHandle("Scores");
    root.addFile(scoreFile("Tune.gp", "first", 1));
    const first = await scanUserScoreLibrary(asDirectoryHandle(root));
    root.addFile(scoreFile("Tune.gp", "second", 2));
    const updated = await scanUserScoreLibrary(asDirectoryHandle(root), first);
    expect(updated.summary.updated).toBe(1);
    expect(updated.entries[0].sha256).not.toBe(first.entries[0].sha256);

    root.children.delete("Tune.gp");
    const removed = await scanUserScoreLibrary(asDirectoryHandle(root), updated);
    expect(removed.entries).toHaveLength(0);
    expect(removed.summary.removed).toBe(1);
  });

  it("copies imports, renames conflicts, and skips known hashes", async () => {
    const root = new FakeDirectoryHandle("Scores");
    root.addFile(scoreFile("Tune.gp", "existing"));
    const incoming = scoreFile("Tune.gp", "new-score");
    const first = await importUserScoreFiles(asDirectoryHandle(root), [incoming], []);
    expect(first).toMatchObject({ copied: 1, skipped: 0, errors: [] });
    expect(root.children.has("Tune (2).gp")).toBe(true);

    const scanned = await scanUserScoreLibrary(asDirectoryHandle(root));
    const imported = scanned.entries.find((entry) => entry.fileName === "Tune (2).gp") as UserScoreLibraryEntry;
    const second = await importUserScoreFiles(asDirectoryHandle(root), [incoming], [imported]);
    expect(second).toMatchObject({ copied: 0, skipped: 1, errors: [] });
  });

  it("reads a nested local score without using fetch", async () => {
    const root = new FakeDirectoryHandle("Scores");
    const nested = root.addDirectory(new FakeDirectoryHandle("MIDI"));
    const file = nested.addFile(scoreFile("Practice.gp", "score")).file;
    const entry: UserScoreLibraryEntry = {
      bytes: file.size,
      fileName: file.name,
      format: "guitar-pro",
      id: "user:test",
      lastModified: file.lastModified,
      relativePath: "MIDI/Practice.gp",
      sha256: "a".repeat(64),
      sourceKind: "user",
      title: "Practice",
    };
    await expect(getUserScoreFile(asDirectoryHandle(root), entry)).resolves.toBe(file);
  });
});

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const userLibrary = vi.hoisted(() => ({
  deleteFile: vi.fn().mockResolvedValue(undefined),
  directoryHandle: null as FileSystemDirectoryHandle | null,
  importFiles: vi.fn().mockResolvedValue({ copied: 1, errors: [], skipped: 0 }),
  index: { entries: [] as unknown[], issues: [], lastScanAt: null },
  isScanning: false,
  permission: "unsupported" as string,
  reconnect: vi.fn(),
  rescan: vi.fn().mockResolvedValue(null),
  updateMetadata: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./UserScoreLibraryContext", () => ({
  useUserScoreLibrary: () => userLibrary,
}));

import { ScoreLibraryDialog } from "./ScoreLibraryDialog";
import { filterScoreLibraryEntries } from "./scoreLibraryFilter";
import { resetScoreLibraryCatalogCacheForTests } from "./scoreLibrary";
import type { LibraryEntry, ScoreLibraryEntry } from "./scoreLibrary";
import type { UserScoreLibraryEntry } from "./userScoreLibrary";

const entry: ScoreLibraryEntry = {
  id: "folk-song",
  title: "Folk Song",
  composer: "Composer",
  arranger: "Arranger",
  format: "musicxml",
  assetPath: "assets/test/folk.mxl",
  fileName: "folk.mxl",
  bytes: 123,
  sha256: "a".repeat(64),
  difficulty: "beginner",
  tags: ["folk", "familiar"],
  source: { name: "Open Source", url: "https://example.com/source" },
  license: { kind: "CC0-1.0", url: "https://example.com/license", basis: "test" },
  rightsReviewedAt: "2026-07-17",
  sourceKind: "public",
};

const localMidiEntry: UserScoreLibraryEntry = {
  bytes: 100,
  difficulty: "beginner",
  fileName: "practice.mid",
  format: "midi",
  id: "user:bbb",
  lastModified: 1,
  relativePath: "midi/practice.mid",
  sha256: "b".repeat(64),
  sourceKind: "user",
  tags: ["practice", "custom"],
  title: "Practice MIDI",
};

const localMsczEntry: UserScoreLibraryEntry = {
  bytes: 200,
  conversionWarnings: ["Unsupported decoration was skipped."],
  fileName: "local-score.mscz",
  format: "musescore",
  id: "user:ccc",
  lastModified: 2,
  relativePath: "MuseScore/local-score.mscz",
  sha256: "c".repeat(64),
  sourceKind: "user",
  title: "Local MuseScore",
};

const rawEntry = (entry: ScoreLibraryEntry) => {
  const value: Partial<ScoreLibraryEntry> = { ...entry };
  delete value.sourceKind;
  return value;
};

const renderDialog = async (onLoadScore = vi.fn()) => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ScoreLibraryDialog isOpen onClose={vi.fn()} onLoadScore={onLoadScore} />
      </MemoryRouter>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
};

describe("ScoreLibraryDialog", () => {
  beforeEach(() => {
    localStorage.clear();
    resetScoreLibraryCatalogCacheForTests();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    userLibrary.directoryHandle = null;
    userLibrary.index = { entries: [], issues: [], lastScanAt: null };
    userLibrary.permission = "unsupported";
    userLibrary.importFiles.mockClear();
    userLibrary.deleteFile.mockClear();
    userLibrary.rescan.mockClear();
    userLibrary.updateMetadata.mockClear();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ catalogVersion: 1, entries: [rawEntry(entry)] })),
    ));
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("filters public and user entries by source, metadata, and MIDI format", () => {
    const entries: LibraryEntry[] = [entry, localMidiEntry];
    expect(filterScoreLibraryEntries(entries, { query: "arranger", difficulty: "all", favoriteIds: new Set(), format: "all", source: "all", tag: "all" })).toEqual([entry]);
    expect(filterScoreLibraryEntries(entries, { query: "", difficulty: "all", favoriteIds: new Set(), format: "midi", source: "user", tag: "all" })).toEqual([localMidiEntry]);
    expect(filterScoreLibraryEntries(entries, { query: "custom", difficulty: "beginner", favoriteIds: new Set(), format: "all", source: "user", tag: "practice" })).toEqual([localMidiEntry]);
    expect(filterScoreLibraryEntries(entries, { query: "", difficulty: "unrated", favoriteIds: new Set(), format: "all", source: "user", tag: "all" })).toEqual([]);
    expect(filterScoreLibraryEntries(entries, { query: "", difficulty: "all", favoriteIds: new Set([entry.id, localMidiEntry.id]), format: "all", source: "favorites", tag: "all" })).toEqual(entries);
  });

  it("marks scores as favourites without loading them and filters the list", async () => {
    const onLoadScore = vi.fn();
    const { container, root } = await renderDialog(onLoadScore);
    const favoriteButton = container.querySelector(
      'button[aria-label="Add Folk Song to favourites"]',
    ) as HTMLButtonElement;

    await act(async () => {
      favoriteButton.click();
      await Promise.resolve();
    });

    expect(onLoadScore).not.toHaveBeenCalled();
    expect(favoriteButton.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Favourites (1)");

    const sourceFilter = container.querySelector(
      'select[aria-label="Filter by source"]',
    ) as HTMLSelectElement;
    await act(async () => {
      sourceFilter.value = "favorites";
      sourceFilter.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain("1 of 1 scores");
    expect(container.textContent).toContain("Folk Song");
    act(() => root.unmount());
  });

  it("renders public rights metadata and the Settings setup action", async () => {
    const { container, root } = await renderDialog();
    expect(container.textContent).toContain("1 of 1 scores");
    expect(container.textContent).toContain("Source: Open Source");
    expect(container.textContent).toContain("License: CC0-1.0");
    expect(container.textContent).toContain("Set up local library");
    expect(container.querySelector('option[value="midi"]')).not.toBeNull();
    expect(container.querySelector('option[value="musescore"]')).not.toBeNull();
    act(() => root.unmount());
  });

  it("renders MSCZ local badges and conversion warnings", async () => {
    userLibrary.index = { entries: [localMsczEntry], issues: [], lastScanAt: null };
    const { container, root } = await renderDialog();
    expect(container.textContent).toContain("LOCAL · MSCZ");
    expect(container.textContent).toContain("Converted with 1 warning");
    act(() => root.unmount());
  });

  it("shows Add files only for a configured folder with permission", async () => {
    userLibrary.directoryHandle = { name: "Scores" } as FileSystemDirectoryHandle;
    userLibrary.permission = "granted";
    const { container, root } = await renderDialog();
    expect(container.textContent).toContain("Add files");
    expect(container.textContent).not.toContain("Set up local library");

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toContain(".mxl");
    expect(input.accept).toContain(".gp");
    expect(input.accept).toContain(".mid");
    expect(input.accept).toContain(".mscz");
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["score"], "score.gp")],
    });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
    expect(userLibrary.importFiles).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("1 copied, 0 skipped");
    act(() => root.unmount());
  });

  it("shows Reconnect instead of Add files when permission expires", async () => {
    userLibrary.directoryHandle = { name: "Scores" } as FileSystemDirectoryHandle;
    userLibrary.permission = "prompt";
    const { container, root } = await renderDialog();
    expect(container.textContent).toContain("Reconnect folder");
    expect(container.textContent).not.toContain("Add files");
    act(() => root.unmount());
  });

  it("edits local difficulty and tags without opening the score", async () => {
    userLibrary.directoryHandle = { name: "Scores" } as FileSystemDirectoryHandle;
    userLibrary.permission = "granted";
    userLibrary.index = { entries: [localMidiEntry], issues: [], lastScanAt: null };
    const onLoadScore = vi.fn();
    const { container, root } = await renderDialog(onLoadScore);

    await act(async () => {
      (container.querySelector('button[aria-label="Edit metadata for Practice MIDI"]') as HTMLButtonElement).click();
    });
    const difficultySelect = container.querySelector("#local-score-difficulty") as HTMLSelectElement;
    const existingTagSelect = container.querySelector('select[aria-label="Add existing tag"]') as HTMLSelectElement;
    await act(async () => {
      difficultySelect.value = "advanced";
      difficultySelect.dispatchEvent(new Event("change", { bubbles: true }));
      existingTagSelect.value = "folk";
      existingTagSelect.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
    const saveButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Save") as HTMLButtonElement;
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
    });

    expect(userLibrary.updateMetadata).toHaveBeenCalledWith(localMidiEntry.id, {
      difficulty: "advanced",
      tags: ["practice", "custom", "folk"],
    });
    expect(onLoadScore).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("requires confirmation before deleting a local file", async () => {
    userLibrary.directoryHandle = { name: "Scores" } as FileSystemDirectoryHandle;
    userLibrary.permission = "granted";
    userLibrary.index = { entries: [localMidiEntry], issues: [], lastScanAt: null };
    const { container, root } = await renderDialog();

    await act(async () => {
      (container.querySelector('button[aria-label="Delete Practice MIDI"]') as HTMLButtonElement).click();
    });
    expect(container.textContent).toContain("This action cannot be undone");
    expect(userLibrary.deleteFile).not.toHaveBeenCalled();
    const deleteButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Delete file") as HTMLButtonElement;
    await act(async () => {
      deleteButton.click();
      await Promise.resolve();
    });

    expect(userLibrary.deleteFile).toHaveBeenCalledWith(localMidiEntry);
    expect(container.textContent).toContain("Deleted practice.mid.");
    act(() => root.unmount());
  });
});

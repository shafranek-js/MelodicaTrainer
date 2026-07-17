import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScoreLibraryDialog } from "./ScoreLibraryDialog";
import { filterScoreLibraryEntries } from "./scoreLibraryFilter";
import { resetScoreLibraryCatalogCacheForTests } from "./scoreLibrary";
import type { ScoreLibraryEntry } from "./scoreLibrary";

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
};

describe("ScoreLibraryDialog", () => {
  beforeEach(() => {
    resetScoreLibraryCatalogCacheForTests();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("searches arranger and tags and applies format/difficulty filters", () => {
    const gpEntry: ScoreLibraryEntry = {
      ...entry,
      id: "gp-exercise",
      title: "Exercise",
      arranger: undefined,
      format: "guitar-pro",
      assetPath: "assets/test/exercise.gp",
      fileName: "exercise.gp",
      difficulty: "intermediate",
      tags: ["rhythm"],
    };
    expect(filterScoreLibraryEntries([entry, gpEntry], { query: "arranger", difficulty: "all", format: "all", tag: "all" })).toEqual([entry]);
    expect(filterScoreLibraryEntries([entry, gpEntry], { query: "", difficulty: "intermediate", format: "guitar-pro", tag: "rhythm" })).toEqual([gpEntry]);
  });

  it("renders result count, source, and license from the lazy catalog", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ catalogVersion: 1, entries: [entry] })),
    ));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<ScoreLibraryDialog isOpen onClose={vi.fn()} onLoadScore={vi.fn()} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("1 of 1 scores");
    expect(container.textContent).toContain("Source: Open Source");
    expect(container.textContent).toContain("License: CC0-1.0");
    act(() => root.unmount());
    container.remove();
  });
});

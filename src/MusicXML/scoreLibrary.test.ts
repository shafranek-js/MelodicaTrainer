import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getScoreLibraryAssetUrl,
  loadScoreLibraryCatalog,
  parseScoreLibraryCatalog,
  resetScoreLibraryCatalogCacheForTests,
} from "./scoreLibrary";
import type { ScoreLibraryEntry } from "./scoreLibrary";

export const testLibraryEntry: ScoreLibraryEntry = {
  id: "test-score",
  title: "Test Score",
  composer: "Test Composer",
  arranger: "Test Arranger",
  format: "musicxml",
  assetPath: "assets/test/Test_Score.mxl",
  fileName: "Test_Score.mxl",
  bytes: 5,
  sha256: "a".repeat(64),
  difficulty: "beginner",
  tags: ["test", "familiar"],
  source: { name: "Test Source", url: "https://example.com/source" },
  license: {
    kind: "CC0-1.0",
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
    basis: "test",
  },
  rightsReviewedAt: "2026-07-17",
  sourceKind: "public",
};

const rawEntry = (entry: ScoreLibraryEntry) => {
  const value: Partial<ScoreLibraryEntry> = { ...entry };
  delete value.sourceKind;
  return value;
};

describe("score library catalog", () => {
  beforeEach(() => resetScoreLibraryCatalogCacheForTests());

  it("parses public entries and rejects duplicate IDs or unsafe paths", () => {
    const raw = rawEntry(testLibraryEntry);
    expect(parseScoreLibraryCatalog({ catalogVersion: 1, entries: [raw] }).entries[0].sourceKind).toBe("public");
    expect(() => parseScoreLibraryCatalog({ catalogVersion: 1, entries: [raw, raw] })).toThrow("invalid");
    expect(() => parseScoreLibraryCatalog({ catalogVersion: 1, entries: [{ ...raw, assetPath: "../escape.mxl" }] })).toThrow("invalid");
    expect(() => parseScoreLibraryCatalog({ catalogVersion: 1, entries: [{ ...raw, assetPath: "assets/test/Test_Score.pdf" }] })).toThrow("invalid");
  });

  it("loads once and caches only a successful request", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ catalogVersion: 1, entries: [rawEntry(testLibraryEntry)] })),
    );
    const first = loadScoreLibraryCatalog(fetchImpl);
    const second = loadScoreLibraryCatalog(fetchImpl);
    expect(first).toBe(second);
    await expect(first).resolves.toMatchObject({ catalogVersion: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("/score-library/catalog.json", { cache: "no-store" });
  });

  it("allows retry after a failed request", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ catalogVersion: 1, entries: [rawEntry(testLibraryEntry)] })));
    await expect(loadScoreLibraryCatalog(fetchImpl)).rejects.toThrow("could not be loaded");
    await expect(loadScoreLibraryCatalog(fetchImpl)).resolves.toMatchObject({ catalogVersion: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("builds a public score-library asset URL", () => {
    expect(getScoreLibraryAssetUrl(testLibraryEntry)).toBe(
      `/score-library/assets/test/Test_Score.mxl?v=${"a".repeat(64)}`,
    );
  });
});

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
};

describe("score library catalog", () => {
  beforeEach(() => resetScoreLibraryCatalogCacheForTests());

  it("parses entries and rejects duplicate IDs or unsafe paths", () => {
    expect(parseScoreLibraryCatalog({ catalogVersion: 1, entries: [testLibraryEntry] }).entries).toHaveLength(1);
    expect(() => parseScoreLibraryCatalog({ catalogVersion: 1, entries: [testLibraryEntry, testLibraryEntry] })).toThrow("invalid");
    expect(() => parseScoreLibraryCatalog({ catalogVersion: 1, entries: [{ ...testLibraryEntry, assetPath: "../escape.mxl" }] })).toThrow("invalid");
    expect(() => parseScoreLibraryCatalog({ catalogVersion: 1, entries: [{ ...testLibraryEntry, assetPath: "assets/test/Test_Score.pdf" }] })).toThrow("invalid");
  });

  it("loads once and caches only a successful request", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ catalogVersion: 1, entries: [testLibraryEntry] }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const first = loadScoreLibraryCatalog(fetchImpl);
    const second = loadScoreLibraryCatalog(fetchImpl);
    expect(first).toBe(second);
    await expect(first).resolves.toMatchObject({ catalogVersion: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/score-library/catalog.json",
      { cache: "no-store" },
    );
  });

  it("allows retry after a failed request", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ catalogVersion: 1, entries: [testLibraryEntry] })));
    await expect(loadScoreLibraryCatalog(fetchImpl)).rejects.toThrow("could not be loaded");
    await expect(loadScoreLibraryCatalog(fetchImpl)).resolves.toMatchObject({ catalogVersion: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("builds a local score-library asset URL", () => {
    expect(getScoreLibraryAssetUrl(testLibraryEntry)).toBe(
      `/score-library/assets/test/Test_Score.mxl?v=${"a".repeat(64)}`,
    );
  });
});

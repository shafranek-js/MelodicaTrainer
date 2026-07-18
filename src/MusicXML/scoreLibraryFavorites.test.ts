import { describe, expect, it } from "vitest";
import {
  sanitizeFavoriteScoreIds,
  toggleFavoriteScoreId,
} from "./scoreLibraryFavorites";

describe("score library favourites", () => {
  it("sanitizes persisted IDs and removes duplicates", () => {
    expect(sanitizeFavoriteScoreIds(["folk-song", "folk-song", "user:abc", 7, ""])).toEqual([
      "folk-song",
      "user:abc",
    ]);
    expect(sanitizeFavoriteScoreIds({ id: "folk-song" })).toBeUndefined();
  });

  it("toggles an ID without mutating the existing list", () => {
    const ids = ["folk-song"];
    expect(toggleFavoriteScoreId(ids, "user:abc")).toEqual(["folk-song", "user:abc"]);
    expect(toggleFavoriteScoreId(ids, "folk-song")).toEqual([]);
    expect(ids).toEqual(["folk-song"]);
  });
});

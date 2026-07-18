import type {
  LibraryEntry,
  ScoreLibraryDifficulty,
  ScoreLibraryFormat,
} from "./scoreLibrary";

export type ScoreLibrarySourceFilter =
  | "all"
  | "public"
  | "user"
  | "favorites";

export type ScoreLibraryDifficultyFilter = ScoreLibraryDifficulty | "unrated" | "all";

export type ScoreLibraryFilters = {
  difficulty: ScoreLibraryDifficultyFilter;
  favoriteIds: ReadonlySet<string>;
  format: ScoreLibraryFormat | "all";
  query: string;
  source: ScoreLibrarySourceFilter;
  tag: string;
};

export const filterScoreLibraryEntries = (
  entries: readonly LibraryEntry[],
  filters: ScoreLibraryFilters,
) => {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase();
  return entries.filter((entry) => {
    const publicEntry = entry.sourceKind === "public" ? entry : null;
    const entryTags = entry.sourceKind === "public" ? entry.tags : entry.tags ?? [];
    const entryDifficulty = entry.difficulty;
    const matchesSource =
      filters.source === "all" ||
      (filters.source === "favorites"
        ? filters.favoriteIds.has(entry.id)
        : entry.sourceKind === filters.source);
    const matchesQuery =
      !normalizedQuery ||
      [
        entry.title,
        entry.composer ?? "",
        publicEntry?.arranger ?? "",
        entryTags.join(" "),
        entry.fileName,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    return (
      matchesQuery &&
      matchesSource &&
      (filters.difficulty === "all" ||
        (filters.difficulty === "unrated"
          ? entryDifficulty === undefined
          : entryDifficulty === filters.difficulty)) &&
      (filters.format === "all" || entry.format === filters.format) &&
      (filters.tag === "all" || entryTags.includes(filters.tag))
    );
  });
};

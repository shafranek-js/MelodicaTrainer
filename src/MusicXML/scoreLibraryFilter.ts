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

export type ScoreLibraryFilters = {
  difficulty: ScoreLibraryDifficulty | "all";
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
        publicEntry?.tags.join(" ") ?? "",
        entry.fileName,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    return (
      matchesQuery &&
      matchesSource &&
      (filters.difficulty === "all" || publicEntry?.difficulty === filters.difficulty) &&
      (filters.format === "all" || entry.format === filters.format) &&
      (filters.tag === "all" || publicEntry?.tags.includes(filters.tag) === true)
    );
  });
};

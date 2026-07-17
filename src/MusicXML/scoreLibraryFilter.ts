import type {
  ScoreLibraryDifficulty,
  ScoreLibraryEntry,
  ScoreLibraryFormat,
} from "./scoreLibrary";

export type ScoreLibraryFilters = {
  difficulty: ScoreLibraryDifficulty | "all";
  format: ScoreLibraryFormat | "all";
  query: string;
  tag: string;
};

export const filterScoreLibraryEntries = (
  entries: readonly ScoreLibraryEntry[],
  filters: ScoreLibraryFilters,
) => {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase();
  return entries.filter((entry) => {
    const matchesQuery =
      !normalizedQuery ||
      [entry.title, entry.composer, entry.arranger ?? "", ...entry.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    return (
      matchesQuery &&
      (filters.difficulty === "all" || entry.difficulty === filters.difficulty) &&
      (filters.format === "all" || entry.format === filters.format) &&
      (filters.tag === "all" || entry.tags.includes(filters.tag))
    );
  });
};

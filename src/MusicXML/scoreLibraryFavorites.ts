export const FAVORITE_SCORE_IDS_STORAGE_KEY =
  "melodicatrainer_favorite_score_ids";

export const sanitizeFavoriteScoreIds = (
  value: unknown,
): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const ids = value.filter(
    (id): id is string => typeof id === "string" && id.trim().length > 0,
  );

  return [...new Set(ids)];
};

export const toggleFavoriteScoreId = (
  ids: readonly string[],
  id: string,
): string[] =>
  ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];

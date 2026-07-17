export type ScoreFormat = "musicxml" | "guitar-pro" | "midi";

export const getScoreFormat = (fileName: string | null): ScoreFormat | null => {
  if (!fileName) return null;
  if (/\.(gp|gp3|gp4|gp5|gpx)$/i.test(fileName)) return "guitar-pro";
  if (/\.(mid|midi)$/i.test(fileName)) return "midi";
  if (/\.(xml|musicxml|mxl)$/i.test(fileName)) return "musicxml";
  return null;
};

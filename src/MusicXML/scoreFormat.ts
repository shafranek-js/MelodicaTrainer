export type ScoreFormat = "musicxml" | "guitar-pro" | "midi";
export type ScoreFileFormat = ScoreFormat | "musescore";

export const getScoreFileFormat = (fileName: string | null): ScoreFileFormat | null => {
  if (!fileName) return null;
  if (/\.(gp|gp3|gp4|gp5|gpx)$/i.test(fileName)) return "guitar-pro";
  if (/\.(mid|midi)$/i.test(fileName)) return "midi";
  if (/\.mscz$/i.test(fileName)) return "musescore";
  if (/\.(xml|musicxml|mxl)$/i.test(fileName)) return "musicxml";
  return null;
};

export const getScoreFormat = (fileName: string | null): ScoreFormat | null => {
  const fileFormat = getScoreFileFormat(fileName);
  return fileFormat === "musescore" ? "musicxml" : fileFormat;
};

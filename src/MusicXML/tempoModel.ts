export const DEFAULT_TEMPO_BPM = 90;
export const MIN_TEMPO_BPM = 20;
export const MAX_TEMPO_BPM = 300;

export type TempoState = {
  detectedTempoBpm: number;
  userTempoBpm: number | null;
};

export const clampTempoBpm = (tempoBpm: number) =>
  Math.min(MAX_TEMPO_BPM, Math.max(MIN_TEMPO_BPM, tempoBpm));

export const sanitizeNullableTempo = (value: unknown): number | null | undefined => {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return clampTempoBpm(value);
};

export const getEffectiveTempoBpm = ({
  detectedTempoBpm,
  userTempoBpm,
}: TempoState) => userTempoBpm ?? detectedTempoBpm;

export const getResetTempoState = (): TempoState => ({
  detectedTempoBpm: DEFAULT_TEMPO_BPM,
  userTempoBpm: null,
});

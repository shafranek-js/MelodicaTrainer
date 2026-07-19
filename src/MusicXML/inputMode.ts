export type InputMode = "auto" | "mic" | "midi";
export type EffectiveInputSource = "mic" | "midi";

export const sanitizeInputMode = (value: unknown): InputMode | undefined =>
  value === "auto" || value === "mic" || value === "midi" ? value : undefined;

export const resolveEffectiveInputSource = (
  inputMode: InputMode,
  connectedMidiInputCount: number,
): EffectiveInputSource => {
  if (inputMode === "mic") return "mic";
  if (inputMode === "midi") return "midi";
  return connectedMidiInputCount > 0 ? "midi" : "mic";
};

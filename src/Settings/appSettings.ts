import type { MelodicaKeyCount } from "../utils/utils";
import { normalizeMelodicaKeyCount } from "../utils/utils";

export const SOUND_FONT_OPTIONS = [
  { label: "Melodica", value: "melodica.sf2" },
  { label: "General MIDI Reed", value: "MS_Basic.sf3" },
  { label: "Florestan Harmonica", value: "022_Florestan_Harmonica.sf2" },
  { label: "Harmonica Essentials", value: "Harmonica_Essentials.sf2" },
  { label: "Monsoons Hohner C", value: "Monsoons Hohner C Harmonica.sf2" },
  { label: "Sonivox", value: "soundfont/sonivox.sf2" },
] as const;

export const sanitizeSoundFont = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  return SOUND_FONT_OPTIONS.some((soundFont) => soundFont.value === value)
    ? value
    : "melodica.sf2";
};

export const sanitizeMelodicaKeyCount = (
  value: unknown,
): MelodicaKeyCount | undefined => {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  return normalizeMelodicaKeyCount(value);
};

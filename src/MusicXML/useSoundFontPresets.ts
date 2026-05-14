import { useEffect, useState } from "react";
import type { MutableRefObject } from "react";
import {
  changeInstrument,
  ensureAudioContext,
  getAvailablePresets,
  initSynthesizer,
} from "./audioPlayback";
import type { SoundFontPreset } from "./audioPlayback";

type PresetSelection = {
  bank: number;
  program: number;
};

type UseSoundFontPresetsOptions = {
  audioContextRef: MutableRefObject<AudioContext | null>;
  selectedPreset: string;
  selectedSoundFont: string;
};

export const parsePresetSelection = (
  selectedPreset: string
): PresetSelection | null => {
  const [bank, program] = selectedPreset.split(":").map(Number);

  if (!Number.isFinite(bank) || !Number.isFinite(program)) {
    return null;
  }

  return { bank, program };
};

export const useSoundFontPresets = ({
  audioContextRef,
  selectedPreset,
  selectedSoundFont,
}: UseSoundFontPresetsOptions) => {
  const [availablePresets, setAvailablePresets] = useState<SoundFontPreset[]>(
    []
  );

  useEffect(() => {
    if (availablePresets.length === 0) return;

    const preset = parsePresetSelection(selectedPreset);
    if (!preset) return;

    changeInstrument(preset.program, preset.bank);
  }, [availablePresets, selectedPreset]);

  useEffect(() => {
    let isActive = true;
    const audioContext = ensureAudioContext(audioContextRef.current);
    audioContextRef.current = audioContext;

    initSynthesizer(audioContext, selectedSoundFont)
      .then(() => {
        if (!isActive) return;
        setAvailablePresets(getAvailablePresets());
      })
      .catch((err: unknown) => {
        if (!isActive) return;
        console.error("Failed to pre-load soundfont:", err);
      });

    return () => {
      isActive = false;
    };
  }, [audioContextRef, selectedSoundFont]);

  return availablePresets;
};

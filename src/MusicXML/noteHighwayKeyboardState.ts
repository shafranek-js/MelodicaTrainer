import { Note } from "tonal";
import { getCandyNoteColor } from "../utils/utils";

export type PlaybackAttack = {
  midiNumbers: readonly number[];
  sequence: number;
};

export const getKeyboardOverlayKeyState = (
  midi: number,
  activeKeyboardMidi: ReadonlyMap<number, string>,
  userActiveMidi?: ReadonlySet<number>,
  playbackAttack?: PlaybackAttack,
) => {
  const isUserActive = userActiveMidi?.has(midi) ?? false;
  const playbackPulseId = playbackAttack?.midiNumbers.includes(midi)
    ? playbackAttack.sequence
    : undefined;
  return {
    activeColor: isUserActive
      ? getCandyNoteColor(Note.fromMidi(midi)).shell
      : activeKeyboardMidi.get(midi),
    isActive: activeKeyboardMidi.has(midi) || isUserActive,
    isTarget: false,
    targetColor: undefined,
    ...(playbackPulseId === undefined ? {} : { playbackPulseId }),
  };
};

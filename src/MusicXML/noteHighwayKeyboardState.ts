import { Note } from "tonal";
import { getSuzukiNoteColor } from "../utils/utils";

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
  const isTarget = activeKeyboardMidi.has(midi);
  const isUserActive = userActiveMidi?.has(midi) ?? false;
  const playbackPulseId = playbackAttack?.midiNumbers.includes(midi)
    ? playbackAttack.sequence
    : undefined;
  return {
    activeColor: isUserActive
      ? getSuzukiNoteColor(Note.fromMidi(midi))
      : activeKeyboardMidi.get(midi),
    isActive: isTarget || isUserActive,
    isTarget,
    targetColor: activeKeyboardMidi.get(midi),
    ...(playbackPulseId === undefined ? {} : { playbackPulseId }),
  };
};

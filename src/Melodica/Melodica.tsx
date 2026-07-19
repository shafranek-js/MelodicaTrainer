import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useInteractiveSynth } from "../hooks/useInteractiveSynth";
import { useMidiInput } from "../hooks/useMidiInput";
import { usePitchDetector } from "../hooks/usePitchDetector";
import { useAppSettings } from "../Settings/AppSettingsContext";
import {
  generateMelodicaLayout,
  getMelodicaMidiNumbers,
} from "../utils/utils";
import {
  MelodicaHeaderPanel,
  MelodicaKeyboardPanel,
  MelodicaListeningPanel,
} from "./MelodicaPanels";
import { useMelodicaViewModel } from "./useMelodicaViewModel";

function Melodica() {
  const { t } = useTranslation();
  const { melodicaRange: keyCount, soundFont } = useAppSettings();
  const [isListening, setIsListening] = useState(false);
  const [activePressedNotes, setActivePressedNotes] = useState<Set<number>>(new Set());

  const layout = useMemo(() => generateMelodicaLayout(keyCount), [keyCount]);
  const allowedMidiNumbers = useMemo(
    () => new Set(getMelodicaMidiNumbers(layout)),
    [layout]
  );
  const {
    error: synthError,
    noteOff: stopInteractiveNote,
    noteOn: startInteractiveNote,
  } = useInteractiveSynth({ soundFont });

  const handleVirtualNoteOn = useCallback((midi: number) => {
    setActivePressedNotes((prev) => {
      const next = new Set(prev);
      next.add(midi);
      return next;
    });
    startInteractiveNote(midi);
  }, [startInteractiveNote]);

  const handleVirtualNoteOff = useCallback((midi: number) => {
    setActivePressedNotes((prev) => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
    stopInteractiveNote(midi);
  }, [stopInteractiveNote]);

  const midiInput = useMidiInput({
    onNoteOff: stopInteractiveNote,
    onNoteOn: startInteractiveNote,
  });

  const { pitch, clarity, error } = usePitchDetector(0.82, isListening, {
    allowedMidiNumbers,
    minRms: 0.015,
    stableFrames: 4,
  });

  const { detectedMidi, detectedNote, keyboardRangeLabel, rangeSummary } =
    useMelodicaViewModel({ layout, pitch });

  const userActiveMidi = useMemo(() => {
    const active = new Set(midiInput.activeNotes);
    activePressedNotes.forEach((midi) => active.add(midi));
    return active;
  }, [midiInput.activeNotes, activePressedNotes]);

  return (
    <div className="flex min-h-full flex-col bg-gray-950 p-4 text-white sm:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
        <MelodicaHeaderPanel
          rangeSummary={rangeSummary}
        />

        <section className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <MelodicaListeningPanel
            clarity={clarity}
            detectedNote={detectedNote}
            error={synthError ?? error}
            isListening={isListening}
            onListeningToggle={() => setIsListening((value) => !value)}
            pitch={pitch}
          />
          <MelodicaKeyboardPanel
            detectedMidi={detectedMidi}
            detectedNote={detectedNote}
            keyboardRangeLabel={keyboardRangeLabel}
            layout={layout}
            t={t}
            onNoteOn={handleVirtualNoteOn}
            onNoteOff={handleVirtualNoteOff}
            userActiveMidi={userActiveMidi}
          />
        </section>
      </div>
    </div>
  );
}

export default Melodica;

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Note } from "tonal";
import { usePitchDetector } from "../hooks/usePitchDetector";
import {
  freqToNoteAndCents,
  generateMelodicaLayout,
  getMelodicaMidiNumbers,
} from "../utils/utils";
import type { MelodicaKeyCount } from "../utils/utils";
import {
  BluesPanel,
  ListeningPanel,
  PracticeControlsPanel,
  PracticeKeyboardPanel,
  TargetPanel,
} from "./PracticePanels";
import type { PracticeScaleValue } from "./practiceTargets";
import { usePracticeViewModel } from "./usePracticeViewModel";
import type { TrainerMode } from "./usePracticeViewModel";

function Practice() {
  const { t } = useTranslation();
  const [keyCount, setKeyCount] = useState<MelodicaKeyCount>(32);
  const [tonic, setTonic] = useState("C");
  const [scaleValue, setScaleValue] = useState<PracticeScaleValue>("blues");
  const [trainerMode, setTrainerMode] = useState<TrainerMode>("explore");
  const [targetIndex, setTargetIndex] = useState(0);
  const [barIndex, setBarIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);

  const layout = useMemo(() => generateMelodicaLayout(keyCount), [keyCount]);
  const allowedMidiNumbers = useMemo(
    () => new Set(getMelodicaMidiNumbers(layout)),
    [layout]
  );
  const { pitch, clarity, error } = usePitchDetector(0.82, isListening, {
    allowedMidiNumbers,
    minRms: 0.015,
    stableFrames: 4,
  });
  const detectedNote = useMemo(
    () => (pitch ? freqToNoteAndCents(Number(pitch)) : null),
    [pitch]
  );
  const detectedMidi = detectedNote ? Note.midi(detectedNote.note) : null;
  const {
    activePitchClasses,
    activeTarget,
    bluesPitchClasses,
    chordPitchClasses,
    currentBluesNotes,
    currentBluesRoot,
    isTargetHit,
    scale,
    scaleLabel,
    targets,
  } = usePracticeViewModel({
    barIndex,
    detectedMidi,
    detectedNote,
    layout,
    scaleValue,
    targetIndex,
    tonic,
    trainerMode,
  });

  const nextTarget = () => {
    if (!targets.length) return;
    setTargetIndex((index) => {
      if (trainerMode === "scale") return (index + 1) % targets.length;
      if (targets.length === 1) return 0;

      const nextIndex = Math.floor(Math.random() * targets.length);
      return nextIndex === index ? (index + 1) % targets.length : nextIndex;
    });
  };

  return (
    <div className="min-h-full bg-gray-950 p-4 text-white sm:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Practice Trainer</h1>
          <p className="mt-1 text-sm text-gray-400">
            {layout.startNote}-{layout.endNote} · {t(tonic)} {scaleLabel}
          </p>
        </div>

        <PracticeControlsPanel
          keyCount={keyCount}
          onKeyCountChange={(value) => {
            setKeyCount(value);
            setTargetIndex(0);
          }}
          onScaleValueChange={(value) => {
            setScaleValue(value);
            setTargetIndex(0);
          }}
          onTonicChange={(value) => {
            setTonic(value);
            setTargetIndex(0);
          }}
          onTrainerModeChange={(value) => {
            setTrainerMode(value);
            setTargetIndex(0);
          }}
          scaleValue={scaleValue}
          t={t}
          tonic={tonic}
          trainerMode={trainerMode}
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <PracticeKeyboardPanel
            activePitchClasses={activePitchClasses}
            activeTarget={activeTarget}
            bluesPitchClasses={bluesPitchClasses}
            chordPitchClasses={chordPitchClasses}
            detectedMidi={detectedMidi}
            detectedNote={detectedNote}
            layout={layout}
            scale={scale}
            t={t}
            trainerMode={trainerMode}
          />

          <aside className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            {trainerMode === "blues" ? (
              <BluesPanel
                barIndex={barIndex}
                currentBluesNotes={currentBluesNotes}
                currentBluesRoot={currentBluesRoot}
                onBarIndexChange={setBarIndex}
                t={t}
              />
            ) : (
              <TargetPanel
                activeTarget={activeTarget}
                isTargetHit={isTargetHit}
                onNextTarget={nextTarget}
                t={t}
                targetsLength={targets.length}
                trainerMode={trainerMode}
              />
            )}

            <ListeningPanel
              clarity={clarity}
              detectedNote={detectedNote}
              error={error}
              isListening={isListening}
              onListeningToggle={() => setIsListening((value) => !value)}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

export default Practice;

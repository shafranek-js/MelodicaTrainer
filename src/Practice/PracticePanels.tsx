import { Note } from "tonal";
import type { TFunction } from "i18next";
import { MelodicaKeyboard } from "../Melodica/MelodicaKeyboard";
import {
  getSuzukiNoteColor,
} from "../utils/utils";
import type { MelodicaLayout } from "../utils/utils";
import { bluesBars, scaleOptions, tonicOptions } from "./practiceTargets";
import type { PracticeScaleValue, PracticeTarget } from "./practiceTargets";
import { trainerModes } from "./usePracticeViewModel";
import type { TrainerMode } from "./usePracticeViewModel";

type DetectedNote = {
  cents: number;
  note: string;
} | null;

type PracticeControlsPanelProps = {
  onScaleValueChange: (scaleValue: PracticeScaleValue) => void;
  onTonicChange: (tonic: string) => void;
  onTrainerModeChange: (mode: TrainerMode) => void;
  scaleValue: PracticeScaleValue;
  t: TFunction;
  tonic: string;
  trainerMode: TrainerMode;
};

export const PracticeControlsPanel = ({
  onScaleValueChange,
  onTonicChange,
  onTrainerModeChange,
  scaleValue,
  t,
  tonic,
  trainerMode,
}: PracticeControlsPanelProps) => (
  <div className="grid gap-3 rounded-lg border border-gray-800 bg-gray-900 p-4 lg:grid-cols-3">
    <label className="text-sm text-gray-300">
      Tonic
      <select
        value={tonic}
        onChange={(event) => onTonicChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
      >
        {tonicOptions.map((option) => (
          <option key={option} value={option}>
            {t(option)}
          </option>
        ))}
      </select>
    </label>

    <label className="text-sm text-gray-300">
      Scale
      <select
        value={scaleValue}
        onChange={(event) =>
          onScaleValueChange(event.target.value as PracticeScaleValue)
        }
        className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
      >
        {scaleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>

    <div className="flex flex-wrap items-end gap-2">
      {trainerModes.map((mode) => (
        <button
          key={mode.value}
          type="button"
          onClick={() => onTrainerModeChange(mode.value)}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            trainerMode === mode.value
              ? "bg-emerald-400 text-black"
              : "bg-gray-800 text-white hover:bg-gray-700"
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  </div>
);

type PracticeKeyboardPanelProps = {
  activePitchClasses: Set<number>;
  activeTarget?: PracticeTarget;
  bluesPitchClasses: Set<number>;
  chordPitchClasses: Set<number>;
  detectedMidi: number | null;
  detectedNote: DetectedNote;
  layout: MelodicaLayout;
  scale: string[];
  t: TFunction;
  trainerMode: TrainerMode;
};

export const PracticeKeyboardPanel = ({
  activePitchClasses,
  activeTarget,
  bluesPitchClasses,
  chordPitchClasses,
  detectedMidi,
  detectedNote,
  layout,
  scale,
  t,
  trainerMode,
}: PracticeKeyboardPanelProps) => (
  <div className="min-w-0 overflow-x-auto rounded-lg border border-gray-800 bg-gray-900 p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-black uppercase tracking-widest text-gray-300">
        Keyboard
      </h2>
      <div className="text-xs text-gray-500">
        {scale.map((note) => t(note)).join(" ")}
      </div>
    </div>
    <MelodicaKeyboard
      formatPitchClass={t}
      getKeyState={(key) => {
        const chroma = Note.chroma(key.name);
        const isScaleTone = activePitchClasses.has(chroma);
        const isChordTone =
          trainerMode === "chords" && chordPitchClasses.has(chroma);
        const isBluesTone =
          trainerMode === "blues" && bluesPitchClasses.has(chroma);
        const isDetected = detectedMidi === key.midi;

        return {
          activeColor: getSuzukiNoteColor(key.name),
          isActive: isDetected,
          isMuted: !isScaleTone && !isChordTone && !isBluesTone,
          isPrimary: isScaleTone,
          isSecondary: isChordTone || isBluesTone,
          isTarget: activeTarget?.midi === key.midi,
          tuningCents: isDetected ? detectedNote?.cents : null,
        };
      }}
      heightClassName="h-44 sm:h-52"
      layout={layout}
    />
  </div>
);

type BluesPanelProps = {
  barIndex: number;
  currentBluesNotes: string[];
  currentBluesRoot: string;
  onBarIndexChange: (barIndex: number) => void;
  t: TFunction;
};

export const BluesPanel = ({
  barIndex,
  currentBluesNotes,
  currentBluesRoot,
  onBarIndexChange,
  t,
}: BluesPanelProps) => (
  <>
    <h2 className="text-lg font-bold">12-bar blues</h2>
    <div className="mt-3 grid grid-cols-4 gap-2">
      {bluesBars.map((degree, index) => (
        <button
          key={`${degree}-${index}`}
          type="button"
          onClick={() => onBarIndexChange(index)}
          className={`rounded-lg px-2 py-2 text-sm font-semibold ${
            barIndex === index
              ? "bg-cyan-400 text-black"
              : "bg-gray-800 text-white hover:bg-gray-700"
          }`}
        >
          {index + 1}. {degree}
        </button>
      ))}
    </div>
    <p className="mt-4 text-sm text-gray-300">
      Bar {barIndex + 1}: {t(currentBluesRoot)}7 ·{" "}
      {currentBluesNotes.map((note) => t(Note.pitchClass(note))).join(" ")}
    </p>
  </>
);

type TargetPanelProps = {
  activeTarget?: PracticeTarget;
  isTargetHit: boolean;
  onNextTarget: () => void;
  t: TFunction;
  targetsLength: number;
  trainerMode: TrainerMode;
};

export const TargetPanel = ({
  activeTarget,
  isTargetHit,
  onNextTarget,
  t,
  targetsLength,
  trainerMode,
}: TargetPanelProps) => (
  <>
    <h2 className="text-lg font-bold">
      {trainerMode === "chords" ? "Chord tones" : "Note practice"}
    </h2>
    {activeTarget ? (
      <div className="mt-4 rounded-lg bg-gray-800 p-4 text-center">
        <div className="text-sm text-gray-400">{activeTarget.label}</div>
        <div className="mt-1 text-4xl font-bold">
          {t(Note.pitchClass(activeTarget.noteName))}
        </div>
        <div className="mt-1 text-sm text-gray-400">
          {activeTarget.noteName}
        </div>
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
            isTargetHit
              ? "bg-green-500 text-black"
              : "bg-gray-700 text-gray-300"
          }`}
        >
          {isTargetHit ? "Hit" : "Waiting"}
        </div>
      </div>
    ) : (
      <p className="mt-3 text-sm text-gray-400">No targets.</p>
    )}

    <button
      type="button"
      onClick={onNextTarget}
      disabled={!targetsLength}
      className="mt-3 w-full rounded-lg bg-cyan-700 px-4 py-2 font-semibold text-white transition hover:bg-cyan-600 disabled:bg-gray-700 disabled:text-gray-400"
    >
      Next target
    </button>
  </>
);

type ListeningPanelProps = {
  clarity: string | null;
  detectedNote: DetectedNote;
  error: string | null;
  isListening: boolean;
  onListeningToggle: () => void;
};

export const ListeningPanel = ({
  clarity,
  detectedNote,
  error,
  isListening,
  onListeningToggle,
}: ListeningPanelProps) => (
  <div className="mt-5 border-t border-gray-800 pt-4">
    <button
      type="button"
      onClick={onListeningToggle}
      className="w-full rounded-lg bg-green-600 px-4 py-2 font-semibold text-white transition hover:bg-green-700"
    >
      {isListening ? "Stop listening" : "Start listening"}
    </button>

    {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    {detectedNote && (
      <p className="mt-3 text-sm text-gray-300">
        {detectedNote.note} · {detectedNote.cents.toFixed(1)} cents · {clarity}
      </p>
    )}
  </div>
);

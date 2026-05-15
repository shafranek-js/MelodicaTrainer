import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Chord, Note } from "tonal";
import { usePitchDetector } from "../hooks/usePitchDetector";
import {
  freqToNoteAndCents,
  generateMelodicaLayout,
  getMelodicaMidiNumbers,
  getSuzukiNoteColor,
  melodicaRangeOptions,
} from "../utils/utils";
import type { MelodicaKeyCount } from "../utils/utils";
import { MelodicaKeyboard } from "../Melodica/MelodicaKeyboard";
import {
  bluesBars,
  getLayoutTargets,
  getPitchClassSet,
  getPracticeTargets,
  scaleOptions,
  tonicOptions,
} from "./practiceTargets";
import type { PracticeScaleValue } from "./practiceTargets";

const trainerModes = [
  { label: "Explore", value: "explore" },
  { label: "Notes", value: "practice" },
  { label: "Scale", value: "scale" },
  { label: "Chord tones", value: "chords" },
  { label: "12-bar", value: "blues" },
] as const;

type TrainerMode = (typeof trainerModes)[number]["value"];

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
  const { scale, scaleLabel, activePitchClasses, practiceTargets } = useMemo(
    () => getPracticeTargets({ layout, tonic, scaleValue }),
    [layout, scaleValue, tonic]
  );

  const bluesRoots = useMemo(
    () => ({
      I: tonic,
      IV: Note.transpose(tonic, "4P"),
      V: Note.transpose(tonic, "5P"),
    }),
    [tonic]
  );
  const currentBluesRoot = bluesRoots[bluesBars[barIndex] as keyof typeof bluesRoots];
  const currentBluesNotes = Chord.get(`${currentBluesRoot}7`).notes;
  const chordNotes = Chord.get(`${tonic}maj7`).notes;
  const chordPitchClasses = useMemo(() => getPitchClassSet(chordNotes), [chordNotes]);
  const bluesPitchClasses = useMemo(
    () => getPitchClassSet(currentBluesNotes),
    [currentBluesNotes]
  );
  const chordTargets = useMemo(
    () => getLayoutTargets(layout, chordPitchClasses),
    [chordPitchClasses, layout]
  );

  const targets = trainerMode === "chords" ? chordTargets : practiceTargets;
  const target = targets[targetIndex % Math.max(targets.length, 1)];
  const activeTarget =
    trainerMode === "practice" || trainerMode === "scale" || trainerMode === "chords"
      ? target
      : undefined;

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
  const isTargetHit = Boolean(
    activeTarget &&
      detectedMidi === activeTarget.midi &&
      Math.abs(detectedNote?.cents ?? 99) <= 25
  );

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

        <div className="grid gap-3 rounded-lg border border-gray-800 bg-gray-900 p-4 lg:grid-cols-4">
          <label className="text-sm text-gray-300">
            Melodica range
            <select
              value={keyCount}
              onChange={(event) => {
                setKeyCount(Number(event.target.value) as MelodicaKeyCount);
                setTargetIndex(0);
              }}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
            >
              {melodicaRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.startNote}-{option.endNote})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-300">
            Tonic
            <select
              value={tonic}
              onChange={(event) => {
                setTonic(event.target.value);
                setTargetIndex(0);
              }}
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
              onChange={(event) => {
                setScaleValue(event.target.value as PracticeScaleValue);
                setTargetIndex(0);
              }}
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
                onClick={() => {
                  setTrainerMode(mode.value);
                  setTargetIndex(0);
                }}
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

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
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
                const isChordTone = trainerMode === "chords" && chordPitchClasses.has(chroma);
                const isBluesTone = trainerMode === "blues" && bluesPitchClasses.has(chroma);
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

          <aside className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            {trainerMode === "blues" ? (
              <>
                <h2 className="text-lg font-bold">12-bar blues</h2>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {bluesBars.map((degree, index) => (
                    <button
                      key={`${degree}-${index}`}
                      type="button"
                      onClick={() => setBarIndex(index)}
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
            ) : (
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
                  onClick={nextTarget}
                  disabled={!targets.length}
                  className="mt-3 w-full rounded-lg bg-cyan-700 px-4 py-2 font-semibold text-white transition hover:bg-cyan-600 disabled:bg-gray-700 disabled:text-gray-400"
                >
                  Next target
                </button>
              </>
            )}

            <div className="mt-5 border-t border-gray-800 pt-4">
              <button
                type="button"
                onClick={() => setIsListening((value) => !value)}
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
          </aside>
        </div>
      </div>
    </div>
  );
}

export default Practice;

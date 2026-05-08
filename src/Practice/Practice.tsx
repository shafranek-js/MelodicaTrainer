import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Chord, Note, Scale } from "tonal";
import { usePitchDetector } from "../hooks/usePitchDetector";
import {
  freqToNoteAndCents,
  generateLayout,
  getLayoutMidiNumbers,
  harmonicaKeys,
} from "../utils/utils";
import type { TonalNote } from "../utils/utils";

const positionOptions = [
  { label: "1st", name: "Ionian", degree: 1 },
  { label: "2nd", name: "Mixolydian", degree: 5 },
  { label: "3rd", name: "Dorian", degree: 2 },
  { label: "4th", name: "Aeolian", degree: 6 },
  { label: "5th", name: "Phrygian", degree: 3 },
  { label: "12th", name: "Lydian", degree: 4 },
];

const scaleOptions = [
  { label: "Position mode", value: "mode" },
  { label: "Major", value: "major" },
  { label: "Major pentatonic", value: "major pentatonic" },
  { label: "Minor pentatonic", value: "minor pentatonic" },
  { label: "Blues", value: "blues" },
  { label: "Major blues", value: "major blues" },
];

const trainerModes = [
  { label: "Explore", value: "explore" },
  { label: "Practice", value: "practice" },
  { label: "Bends", value: "bends" },
  { label: "12-bar", value: "blues" },
];

const layoutRows = [
  { key: "wholeStepBlowBend", label: "Blow bend", color: "bg-purple-800" },
  { key: "HalfStepBlowBend", label: "Blow bend", color: "bg-indigo-800" },
  { key: "blow", label: "Blow", color: "bg-blue-700" },
  { key: "draw", label: "Draw", color: "bg-red-700" },
  {
    key: "halfStepDrawBendOverdraw",
    label: "Draw bend",
    color: "bg-pink-800",
  },
  { key: "wholeStepDrawBend", label: "Draw bend", color: "bg-rose-800" },
  { key: "oneAndHalfStepDrawBend", label: "Draw bend", color: "bg-amber-800" },
] as const;

const bluesBars = ["I", "I", "I", "I", "IV", "IV", "I", "I", "V", "IV", "I", "V"];

type TrainerMode = (typeof trainerModes)[number]["value"];
type Layout = ReturnType<typeof generateLayout>;
type LayoutRowKey = keyof Layout;
const pitchClassSet = (notes: string[]) =>
  new Set(notes.map((note) => Note.chroma(note)).filter((chroma) => chroma >= 0));

const getLayoutTargets = (
  layout: Layout,
  activePitchClasses: Set<number>,
  includeOnlyBends = false
) =>
  layoutRows.flatMap(({ key, label }) =>
    layout[key as LayoutRowKey].flatMap((note, index) => {
      if (!note) return [];

      const midi = Note.midi(note.name);
      const chroma = Note.chroma(note.name);
      const isBend = label.includes("bend");

      if (midi === null || !activePitchClasses.has(chroma)) return [];
      if (includeOnlyBends && !isBend) return [];

      return [
        {
          label: `${label} ${index + 1}`,
          midi,
          noteName: note.name,
          row: label,
        },
      ];
    })
  );

function Practice() {
  const { t } = useTranslation();
  const [key, setKey] = useState("C4");
  const [positionIndex, setPositionIndex] = useState(1);
  const [scaleValue, setScaleValue] = useState("blues");
  const [trainerMode, setTrainerMode] = useState<TrainerMode>("explore");
  const [targetIndex, setTargetIndex] = useState(0);
  const [barIndex, setBarIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);

  const layout = useMemo(() => generateLayout(key), [key]);
  const keyScale = useMemo(() => Scale.get(`${Note.pitchClass(key)} major`).notes, [key]);
  const position = positionOptions[positionIndex];
  const tonic = keyScale[position.degree - 1];
  const modeScale = [...keyScale.slice(position.degree - 1), ...keyScale.slice(0, position.degree - 1)];
  const scale =
    scaleValue === "mode" ? modeScale : Scale.get(`${tonic} ${scaleValue}`).notes;

  const bluesRoots = useMemo(
    () => ({
      I: tonic,
      IV: Note.transpose(tonic, "4P"),
      V: Note.transpose(tonic, "5P"),
    }),
    [tonic]
  );
  const currentBluesRoot = bluesRoots[bluesBars[barIndex] as keyof typeof bluesRoots];
  const currentChordNotes = Chord.get(`${currentBluesRoot}7`).notes;

  const activePitchClasses = useMemo(() => pitchClassSet(scale), [scale]);
  const chordPitchClasses = useMemo(
    () => pitchClassSet(currentChordNotes),
    [currentChordNotes]
  );
  const practiceTargets = useMemo(
    () => getLayoutTargets(layout, activePitchClasses),
    [activePitchClasses, layout]
  );
  const bendTargets = useMemo(
    () => getLayoutTargets(layout, activePitchClasses, true),
    [activePitchClasses, layout]
  );
  const targets = trainerMode === "bends" ? bendTargets : practiceTargets;
  const target = targets[targetIndex % Math.max(targets.length, 1)];
  const activeTarget =
    trainerMode === "practice" || trainerMode === "bends" ? target : undefined;

  const allowedMidiNumbers = useMemo(() => {
    return new Set(getLayoutMidiNumbers(layout));
  }, [layout]);

  const { pitch, clarity, error } = usePitchDetector(0.82, isListening, {
    allowedMidiNumbers,
    minRms: 0.015,
    stableFrames: 4,
  });
  const detectedNote = useMemo(() => {
    if (!pitch) return null;
    return freqToNoteAndCents(Number(pitch));
  }, [pitch]);
  const detectedMidi = detectedNote ? Note.midi(detectedNote.note) : null;
  const isTargetHit =
    Boolean(activeTarget && detectedMidi === activeTarget.midi && Math.abs(detectedNote?.cents ?? 99) <= 25);

  const nextTarget = () => {
    if (!targets.length) return;
    setTargetIndex((index) => {
      if (targets.length === 1) return 0;

      const nextIndex = Math.floor(Math.random() * targets.length);
      return nextIndex === index ? (index + 1) % targets.length : nextIndex;
    });
  };

  const renderLine = (offsetY: number) => {
    const clampedOffset = Math.max(-8, Math.min(8, offsetY));
    return (
      <div
        className="absolute left-0 right-0 h-[2px] bg-green-300"
        style={{ top: `calc(50% + ${clampedOffset}px)`, pointerEvents: "none" }}
      />
    );
  };

  const renderCell = (note: TonalNote | null, rowLabel: string, index: number, color: string) => {
    if (!note) return <div key={`${rowLabel}-${index}`} />;

    const midi = Note.midi(note.name);
    const chroma = Note.chroma(note.name);
    const isActive = activePitchClasses.has(chroma);
    const isChordTone = trainerMode === "blues" && chordPitchClasses.has(chroma);
    const isTarget = activeTarget?.midi === midi;
    const isDetected = detectedMidi === midi;
    const pitchClass = Note.simplify(Note.pitchClass(note.name));

    return (
      <div
        key={`${rowLabel}-${index}`}
        className={`relative min-h-8 rounded border px-1 py-1 text-center text-sm font-semibold ${
          isTarget
            ? "border-cyan-200 bg-cyan-400 text-black"
            : isChordTone
              ? "border-yellow-200 bg-yellow-400 text-black"
              : isActive
              ? "border-emerald-300 bg-emerald-500 text-black"
              : `border-gray-700 ${color} text-white opacity-45`
        }`}
      >
        {t(pitchClass)}
        {isDetected && renderLine(-((detectedNote?.cents ?? 0) / 50) * 8)}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 p-4 text-white sm:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Practice Trainer</h1>
          <p className="mt-1 text-sm text-gray-400">
            {t(Note.pitchClass(key))} harmonica · {position.label} position · {t(tonic)}{" "}
            {scaleOptions.find((option) => option.value === scaleValue)?.label}
          </p>
        </div>

        <div className="grid gap-3 rounded border border-gray-800 bg-gray-900 p-4 lg:grid-cols-4">
          <label className="text-sm text-gray-300">
            Harmonica key
            <select
              value={key}
              onChange={(event) => {
                setKey(event.target.value);
                setTargetIndex(0);
              }}
              className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-white"
            >
              {harmonicaKeys.map((harmonicaKey) => (
                <option key={harmonicaKey.value} value={harmonicaKey.value}>
                  {t(harmonicaKey.label)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-300">
            Position
            <select
              value={positionIndex}
              onChange={(event) => {
                setPositionIndex(Number(event.target.value));
                setTargetIndex(0);
              }}
              className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-white"
            >
              {positionOptions.map((option, index) => (
                <option key={option.label} value={index}>
                  {option.label} · {option.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-300">
            Scale
            <select
              value={scaleValue}
              onChange={(event) => {
                setScaleValue(event.target.value);
                setTargetIndex(0);
              }}
              className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-white"
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
                className={`rounded px-3 py-2 text-sm font-semibold ${
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
          <div className="overflow-x-auto rounded border border-gray-800 bg-gray-900 p-4">
            <div className="min-w-[620px]">
              {layoutRows.slice(0, 3).map(({ key, label, color }) => (
                <div key={key} className="mb-1 grid grid-cols-10 gap-2">
                  {layout[key].map((note, index) => renderCell(note, label, index, color))}
                </div>
              ))}
              <div className="mb-2 grid grid-cols-10 gap-2 text-center text-sm font-bold text-gray-400">
                {Array.from({ length: 10 }, (_, index) => (
                  <div key={index + 1}>{index + 1}</div>
                ))}
              </div>
              {layoutRows.slice(3).map(({ key, label, color }) => (
                <div key={key} className="mb-1 grid grid-cols-10 gap-2">
                  {layout[key].map((note, index) => renderCell(note, label, index, color))}
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded border border-gray-800 bg-gray-900 p-4">
            {trainerMode === "blues" ? (
              <>
                <h2 className="text-lg font-bold">12-bar blues</h2>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {bluesBars.map((degree, index) => (
                    <button
                      key={`${degree}-${index}`}
                      type="button"
                      onClick={() => setBarIndex(index)}
                      className={`rounded px-2 py-2 text-sm font-semibold ${
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
                  {currentChordNotes.map((note) => t(Note.pitchClass(note))).join(" - ")}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold">
                  {trainerMode === "bends" ? "Bend trainer" : "Note practice"}
                </h2>
                {activeTarget ? (
                  <div className="mt-4 rounded bg-gray-800 p-4 text-center">
                    <div className="text-sm text-gray-400">{activeTarget.label}</div>
                    <div className="mt-1 text-4xl font-bold">{t(Note.pitchClass(activeTarget.noteName))}</div>
                    <div className="mt-1 text-sm text-gray-400">{activeTarget.noteName}</div>
                    <div
                      className={`mt-3 rounded px-3 py-2 text-sm font-semibold ${
                        isTargetHit ? "bg-green-500 text-black" : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      {isTargetHit ? "Hit" : "Waiting"}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-400">
                    No playable targets for this selection.
                  </p>
                )}

                <button
                  type="button"
                  onClick={nextTarget}
                  disabled={!targets.length}
                  className="mt-3 w-full rounded bg-cyan-700 px-4 py-2 font-semibold text-white transition hover:bg-cyan-600 disabled:bg-gray-700 disabled:text-gray-400"
                >
                  Next target
                </button>
              </>
            )}

            <div className="mt-5 border-t border-gray-800 pt-4">
              {!isListening ? (
                <button
                  type="button"
                  onClick={() => setIsListening(true)}
                  className="w-full rounded bg-green-600 px-4 py-2 font-semibold text-white transition hover:bg-green-700"
                >
                  Start listening
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsListening(false)}
                  className="w-full rounded bg-gray-800 px-4 py-2 font-semibold text-white transition hover:bg-gray-700"
                >
                  Stop listening
                </button>
              )}

              {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
              {detectedNote && (
                <p className="mt-3 text-sm text-gray-300">
                  Detected {detectedNote.note} · {detectedNote.cents.toFixed(1)} cents · clarity{" "}
                  {clarity}
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

import { Fragment } from "react";
import type { TFunction } from "i18next";
import { Chord, Note } from "tonal";
import {
  chordQualityColors,
  modes,
  modeNames,
  scaleOptions,
} from "./circleTheory";
import type { CircleScaleValue, CircleTriad } from "./circleTheory";

type CircleDiagramProps = {
  center: number;
  circleOfFifths: string[];
  modeTonic: string;
  noteColors: Record<number, string>;
  onRootSelect: (note: string) => void;
  radius: number;
  scale: string[];
  selectedRoot: string;
  t: TFunction;
};

export const CircleDiagram = ({
  center,
  circleOfFifths,
  modeTonic,
  noteColors,
  onRootSelect,
  radius,
  scale,
  selectedRoot,
  t,
}: CircleDiagramProps) => {
  const angleStep = (2 * Math.PI) / circleOfFifths.length;
  const circleSize = center * 2;

  return (
    <div
      className="relative"
      style={{ width: circleSize, height: circleSize, marginBottom: 40 }}
    >
      {circleOfFifths.map((note, index) => {
        const angle = index * angleStep - Math.PI / 2;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);

        const chroma = Note.chroma(note);
        const noteColor = noteColors[chroma] || "none";
        const colorClass =
          chordQualityColors[noteColor] ||
          chordQualityColors[Chord.get(noteColor).type || "none"] ||
          chordQualityColors.none;

        const isTonicNote = Note.chroma(note) === Note.chroma(modeTonic);
        const borderClass = isTonicNote ? "border-4 border-cyan-300" : "";
        const degreeIndex = scale.findIndex(
          (scaleNote) => Note.chroma(scaleNote) === chroma,
        );

        return (
          <Fragment key={note}>
            <button
              type="button"
              onClick={() => onRootSelect(note)}
              aria-label={`Select root: ${t(note)}`}
              aria-pressed={Note.chroma(note) === Note.chroma(selectedRoot)}
              className={`absolute flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-sm font-semibold transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-gray-950 sm:h-14 sm:w-14 sm:text-lg ${colorClass} ${borderClass}`}
              style={{
                left: x,
                top: y,
                transform: "translate(-50%, -50%)",
              }}
              title={`Select root: ${t(note)}`}
            >
              {t(note)}
            </button>

            {degreeIndex !== -1 && (
              <div
                className={`absolute flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold sm:h-8 sm:w-8 ${colorClass}`}
                style={{
                  left: center + radius * 0.6 * Math.cos(angle),
                  top: center + radius * 0.6 * Math.sin(angle),
                  transform: "translate(-50%, -50%)",
                }}
              >
                {degreeIndex + 1}
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
};

type ModeControlsProps = {
  onModeSelect: (modeIndex: number) => void;
  selectedMode: number;
};

export const ModeControls = ({
  onModeSelect,
  selectedMode,
}: ModeControlsProps) => (
  <div className="mt-2 flex max-w-full gap-2 overflow-x-auto px-2 pb-2 sm:mt-4 sm:gap-3 sm:px-4">
    {[...modes]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(({ name }) => {
        const modeIndex = modeNames.indexOf(name);
        const isSelected = modeIndex === selectedMode;

        return (
          <button
            type="button"
            key={name}
            onClick={() => onModeSelect(modeIndex)}
            aria-pressed={isSelected}
            className={`cursor-pointer whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-2 focus:ring-offset-gray-950 sm:px-4 sm:py-2 sm:text-base ${
              isSelected
                ? "bg-indigo-400 text-black shadow-md"
                : "bg-gray-800 text-white transition-colors hover:bg-indigo-500"
            }`}
          >
            {name}
          </button>
        );
      })}
  </div>
);

type ScaleControlsProps = {
  onScaleSelect: (scale: CircleScaleValue) => void;
  selectedScale: CircleScaleValue;
};

export const ScaleControls = ({
  onScaleSelect,
  selectedScale,
}: ScaleControlsProps) => (
  <div className="mt-2 flex max-w-full gap-2 overflow-x-auto px-2 pb-2 sm:gap-3 sm:px-4">
    {scaleOptions.map(({ label, value }) => {
      const isSelected = selectedScale === value;

      return (
        <button
          key={value}
          type="button"
          onClick={() => onScaleSelect(value)}
          aria-pressed={isSelected}
          className={`cursor-pointer whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-2 focus:ring-offset-gray-950 sm:px-4 sm:py-2 sm:text-base ${
            isSelected
              ? "bg-emerald-400 text-black shadow-md"
              : "bg-gray-800 text-white transition-colors hover:bg-emerald-500"
          }`}
        >
          {label}
        </button>
      );
    })}
  </div>
);

type ScaleTriadsPanelProps = {
  modeTonic: string;
  scale: string[];
  scaleLabel: string;
  t: TFunction;
  triads: CircleTriad[];
};

export const ScaleTriadsPanel = ({
  modeTonic,
  scale,
  scaleLabel,
  t,
  triads,
}: ScaleTriadsPanelProps) => (
  <div className="w-full space-y-2 rounded-lg bg-gray-900 p-4 text-sm">
    <h2 className="mb-2 text-lg font-bold">
      {t(modeTonic)} {scaleLabel}
    </h2>
    <div className="flex flex-wrap gap-2">
      {scale.map((note, index) => (
        <span
          key={`${note}-${index}`}
          className="rounded bg-gray-800 px-2 py-1 text-xs font-medium sm:text-sm"
        >
          {index + 1}. {t(note)}
        </span>
      ))}
    </div>
    {triads.length > 0 && <h3 className="pt-3 text-base font-bold">Triads</h3>}
    <ul className="space-y-1">
      {triads.map(({ root, notes, quality }, index) => {
        const chordData = Chord.get(quality);
        const qualityLabel = chordData.tonic
          ? `${t(chordData.tonic)} ${chordData.type}`
          : quality;

        return (
          <li
            key={`${root}-${index}`}
            className="grid gap-2 rounded bg-gray-800 px-2 py-1 text-xs sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:text-sm"
          >
            <span className="font-medium">
              {index + 1}. {t(root)}
            </span>
            <span className="text-gray-300 sm:text-center">
              {notes.map((note) => t(note)).join(" - ")}
            </span>
            <span
              className={`justify-self-start rounded px-2 py-1 text-xs font-semibold capitalize sm:justify-self-end ${
                chordQualityColors[chordData.type || "none"]
              }`}
            >
              {qualityLabel}
            </span>
          </li>
        );
      })}
    </ul>
  </div>
);

export const LegendPanel = () => (
  <div className="w-full space-y-2 rounded-lg bg-gray-900 p-4 text-sm">
    <h2 className="mb-2 text-lg font-bold">Legend</h2>
    <ul className="space-y-1">
      <li>
        <span className="mr-2 inline-block h-4 w-4 rounded-sm border border-black bg-emerald-500 align-middle" />
        Scale note
      </li>
      <li>
        <span className="mr-2 inline-block h-4 w-4 rounded-sm border border-black bg-yellow-400 align-middle" />
        Major triad
      </li>
      <li>
        <span className="mr-2 inline-block h-4 w-4 rounded-sm bg-blue-600 align-middle" />
        Minor triad
      </li>
      <li>
        <span className="mr-2 inline-block h-4 w-4 rounded-sm bg-red-500 align-middle" />
        Diminished triad
      </li>
      <li>
        <span className="mr-2 inline-block h-4 w-4 rounded-sm border border-white bg-gray-800 align-middle" />
        No triad / unclassified
      </li>
      <li>
        <span className="mr-2 inline-block h-4 w-4 rounded-full border-4 border-cyan-300 align-middle" />
        Tonic of selected mode (starting note)
      </li>
      <li>
        <span className="mr-2 inline-block h-4 w-4 rounded-sm bg-gray-600 align-middle" />
        Numbers inside circle = scale degrees
      </li>
    </ul>
  </div>
);

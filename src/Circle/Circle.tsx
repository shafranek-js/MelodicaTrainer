import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Chord, Note } from "tonal";
import {
  chordQualityColors,
  getCircleTheory,
  modes,
  modeNames,
  scaleOptions,
  type CircleScaleValue,
} from "./circleTheory";

const getResponsiveSize = () => {
  const width = window.innerWidth;
  if (width < 400) return { radius: 100, center: 120 };
  if (width < 640) return { radius: 120, center: 140 };
  if (width < 768) return { radius: 140, center: 160 };
  return { radius: 160, center: 180 };
};

function Circle() {
  const [selectedRoot, setSelectedRoot] = useState("C");
  const [selectedMode, setSelectedMode] = useState(0);
  const [selectedScale, setSelectedScale] =
    useState<CircleScaleValue>("mode");
  const [dimensions, setDimensions] = useState(getResponsiveSize());
  const { t } = useTranslation();

  useEffect(() => {
    const handleResize = () => setDimensions(getResponsiveSize());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { radius, center } = dimensions;
  const circleSize = center * 2;
  const { circleOfFifths, modeTonic, scale, scaleLabel, triads, noteColors } =
    useMemo(
      () =>
        getCircleTheory({
          selectedRoot,
          selectedMode,
          selectedScale,
        }),
      [selectedRoot, selectedMode, selectedScale]
    );

  const angleStep = (2 * Math.PI) / circleOfFifths.length;

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gray-950 p-4 text-white sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-center">
        🎵 Circle of Fifths
      </h1>

      <div
        className="relative"
        style={{ width: circleSize, height: circleSize, marginBottom: 40 }}
      >
        {circleOfFifths.map((note, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);

          const chroma = Note.chroma(note);
          const noteColor = noteColors[chroma] || "none";
          const colorClass =
            chordQualityColors[noteColor] ||
            chordQualityColors[Chord.get(noteColor).type || "none"] ||
            chordQualityColors.none;

          const isTonicNote =
            Note.chroma(note) === Note.chroma(modeTonic);
          const borderClass = isTonicNote ? "border-4 border-cyan-300" : "";

          return (
            <React.Fragment key={note}>
              <button
                type="button"
                onClick={() => {
                  setSelectedRoot(note);
                  setSelectedMode(0);
                }}
                aria-label={`Select root: ${t(note)}`}
                aria-pressed={
                  Note.chroma(note) === Note.chroma(selectedRoot)
                }
                className={`absolute cursor-pointer rounded-full w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center font-semibold text-sm sm:text-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-gray-950 ${colorClass} ${borderClass}`}
                style={{
                  left: x,
                  top: y,
                  transform: "translate(-50%, -50%)",
                }}
                title={`Select root: ${t(note)}`}
              >
                {t(note)}
              </button>

              {(() => {
                const degreeIndex = scale.findIndex(
                  (n) => Note.chroma(n) === Note.chroma(note)
                );
                if (degreeIndex === -1) return null;

                const innerRadius = radius * 0.6;
                const xInner =
                  center + innerRadius * Math.cos(i * angleStep - Math.PI / 2);
                const yInner =
                  center + innerRadius * Math.sin(i * angleStep - Math.PI / 2);

                return (
                  <div
                    className={`absolute rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-xs font-bold ${colorClass}`}
                    style={{
                      left: xInner,
                      top: yInner,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    {degreeIndex + 1}
                  </div>
                );
              })()}
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex gap-2 sm:gap-3 overflow-x-auto max-w-full px-2 sm:px-4 mt-2 sm:mt-4 pb-2">
        {[...modes]
          .sort((a, b) => a.harmonicaOrder - b.harmonicaOrder)
          .map(({ name, harmonicaPosition }) => {
            const modeIndex = modeNames.indexOf(name);
            const isSelected = modeIndex === selectedMode;

            return (
              <button
                type="button"
                key={name}
                onClick={() => setSelectedMode(modeIndex)}
                aria-pressed={isSelected}
                className={`cursor-pointer px-3 sm:px-4 py-1.5 sm:py-2 rounded font-medium text-sm sm:text-base whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-2 focus:ring-offset-gray-950 ${
                  isSelected
                    ? "bg-indigo-400 text-black shadow-md"
                    : "bg-gray-800 text-white hover:bg-indigo-500 transition-colors"
                }`}
              >
                {name} ({harmonicaPosition})
              </button>
            );
          })}
      </div>

      <div className="flex gap-2 sm:gap-3 overflow-x-auto max-w-full px-2 sm:px-4 mt-2 pb-2">
        {scaleOptions.map(({ label, value }) => {
          const isSelected = selectedScale === value;

          return (
            <button
              key={value}
              type="button"
              onClick={() => setSelectedScale(value)}
              aria-pressed={isSelected}
              className={`cursor-pointer px-3 sm:px-4 py-1.5 sm:py-2 rounded font-medium text-sm sm:text-base whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-2 focus:ring-offset-gray-950 ${
                isSelected
                  ? "bg-emerald-400 text-black shadow-md"
                  : "bg-gray-800 text-white hover:bg-emerald-500 transition-colors"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0 mt-6 sm:mt-8 w-full px-2 sm:px-4 max-w-5xl">
        <div className="bg-gray-900 p-4 rounded-lg w-full text-sm space-y-2">
          <h2 className="text-lg font-bold mb-2">
            {t(modeTonic)} {scaleLabel}
          </h2>
          <div className="flex flex-wrap gap-2">
            {scale.map((note, idx) => (
              <span
                key={`${note}-${idx}`}
                className="rounded bg-gray-800 px-2 py-1 text-xs sm:text-sm font-medium"
              >
                {idx + 1}. {t(note)}
              </span>
            ))}
          </div>
          {triads.length > 0 && (
            <h3 className="text-base font-bold pt-3">Triads</h3>
          )}
          <ul className="space-y-1">
            {triads.map(({ root, notes, quality }, idx) => (
              <li
                key={idx}
                className="grid gap-2 rounded bg-gray-800 px-2 py-1 text-xs sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:text-sm"
              >
                <span className="font-medium">
                  {idx + 1}. {t(root)}
                </span>
                <span className="text-gray-300 sm:text-center">
                  {notes.map((note) => t(note)).join(" - ")}
                </span>
                <span
                  className={`justify-self-start rounded px-2 py-1 text-xs font-semibold capitalize sm:justify-self-end ${
                    chordQualityColors[Chord.get(quality).type || "none"]
                  }`}
                >
                  {(() => {
                    const chordData = Chord.get(quality); // e.g., C#m -> { tonic: "C#", type: "m", name: "C#m" }

                    if (!chordData.tonic) return quality; // fallback

                    const translatedRoot = t(chordData.tonic);
                    const suffix = chordData.type; // e.g., "m", "maj7", "dim"

                    return `${translatedRoot} ${suffix}`;
                  })()}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-gray-900 p-4 rounded-lg w-full text-sm space-y-2">
          <h2 className="text-lg font-bold mb-2">Legend</h2>
          <ul className="space-y-1">
            <li>
              <span className="inline-block w-4 h-4 bg-emerald-500 rounded-sm align-middle mr-2 border border-black"></span>
              Scale note
            </li>
            <li>
              <span className="inline-block w-4 h-4 bg-yellow-400 rounded-sm align-middle mr-2 border border-black"></span>
              Major triad
            </li>
            <li>
              <span className="inline-block w-4 h-4 bg-blue-600 rounded-sm align-middle mr-2"></span>
              Minor triad
            </li>
            <li>
              <span className="inline-block w-4 h-4 bg-red-500 rounded-sm align-middle mr-2"></span>
              Diminished triad
            </li>
            <li>
              <span className="inline-block w-4 h-4 bg-gray-800 rounded-sm align-middle mr-2 border border-white"></span>
              No triad / unclassified
            </li>
            <li>
              <span className="inline-block w-4 h-4 border-4 border-cyan-300 rounded-full align-middle mr-2"></span>
              Tonic of selected mode (starting note)
            </li>
            <li>
              <span className="inline-block w-4 h-4 bg-gray-600 rounded-sm align-middle mr-2"></span>
              Numbers inside circle = scale degrees
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Circle;

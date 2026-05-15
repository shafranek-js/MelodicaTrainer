import { useMemo, useState } from "react";
import { Music2 } from "lucide-react";
import { Note } from "tonal";
import { useTranslation } from "react-i18next";
import { usePitchDetector } from "../hooks/usePitchDetector";
import {
  freqToNoteAndCents,
  generateMelodicaLayout,
  getMelodicaMidiNumbers,
  getSuzukiNoteColor,
  melodicaRangeOptions,
} from "../utils/utils";
import type { MelodicaKeyCount } from "../utils/utils";
import { MelodicaKeyboard } from "./MelodicaKeyboard";

function Melodica() {
  const { t } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [keyCount, setKeyCount] = useState<MelodicaKeyCount>(32);
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

  return (
    <div className="flex min-h-full flex-col bg-gray-950 p-4 text-white sm:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-lg border border-gray-800 bg-gray-900 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-emerald-300">
              <Music2 size={20} />
              <span className="text-xs font-black uppercase tracking-widest">
                Melodica Trainer
              </span>
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              Melodica Pitch Visualizer
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              {layout.startNote}-{layout.endNote} range, {layout.keys.length} keys
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:min-w-56">
            <label
              htmlFor="melodica-range"
              className="text-[10px] font-black uppercase tracking-widest text-gray-400"
            >
              Melodica range
            </label>
            <select
              id="melodica-range"
              value={keyCount}
              onChange={(event) =>
                setKeyCount(Number(event.target.value) as MelodicaKeyCount)
              }
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-semibold text-white outline-none transition focus:ring-2 focus:ring-emerald-500"
            >
              {melodicaRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.startNote}-{option.endNote})
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <button
              type="button"
              onClick={() => setIsListening((value) => !value)}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black uppercase tracking-widest text-white transition hover:bg-emerald-500"
            >
              {isListening ? "Stop listening" : "Start listening"}
            </button>

            <div className="mt-4 min-h-32 rounded-lg border border-gray-800 bg-gray-950 p-4">
              {error ? (
                <div className="text-sm text-red-300">{error}</div>
              ) : detectedNote ? (
                <div className="space-y-2">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-500">
                    Detected note
                  </div>
                  <div className="text-3xl font-black text-emerald-300">
                    {detectedNote.note}
                  </div>
                  <div className="text-sm text-gray-300">
                    {detectedNote.cents.toFixed(1)} cents
                  </div>
                  <div className="text-xs text-gray-500">
                    {pitch} Hz, clarity {clarity}
                  </div>
                </div>
              ) : isListening ? (
                <div className="text-sm text-gray-400">Listening for pitch...</div>
              ) : (
                <div className="text-sm text-gray-500">Idle</div>
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-300">
                Keyboard
              </h2>
              <div className="text-xs text-gray-500">
                {layout.startNote} to {layout.endNote}
              </div>
            </div>
            <div className="overflow-x-auto pb-2">
              <MelodicaKeyboard
                formatPitchClass={t}
                getKeyState={(key) => ({
                  activeColor: getSuzukiNoteColor(key.name),
                  isActive: detectedMidi === key.midi,
                  tuningCents: detectedMidi === key.midi ? detectedNote?.cents : null,
                })}
                layout={layout}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Melodica;

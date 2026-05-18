import { Music2 } from "lucide-react";
import type { TFunction } from "i18next";
import {
  getSuzukiNoteColor,
  melodicaRangeOptions,
} from "../utils/utils";
import type { MelodicaKeyCount, MelodicaLayout } from "../utils/utils";
import { MelodicaKeyboard } from "./MelodicaKeyboard";

type DetectedNote = {
  cents: number;
  note: string;
} | null;

type MelodicaHeaderPanelProps = {
  keyCount: MelodicaKeyCount;
  onKeyCountChange: (keyCount: MelodicaKeyCount) => void;
  rangeSummary: string;
};

export const MelodicaHeaderPanel = ({
  keyCount,
  onKeyCountChange,
  rangeSummary,
}: MelodicaHeaderPanelProps) => (
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
      <p className="mt-1 text-sm text-gray-400">{rangeSummary}</p>
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
          onKeyCountChange(Number(event.target.value) as MelodicaKeyCount)
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
);

type MelodicaListeningPanelProps = {
  clarity: string | null;
  detectedNote: DetectedNote;
  error: string | null;
  isListening: boolean;
  onListeningToggle: () => void;
  pitch: string | null;
};

export const MelodicaListeningPanel = ({
  clarity,
  detectedNote,
  error,
  isListening,
  onListeningToggle,
  pitch,
}: MelodicaListeningPanelProps) => (
  <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
    <button
      type="button"
      onClick={onListeningToggle}
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
);

type MelodicaKeyboardPanelProps = {
  detectedMidi: number | null;
  detectedNote: DetectedNote;
  keyboardRangeLabel: string;
  layout: MelodicaLayout;
  t: TFunction;
};

export const MelodicaKeyboardPanel = ({
  detectedMidi,
  detectedNote,
  keyboardRangeLabel,
  layout,
  t,
}: MelodicaKeyboardPanelProps) => (
  <div className="min-w-0 rounded-lg border border-gray-800 bg-gray-900 p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-black uppercase tracking-widest text-gray-300">
        Keyboard
      </h2>
      <div className="text-xs text-gray-500">{keyboardRangeLabel}</div>
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
);

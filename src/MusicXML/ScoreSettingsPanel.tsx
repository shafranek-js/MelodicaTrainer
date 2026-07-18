import { FolderOpen, Library, Pin, PinOff } from "lucide-react";
import { useState } from "react";
import type { ChangeEvent } from "react";
import type { MelodicaRangeOption, MelodicaKeyCount } from "../utils/utils";
import { ScoreLibraryDialog } from "./ScoreLibraryDialog";
import type { LibraryEntry } from "./scoreLibrary";
import type { MidiPartInfo } from "./midiParser";
import {
  MIDI_QUANTIZATION_OPTIONS,
} from "./midiNotation";
import type {
  MidiNotationStatus,
  MidiQuantizationMode,
  ResolvedMidiQuantization,
} from "./midiNotation";
import type { ScoreFormat } from "./scoreFormat";

type RouteStatusTone = "info" | "success" | "error";
type RouteStatus = { tone: RouteStatusTone; message: string };

type SoundFontOption = {
  label: string;
  value: string;
};

type AvailablePreset = {
  bank: number;
  name: string;
  program: number;
};

type GpTrack = {
  index: number;
  name: string;
};

type ScoreSettingsPanelProps = {
  availablePresets: AvailablePreset[];
  canUseProcessedScore: boolean;
  fileName: string | null;
  gpTracks: GpTrack[];
  midiParts: MidiPartInfo[];
  midiNotationStatus: MidiNotationStatus;
  midiNotationWarnings: string[];
  midiQuantizationMode: MidiQuantizationMode;
  keyCount: MelodicaKeyCount;
  melodicaRanges: readonly MelodicaRangeOption[];
  isPinned: boolean;
  onDownloadMelodicaNotes: () => void;
  onDownloadTransposedXml: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onGpTrackChange: (trackIndex: number) => void;
  onMidiPartChange: (partId: string) => void;
  onMidiQuantizationChange: (mode: MidiQuantizationMode) => void;
  onLibraryScoreLoad: (entry: LibraryEntry, signal: AbortSignal) => Promise<void>;
  onMelodicaRangeChange: (keyCount: MelodicaKeyCount) => void;
  onSelectedPresetChange: (preset: string) => void;
  onSoundFontChange: (soundFont: string) => void;
  onTogglePin: () => void;
  routeStatus: RouteStatus | null;
  routeStatusClassNames: Record<RouteStatusTone, string>;
  scoreFormat: ScoreFormat | null;
  selectedGpTrackIndex: number;
  selectedMidiPartId: string | null;
  resolvedMidiQuantization: ResolvedMidiQuantization | null;
  selectedPreset: string;
  selectedSoundFont: string;
  soundFonts: SoundFontOption[];
};

export const ScoreSettingsPanel = ({
  availablePresets,
  canUseProcessedScore,
  fileName,
  gpTracks,
  midiParts,
  midiNotationStatus,
  midiNotationWarnings,
  midiQuantizationMode,
  keyCount,
  melodicaRanges,
  isPinned,
  onDownloadMelodicaNotes,
  onDownloadTransposedXml,
  onFileChange,
  onGpTrackChange,
  onMidiPartChange,
  onMidiQuantizationChange,
  onLibraryScoreLoad,
  onMelodicaRangeChange,
  onSelectedPresetChange,
  onSoundFontChange,
  onTogglePin,
  routeStatus,
  routeStatusClassNames,
  scoreFormat,
  selectedGpTrackIndex,
  selectedMidiPartId,
  resolvedMidiQuantization,
  selectedPreset,
  selectedSoundFont,
  soundFonts,
}: ScoreSettingsPanelProps) => {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  return (
    <>
      <div className="w-full lg:w-72 shrink-0 bg-gray-900 rounded-xl shadow-xl p-5 space-y-5 border border-gray-700 overflow-y-auto max-h-full custom-scrollbar relative">
    <button
      onClick={onTogglePin}
      className="hidden lg:flex absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors p-1"
      title={isPinned ? "Unpin panel" : "Pin panel"}
    >
      {isPinned ? <Pin size={16} className="text-emerald-500" /> : <PinOff size={16} />}
    </button>

    {routeStatus && (
      <div className={`rounded-lg border px-3 py-2 text-sm font-medium mt-4 ${routeStatusClassNames[routeStatus.tone]}`}>
        {routeStatus.message}
      </div>
    )}

    <div className="space-y-4">
      <div>
        <label className="block mb-1 text-gray-400 font-bold text-[10px] uppercase tracking-widest">Melodica Range</label>
        <select
          value={keyCount}
          onChange={(e) => onMelodicaRangeChange(Number(e.target.value) as MelodicaKeyCount)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 w-full text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
        >
          {melodicaRanges.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label} ({range.startNote}-{range.endNote})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block mb-1 text-gray-400 font-bold text-[10px] uppercase tracking-widest">SoundFont</label>
        <select
          value={selectedSoundFont}
          onChange={(e) => onSoundFontChange(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 w-full text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
        >
          {soundFonts.map((soundFont) => (
            <option key={soundFont.value} value={soundFont.value}>
              {soundFont.label}
            </option>
          ))}
        </select>
      </div>

      {availablePresets.length > 0 && (
        <div>
          <label className="block mb-1 text-gray-400 font-bold text-[10px] uppercase tracking-widest">Instrument</label>
          <select
            value={selectedPreset}
            onChange={(e) => onSelectedPresetChange(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 w-full text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          >
            {availablePresets.map((preset, idx) => (
              <option key={`${preset.bank}:${preset.program}:${idx}`} value={`${preset.bank}:${preset.program}`}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {scoreFormat === "guitar-pro" && gpTracks.length > 0 && (
        <div>
          <label className="block mb-1 text-gray-400 font-bold text-[10px] uppercase tracking-widest">GP Track</label>
          <select
            value={selectedGpTrackIndex}
            onChange={(e) => onGpTrackChange(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 w-full text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          >
            {gpTracks.map((track) => (
              <option key={track.index} value={track.index}>
                {track.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {scoreFormat === "midi" && midiParts.length > 0 && selectedMidiPartId && (
        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-gray-400 font-bold text-[10px] uppercase tracking-widest">MIDI Part</label>
            <select
              value={selectedMidiPartId}
              onChange={(e) => onMidiPartChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 w-full text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            >
              {midiParts.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.name} — Ch. {part.channel + 1}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 text-gray-400 font-bold text-[10px] uppercase tracking-widest">Notation grid</label>
            <select
              value={midiQuantizationMode}
              onChange={(e) => onMidiQuantizationChange(e.target.value as MidiQuantizationMode)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 w-full text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            >
              {MIDI_QUANTIZATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] font-semibold text-gray-500">
              Approximate notation
              {midiQuantizationMode === "auto" && resolvedMidiQuantization
                ? ` · Auto detected: ${MIDI_QUANTIZATION_OPTIONS.find((option) => option.value === resolvedMidiQuantization)?.label ?? resolvedMidiQuantization}`
                : midiNotationStatus === "preparing"
                  ? " · Preparing…"
                  : midiNotationStatus === "unavailable"
                    ? " · Unavailable"
                    : ""}
            </p>
            {midiNotationWarnings.length > 0 && (
              <p className="mt-1 text-[10px] font-semibold text-amber-400">
                {midiNotationWarnings.join(" ")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>

    <div className="space-y-2 pt-2">
      <label className="group relative flex items-center justify-center gap-2 cursor-pointer px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all w-full text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95">
        <FolderOpen size={16} />
        Load XML/GP/MIDI
        <input
          type="file"
          accept=".xml,.musicxml,.mxl,.gp,.gp3,.gp4,.gp5,.gpx,.mid,.midi"
          onChange={onFileChange}
          className="hidden"
        />
      </label>
      <button
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-950/60 px-4 py-3 text-xs font-black uppercase tracking-widest text-emerald-200 shadow-lg shadow-emerald-950/20 transition-all hover:bg-emerald-900/70 active:scale-95"
        onClick={() => setIsLibraryOpen(true)}
        type="button"
      >
        <Library size={16} />
        Browse library
      </button>
      {fileName && <p className="mt-2 text-[10px] text-gray-500 font-bold truncate text-center uppercase tracking-tighter">Loaded: {fileName}</p>}
    </div>

    {scoreFormat === "musicxml" && (
      <div className="pt-2 grid grid-cols-2 gap-2">
        <button
          onClick={onDownloadTransposedXml}
          disabled={!canUseProcessedScore}
          className="bg-gray-800 border border-gray-700 hover:bg-gray-750 disabled:opacity-30 text-gray-400 px-3 py-2 rounded-lg transition-all w-full text-[10px] font-black uppercase tracking-tighter"
          title="Transposed XML"
        >
          💾 XML
        </button>
        <button
          onClick={onDownloadMelodicaNotes}
          disabled={!canUseProcessedScore}
          className="bg-gray-800 border border-gray-700 hover:bg-gray-750 disabled:opacity-30 text-gray-400 px-3 py-2 rounded-lg transition-all w-full text-[10px] font-black uppercase tracking-tighter"
          title="Melodica notes text"
        >
          📝 Text
        </button>
      </div>
    )}
      </div>
      <ScoreLibraryDialog
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onLoadScore={onLibraryScoreLoad}
      />
    </>
  );
};

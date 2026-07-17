import { FolderOpen, Library, Pin, PinOff } from "lucide-react";
import { useState } from "react";
import type { ChangeEvent } from "react";
import type { MelodicaRangeOption, MelodicaKeyCount } from "../utils/utils";
import { ScoreLibraryDialog } from "./ScoreLibraryDialog";
import type { ScoreLibraryEntry } from "./scoreLibrary";

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
  keyCount: MelodicaKeyCount;
  melodicaRanges: readonly MelodicaRangeOption[];
  isGpFile: boolean;
  isPinned: boolean;
  onDownloadMelodicaNotes: () => void;
  onDownloadTransposedXml: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onGpTrackChange: (trackIndex: number) => void;
  onLibraryScoreLoad: (entry: ScoreLibraryEntry, signal: AbortSignal) => Promise<void>;
  onMelodicaRangeChange: (keyCount: MelodicaKeyCount) => void;
  onSelectedPresetChange: (preset: string) => void;
  onSoundFontChange: (soundFont: string) => void;
  onTogglePin: () => void;
  routeStatus: RouteStatus | null;
  routeStatusClassNames: Record<RouteStatusTone, string>;
  selectedGpTrackIndex: number;
  selectedPreset: string;
  selectedSoundFont: string;
  soundFonts: SoundFontOption[];
};

export const ScoreSettingsPanel = ({
  availablePresets,
  canUseProcessedScore,
  fileName,
  gpTracks,
  keyCount,
  melodicaRanges,
  isGpFile,
  isPinned,
  onDownloadMelodicaNotes,
  onDownloadTransposedXml,
  onFileChange,
  onGpTrackChange,
  onLibraryScoreLoad,
  onMelodicaRangeChange,
  onSelectedPresetChange,
  onSoundFontChange,
  onTogglePin,
  routeStatus,
  routeStatusClassNames,
  selectedGpTrackIndex,
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

      {isGpFile && gpTracks.length > 0 && (
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
    </div>

    <div className="space-y-2 pt-2">
      <label className="group relative flex items-center justify-center gap-2 cursor-pointer px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all w-full text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95">
        <FolderOpen size={16} />
        Load XML/GP
        <input
          type="file"
          accept=".xml,.musicxml,.mxl,.gp,.gp3,.gp4,.gp5,.gpx"
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

    {!isGpFile && (
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

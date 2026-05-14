import { FolderOpen } from "lucide-react";
import type { ChangeEvent } from "react";

type RouteStatusTone = "info" | "success" | "error";
type RouteStatus = { tone: RouteStatusTone; message: string };

type HarmonicaKey = {
  label: string;
  value: string;
};

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
  harmonicaKey: string;
  harmonicaKeys: HarmonicaKey[];
  isGpFile: boolean;
  onDownloadHarpTabs: () => void;
  onDownloadTransposedXml: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onGpTrackChange: (trackIndex: number) => void;
  onHarmonicaKeyChange: (key: string) => void;
  onSelectedPresetChange: (preset: string) => void;
  onSoundFontChange: (soundFont: string) => void;
  routeStatus: RouteStatus | null;
  routeStatusClassNames: Record<RouteStatusTone, string>;
  selectedGpTrackIndex: number;
  selectedPreset: string;
  selectedSoundFont: string;
  soundFonts: SoundFontOption[];
  t: (key: string) => string;
};

export const ScoreSettingsPanel = ({
  availablePresets,
  canUseProcessedScore,
  fileName,
  gpTracks,
  harmonicaKey,
  harmonicaKeys,
  isGpFile,
  onDownloadHarpTabs,
  onDownloadTransposedXml,
  onFileChange,
  onGpTrackChange,
  onHarmonicaKeyChange,
  onSelectedPresetChange,
  onSoundFontChange,
  routeStatus,
  routeStatusClassNames,
  selectedGpTrackIndex,
  selectedPreset,
  selectedSoundFont,
  soundFonts,
  t,
}: ScoreSettingsPanelProps) => (
  <div className="w-full lg:w-72 shrink-0 bg-gray-900 rounded-xl shadow-xl p-5 space-y-5 border border-gray-700 overflow-y-auto max-h-full custom-scrollbar">
    {routeStatus && (
      <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${routeStatusClassNames[routeStatus.tone]}`}>
        {routeStatus.message}
      </div>
    )}

    <div className="space-y-4">
      <div>
        <label className="block mb-1 text-gray-400 font-bold text-[10px] uppercase tracking-widest">Harmonica Key</label>
        <select
          value={harmonicaKey}
          onChange={(e) => onHarmonicaKeyChange(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 w-full text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
        >
          {harmonicaKeys.map((key) => (
            <option key={key.value} value={key.value}>
              {t(key.label)}
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

    <div className="pt-2">
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
          onClick={onDownloadHarpTabs}
          disabled={!canUseProcessedScore}
          className="bg-gray-800 border border-gray-700 hover:bg-gray-750 disabled:opacity-30 text-gray-400 px-3 py-2 rounded-lg transition-all w-full text-[10px] font-black uppercase tracking-tighter"
          title="HarpTabs text"
        >
          📝 Text
        </button>
      </div>
    )}
  </div>
);

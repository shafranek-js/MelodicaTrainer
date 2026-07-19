import {
  AlertTriangle,
  CheckCircle2,
  FolderCog,
  FolderOpen,
  Link2,
  RefreshCw,
  SlidersHorizontal,
  Unlink,
} from "lucide-react";
import { useMidiInput } from "../hooks/useMidiInput";
import { useUserScoreLibrary } from "../MusicXML/UserScoreLibraryContext";
import type { InputMode } from "../MusicXML/inputMode";
import { melodicaRangeOptions } from "../utils/utils";
import type { MelodicaKeyCount } from "../utils/utils";
import { useAppSettings } from "./AppSettingsContext";
import { SOUND_FONT_OPTIONS } from "./appSettings";

const formatScanTime = (value: string | null) => {
  if (!value) return "Not scanned yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const Settings = () => {
  const library = useUserScoreLibrary();
  const {
    inputMode,
    melodicaRange,
    setInputMode,
    setMelodicaRange,
    setSoundFont,
    soundFont,
  } = useAppSettings();
  const midiInput = useMidiInput();
  const isConnected = Boolean(library.directoryHandle);
  const isGranted = library.permission === "granted";
  const midiStatus = midiInput.accessState === "unsupported"
    ? "Web MIDI is not supported in this browser."
    : midiInput.accessState === "denied"
      ? "MIDI access was not granted."
      : midiInput.accessState === "requesting"
        ? "Checking MIDI devices…"
        : midiInput.connectedInputCount === 0
          ? "No MIDI keyboard connected."
          : `${midiInput.connectedInputCount} MIDI input${midiInput.connectedInputCount === 1 ? "" : "s"} connected.`;

  return (
    <div className="custom-scrollbar h-full overflow-y-auto bg-gray-950 px-4 py-6 text-gray-100 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <div className="flex items-center gap-3">
            <FolderCog className="text-emerald-400" size={28} />
            <div>
              <h1 className="text-2xl font-black text-white">Settings</h1>
              <p className="mt-1 text-sm text-gray-400">
                Connect a folder for scores that stay on this device.
              </p>
            </div>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-xl">
          <div className="border-b border-gray-800 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="text-emerald-400" size={19} />
              <h2 className="font-black text-white">Instrument and input</h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              Range is shared by Tabs, Melodica and Practice. Input and SoundFont control playable audio.
            </p>
          </div>
          <div className="grid gap-5 px-5 py-5 sm:grid-cols-3 sm:px-6">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Melodica Range
              <select
                className="mt-1.5 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:ring-2 focus:ring-emerald-500"
                id="melodica-range-setting"
                onChange={(event) => setMelodicaRange(Number(event.target.value) as MelodicaKeyCount)}
                value={melodicaRange}
              >
                {melodicaRangeOptions.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label} ({range.startNote}-{range.endNote})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Note input
              <select
                className="mt-1.5 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:ring-2 focus:ring-emerald-500"
                id="note-input-mode"
                onChange={(event) => setInputMode(event.target.value as InputMode)}
                value={inputMode}
              >
                <option value="auto">Auto</option>
                <option value="mic">Mic</option>
                <option value="midi">MIDI</option>
              </select>
              <span className="mt-1.5 block text-[9px] font-medium normal-case leading-relaxed tracking-normal text-gray-500">
                {midiStatus}
              </span>
            </label>

            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              SoundFont
              <select
                className="mt-1.5 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:ring-2 focus:ring-emerald-500"
                id="soundfont-setting"
                onChange={(event) => setSoundFont(event.target.value)}
                value={soundFont}
              >
                {SOUND_FONT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-xl">
          <div className="border-b border-gray-800 px-5 py-4 sm:px-6">
            <h2 className="font-black text-white">My score library</h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              Melodica Trainer reads supported score files directly from this folder. Files are never uploaded.
            </p>
          </div>

          <div className="space-y-5 px-5 py-5 sm:px-6">
            {!library.supported ? (
              <div className="rounded-xl border border-amber-800 bg-amber-950/50 p-4 text-sm text-amber-100">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 shrink-0 text-amber-400" size={19} />
                  <div>
                    <p className="font-bold">Folder libraries are unavailable in this browser.</p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
                      Use Chrome or Edge for a persistent folder. You can still use Load XML/GP/MIDI/MSCZ on the Tabs page.
                    </p>
                  </div>
                </div>
              </div>
            ) : library.isInitializing ? (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                <RefreshCw className="animate-spin" size={17} /> Loading folder settings…
              </div>
            ) : !isConnected ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-700 bg-gray-950/60 p-4 text-sm text-gray-300">
                  Choose one folder. Existing files and files added later in its subfolders will appear in My files.
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-500"
                  onClick={() => void library.chooseFolder()}
                  type="button"
                >
                  <FolderOpen size={18} /> Choose local library folder
                </button>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-gray-700 bg-gray-950/60 p-4 sm:col-span-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Folder</p>
                    <p className="mt-1 truncate font-bold text-white">{library.directoryHandle?.name}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs">
                      {isGranted ? (
                        <><CheckCircle2 className="text-emerald-400" size={14} /><span className="text-emerald-300">Connected</span></>
                      ) : (
                        <><AlertTriangle className="text-amber-400" size={14} /><span className="text-amber-300">Permission required</span></>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-700 bg-gray-950/60 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Available scores</p>
                    <p className="mt-1 text-2xl font-black text-white">{library.index.entries.length}</p>
                    <p className="mt-1 text-[10px] text-gray-500">{formatScanTime(library.index.lastScanAt)}</p>
                  </div>
                </div>

                {library.scanSummary && (
                  <div className="rounded-xl border border-gray-700 bg-gray-950/60 px-4 py-3 text-xs text-gray-300">
                    Last scan: {library.scanSummary.added} added, {library.scanSummary.updated} updated, {library.scanSummary.removed} removed, {library.scanSummary.skipped} skipped, {library.scanSummary.warnings} warnings, {library.scanSummary.errors} errors.
                  </div>
                )}

                {library.index.issues.length > 0 && (
                  <details className="rounded-xl border border-amber-900 bg-amber-950/30 px-4 py-3 text-xs text-amber-100">
                    <summary className="cursor-pointer font-bold">{library.index.issues.length} file notices</summary>
                    <ul className="mt-3 space-y-2">
                      {library.index.issues.map((issue) => (
                        <li className={issue.severity === "warning" ? "text-amber-200" : "text-red-200"} key={`${issue.relativePath}:${issue.message}`}>
                          <span className="font-semibold">{issue.relativePath}</span>: {issue.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <div className="flex flex-wrap gap-2">
                  {!isGranted && (
                    <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-500" onClick={() => void library.reconnect()} type="button">
                      <Link2 size={16} /> Reconnect
                    </button>
                  )}
                  <button className="inline-flex items-center gap-2 rounded-xl border border-gray-600 bg-gray-800 px-4 py-2.5 text-xs font-black text-white hover:bg-gray-700 disabled:opacity-50" disabled={!isGranted || library.isScanning} onClick={() => void library.rescan()} type="button">
                    <RefreshCw className={library.isScanning ? "animate-spin" : ""} size={16} /> {library.isScanning ? "Scanning…" : "Rescan"}
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-xl border border-gray-600 bg-gray-800 px-4 py-2.5 text-xs font-black text-white hover:bg-gray-700" onClick={() => void library.chooseFolder()} type="button">
                    <FolderOpen size={16} /> Change folder
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-xl border border-red-900 bg-red-950/50 px-4 py-2.5 text-xs font-black text-red-200 hover:bg-red-900/60" onClick={() => void library.disconnect()} type="button">
                    <Unlink size={16} /> Disconnect
                  </button>
                </div>
              </>
            )}

            {library.error && (
              <div className="rounded-xl border border-red-800 bg-red-950/60 p-3 text-sm text-red-200">{library.error}</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;

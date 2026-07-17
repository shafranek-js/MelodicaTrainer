import type { ComponentProps, RefObject } from "react";
import { Gauge, Pin, PinOff } from "lucide-react";
import AlphaTabViewer from "./AlphaTabViewer";
import type { AlphaTabViewerRef } from "./AlphaTabViewer";
import { NoteHighway } from "./NoteHighway";
import { ScoreSettingsPanel } from "./ScoreSettingsPanel";
import { TransposeControls } from "./TransposeControls";
import type { GameStats } from "./types";
import type { ScoreFormat } from "./scoreFormat";

export type MidiSummaryData = {
  durationSeconds: number;
  fileName: string;
  initialTempoBpm: number;
  noteCount: number;
  partLabel: string;
  tempoChangeCount: number;
};

type ScoreWindowPanelProps = {
  alphaTabProps: Omit<ComponentProps<typeof AlphaTabViewer>, "fileData"> & {
    fileData: string | Uint8Array;
  };
  alphaTabRef: RefObject<AlphaTabViewerRef | null>;
  gpScorePaneHeightPx: number;
  midiSummary: MidiSummaryData | null;
  isTopDrawerHovered: boolean;
  isTopDrawerPinned: boolean;
  onTopDrawerHoverChange: (isHovered: boolean) => void;
  onToggleTopPinned: () => void;
  osmdRef: RefObject<HTMLDivElement | null>;
  scoreFormat: ScoreFormat | null;
  sheetScrollRef: RefObject<HTMLDivElement | null>;
};

type MusicXmlWorkspaceProps = {
  isBpmOverlayVisible: boolean;
  isDrawerHovered: boolean;
  isDrawerPinned: boolean;
  isRightDrawerHovered: boolean;
  isRightDrawerPinned: boolean;
  noteHighwayProps: ComponentProps<typeof NoteHighway>;
  onCenterContextMenu: () => void;
  onCenterWheel: (deltaY: number) => void;
  onDrawerHoverChange: (isHovered: boolean) => void;
  onRightDrawerHoverChange: (isHovered: boolean) => void;
  onTogglePlayback: () => void;
  scoreSettingsProps: ComponentProps<typeof ScoreSettingsPanel>;
  tempo: number;
  transposeControlsProps: ComponentProps<typeof TransposeControls>;
};

type EndStatsOverlayProps = {
  accuracy: number;
  gameStats: GameStats;
  onDismiss: () => void;
};

const formatDuration = (durationSeconds: number) => {
  const totalSeconds = Math.max(0, Math.round(durationSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const MidiSummaryMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-gray-800 bg-gray-900/80 px-3 py-2">
    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{label}</p>
    <p className="mt-1 text-sm font-bold text-gray-100">{value}</p>
  </div>
);

export const ScoreWindowPanel = ({
  alphaTabProps,
  alphaTabRef,
  gpScorePaneHeightPx,
  midiSummary,
  isTopDrawerHovered,
  isTopDrawerPinned,
  onTopDrawerHoverChange,
  onToggleTopPinned,
  osmdRef,
  scoreFormat,
  sheetScrollRef,
}: ScoreWindowPanelProps) => (
  <>
    <div
      className="absolute left-0 right-0 top-0 h-4 z-40 hidden lg:block cursor-ns-resize"
      onMouseEnter={() => onTopDrawerHoverChange(true)}
    />

    <div
      className={`w-full shrink-0 transition-all duration-300 ease-in-out grid bg-white relative z-30
        ${isTopDrawerHovered || isTopDrawerPinned ? "grid-rows-[1fr] opacity-100 border-b border-gray-800 shadow-2xl" : "grid-rows-[0fr] opacity-0 border-b-0 shadow-none"}
      `}
      onMouseLeave={() => onTopDrawerHoverChange(false)}
    >
      <div className="overflow-hidden w-full max-w-full relative">
        <button
          onClick={onToggleTopPinned}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors p-1 z-50 bg-white/80 rounded"
          title={isTopDrawerPinned ? "Unpin score" : "Pin score"}
        >
          {isTopDrawerPinned ? <Pin size={16} className="text-emerald-500" /> : <PinOff size={16} />}
        </button>
        <div
          ref={sheetScrollRef}
          className={`${scoreFormat === "guitar-pro" ? "" : "h-48 min-h-[180px]"} w-full overflow-x-auto overflow-y-hidden bg-white text-black scrollbar-hide`}
          style={scoreFormat === "guitar-pro" ? { height: `${gpScorePaneHeightPx}px`, minHeight: `${gpScorePaneHeightPx}px` } : undefined}
        >
          {scoreFormat === "musicxml" ? (
            <div ref={osmdRef} className="h-full flex items-center min-w-max" />
          ) : scoreFormat === "guitar-pro" ? (
            <AlphaTabViewer ref={alphaTabRef} {...alphaTabProps} />
          ) : scoreFormat === "midi" ? (
            <div className="h-full w-full bg-gray-950 px-6 py-5 text-white">
              {midiSummary ? (
                <div className="mx-auto flex h-full max-w-5xl flex-col justify-center gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black uppercase tracking-wider text-emerald-300">
                      {midiSummary.fileName}
                    </p>
                    <p className="truncate text-xs font-semibold text-gray-400">
                      {midiSummary.partLabel}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MidiSummaryMetric label="Notes" value={String(midiSummary.noteCount)} />
                    <MidiSummaryMetric label="Duration" value={formatDuration(midiSummary.durationSeconds)} />
                    <MidiSummaryMetric label="Initial tempo" value={`${Math.round(midiSummary.initialTempoBpm)} BPM`} />
                    <MidiSummaryMetric label="Tempo changes" value={String(midiSummary.tempoChangeCount)} />
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-bold text-gray-500">
                  Preparing MIDI file…
                </div>
              )}
            </div>
          ) : (
            <div className="h-full w-full bg-gray-950" />
          )}
        </div>
      </div>
    </div>
  </>
);

export const MusicXmlWorkspace = ({
  isBpmOverlayVisible,
  isDrawerHovered,
  isDrawerPinned,
  isRightDrawerHovered,
  isRightDrawerPinned,
  noteHighwayProps,
  onCenterContextMenu,
  onCenterWheel,
  onDrawerHoverChange,
  onRightDrawerHoverChange,
  onTogglePlayback,
  scoreSettingsProps,
  tempo,
  transposeControlsProps,
}: MusicXmlWorkspaceProps) => (
  <div className="flex-1 w-full overflow-hidden bg-gray-950 relative">
    <div
      className="absolute left-0 top-0 bottom-0 w-6 z-40 hidden lg:block cursor-ew-resize"
      onMouseEnter={() => onDrawerHoverChange(true)}
    />
    <div
      className="absolute right-0 top-0 bottom-0 w-6 z-40 hidden lg:block cursor-ew-resize"
      onMouseEnter={() => onRightDrawerHoverChange(true)}
    />

    <div className="h-full w-full p-4 sm:p-6 overflow-hidden flex flex-col">
      <div className="flex flex-col lg:flex-row gap-4 h-full items-start w-full">
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 lg:h-full
            ${isDrawerHovered || isDrawerPinned ? "lg:w-[288px] lg:opacity-100" : "lg:w-0 lg:opacity-0"}
          `}
          onMouseLeave={() => onDrawerHoverChange(false)}
        >
          <div className="w-full lg:w-72 h-full">
            <ScoreSettingsPanel {...scoreSettingsProps} />
          </div>
        </div>

        <div
          className="flex-[1_1_auto] w-full h-full overflow-hidden flex flex-col min-w-0 order-first lg:order-none cursor-pointer relative"
          onClick={onTogglePlayback}
          onContextMenu={(e) => {
            e.preventDefault();
            onCenterContextMenu();
          }}
          onWheel={(e) => onCenterWheel(e.deltaY)}
        >
          <div
            className={`absolute inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-500 ease-in-out
              ${isBpmOverlayVisible ? "opacity-100" : "opacity-0"}
            `}
          >
            <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700 shadow-2xl rounded-2xl p-6 flex flex-col items-center gap-2 transform scale-110">
              <Gauge size={48} className="text-emerald-500 opacity-80" />
              <span className="text-4xl font-black tracking-tighter text-white">
                {tempo} <span className="text-xl text-emerald-500/80">BPM</span>
              </span>
            </div>
          </div>

          <NoteHighway {...noteHighwayProps} />
        </div>

        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 lg:h-full
            ${isRightDrawerHovered || isRightDrawerPinned ? "lg:w-[288px] lg:opacity-100" : "lg:w-0 lg:opacity-0"}
          `}
          onMouseLeave={() => onRightDrawerHoverChange(false)}
        >
          <div className="w-full lg:w-72 h-full">
            <TransposeControls {...transposeControlsProps} />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const EndStatsOverlay = ({
  accuracy,
  gameStats,
  onDismiss,
}: EndStatsOverlayProps) => (
  <div
    className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
    onClick={onDismiss}
  >
    <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl px-12 py-8 text-center space-y-4">
      <h2 className="text-2xl font-black text-white tracking-widest uppercase">Song Complete!</h2>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-lg">
        <span className="text-gray-400 text-right">Hits</span>
        <span className="text-emerald-400 font-black text-left">{gameStats.hits}</span>
        <span className="text-gray-400 text-right">Misses</span>
        <span className="text-red-400 font-black text-left">{gameStats.misses}</span>
        <span className="text-gray-400 text-right">Streak</span>
        <span className="text-amber-400 font-black text-left">{gameStats.streak}</span>
        <span className="text-gray-400 text-right">Accuracy</span>
        <span className="text-white font-black text-left">{accuracy}%</span>
      </div>
      <p className="text-gray-500 text-xs mt-4">Press any key or click to continue</p>
    </div>
  </div>
);

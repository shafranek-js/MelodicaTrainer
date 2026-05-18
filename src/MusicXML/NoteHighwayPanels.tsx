import { forwardRef } from "react";
import type { CSSProperties } from "react";
import { Mic } from "lucide-react";
import { Note } from "tonal";
import { MelodicaKeyboard } from "../Melodica/MelodicaKeyboard";
import type { MelodicaKeyboardGeometry, MelodicaLayout } from "../utils/utils";
import { PhantomHand } from "./PhantomHand";
import type { NoteHighwayRenderItem } from "./noteHighwayLayout";
import type { FingerVisualState } from "./usePhantomHand";

type DetectedNote = {
  note: string;
  cents: number;
};

type PitchStatusBarProps = {
  clarity: string | null;
  detectedNote: DetectedNote | null;
  isPlaying: boolean;
  pitchError: string | null;
};

export const PitchStatusBar = ({
  clarity,
  detectedNote,
  isPlaying,
  pitchError,
}: PitchStatusBarProps) => (
  <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-300 pointer-events-none z-[60]">
    <span className="inline-flex items-center gap-2 rounded border border-gray-800 bg-gray-900/90 px-2 py-1">
      <Mic size={14} />
      {pitchError
        ? "Mic unavailable"
        : detectedNote
          ? `${Note.pitchClass(detectedNote.note)} ${
              detectedNote.cents > 0 ? "+" : ""
            }${Math.round(detectedNote.cents)}c`
          : isPlaying
            ? "Listening"
            : "Press play"}
    </span>
    <span className="rounded border border-gray-800 bg-gray-900/90 px-2 py-1">
      Clarity {clarity || "-"}
    </span>
  </div>
);

type LaneTracksProps = {
  keys: MelodicaKeyboardGeometry["keys"];
};

export const LaneTracks = ({ keys }: LaneTracksProps) => (
  <>
    {keys.map((key) => (
      <div
        key={`lane-track-${key.midi}`}
        className={`absolute bottom-0 top-0 border-x border-gray-800/20 ${
          key.isBlack ? "bg-violet-950/25" : "bg-white/[0.03]"
        }`}
        style={{ left: `${key.leftPct}%`, width: `${key.widthPct}%` }}
      >
        {!key.isBlack && (
          <div className="mt-2 text-center text-[9px] font-bold text-gray-700">
            {key.index}
          </div>
        )}
      </div>
    ))}
  </>
);

type NoteTilesProps = {
  renderData: NoteHighwayRenderItem[];
  showNoteNames: boolean;
  showNumbers?: boolean;
};

export const NoteTiles = ({
  renderData,
  showNoteNames,
  showNumbers,
}: NoteTilesProps) => (
  <>
    {renderData.map(
      (data) =>
        data.isVisible && (
          <div
            key={`candy-${data.key}`}
            className={`
              absolute box-border flex items-center justify-center
              text-xs font-black z-30
              rounded-[22px]
              ${data.isBlack ? "!rounded-[4px]" : ""}
              ${
                data.wasHit
                  ? "z-[60] animate-[candyPop_0.35s_ease-out]"
                  : "animate-[candyDrop_0.35s_cubic-bezier(0.34,1.56,0.64,1)]"
              }
            `}
            style={{
              left: `${data.htmlLeft}%`,
              top: `${data.htmlTop}%`,
              width: `${data.htmlWidth}%`,
              height: `${data.htmlHeight}%`,
              backgroundColor: data.color,
              backgroundImage: `
                linear-gradient(180deg, rgba(255,255,255,0.32) 0%, ${data.color} 10%, ${data.color} 38%, ${data.colorBody} 72%, rgba(0,0,0,0.18) 100%),
                repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.08) 8px, rgba(255,255,255,0.08) 10px),
                repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.05) 8px, rgba(255,255,255,0.05) 10px)
              `.replace(/\s+/g, " ").trim(),
              boxShadow: data.wasHit
                ? `
                  inset 0 1px 0 rgba(255,255,255,0.7),
                  0 0 28px 6px rgba(255,255,255,0.5),
                  0 0 56px 12px ${data.color}
                `.replace(/\s+/g, " ").trim()
                : `
                  inset 0 1px 0 rgba(255,255,255,0.55),
                  inset 0 -4px 8px rgba(0,0,0,0.3),
                  0 10px 22px rgba(0,0,0,0.55)
                `.replace(/\s+/g, " ").trim(),
              willChange: "transform",
            }}
          >
            <div
              className={`absolute inset-0 ${data.isBlack ? "rounded-[4px]" : "rounded-[22px]"} pointer-events-none overflow-hidden`}
              style={{ mixBlendMode: "overlay" as CSSProperties["mixBlendMode"] }}
            >
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  top: "4%",
                  left: "14%",
                  width: "32%",
                  height: "18%",
                  background:
                    "radial-gradient(ellipse at center, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.4) 40%, transparent 75%)",
                }}
              />
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  bottom: "10%",
                  right: "12%",
                  width: "14%",
                  height: "8%",
                  background:
                    "radial-gradient(ellipse at center, rgba(255,255,255,0.25) 0%, transparent 75%)",
                }}
              />
            </div>

            {data.sparkleSeed % 3 === 0 && (
              <span
                className="absolute pointer-events-none text-[10px] text-white/70 z-10"
                style={{
                  top: `${8 + (data.sparkleSeed * 7) % 45}%`,
                  right: `${6 + (data.sparkleSeed * 13) % 32}%`,
                  filter: "drop-shadow(0 0 3px rgba(255,255,255,0.9))",
                }}
              >
                ✦
              </span>
            )}

            {(showNumbers ?? true) && data.finger !== undefined && (
              <span className="relative z-20 text-[15px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] pointer-events-none">
                {data.finger}
              </span>
            )}

            {showNoteNames && (
              <span className="relative z-20 drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] text-white pointer-events-none text-[11px]">
                {data.noteName}
              </span>
            )}

            {data.wasHit && (
              <div
                className={`absolute inset-0 ${data.isBlack ? "rounded-[4px]" : "rounded-[20px]"} bg-white/60 animate-[candyFlash_0.35s_ease-out] pointer-events-none`}
              />
            )}

            {data.wasHit &&
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`hit-sparkle-${i}`}
                  className="absolute w-[5px] h-[5px] rounded-full bg-white pointer-events-none"
                  style={{
                    left: "50%",
                    top: "50%",
                    animation: `candySparkle${i + 1} 0.55s ease-out forwards`,
                    animationDelay: `${i * 0.04}s`,
                    boxShadow: "0 0 5px 3px rgba(255,255,255,0.9)",
                  }}
                />
              ))}

            {data.showClarity && (
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-black/35 overflow-hidden rounded-t-[20px] z-10">
                <div
                  className={`h-full transition-[width] duration-75 ${
                    data.clarityValue >= 0.82
                      ? "bg-emerald-300"
                      : "bg-yellow-300"
                  }`}
                  style={{ width: `${data.clarityValue * 100}%` }}
                />
              </div>
            )}
          </div>
        ),
    )}
  </>
);

type KeyboardAndHandOverlayProps = {
  activeKeyboardMidi: Map<number, string>;
  handOffsetPct: number;
  layout: MelodicaLayout;
  onSvgWidthChange: (width: number) => void;
  phantomStates?: FingerVisualState[];
  showVirtualHand?: boolean;
};

export const KeyboardAndHandOverlay = forwardRef<
  HTMLDivElement,
  KeyboardAndHandOverlayProps
>(
  (
    {
      activeKeyboardMidi,
      handOffsetPct,
      layout,
      onSvgWidthChange,
      phantomStates,
      showVirtualHand,
    },
    ref,
  ) => (
    <>
      <div
        ref={ref}
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-44 lg:h-56 z-[40]"
      >
        <MelodicaKeyboard
          formatPitchClass={(pitchClass) => pitchClass}
          getKeyState={(key) => ({
            activeColor: activeKeyboardMidi.get(key.midi),
            isActive: activeKeyboardMidi.has(key.midi),
          })}
          heightClassName="h-44 lg:h-56"
          innerInsetClassName="inset-0"
          layout={layout}
          minWhiteKeyWidthPx={0}
          showOctaves
          showNoteNames
        />
      </div>

      <PhantomHand
        fingerStates={phantomStates ?? ["idle", "idle", "idle", "idle", "idle"]}
        visible={showVirtualHand ?? false}
        handOffsetPct={handOffsetPct}
        onSvgWidthChange={onSvgWidthChange}
      />
    </>
  ),
);

type TargetLineProps = {
  isWaiting?: boolean;
  targetLinePercent: number;
};

export const TargetLine = ({ isWaiting, targetLinePercent }: TargetLineProps) => (
  <div
    className={`absolute left-0 right-0 h-[1px] -translate-y-1/2 pointer-events-none ${
      isWaiting
        ? "bg-amber-400/90 animate-pulse shadow-[0_0_12px_4px_rgba(251,191,36,0.5)]"
        : "bg-gray-600/60"
    }`}
    style={{ top: `${targetLinePercent}%`, zIndex: 35 }}
  />
);

type ScreenReaderKeyLabelsProps = {
  keys: MelodicaKeyboardGeometry["keys"];
  targetLinePercent: number;
};

export const ScreenReaderKeyLabels = ({
  keys,
  targetLinePercent,
}: ScreenReaderKeyLabelsProps) => (
  <>
    {keys.map((key) => (
      <div
        key={`key-label-${key.midi}`}
        className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-[50] pointer-events-none"
        style={{ left: `${key.centerPct}%`, top: `${targetLinePercent}%` }}
      >
        <span className="sr-only">{key.name}</span>
      </div>
    ))}
  </>
);

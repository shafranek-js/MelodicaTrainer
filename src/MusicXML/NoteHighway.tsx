import { Mic } from "lucide-react";
import { Note } from "tonal";
import { useRef, useEffect, useMemo, useState } from "react";
import { generateMelodicaLayout, getMelodicaKeyboardGeometry } from "../utils/utils";
import type { MelodicaKeyCount, freqToNoteAndCents } from "../utils/utils";
import { buildNoteHighwayRenderData } from "./noteHighwayLayout";
import type { VisibleGameEvent } from "./types";
import { MelodicaKeyboard } from "../Melodica/MelodicaKeyboard";
import { PhantomHand } from "./PhantomHand";
import type { FingerVisualState } from "./usePhantomHand";

type DetectedNote = NonNullable<ReturnType<typeof freqToNoteAndCents>>;

type NoteHighwayProps = {
  clarity: string | null;
  detectedNote: DetectedNote | null;
  isPlaying: boolean;
  keyCount: MelodicaKeyCount;
  lastHitIndex: number | null;
  pitchError: string | null;
  shortestNoteDurationMs: number;
  showNoteNames: boolean;
  visibleGameEvents: VisibleGameEvent[];
  visualPlayheadMs: number;
  isGp?: boolean;
  fingerAssignments?: Map<string, number>;
  showNumbers?: boolean;
  phantomStates?: FingerVisualState[];
  activeMidi?: number | null;
  activeFinger?: number | null;
  showVirtualHand?: boolean;
  isWaiting?: boolean;
};

export const NoteHighway = ({
  clarity,
  detectedNote,
  isPlaying,
  keyCount,
  lastHitIndex,
  pitchError,
  shortestNoteDurationMs,
  showNoteNames,
  visibleGameEvents,
  visualPlayheadMs,
  fingerAssignments,
  showNumbers,
  phantomStates,
  activeMidi,
  activeFinger,
  showVirtualHand,
  isWaiting,
}: NoteHighwayProps) => {

  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [keyboardHeightPx, setKeyboardHeightPx] = useState(176);
  const [measuredSvgWidth, setMeasuredSvgWidth] = useState(316);

  useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const observer = new ResizeObserver(entries => {
          for (const entry of entries) {
              setContainerWidth(entry.contentRect.width);
              setContainerHeight(entry.contentRect.height);
          }
      });
      observer.observe(el);
      return () => observer.disconnect();
  }, []);

  useEffect(() => {
      const el = keyboardRef.current;
      if (!el) return;
      const observer = new ResizeObserver(entries => {
          for (const entry of entries) {
              setKeyboardHeightPx(entry.contentRect.height);
          }
      });
      observer.observe(el);
      return () => observer.disconnect();
  }, []);

  const targetLinePercent = containerHeight > 0
    ? ((containerHeight - keyboardHeightPx) / containerHeight) * 100
    : 65; // fallback

  const melodicaLayout = useMemo(() => generateMelodicaLayout(keyCount), [keyCount]);
  const keyboardGeometry = useMemo(
    () => getMelodicaKeyboardGeometry(melodicaLayout),
    [melodicaLayout]
  );

  // Compute hand horizontal offset so the active fingertip aligns with its key.
  const handOffsetPct = useMemo(() => {
    if (activeMidi == null || activeFinger == null || containerWidth === 0) return 0;
    const key = keyboardGeometry.keys.find(k => k.midi === activeMidi);
    if (!key) return 0;
    const fingerTipX: Record<number, number> = { 1: 15, 2: 55, 3: 100, 4: 140, 5: 175 };
    const tipX = fingerTipX[activeFinger] ?? 100;
    const svgWidth = measuredSvgWidth > 0 ? measuredSvgWidth : 316;
    const keyCenterPx = (key.centerPct / 100) * containerWidth;
    const fingerScreenPx = (containerWidth - svgWidth) / 2 + (tipX / 200) * svgWidth;
    return ((keyCenterPx - fingerScreenPx) / svgWidth) * 100;
  }, [activeMidi, activeFinger, containerWidth, measuredSvgWidth, keyboardGeometry.keys]);
  const renderData = buildNoteHighwayRenderData({
      clarity,
      containerWidth,
      lastHitIndex,
      keyCount,
      shortestNoteDurationMs,
      visibleGameEvents,
      visualPlayheadMs,
      fingerAssignments,
      targetLinePercent,
  });
  const activeKeyboardMidi = useMemo(() => {
    const active = new Map<number, string>();

    renderData.forEach((data) => {
      if (!data.isVisible || !data.isSounding) return;
      const key = keyboardGeometry.keys[data.laneIndex];
      if (key) active.set(key.midi, data.color);
    });

    return active;
  }, [keyboardGeometry.keys, renderData]);

  return (
    <div className="flex h-full w-full min-w-0 flex-col rounded-lg border border-gray-700 bg-gray-900 p-4 shadow overflow-hidden">
      <div className="flex-1 w-full overflow-hidden">
        <div className="relative h-full overflow-hidden rounded border border-gray-800 bg-gray-950" id="highway-container" ref={containerRef}>
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

          {/* Lane tracks */}
          {keyboardGeometry.keys.map((key) => (
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

          {/* ── Glossy candy blocks ── */}
          {renderData.map(data => data.isVisible && (
              <div
                  key={`candy-${data.key}`}
                  className={`
                    absolute box-border flex items-center justify-center
                    text-xs font-black z-30
                    rounded-[22px]
                    ${data.isBlack ? "!rounded-[4px]" : ""}
                    ${data.wasHit
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
                  {/* ── Specular gloss (single overlay layer for GPU) ── */}
                  <div
                    className={`absolute inset-0 ${data.isBlack ? "rounded-[4px]" : "rounded-[22px]"} pointer-events-none overflow-hidden`}
                    style={{ mixBlendMode: "overlay" as React.CSSProperties["mixBlendMode"] }}
                  >
                    <div
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        top: "4%",
                        left: "14%",
                        width: "32%",
                        height: "18%",
                        background: "radial-gradient(ellipse at center, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.4) 40%, transparent 75%)",
                      }}
                    />
                    <div
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        bottom: "10%",
                        right: "12%",
                        width: "14%",
                        height: "8%",
                        background: "radial-gradient(ellipse at center, rgba(255,255,255,0.25) 0%, transparent 75%)",
                      }}
                    />
                  </div>

                  {/* Sparkle ✦ (1 in 3 blocks) */}
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

                  {/* Finger hint — only in "numbers" mode */}
                  {(showNumbers ?? true) && data.finger !== undefined && (
                    <span className="relative z-20 text-[15px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] pointer-events-none">
                      {data.finger}
                    </span>
                  )}

                  {/* Note name */}
                  {showNoteNames && (
                    <span className="relative z-20 drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] text-white pointer-events-none text-[11px]">
                      {data.noteName}
                    </span>
                  )}

                  {/* Hit flash */}
                  {data.wasHit && (
                    <div className={`absolute inset-0 ${data.isBlack ? "rounded-[4px]" : "rounded-[20px]"} bg-white/60 animate-[candyFlash_0.35s_ease-out] pointer-events-none`} />
                  )}

                  {/* Hit sparkle burst */}
                  {data.wasHit && Array.from({ length: 6 }).map((_, i) => (
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

                  {/* Clarity bar */}
                  {data.showClarity && (
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-black/35 overflow-hidden rounded-t-[20px] z-10">
                      <div
                        className={`h-full transition-[width] duration-75 ${
                          data.clarityValue >= 0.82 ? "bg-emerald-300" : "bg-yellow-300"
                        }`}
                        style={{ width: `${data.clarityValue * 100}%` }}
                      />
                    </div>
                  )}
              </div>
          ))}

          {/* Bottom keyboard overlay */}
          <div
            ref={keyboardRef}
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
              layout={melodicaLayout}
              minWhiteKeyWidthPx={0}
              showOctaves
              showNoteNames
            />
          </div>

          {/* Phantom hand overlay */}
          <PhantomHand
            fingerStates={phantomStates ?? ["idle","idle","idle","idle","idle"]}
            visible={showVirtualHand ?? false}
            handOffsetPct={handOffsetPct}
            onSvgWidthChange={setMeasuredSvgWidth}
          />

          {/* Target line — pulses in study mode */}
          <div
            className={`absolute left-0 right-0 h-[1px] -translate-y-1/2 pointer-events-none ${
              isWaiting
                ? "bg-amber-400/90 animate-pulse shadow-[0_0_12px_4px_rgba(251,191,36,0.5)]"
                : "bg-gray-600/60"
            }`}
            style={{ top: `${targetLinePercent}%`, zIndex: 35 }}
          />

          {/* Screen-reader labels */}
          {keyboardGeometry.keys.map((key) => (
            <div
              key={`key-label-${key.midi}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-[50] pointer-events-none"
              style={{ left: `${key.centerPct}%`, top: `${targetLinePercent}%` }}
            >
               <span className="sr-only">
                {key.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

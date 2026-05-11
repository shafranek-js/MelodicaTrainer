import { Mic } from "lucide-react";
import { Note } from "tonal";
import React, { useRef, useEffect, useState } from "react";
import type { freqToNoteAndCents } from "../utils/utils";
import {
  NOTE_HIGHWAY_LOOKAHEAD_MS,
  NOTE_HIT_WINDOW_MS,
  NOTE_TARGET_LINE_PERCENT,
} from "./constants";
import { getTabHole } from "./playbackParser";
import type { VisibleGameEvent, PlaybackEvent, PlaybackTiming } from "./types";

type DetectedNote = NonNullable<ReturnType<typeof freqToNoteAndCents>>;

type NoteHighwayProps = {
  clarity: string | null;
  detectedNote: DetectedNote | null;
  isPlaying: boolean;
  lastHitIndex: number | null;
  pitchError: string | null;
  shortestNoteDurationMs: number;
  showNoteNames: boolean;
  visibleGameEvents: VisibleGameEvent[];
  visualPlayheadMs: number;
  playbackEvents: PlaybackEvent[];
  playbackTimeline: PlaybackTiming[];
};

const getTargetWidthPct = (tab: string, containerWidthPx: number) => {
    const isOverblow = tab.toLowerCase().endsWith("o");
    let bendDepth = 0;
    const bendMatch = tab.match(/('+|"+)$/);
    if (bendMatch) {
        bendDepth = bendMatch[1].includes('"') ? 2 : bendMatch[1].length;
    }
    
    // Calculate the percentage of the full container that represents 40px
    // If containerWidthPx is 0 (not yet measured), use a safe fallback (e.g. assuming a 1000px wide screen)
    const minWidthPct = containerWidthPx > 0 ? (40 / containerWidthPx) * 100 : 4.0;
    
    // Widths are percentages of the total screen width (100 = full screen, 10 = one lane)
    let targetPct = 8.4; // Natural note
    if (isOverblow) targetPct = 11;
    else if (bendDepth === 1) targetPct = 6.5;
    else if (bendDepth === 2) targetPct = 4.8;
    else if (bendDepth >= 3) targetPct = 3.0;

    // Enforce minimum width of 40px
    return Math.max(targetPct, minWidthPct);
};

export const NoteHighway = ({
  clarity,
  detectedNote,
  isPlaying,
  lastHitIndex,
  pitchError,
  shortestNoteDurationMs,
  showNoteNames,
  visibleGameEvents,
  visualPlayheadMs,
  playbackEvents,
  playbackTimeline,
}: NoteHighwayProps) => {

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const observer = new ResizeObserver(entries => {
          for (let entry of entries) {
              setContainerWidth(entry.contentRect.width);
          }
      });
      observer.observe(el);
      return () => observer.disconnect();
  }, []);

  const renderData = visibleGameEvents.flatMap(({ event, index: globalEventIndex, timing }) => {
      return event.notes.map((note, noteIndex) => {
          const tab = event.tabs[noteIndex] || event.tabs[0] || "";
          const hole = getTabHole(tab);
          if (hole === null || hole < 1 || hole > 10) return null;

          const laneIndex = hole - 1;
          const timeToHitMs = timing.startMs - visualPlayheadMs;
          
          const containerHeightPx = 520; 
          const msPerPx = shortestNoteDurationMs / 40;
          const dynamicLookaheadMs = containerHeightPx * msPerPx;
          const percentPerMs = NOTE_TARGET_LINE_PERCENT / dynamicLookaheadMs;
          
          const topPercent = NOTE_TARGET_LINE_PERCENT - (timeToHitMs * percentPerMs);
          const heightPercent = timing.durationMs * percentPerMs;

          const targetWidth = getTargetWidthPct(tab, containerWidth);
          let bottomWidth = targetWidth;
          const topWidth = targetWidth;
          
          let yBottom = topPercent;
          const yTop = topPercent - heightPercent;
          
          let isScoop = false;

          // Check for contiguous previous note on the same lane to create trapezoid scoop
          if (globalEventIndex > 0) {
              const prevTiming = playbackTimeline[globalEventIndex - 1];
              // Use a small tolerance for "contiguous" due to float math
              if (prevTiming && Math.abs(prevTiming.endMs - timing.startMs) < 10) {
                  const prevEvent = playbackEvents[globalEventIndex - 1];
                  const prevNoteIndex = prevEvent.tabs.findIndex(t => getTabHole(t) === hole);
                  if (prevNoteIndex !== -1) {
                      const prevTab = prevEvent.tabs[prevNoteIndex];
                      if (prevTab !== tab) {
                          bottomWidth = getTargetWidthPct(prevTab, containerWidth);
                          isScoop = true;
                      }
                  }
              }
          }

          // If it's a repeated identical note, we want a tiny gap so they don't merge into one infinite pill
          if (!isScoop) {
              yBottom -= 0.4; 
          }

          const isHitWindow = visualPlayheadMs >= timing.startMs - NOTE_HIT_WINDOW_MS && visualPlayheadMs <= timing.endMs + NOTE_HIT_WINDOW_MS;
          const isStrictlyActive = visualPlayheadMs >= timing.startMs && visualPlayheadMs <= timing.endMs;
          const wasHit = lastHitIndex === globalEventIndex && isHitWindow;
          
          const isDraw = tab.startsWith("-");
          const isBlow = /^\d/.test(tab);
          
          let color = "#374151"; // gray-800
          if (wasHit) {
              color = "#34d399"; // emerald-400
          } else if (isStrictlyActive) {
              color = isDraw ? "#60a5fa" : (isBlow ? "#f87171" : "#22d3ee"); 
          } else {
              color = isDraw ? "#1e3a8a" : (isBlow ? "#7f1d1d" : "#1f2937"); 
          }

          const isOverblow = tab.toLowerCase().endsWith("o");
          let bendDepth = 0;
          const bendMatch = tab.match(/('+|"+)$/);
          if (bendMatch) {
              bendDepth = bendMatch[1].includes('"') ? 2 : bendMatch[1].length;
          }

          const centerX = laneIndex * 10 + 5;
          
          const tlX = centerX - topWidth / 2;
          const trX = centerX + topWidth / 2;
          const brX = centerX + bottomWidth / 2;
          const blX = centerX - bottomWidth / 2;

          // Target 20px corner radius, converted to percentage coordinates based on physical dimensions.
          // Container height is assumed ~520px, width is measured dynamically. Fallback to 1000px if 0.
          const effContainerWidth = containerWidth > 0 ? containerWidth : 1000;
          const targetRadiusPx = 20;
          
          const idealRXPercent = (targetRadiusPx / effContainerWidth) * 100;
          const idealRYPercent = (targetRadiusPx / containerHeightPx) * 100;

          // Cap the radius so curves don't overlap on very narrow/short blocks
          const heightPct = Math.max(0, yBottom - yTop);
          const maxRY = heightPct / 2;
          const maxRXTop = topWidth / 2;
          const maxRXBot = bottomWidth / 2;

          const actualRY = Math.min(idealRYPercent, maxRY);
          // For a perfect circle visually, the percentage ratio RX/RY must equal (HeightPx/WidthPx).
          // However, because we cap them, we scale RX proportionally if RY is capped, and vice-versa,
          // to maintain the circular curve shape as long as possible.
          let rxTop = idealRXPercent;
          let ryTop = idealRYPercent;
          if (idealRYPercent > maxRY || idealRXPercent > maxRXTop) {
             const scale = Math.min(maxRY / idealRYPercent, maxRXTop / idealRXPercent);
             rxTop = idealRXPercent * scale;
             ryTop = idealRYPercent * scale;
          }

          let rxBot = idealRXPercent;
          let ryBot = idealRYPercent;
          if (idealRYPercent > maxRY || idealRXPercent > maxRXBot) {
             const scale = Math.min(maxRY / idealRYPercent, maxRXBot / idealRXPercent);
             rxBot = idealRXPercent * scale;
             ryBot = idealRYPercent * scale;
          }

          // Use SVG Arc (A) command for perfect elliptical rendering. 
          // Q (quadratic bezier) is only an approximation of a circle. 
          // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
          const pathD = `
            M ${tlX + rxTop},${yTop}
            L ${trX - rxTop},${yTop}
            A ${rxTop} ${ryTop} 0 0 1 ${trX},${yTop + ryTop}
            L ${brX},${yBottom - ryBot}
            A ${rxBot} ${ryBot} 0 0 1 ${brX - rxBot},${yBottom}
            L ${blX + rxBot},${yBottom}
            A ${rxBot} ${ryBot} 0 0 1 ${blX},${yBottom - ryBot}
            L ${tlX},${yTop + ryTop}
            A ${rxTop} ${ryTop} 0 0 1 ${tlX + rxTop},${yTop}
            Z
          `;

          const isVisible = !(yBottom < -10 || yTop > 110);

          // We also want a slightly inset box for the HTML overlays so they perfectly center inside the polygon
          // We'll use the max width of the trapezoid for the HTML container.
          const maxHtmlWidth = Math.max(topWidth, bottomWidth);

          return {
              key: `${globalEventIndex}-${note.name}-${noteIndex}`,
              pathD,
              color,
              wasHit,
              isVisible,
              showClarity: isHitWindow && !wasHit && clarity,
              clarityValue: clarity ? parseFloat(clarity) : 0,
              noteName: Note.pitchClass(note.name),
              isOverblow,
              bendDepth,
              laneIndex,
              htmlLeft: centerX - maxHtmlWidth / 2,
              htmlTop: yTop,
              htmlHeight: heightPercent,
              htmlWidth: maxHtmlWidth
          };
      }).filter(n => n !== null);
  });

  return (
    <div className="flex h-full w-full min-w-0 flex-col rounded-lg border border-gray-700 bg-gray-900 p-4 shadow overflow-hidden">
      <div className="flex-1 w-full overflow-hidden">
        <div className="relative h-full overflow-hidden rounded border border-gray-800 bg-gray-950" id="highway-container">
          
          {/* Lane tracks with alternating backgrounds */}
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={`lane-track-${i}`}
              className={`absolute bottom-0 top-0 border-x border-gray-800/20 ${
                i % 2 === 0 ? "bg-white/[0.03]" : "bg-transparent"
              }`}
              style={{ left: `${(i / 10) * 100}%`, width: "10%" }}
            >
              <div className="mt-2 text-center text-[10px] font-bold text-gray-700">{i + 1}</div>
            </div>
          ))}

          {/* MASTER SVG CANVAS FOR POLygons */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible z-10 pointer-events-none">
              {renderData.map(data => data.isVisible && (
                  <path 
                      key={data.key}
                      d={data.pathD}
                      fill={data.color}
                      stroke={data.wasHit ? "white" : "black"}
                      strokeWidth={data.wasHit ? 0.3 : 0.15}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      className={data.wasHit ? "drop-shadow-[0_0_8px_rgba(52,211,153,1)]" : "drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"}
                  />
              ))}
          </svg>

          {/* HTML OVERLAYS (Labels, Clarity, Arrows) */}
          {renderData.map(data => data.isVisible && (
              <div
                  key={`overlay-${data.key}`}
                  className={`absolute box-border flex items-center justify-center text-xs font-bold ${data.wasHit ? "z-[60]" : "z-20"}`}
                  style={{
                      left: `${data.htmlLeft}%`,
                      top: `${data.htmlTop}%`,
                      width: `${data.htmlWidth}%`,
                      height: `${data.htmlHeight}%`,
                  }}
              >
                  {/* Advanced Notation External Arrows */}
                  {data.isOverblow && (
                    <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-between pointer-events-none w-full z-10">
                      <div className="absolute right-full mr-[1px] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,1)] leading-none text-[12px] font-black">◀</div>
                      <div className="absolute left-full ml-[1px] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,1)] leading-none text-[12px] font-black">▶</div>
                    </div>
                  )}
                  {data.bendDepth > 0 && (
                    <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-between pointer-events-none w-full z-10">
                      <div className="flex flex-col gap-[1px] absolute right-full mr-[1px]">
                        {Array.from({ length: data.bendDepth }).map((_, i) => (
                          <div key={i} className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,1)] leading-none text-[12px] font-black">▶</div>
                        ))}
                      </div>
                      <div className="flex flex-col gap-[1px] absolute left-full ml-[1px]">
                        {Array.from({ length: data.bendDepth }).map((_, i) => (
                          <div key={i} className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,1)] leading-none text-[12px] font-black">◀</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clarity Indicator (Progress bar at the top of active note) */}
                  {data.showClarity && (
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-black/40 overflow-hidden rounded-t-[20px]">
                      <div 
                        className={`h-full transition-[width] duration-75 ${
                          data.clarityValue >= 0.82 ? "bg-emerald-400" : "bg-yellow-400"
                        }`}
                        style={{ width: `${data.clarityValue * 100}%` }}
                      />
                    </div>
                  )}
                  
                  {data.showNoteNames && <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,1)] text-white pointer-events-none">{data.noteName}</span>}
              </div>
          ))}

          {/* Harmonica Body Visual - SVG with transparent holes */}
          <div
            className="pointer-events-none absolute left-0 right-0 h-20 -translate-y-1/2 z-[40]"
            style={{ top: `${NOTE_TARGET_LINE_PERCENT}%` }}
          >
            <svg width="100%" height="100%" preserveAspectRatio="none" className="drop-shadow-2xl">
              <defs>
                <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4b5563" />
                  <stop offset="50%" stopColor="#1f2937" />
                  <stop offset="100%" stopColor="#111827" />
                </linearGradient>
                <mask id="holeMask">
                  <rect width="100%" height="100%" fill="white" />
                  {Array.from({ length: 10 }).map((_, i) => (
                    <circle 
                      key={i} 
                      cx={`${(i / 10) * 100 + 5}%`} 
                      cy="50%" 
                      r="20" 
                      fill="black" 
                    />
                  ))}
                </mask>
              </defs>
              <rect 
                width="100%" 
                height="100%" 
                fill="url(#bodyGrad)" 
                mask="url(#holeMask)"
              />
            </svg>
          </div>
            
          {/* Gray Target Line - Visible only through holes, on top of notes */}
          <div
            className="absolute left-0 right-0 h-[1px] -translate-y-1/2 bg-gray-600/60 pointer-events-none"
            style={{ top: `${NOTE_TARGET_LINE_PERCENT}%`, zIndex: 35 }}
          />

          {/* Numbers inside the holes - Top layer (z-[50]) */}
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={`hole-label-${i}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-[50] pointer-events-none"
              style={{ left: `${(i / 10) * 100 + 5}%`, top: `${NOTE_TARGET_LINE_PERCENT}%` }}
            >
               <span className="text-lg font-extrabold leading-none text-white drop-shadow-[0_2px_3px_rgba(0,0,0,1)]">
                {i + 1}
              </span>
            </div>
          ))}

          {/* Mic / Clarity Stats Overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-300 pointer-events-none z-[60]">
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
        </div>
      </div>
    </div>
  );
};

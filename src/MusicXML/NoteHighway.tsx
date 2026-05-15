import { Mic } from "lucide-react";
import { Note } from "tonal";
import { useRef, useEffect, useMemo, useState } from "react";
import { generateMelodicaLayout, getMelodicaKeyboardGeometry } from "../utils/utils";
import type { MelodicaKeyCount, freqToNoteAndCents } from "../utils/utils";
import { NOTE_TARGET_LINE_PERCENT } from "./constants";
import { buildNoteHighwayRenderData } from "./noteHighwayLayout";
import type { VisibleGameEvent, PlaybackEvent, PlaybackTiming } from "./types";
import { MelodicaKeyboard } from "../Melodica/MelodicaKeyboard";

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
  playbackEvents: PlaybackEvent[];
  playbackTimeline: PlaybackTiming[];
  isGp?: boolean;
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
  playbackEvents,
  playbackTimeline
}: NoteHighwayProps) => {

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const observer = new ResizeObserver(entries => {
          for (const entry of entries) {
              setContainerWidth(entry.contentRect.width);
          }
      });
      observer.observe(el);
      return () => observer.disconnect();
  }, []);

  const melodicaLayout = useMemo(() => generateMelodicaLayout(keyCount), [keyCount]);
  const keyboardGeometry = useMemo(
    () => getMelodicaKeyboardGeometry(melodicaLayout),
    [melodicaLayout]
  );
  const renderData = buildNoteHighwayRenderData({
      clarity,
      containerWidth,
      lastHitIndex,
      keyCount,
      shortestNoteDurationMs,
      visibleGameEvents,
      visualPlayheadMs,
      playbackEvents,
      playbackTimeline,
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
        <div className="relative h-full overflow-hidden rounded border border-gray-800 bg-gray-950" id="highway-container">
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

          {renderData.map(data => data.isVisible && (
              <div
                  key={`overlay-${data.key}`}
                  className={`absolute box-border flex items-center justify-center border-[1.5px] border-white/50 text-xs font-bold ${
                    keyboardGeometry.keys[data.laneIndex]?.isBlack ? "rounded-[4px]" : "rounded-[18px]"
                  } ${
                    data.wasHit ? "z-[60]" : "z-30"
                  }`}
                  style={{
                      left: `${data.htmlLeft}%`,
                      top: `${data.htmlTop}%`,
                      width: `${data.htmlWidth}%`,
                      height: `${data.htmlHeight}%`,
                      backgroundColor: data.color,
                      backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.2) 100%)",
                      boxShadow: data.wasHit 
                          ? `inset 0 4px 8px rgba(255,255,255,0.7), inset 0 -4px 8px rgba(0,0,0,0.3), 0 0 20px 4px rgba(255,255,255,0.5), 0 0 10px 2px ${data.color}`
                          : "inset 0 4px 6px rgba(255,255,255,0.6), inset 0 -4px 6px rgba(0,0,0,0.3), 0 8px 16px rgba(0,0,0,0.4)",
                      opacity: 0.88,
                      backdropFilter: "blur(6px)"
                  }}
              >
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

                  {data.showClarity && (
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-black/40 overflow-hidden rounded-t-[20px] z-10">
                      <div 
                        className={`h-full transition-[width] duration-75 ${
                          data.clarityValue >= 0.82 ? "bg-emerald-400" : "bg-yellow-400"
                        }`}
                        style={{ width: `${data.clarityValue * 100}%` }}
                      />
                    </div>
                  )}
                  
                  {showNoteNames && <span className="relative z-20 drop-shadow-[0_1px_1px_rgba(0,0,0,1)] text-white pointer-events-none">{data.noteName}</span>}
              </div>
          ))}

          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-36 z-[40]"
          >
            <MelodicaKeyboard
              formatPitchClass={(pitchClass) => pitchClass}
              getKeyState={(key) => ({
                activeColor: activeKeyboardMidi.get(key.midi),
                isActive: activeKeyboardMidi.has(key.midi),
              })}
              heightClassName="h-36"
              innerInsetClassName="inset-0"
              layout={melodicaLayout}
              minWhiteKeyWidthPx={0}
              showOctaves
              showNoteNames
            />
          </div>
            
          <div
            className="absolute left-0 right-0 h-[1px] -translate-y-1/2 bg-gray-600/60 pointer-events-none"
            style={{ top: `${NOTE_TARGET_LINE_PERCENT}%`, zIndex: 35 }}
          />

          {keyboardGeometry.keys.map((key) => (
            <div
              key={`key-label-${key.midi}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-[50] pointer-events-none"
              style={{ left: `${key.centerPct}%`, top: `${NOTE_TARGET_LINE_PERCENT}%` }}
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

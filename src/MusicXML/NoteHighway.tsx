import { Mic } from "lucide-react";
import { Note } from "tonal";
import type { freqToNoteAndCents } from "../utils/utils";
import {
  NOTE_HIGHWAY_LOOKAHEAD_MS,
  NOTE_HIT_WINDOW_MS,
  NOTE_TARGET_LINE_PERCENT,
} from "./constants";
import { getTabHole } from "./playbackParser";
import type { VisibleGameEvent } from "./types";

type DetectedNote = NonNullable<ReturnType<typeof freqToNoteAndCents>>;

type NoteHighwayProps = {
  clarity: string | null;
  detectedNote: DetectedNote | null;
  isPlaying: boolean;
  lastHitIndex: number | null;
  pitchError: string | null;
  showNoteNames: boolean;
  visibleGameEvents: VisibleGameEvent[];
  visualPlayheadMs: number;
};

export const NoteHighway = ({
  clarity,
  detectedNote,
  isPlaying,
  lastHitIndex,
  pitchError,
  showNoteNames,
  visibleGameEvents,
  visualPlayheadMs,
}: NoteHighwayProps) => (
  <div className="flex h-full w-full min-w-0 flex-col rounded-lg border border-gray-700 bg-gray-900 p-4 shadow overflow-hidden">
    <div className="flex-1 w-full overflow-hidden">
      <div className="relative h-full overflow-hidden rounded border border-gray-800 bg-gray-950">
        {/* Lane tracks with alternating backgrounds */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={`lane-track-${i}`}
            className={`absolute bottom-0 top-0 border-x border-gray-800/20 ${
              i % 2 === 0 ? "bg-white/[0.03]" : "bg-transparent"
            }`}
            style={{
              left: `${(i / 10) * 100}%`,
              width: "10%",
            }}
          >
            <div className="mt-2 text-center text-[10px] font-bold text-gray-700">
              {i + 1}
            </div>
          </div>
        ))}

        {/* Falling Notes */}
        {visibleGameEvents.flatMap(({ event, index, timing }) =>
          event.notes.map((note, noteIndex) => {
            const tab = event.tabs[noteIndex] || event.tabs[0] || "";
            const hole = getTabHole(tab);
            if (hole === null || hole < 1 || hole > 10) return null;

            const laneIndex = hole - 1;
            const timeToHitMs = timing.startMs - visualPlayheadMs;
            
            const highwayHeight = 520; 
            const msToPx = (highwayHeight * (NOTE_TARGET_LINE_PERCENT / 100)) / NOTE_HIGHWAY_LOOKAHEAD_MS;

            const top = NOTE_TARGET_LINE_PERCENT - (timeToHitMs * msToPx / highwayHeight * 100);
            
            const soundDurationMs = timing.durationMs * (note.tieStart
              ? 1
              : note.articulation === "staccato"
                ? 0.42
                : note.articulation === "tenuto"
                  ? 0.98
                  : 0.86);
            
            const height = soundDurationMs * msToPx;

            const isActive =
              visualPlayheadMs >= timing.startMs - NOTE_HIT_WINDOW_MS &&
              visualPlayheadMs <= timing.endMs + NOTE_HIT_WINDOW_MS;
            const wasHit = lastHitIndex === index && isActive;

            // Only show clarity indicator on the specific target event note
            const showClarityOnThisNote = isActive && !wasHit && clarity;
            const clarityValue = showClarityOnThisNote ? parseFloat(clarity || "0") : 0;

            const isDraw = tab.startsWith("-");
            const isBlow = /^\d/.test(tab);

            return (
              <div
                key={`${index}-${note.name}-${noteIndex}`}
                className={`absolute box-border flex items-center justify-center rounded-sm border-black text-xs font-bold transition-transform overflow-hidden ${
                  wasHit
                    ? "scale-105 border-emerald-200 bg-emerald-400 text-black shadow-[0_0_22px_rgba(52,211,153,0.9)]"
                    : isActive
                      ? isDraw
                        ? "bg-blue-400 text-black"
                        : isBlow
                          ? "bg-red-400 text-black"
                          : "bg-cyan-400 text-black"
                      : isDraw
                        ? "bg-blue-900 text-blue-100"
                        : isBlow
                          ? "bg-red-900 text-red-100"
                          : "bg-gray-800 text-gray-100"
                }`}
                style={{
                  left: `${laneIndex * 10}%`,
                  top: `${top}%`,
                  width: `calc(10% - 2px)`,
                  margin: "0 1px",
                  height: `${height}px`,
                  borderWidth: "1px",
                  transform: "translateY(-100%)",
                  opacity: top < -4 || top > 105 ? 0 : 1,
                  zIndex: 10,
                }}
              >
                {/* Clarity Indicator (Progress bar at the top of active note) */}
                {showClarityOnThisNote && (
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-black/40">
                    <div 
                      className={`h-full transition-[width] duration-75 ${
                        clarityValue >= 0.82 ? "bg-emerald-400" : "bg-yellow-400"
                      }`}
                      style={{ width: `${clarityValue * 100}%` }}
                    />
                  </div>
                )}
                {showNoteNames && Note.pitchClass(note.name)}
              </div>
            );
          })
        )}

        {/* Harmonica Body Visual - SVG with transparent holes */}
        <div
          className="pointer-events-none absolute left-0 right-0 h-20 -translate-y-1/2 z-20"
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
          style={{ 
            top: `${NOTE_TARGET_LINE_PERCENT}%`,
            zIndex: 15 
          }}
        />

        {/* Numbers inside the holes - Top layer (z-50) */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={`hole-label-${i}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-50 pointer-events-none"
            style={{ 
              left: `${(i / 10) * 100 + 5}%`,
              top: `${NOTE_TARGET_LINE_PERCENT}%`
            }}
          >
             <span className="text-lg font-extrabold leading-none text-white drop-shadow-[0_2px_3px_rgba(0,0,0,1)]">
              {i + 1}
            </span>
          </div>
        ))}

        {/* Mic / Clarity Stats Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-300 pointer-events-none">
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

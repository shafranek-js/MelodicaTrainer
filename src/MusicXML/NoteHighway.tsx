import { Mic, Target } from "lucide-react";
import { Note } from "tonal";
import type { freqToNoteAndCents } from "../utils/utils";
import {
  NOTE_HIGHWAY_LOOKAHEAD_MS,
  NOTE_HIT_WINDOW_MS,
  NOTE_LANE_GAP_PX,
  NOTE_TARGET_LINE_PERCENT,
  NOTE_TILE_HEIGHT_PX,
  NOTE_TILE_WIDTH_PX,
} from "./constants";
import { getTabHole } from "./playbackParser";
import type { GameStats, VisibleGameEvent } from "./types";

type DetectedNote = NonNullable<ReturnType<typeof freqToNoteAndCents>>;

type NoteHighwayProps = {
  accuracy: number;
  clarity: string | null;
  currentEventIndex: number;
  currentTab: string;
  detectedNote: DetectedNote | null;
  gameStats: GameStats;
  isPlaying: boolean;
  laneKeys: number[];
  lastHitIndex: number | null;
  pitchError: string | null;
  visibleGameEvents: VisibleGameEvent[];
  visualPlayheadMs: number;
};

export const NoteHighway = ({
  accuracy,
  clarity,
  currentEventIndex,
  currentTab,
  detectedNote,
  gameStats,
  isPlaying,
  laneKeys,
  lastHitIndex,
  pitchError,
  visibleGameEvents,
  visualPlayheadMs,
}: NoteHighwayProps) => (
  <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 shadow">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Target size={18} className="text-emerald-300" />
        <span className="text-sm font-semibold text-gray-100">
          Note highway
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded border border-gray-700 bg-gray-950 px-2 py-1 text-gray-300">
          Hits {gameStats.hits}
        </span>
        <span className="rounded border border-gray-700 bg-gray-950 px-2 py-1 text-gray-300">
          Miss {gameStats.misses}
        </span>
        <span className="rounded border border-gray-700 bg-gray-950 px-2 py-1 text-emerald-300">
          Streak {gameStats.streak}
        </span>
        <span className="rounded border border-gray-700 bg-gray-950 px-2 py-1 text-gray-300">
          {accuracy}% accuracy
        </span>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-[128px_minmax(0,1fr)] xl:grid-cols-[116px_minmax(0,1fr)]">
      <div className="rounded border border-gray-800 bg-gray-950 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-gray-500">
          Tab
        </div>
        <div className="mb-3 rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-3 text-center text-2xl font-bold text-emerald-200">
          {currentTab || "-"}
        </div>
        <div className="space-y-2">
          {visibleGameEvents
            .filter(({ index }) => index > currentEventIndex)
            .slice(0, 7)
            .map(({ event, index }) => (
              <div
                key={`tab-${index}`}
                className="flex min-h-8 items-center justify-center rounded border border-gray-800 bg-gray-900 px-2 text-sm font-semibold text-gray-300"
              >
                {event.tabs.join("  ") || "rest"}
              </div>
            ))}
        </div>
      </div>

      <div className="relative h-[520px] overflow-hidden rounded border border-gray-800 bg-gray-950">
        {Array.from({ length: Math.max(laneKeys.length - 1, 0) }).map(
          (_, lane) => (
            <div
              key={lane}
              className="absolute bottom-0 top-0 border-l border-gray-800"
              style={{ left: `${((lane + 1) / laneKeys.length) * 100}%` }}
            />
          )
        )}
        {laneKeys.map((hole, lane) => (
          <div
            key={`lane-label-${hole}`}
            className="absolute top-2 -translate-x-1/2 text-[10px] font-semibold text-gray-600"
            style={{ left: `${((lane + 0.5) / laneKeys.length) * 100}%` }}
          >
            {hole}
          </div>
        ))}
        {!laneKeys.length && (
          <div className="absolute inset-x-0 top-2 text-center text-[10px] font-semibold text-gray-600">
            No tab lanes
          </div>
        )}

        <div
          className="absolute left-0 right-0 h-[3px] -translate-y-1/2 bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.8)]"
          style={{ top: `${NOTE_TARGET_LINE_PERCENT}%` }}
        />
        <div
          className="absolute left-2 right-2 h-14 -translate-y-1/2 rounded-full border-2 border-emerald-300/80 bg-emerald-400/10"
          style={{ top: `${NOTE_TARGET_LINE_PERCENT}%` }}
        />

        {visibleGameEvents.flatMap(({ event, index, timing }) =>
          event.notes.length
            ? event.notes.map((note, noteIndex) => {
                const tab = event.tabs[noteIndex] || event.tabs[0] || "";
                const hole = getTabHole(tab);
                const laneCount = Math.max(laneKeys.length, 1);
                const laneIndex =
                  hole === null ? noteIndex % laneCount : laneKeys.indexOf(hole);
                const safeLaneIndex =
                  laneIndex >= 0 ? laneIndex : noteIndex % laneCount;
                const left = ((safeLaneIndex + 0.5) / laneCount) * 100;
                const timeToHitMs = timing.startMs - visualPlayheadMs;
                const top =
                  NOTE_TARGET_LINE_PERCENT -
                  (timeToHitMs / NOTE_HIGHWAY_LOOKAHEAD_MS) *
                    NOTE_TARGET_LINE_PERCENT;
                const isActive = Math.abs(timeToHitMs) <= NOTE_HIT_WINDOW_MS;
                const wasHit = lastHitIndex === index && isActive;

                return (
                  <div
                    key={`${index}-${note.name}-${noteIndex}`}
                    className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border text-xs font-bold ${
                      wasHit
                        ? "scale-110 border-emerald-200 bg-emerald-400 text-black shadow-[0_0_22px_rgba(52,211,153,0.9)]"
                        : isActive
                          ? "border-cyan-200 bg-cyan-400 text-black"
                          : "border-gray-600 bg-gray-800 text-gray-100"
                    }`}
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `min(${NOTE_TILE_WIDTH_PX}px, calc(${100 / laneCount}% - ${NOTE_LANE_GAP_PX}px))`,
                      height: NOTE_TILE_HEIGHT_PX,
                      opacity: top < -4 || top > 94 ? 0 : 1,
                    }}
                  >
                    {tab || Note.pitchClass(note.name)}
                  </div>
                );
              })
            : [
                <div
                  key={`${index}-rest`}
                  className="absolute left-1/2 h-2 w-16 -translate-x-1/2 rounded bg-gray-700"
                  style={{
                    top: `${
                      NOTE_TARGET_LINE_PERCENT -
                      ((timing.startMs - visualPlayheadMs) /
                        NOTE_HIGHWAY_LOOKAHEAD_MS) *
                        NOTE_TARGET_LINE_PERCENT
                    }%`,
                  }}
                />,
              ]
        )}

        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-300">
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

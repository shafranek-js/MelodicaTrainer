import { useEffect, useMemo, useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Note } from "tonal";
import {
  getMelodicaKeyboardGeometry,
  type MelodicaKeyGeometry,
  type MelodicaLayout,
} from "../utils/utils";

export type MelodicaKeyboardKeyState = {
  activeColor?: string;
  isActive?: boolean;
  isMuted?: boolean;
  isPrimary?: boolean;
  isSecondary?: boolean;
  isTarget?: boolean;
  playbackPulseId?: number;
  targetColor?: string;
  tuningCents?: number | null;
};

type MelodicaKeyboardProps = {
  formatPitchClass: (pitchClass: string) => string;
  getKeyState?: (key: MelodicaKeyGeometry) => MelodicaKeyboardKeyState;
  heightClassName?: string;
  innerInsetClassName?: string;
  layout: MelodicaLayout;
  minWhiteKeyWidthPx?: number;
  showOctaves?: boolean;
  showNoteNames?: boolean;
  onNoteOn?: (midi: number) => void;
  onNoteOff?: (midi: number) => void;
};

const joinClasses = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const renderTuningLine = (cents: number, isBlack: boolean) => {
  const clampedOffset = Math.max(-10, Math.min(10, -(cents / 50) * 10));

  return (
    <div
      className={joinClasses(
        "pointer-events-none absolute left-1 right-1 h-[2px] rounded-full",
        isBlack
          ? "bg-emerald-200 shadow-[0_0_8px_rgba(167,243,208,0.95)]"
          : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]",
      )}
      style={{ top: `calc(50% + ${clampedOffset}px)` }}
    />
  );
};

export const MelodicaKeyboard = ({
  formatPitchClass,
  getKeyState = () => ({}),
  heightClassName = "h-44 sm:h-56",
  innerInsetClassName = "inset-x-2 top-2 bottom-2",
  layout,
  minWhiteKeyWidthPx = 42,
  showOctaves = true,
  showNoteNames = true,
  onNoteOn,
  onNoteOff,
}: MelodicaKeyboardProps) => {
  const geometry = useMemo(() => getMelodicaKeyboardGeometry(layout), [layout]);
  const minWidthPx = geometry.whiteKeyCount * minWhiteKeyWidthPx;
  const interactive = Boolean(onNoteOn && onNoteOff);
  const activePointerNotesRef = useRef(new Map<number, number>());
  const activeKeyboardNotesRef = useRef(new Set<number>());
  const activeNoteCountsRef = useRef(new Map<number, number>());
  const onNoteOffRef = useRef(onNoteOff);

  useEffect(() => {
    onNoteOffRef.current = onNoteOff;
  }, [onNoteOff]);

  useEffect(() => () => {
    const activeNotes = Array.from(activeNoteCountsRef.current.keys());
    activePointerNotesRef.current.clear();
    activeKeyboardNotesRef.current.clear();
    activeNoteCountsRef.current.clear();
    activeNotes.forEach((midi) => onNoteOffRef.current?.(midi));
  }, []);

  const pressKey = (midi: number) => {
    const previousCount = activeNoteCountsRef.current.get(midi) ?? 0;
    activeNoteCountsRef.current.set(midi, previousCount + 1);
    if (previousCount === 0) onNoteOn?.(midi);
  };

  const releaseKey = (midi: number) => {
    const nextCount = (activeNoteCountsRef.current.get(midi) ?? 0) - 1;
    if (nextCount > 0) {
      activeNoteCountsRef.current.set(midi, nextCount);
      return;
    }
    activeNoteCountsRef.current.delete(midi);
    onNoteOff?.(midi);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>, midi: number) => {
    if (!interactive || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    if (activePointerNotesRef.current.has(event.pointerId)) return;
    activePointerNotesRef.current.set(event.pointerId, midi);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture may be unavailable in older touch browsers.
    }
    pressKey(midi);
  };

  const handlePointerRelease = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const midi = activePointerNotesRef.current.get(event.pointerId);
    if (midi === undefined) return;
    activePointerNotesRef.current.delete(event.pointerId);
    releaseKey(midi);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, midi: number) => {
    if (!interactive || (event.key !== " " && event.key !== "Enter")) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat || activeKeyboardNotesRef.current.has(midi)) return;
    activeKeyboardNotesRef.current.add(midi);
    pressKey(midi);
  };

  const releaseKeyboardNote = (midi: number) => {
    if (!activeKeyboardNotesRef.current.delete(midi)) return;
    releaseKey(midi);
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLDivElement>, midi: number) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    releaseKeyboardNote(midi);
  };

  const renderKey = (key: MelodicaKeyGeometry) => {
    const state = getKeyState(key);
    const pitchClass = formatPitchClass(Note.simplify(key.pitchClass));
    const activeColor = state.activeColor ?? "#34d399";
    const isBlack = key.isBlack;
    const activeShadow = isBlack
      ? `inset 0 1px 2px rgba(255,255,255,0.45), inset 0 -10px 14px rgba(0,0,0,0.82), 0 0 24px ${activeColor}aa`
      : `inset 0 -12px 18px rgba(15,23,42,0.16), 0 0 26px ${activeColor}99`;
    const targetRing = state.isTarget
      ? `, 0 0 0 2px #030712, 0 0 0 4px ${state.targetColor ?? "#67e8f9"}`
      : "";

    return (
      <div
        aria-label={`${key.name}, key ${key.index}`}
        className={joinClasses(
          "absolute rounded-b-[6px] border transition select-none",
          isBlack
            ? "top-0 z-20 h-[62%] rounded-b-[7px] border-gray-950 bg-gradient-to-b from-gray-700 via-gray-950 to-black shadow-[inset_0_1px_2px_rgba(255,255,255,0.32),inset_0_-10px_14px_rgba(0,0,0,0.85),0_7px_14px_rgba(0,0,0,0.65)]"
            : "bottom-0 top-0 border-gray-300 bg-gradient-to-b from-white via-gray-100 to-gray-300 shadow-[inset_0_-12px_18px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.95)]",
          interactive && "cursor-pointer touch-none focus:outline-none focus:ring-2 focus:ring-emerald-300",
          state.isMuted && (isBlack ? "opacity-50" : "opacity-45"),
          state.isPrimary && "ring-2 ring-emerald-300 ring-inset",
          state.isSecondary && "ring-2 ring-yellow-300 ring-inset",
          state.isTarget && "ring-2 ring-cyan-300 ring-offset-2 ring-offset-gray-950",
          state.isActive && (isBlack ? "z-30" : "z-10"),
        )}
        key={key.midi}
        onBlur={() => releaseKeyboardNote(key.midi)}
        onClick={interactive ? (event) => event.stopPropagation() : undefined}
        onKeyDown={(event) => handleKeyDown(event, key.midi)}
        onKeyUp={(event) => handleKeyUp(event, key.midi)}
        onLostPointerCapture={handlePointerRelease}
        onPointerCancel={handlePointerRelease}
        onPointerDown={(event) => handlePointerDown(event, key.midi)}
        onPointerUp={handlePointerRelease}
        role={interactive ? "button" : "listitem"}
        style={{
          background: state.isActive
            ? isBlack
              ? `linear-gradient(180deg, ${activeColor} 0%, #111827 78%, #020617 100%)`
              : `linear-gradient(180deg, #ffffff 0%, ${activeColor} 58%, ${activeColor} 100%)`
            : undefined,
          borderColor: state.isActive ? activeColor : undefined,
          boxShadow: state.isActive ? `${activeShadow}${targetRing}` : undefined,
          left: `${key.leftPct}%`,
          width: `${key.widthPct}%`,
        }}
        tabIndex={interactive ? 0 : undefined}
      >
        {state.playbackPulseId !== undefined && (
          <span
            aria-hidden="true"
            className="melodica-key-strike pointer-events-none absolute inset-0 rounded-[inherit] bg-white/75"
            data-playback-pulse={state.playbackPulseId}
            key={`${key.midi}-${state.playbackPulseId}`}
          />
        )}
        <div className={joinClasses(
          "pointer-events-none absolute bottom-2 flex flex-col items-center gap-0.5 font-black leading-none",
          isBlack
            ? "inset-x-1 text-[9px] text-gray-100 sm:text-[10px]"
            : "inset-x-[7%] text-[10px] text-gray-800 sm:text-xs",
        )}>
          {showNoteNames && <span>{pitchClass}</span>}
          {showOctaves && (
            <span className={isBlack ? "text-[8px] text-gray-400 sm:text-[9px]" : "text-[9px] text-gray-500 sm:text-[10px]"}>
              {key.octave}
            </span>
          )}
        </div>
        {state.isActive && typeof state.tuningCents === "number" &&
          renderTuningLine(state.tuningCents, isBlack)}
      </div>
    );
  };

  return (
    <div
      aria-label={`${layout.keyCount}-key melodica keyboard from ${layout.startNote} to ${layout.endNote}`}
      className={joinClasses(
        "relative overflow-hidden rounded-lg border border-gray-700 bg-gray-950 px-2 pt-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        interactive && "pointer-events-auto",
        heightClassName,
      )}
      role={interactive ? "group" : "list"}
      style={{ minWidth: `${minWidthPx}px` }}
    >
      <div className={joinClasses("absolute", innerInsetClassName)}>
        {geometry.keys.filter((key) => !key.isBlack).map(renderKey)}
        {geometry.keys.filter((key) => key.isBlack).map(renderKey)}
      </div>
    </div>
  );
};

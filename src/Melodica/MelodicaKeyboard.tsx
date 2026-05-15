import { useMemo } from "react";
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
          : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
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
}: MelodicaKeyboardProps) => {
  const geometry = useMemo(() => getMelodicaKeyboardGeometry(layout), [layout]);
  const minWidthPx = geometry.whiteKeyCount * minWhiteKeyWidthPx;
  const whiteKeys = geometry.keys.filter((key) => !key.isBlack);
  const blackKeys = geometry.keys.filter((key) => key.isBlack);

  const renderWhiteKey = (key: MelodicaKeyGeometry) => {
    const state = getKeyState(key);
    const pitchClass = formatPitchClass(Note.simplify(key.pitchClass));
    const activeColor = state.activeColor ?? "#34d399";

    return (
      <div
        key={key.midi}
        aria-label={`${key.name}, key ${key.index}`}
        className={joinClasses(
          "absolute bottom-0 top-0 rounded-b-[6px] border border-gray-300 bg-gradient-to-b from-white via-gray-100 to-gray-300 shadow-[inset_0_-12px_18px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.95)] transition",
          state.isMuted && "opacity-45",
          state.isPrimary && "ring-2 ring-emerald-300 ring-inset",
          state.isSecondary && "ring-2 ring-yellow-300 ring-inset",
          state.isTarget && "ring-2 ring-cyan-300 ring-offset-2 ring-offset-gray-950",
          state.isActive && "z-10"
        )}
        role="listitem"
        style={{
          background: state.isActive
            ? `linear-gradient(180deg, #ffffff 0%, ${activeColor} 58%, ${activeColor} 100%)`
            : undefined,
          borderColor: state.isActive ? activeColor : undefined,
          boxShadow: state.isActive
            ? `inset 0 -12px 18px rgba(15,23,42,0.16), 0 0 26px ${activeColor}99`
            : undefined,
          left: `${key.leftPct}%`,
          width: `${key.widthPct}%`,
        }}
      >
        <div className="absolute inset-x-[7%] bottom-2 flex flex-col items-center gap-0.5 text-[10px] font-black leading-none text-gray-800 sm:text-xs">
          {showNoteNames && <span>{pitchClass}</span>}
          {showOctaves && <span className="text-[9px] text-gray-500 sm:text-[10px]">{key.octave}</span>}
        </div>
        {state.isActive &&
          typeof state.tuningCents === "number" &&
          renderTuningLine(state.tuningCents, false)}
      </div>
    );
  };

  const renderBlackKey = (key: MelodicaKeyGeometry) => {
    const state = getKeyState(key);
    const pitchClass = formatPitchClass(Note.simplify(key.pitchClass));
    const activeColor = state.activeColor ?? "#34d399";

    return (
      <div
        key={key.midi}
        aria-label={`${key.name}, key ${key.index}`}
        className={joinClasses(
          "absolute top-0 z-20 h-[62%] rounded-b-[7px] border border-gray-950 bg-gradient-to-b from-gray-700 via-gray-950 to-black shadow-[inset_0_1px_2px_rgba(255,255,255,0.32),inset_0_-10px_14px_rgba(0,0,0,0.85),0_7px_14px_rgba(0,0,0,0.65)] transition",
          state.isMuted && "opacity-50",
          state.isPrimary && "ring-2 ring-emerald-300 ring-inset",
          state.isSecondary && "ring-2 ring-yellow-300 ring-inset",
          state.isTarget && "ring-2 ring-cyan-300 ring-offset-2 ring-offset-gray-950",
          state.isActive && "z-30"
        )}
        role="listitem"
        style={{
          background: state.isActive
            ? `linear-gradient(180deg, ${activeColor} 0%, #111827 78%, #020617 100%)`
            : undefined,
          borderColor: state.isActive ? activeColor : undefined,
          boxShadow: state.isActive
            ? `inset 0 1px 2px rgba(255,255,255,0.45), inset 0 -10px 14px rgba(0,0,0,0.82), 0 0 24px ${activeColor}aa`
            : undefined,
          left: `${key.leftPct}%`,
          width: `${key.widthPct}%`,
        }}
      >
        <div className="absolute inset-x-1 bottom-2 flex flex-col items-center gap-0.5 text-[9px] font-black leading-none text-gray-100 sm:text-[10px]">
          {showNoteNames && <span>{pitchClass}</span>}
          {showOctaves && <span className="text-[8px] text-gray-400 sm:text-[9px]">{key.octave}</span>}
        </div>
        {state.isActive &&
          typeof state.tuningCents === "number" &&
          renderTuningLine(state.tuningCents, true)}
      </div>
    );
  };

  return (
    <div
      aria-label={`${layout.keyCount}-key melodica keyboard from ${layout.startNote} to ${layout.endNote}`}
      className={joinClasses(
        "relative overflow-hidden rounded-lg border border-gray-700 bg-gray-950 px-2 pt-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        heightClassName
      )}
      role="list"
      style={{ minWidth: `${minWidthPx}px` }}
    >
      <div className={joinClasses("absolute", innerInsetClassName)}>
        {whiteKeys.map(renderWhiteKey)}
        {blackKeys.map(renderBlackKey)}
      </div>
    </div>
  );
};

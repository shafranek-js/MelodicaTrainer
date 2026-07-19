import { useRef, useEffect, useMemo, useState } from "react";
import { Note } from "tonal";
import { generateMelodicaLayout, getMelodicaKeyboardGeometry } from "../utils/utils";
import type { MelodicaKeyCount, freqToNoteAndCents } from "../utils/utils";
import { buildNoteHighwayRenderData } from "./noteHighwayLayout";
import type { VisibleGameEvent } from "./types";
import {
  KeyboardAndHandOverlay,
  LaneTracks,
  NoteTiles,
  PitchStatusBar,
  ScreenReaderKeyLabels,
  TargetLine,
} from "./NoteHighwayPanels";
import type { FingerVisualState } from "./usePhantomHand";
import type { MidiAccessState } from "../hooks/useMidiInput";
import type { EffectiveInputSource, InputMode } from "./inputMode";
import type { PlaybackAttack } from "./noteHighwayKeyboardState";

type DetectedNote = NonNullable<ReturnType<typeof freqToNoteAndCents>>;

export type NoteHighwayProps = {
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
  fingerAssignments?: Map<string, number>;
  showNumbers?: boolean;
  phantomStates?: FingerVisualState[];
  activeMidi?: number | null;
  activeFinger?: number | null;
  connectedMidiInputCount: number;
  effectiveInputSource: EffectiveInputSource;
  inputError?: string | null;
  inputMode: InputMode;
  midiAccessState: MidiAccessState;
  showVirtualHand?: boolean;
  isWaiting?: boolean;
  onNoteOn?: (midi: number) => void;
  onNoteOff?: (midi: number) => void;
  playbackAttack?: PlaybackAttack;
  userActiveMidi?: ReadonlySet<number>;
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
  connectedMidiInputCount,
  effectiveInputSource,
  inputError,
  inputMode,
  midiAccessState,
  showVirtualHand,
  isWaiting,
  onNoteOn,
  onNoteOff,
  playbackAttack,
  userActiveMidi,
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
  const renderData = useMemo(() => buildNoteHighwayRenderData({
      clarity,
      containerWidth,
      lastHitIndex,
      keyCount,
      shortestNoteDurationMs,
      visibleGameEvents,
      visualPlayheadMs,
      fingerAssignments,
      targetLinePercent,
  }), [
    clarity,
    containerWidth,
    fingerAssignments,
    keyCount,
    lastHitIndex,
    shortestNoteDurationMs,
    targetLinePercent,
    visibleGameEvents,
    visualPlayheadMs,
  ]);
  const activeKeyboardMidi = useMemo(() => {
    const active = new Map<number, string>();

    renderData.forEach((data) => {
      if (!data.isVisible || !data.isSounding) return;
      const key = keyboardGeometry.keys[data.laneIndex];
      if (key) active.set(key.midi, data.color);
    });

    return active;
  }, [keyboardGeometry.keys, renderData]);
  const outOfRangeHint = useMemo(() => {
    if (renderData.length > 0 || visibleGameEvents.length === 0) return null;

    const hasPlayableNotes = visibleGameEvents.some(({ event }) =>
      event.notes.some((note) => note.shouldPlay),
    );
    if (!hasPlayableNotes || keyboardGeometry.keys.length === 0) return null;

    const midiNumbers = keyboardGeometry.keys.map((key) => key.midi);
    const firstNote = Math.min(...midiNumbers);
    const lastNote = Math.max(...midiNumbers);
    return `Upcoming notes are outside ${Note.fromMidi(firstNote)}–${Note.fromMidi(lastNote)}. Use Optimize or adjust Transpose.`;
  }, [keyboardGeometry.keys, renderData.length, visibleGameEvents]);

  return (
    <div className="flex h-full w-full min-w-0 flex-col rounded-lg border border-gray-700 bg-gray-900 p-4 shadow overflow-hidden">
      <div className="flex-1 w-full overflow-hidden">
        <div className="relative h-full overflow-hidden rounded border border-gray-800 bg-gray-950" id="highway-container" ref={containerRef}>
          <PitchStatusBar
            clarity={clarity}
            connectedMidiInputCount={connectedMidiInputCount}
            detectedNote={detectedNote}
            effectiveInputSource={effectiveInputSource}
            inputError={inputError}
            inputMode={inputMode}
            isPlaying={isPlaying}
            midiAccessState={midiAccessState}
            pitchError={pitchError}
          />
          <LaneTracks keys={keyboardGeometry.keys} />
          <NoteTiles
            renderData={renderData}
            showNoteNames={showNoteNames}
            showNumbers={showNumbers}
          />
          {outOfRangeHint && (
            <div className="pointer-events-none absolute left-1/2 top-1/3 z-50 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-amber-700/70 bg-amber-950/90 px-4 py-3 text-center text-sm text-amber-100 shadow-lg">
              {outOfRangeHint}
            </div>
          )}
          <KeyboardAndHandOverlay
            ref={keyboardRef}
            activeKeyboardMidi={activeKeyboardMidi}
            handOffsetPct={handOffsetPct}
            layout={melodicaLayout}
            onSvgWidthChange={setMeasuredSvgWidth}
            phantomStates={phantomStates}
            showVirtualHand={showVirtualHand}
            onNoteOn={onNoteOn}
            onNoteOff={onNoteOff}
            playbackAttack={playbackAttack}
            userActiveMidi={userActiveMidi}
          />
          <TargetLine
            isWaiting={isWaiting}
            targetLinePercent={targetLinePercent}
          />
          <ScreenReaderKeyLabels
            keys={keyboardGeometry.keys}
            targetLinePercent={targetLinePercent}
          />
        </div>
      </div>
    </div>
  );
};

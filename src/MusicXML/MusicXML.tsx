import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pin, PinOff, Gauge } from "lucide-react";
import {
  freqToNoteAndCents,
  melodicaRangeOptions,
  normalizeMelodicaKeyCount,
} from "../utils/utils";
import type { MelodicaKeyCount } from "../utils/utils";
import { usePitchDetector } from "../hooks/usePitchDetector";
import { NoteHighway } from "./NoteHighway";
import { useNoteHighwayScoring } from "./useNoteHighwayScoring";
import { usePersistentState } from "../hooks/usePersistentState";
import { useScoreFileLoader } from "./useScoreFileLoader";
import { useOsmdScore } from "./useOsmdScore";
import { useGpScore } from "./useGpScore";
import { useMusicXmlScore } from "./useMusicXmlScore";
import { useScoreCursor } from "./useScoreCursor";
import { useScorePlayback } from "./useScorePlayback";
import { useScoreDownloads } from "./useScoreDownloads";
import { useScoreFileImport } from "./useScoreFileImport";
import { useSoundFontPresets } from "./useSoundFontPresets";
import { usePlaybackViewModel } from "./usePlaybackViewModel";
import { useTransposeOptimizer } from "./useTransposeOptimizer";
import { ScoreSettingsPanel } from "./ScoreSettingsPanel";
import { TransposeControls } from "./TransposeControls";
import AlphaTabViewer from "./AlphaTabViewer";
import type { AlphaTabViewerRef } from "./AlphaTabViewer";
import { useSetPlaybackToolbarState } from "../PlaybackToolbarContext";
import {
  DEFAULT_TEMPO_BPM,
  getEffectiveTempoBpm,
  sanitizeNullableTempo,
} from "./tempoModel";
import type { PlaybackEvent } from "./types";
import { assignFingers } from "./fingerAssigner";
import { usePhantomHand } from "./usePhantomHand";

type RouteStatusTone = "info" | "success" | "error";
type RouteStatus = { tone: RouteStatusTone; message: string; };

const routeStatusClassNames: Record<RouteStatusTone, string> = {
  info: "border-cyan-800 bg-cyan-950/60 text-cyan-100",
  success: "border-emerald-800 bg-emerald-950/60 text-emerald-100",
  error: "border-red-800 bg-red-950/70 text-red-200",
};

const SOUNDFONTS = [
    { label: "Melodica", value: "melodica.sf2" },
    { label: "General MIDI Reed", value: "MS_Basic.sf3" },
    { label: "Florestan Harmonica", value: "022_Florestan_Harmonica.sf2" },
    { label: "Harmonica Essentials", value: "Harmonica_Essentials.sf2" },
    { label: "Monsoons Hohner C", value: "Monsoons Hohner C Harmonica.sf2" },
    { label: "Sonivox", value: "soundfont/sonivox.sf2" },
];

const sanitizeFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const sanitizeBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const sanitizeString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const sanitizeSoundFont = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  return SOUNDFONTS.some((soundFont) => soundFont.value === value) ? value : "melodica.sf2";
};

const sanitizeMelodicaKeyCount = (value: unknown): MelodicaKeyCount | undefined => {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  return normalizeMelodicaKeyCount(value);
};

const LEGACY_STORAGE_KEYS = {
  preset: ["harptrainer_preset"],
  showNoteNames: ["harptrainer_show_note_names"],
  soundfont: ["harptrainer_soundfont"],
  tempo: ["harptrainer_user_tempo"],
  transpose: ["harptrainer_transpose"],
} as const;

const MusicXML: React.FC = () => {
  const setPlaybackToolbarState = useSetPlaybackToolbarState();
  
  // PERSISTENT STATES
  const [transpose, setTranspose] = usePersistentState<number>("melodicatrainer_transpose", 0, { legacyKeys: LEGACY_STORAGE_KEYS.transpose, sanitize: sanitizeFiniteNumber });
  const [selectedKeyCount, setSelectedKeyCount] = usePersistentState<MelodicaKeyCount>("melodicatrainer_key_count", 32, { sanitize: sanitizeMelodicaKeyCount });
  const [showNoteNames, setShowNoteNames] = usePersistentState<boolean>("melodicatrainer_show_note_names", true, { legacyKeys: LEGACY_STORAGE_KEYS.showNoteNames, sanitize: sanitizeBoolean });
  const [fingeringGuide, setFingeringGuide] = usePersistentState<string>("melodicatrainer_fingering_guide", "numbers", { sanitize: sanitizeString });
  const [isStudyMode, setIsStudyMode] = usePersistentState<boolean>("melodicatrainer_study_mode", false, { sanitize: sanitizeBoolean });
  const studyModeFreezeRef = useRef(false);
  const studyModeNextIndexRef = useRef(0);
  const [isWaiting, setIsWaiting] = useState(false);
  const [userTempoBpm, setUserTempoBpm] = usePersistentState<number | null>("melodicatrainer_user_tempo", null, { legacyKeys: LEGACY_STORAGE_KEYS.tempo, sanitize: sanitizeNullableTempo });

  const handleSetTempo = useCallback((newTempo: number) => {
    setUserTempoBpm(newTempo);
  }, [setUserTempoBpm]);
  const [selectedSf, setSelectedSf] = usePersistentState<string>("melodicatrainer_soundfont", "melodica.sf2", { legacyKeys: LEGACY_STORAGE_KEYS.soundfont, sanitize: sanitizeSoundFont });
  const [selectedPreset, setSelectedPreset] = usePersistentState<string>("melodicatrainer_preset", "0:0", { legacyKeys: LEGACY_STORAGE_KEYS.preset, sanitize: sanitizeString });
  const [isDrawerPinned, setIsDrawerPinned] = usePersistentState<boolean>("melodicatrainer_drawer_pinned", true, { sanitize: sanitizeBoolean });
  const [isRightDrawerPinned, setIsRightDrawerPinned] = usePersistentState<boolean>("melodicatrainer_right_drawer_pinned", true, { sanitize: sanitizeBoolean });
  const [isTopDrawerPinned, setIsTopDrawerPinned] = usePersistentState<boolean>("melodicatrainer_top_drawer_pinned", true, { sanitize: sanitizeBoolean });
  const keyCount = normalizeMelodicaKeyCount(selectedKeyCount);

  // VOLATILE STATES
  const [isDrawerHovered, setIsDrawerHovered] = useState(false);
  const [isRightDrawerHovered, setIsRightDrawerHovered] = useState(false);
  const [isTopDrawerHovered, setIsTopDrawerHovered] = useState(false);
  const [isBpmOverlayVisible, setIsBpmOverlayVisible] = useState(false);
  const [routeStatus, setRouteStatus] = useState<RouteStatus | null>({ tone: "info", message: "Ready." });
  const handleDefaultScoreLoadError = useCallback((err: unknown) => {
    console.error("Intro song load error:", err);
    setRouteStatus({
      tone: "error",
      message: "Failed to load default song. Try loading a file manually.",
    });
  }, []);
  const { fileName, isGpFile, loadScoreFile, rawFileContent } = useScoreFileLoader({
    onDefaultLoadError: handleDefaultScoreLoadError,
  });
  const [detectedTempoBpm, setDetectedTempoBpm] = useState(DEFAULT_TEMPO_BPM);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [currentGameTimeMs, setCurrentGameTimeMs] = useState(0);
  const [isSheetReady, setIsSheetReady] = useState(false);
  const [hasSheetRenderError] = useState(false);
  const [playbackEvents, setPlaybackEvents] = useState<PlaybackEvent[]>([]);

  const showNumbers = fingeringGuide === "numbers" || fingeringGuide === "debugBoth";
  const showVirtualHand = fingeringGuide === "virtualHand" || fingeringGuide === "debugBoth";

  const fingerAssignments = useMemo(() => {
    if (fingeringGuide === "none" || playbackEvents.length === 0) return undefined;
    return assignFingers(playbackEvents, keyCount);
  }, [fingeringGuide, playbackEvents, keyCount]);

  const fingerMap = useMemo(() => {
    if (!fingerAssignments) return undefined;
    const map = new Map<string, number>();
    for (const a of fingerAssignments) map.set(`${a.eventIndex}-${a.noteIndex}`, a.finger);
    return map;
  }, [fingerAssignments]);


  const tempo = getEffectiveTempoBpm({ detectedTempoBpm, userTempoBpm });

  const alphaTabRef = useRef<AlphaTabViewerRef>(null);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const availablePresets = useSoundFontPresets({
    audioContextRef,
    selectedPreset,
    selectedSoundFont: selectedSf,
  });
  const playbackTimerRef = useRef<number | null>(null);
  const playbackRunRef = useRef(0);
  const cursorEventIndexRef = useRef<number | null>(null);
  const gameClockFrameRef = useRef<number | null>(null);
  const gameClockStartMsRef = useRef( performance.now());
  const gameClockOffsetMsRef = useRef(0);
  const gpCursorFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const moveCursorThroughEventRef = useRef<(eventIndex: number, durationMs: number) => void>(() => {});
  const {
    gpOriginalMidiNumbers,
    gpScorePaneHeightPx,
    gpTracks,
    handleGpScoreLoaded,
    handleGpTrackChange,
    isGpPlaybackReady,
    resetGpScore,
    selectedGpTrackIndex,
    setGpScoreHeightPx,
    setIsGpPlaybackReady,
  } = useGpScore({
    cursorEventIndexRef,
    keyCount,
    setCurrentEventIndex,
    setCurrentGameTimeMs,
    setDetectedTempoBpm,
    setIsSheetReady,
    setPlaybackEvents,
    setRouteStatus,
    setTranspose,
    transpose,
  });

  const { displayFileContent, fileContent } = useMusicXmlScore({
    keyCount,
    isGpFile,
    rawFileContent,
    setDetectedTempoBpm,
    setPlaybackEvents,
    transpose,
  });
  const handleOsmdRendered = useCallback(() => {
    setIsSheetReady(true);
  }, []);
  const { osmdInstanceRef, osmdRef } = useOsmdScore({
    displayFileContent,
    isGpFile,
    onRendered: handleOsmdRendered,
  });
  
  const tempoScale = tempo / 100; // Simplified for both
  const tempoScaleRef = useRef(tempoScale);
  useEffect(() => { tempoScaleRef.current = tempoScale; }, [tempoScale]);

  const {
    currentGameEvent,
    playableMidiNumbers,
    playbackTimeline,
    progress,
    shortestNoteDurationMs,
    targetEventIndex,
    visibleGameEvents,
    visualPlayheadMs,
  } = usePlaybackViewModel({
    currentEventIndex,
    currentGameTimeMs,
    playbackEvents,
  });
  

  const phantomStates = usePhantomHand(
    fingerAssignments ?? [],
    playbackEvents,
    playbackTimeline,
    currentGameTimeMs,
    showVirtualHand,
  );

  // ── Study mode: freeze clock at unplayed events ──
  useEffect(() => {
    if (!isStudyMode || !isPlaying || playbackEvents.length === 0) {
      studyModeFreezeRef.current = false;
      setIsWaiting(false);
      return;
    }
    const now = currentGameTimeMs;
    for (let i = studyModeNextIndexRef.current; i < playbackEvents.length; i++) {
      const timing = playbackTimeline[i];
      if (!timing) continue;
      const ev = playbackEvents[i];
      const hasNotes = ev.notes.some(n => n.shouldPlay);
      if (!hasNotes) continue;
      if (now >= timing.startMs) {
        studyModeNextIndexRef.current = i;
        studyModeFreezeRef.current = true;
        setIsWaiting(true);
        return;
      }
      // Timeline is ordered, but there may be gaps with no notes.
      // Don't break — keep scanning in case an earlier event has no playable notes.
    }
    studyModeFreezeRef.current = false;
    setIsWaiting(false);
  }, [isStudyMode, isPlaying, currentGameTimeMs, playbackEvents, playbackTimeline, currentEventIndex]);

  useEffect(() => {
    // When playback stops/restarts, reset the study mode pointer
    if (currentEventIndex === 0) {
      studyModeNextIndexRef.current = 0;
    }
  }, [currentEventIndex]);

  const { pitch, clarity, error: pitchError } = usePitchDetector(0.82, isPlaying && playbackEvents.length > 0, { allowedMidiNumbers: playableMidiNumbers, minRms: 0.012, stableFrames: 2 });
  const detectedNote = useMemo(() => pitch ? freqToNoteAndCents(Number(pitch)) : null, [pitch]);
  const handleStudyModeHit = useCallback((eventIndex: number) => {
    // Accept hits for the expected note even before freeze engages
    // (race condition: mic picks up note 2 while clock hasn't frozen yet).
    if (eventIndex !== studyModeNextIndexRef.current) return;

    // Always advance the pointer — the note has been played.
    studyModeNextIndexRef.current = eventIndex + 1;
    setCurrentEventIndex(eventIndex + 1);

    // Unfreeze and resume clock ONLY if we were actually paused.
    if (studyModeFreezeRef.current) {
      studyModeFreezeRef.current = false;
      setIsWaiting(false);
      gameClockOffsetMsRef.current = currentGameTimeMs;
      gameClockStartMsRef.current = performance.now();
    }
  }, [setCurrentEventIndex, currentGameTimeMs, gameClockStartMsRef, gameClockOffsetMsRef]);

  const { accuracy, gameStats, lastHitIndex, resetScoring } = useNoteHighwayScoring({
    currentGameTimeMs,
    currentGameEvent,
    detectedNote,
    playbackEvents,
    playbackTimeline,
    targetEventIndex,
    isStudyMode,
    studyModeNextIndexRef,
    studyModeOnHit: handleStudyModeHit,
  });
  const canUseProcessedScore = (Boolean(fileContent) || (isGpFile && Boolean(rawFileContent))) && isSheetReady && !hasSheetRenderError;
  const canPlayback = canUseProcessedScore && playbackEvents.length > 0;

  const { downloadMelodicaNotes, downloadTransposedXml } = useScoreDownloads({
    fileContent,
    fileName,
  });

  const { moveCursorThroughEvent, scrollSheetToCursor, stopGpCursorAnimation } = useScoreCursor({
    alphaTabRef,
    cursorEventIndexRef,
    gpCursorFrameRef,
    isGpFile,
    isPlayingRef,
    osmdInstanceRef,
    playbackEvents,
    sheetScrollRef,
  });

  const { stopPlayback, togglePlayback } = useScorePlayback({
    alphaTabRef,
    audioContextRef,
    canPlayback,
    currentEventIndex,
    currentGameTimeMs,
    cursorEventIndexRef,
    fileName,
    gameClockFrameRef,
    gameClockOffsetMsRef,
    gameClockStartMsRef,
    isGpPlaybackReady,
    isGpFile,
    isPlaying,
    isPlayingRef,
    isSheetReady,
    moveCursorThroughEventRef,
    osmdInstanceRef,
    playbackEvents,
    playbackRunRef,
    playbackTimerRef,
    playbackTimeline,
    resetScoring,
    selectedPreset,
    selectedSf,
    setCurrentEventIndex,
    setCurrentGameTimeMs,
    setIsPlaying,
    setRouteStatus,
    sheetScrollRef,
    shortestNoteDurationMs,
    stopGpCursorAnimation,
    studyModeFreezeRef,
    tempoScaleRef,
  });

  useEffect(() => {
    moveCursorThroughEventRef.current = moveCursorThroughEvent;
  }, [moveCursorThroughEvent]);

  // Sync tempo to AlphaTab
  useEffect(() => {
    if (isGpFile && alphaTabRef.current) {
        alphaTabRef.current.setTempo(tempo);
    }
  }, [tempo, isGpFile]);

  // SYNC STATE TO GLOBAL MENU
  useEffect(() => {
    setPlaybackToolbarState({
      isPlaying,
      isPaused: !isPlaying && currentGameTimeMs > 0,
      onTogglePlayback: togglePlayback,
      onRestartPlayback: () => stopPlayback(true),
      tempo,
      setTempo: handleSetTempo,
      progress,
      gameStats,
      accuracy,
      canPlayback,
    });
  }, [setPlaybackToolbarState, isPlaying, currentGameTimeMs, tempo, handleSetTempo, progress, gameStats, accuracy, canPlayback, togglePlayback, stopPlayback]);

  useEffect(() => () => setPlaybackToolbarState(null), [setPlaybackToolbarState]);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Handle unmount only
  useEffect(() => () => stopPlayback(true), [stopPlayback]);

  // Keyboard playback controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or select
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault(); // Prevent page scroll
        togglePlayback();
      } else if (e.code === "Escape") {
        e.preventDefault();
        stopPlayback(true);
      } else if (e.key === "+" || e.key === "=") {
        handleSetTempo(Math.min(240, tempo + 5));
      } else if (e.key === "-" || e.key === "_") {
        handleSetTempo(Math.max(20, tempo - 5));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlayback, stopPlayback, handleSetTempo, tempo]);

  // BPM Overlay timer
  useEffect(() => {
    setIsBpmOverlayVisible(true);
    const timer = setTimeout(() => {
      setIsBpmOverlayVisible(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [tempo]);

  const { autoTransposeWithFilters, optimalVariantsCount } = useTransposeOptimizer({
    gpOriginalMidiNumbers,
    keyCount,
    isGpFile,
    playbackEvents,
    rawFileContent,
    setTranspose,
    transpose,
  });

  const handleTransposeChange = (value: string) => {
    const semitones = Number.parseInt(value, 10);
    setTranspose(Number.isFinite(semitones) ? semitones : 0);
  };

  const handleFileChange = useScoreFileImport({
    loadScoreFile,
    resetGpScore,
    setPlaybackEvents,
    setIsSheetReady,
    setUserTempoBpm,
    setDetectedTempoBpm,
    setTranspose,
    stopPlayback,
  });

  return (
    <div className="h-full w-full flex flex-col bg-gray-950 text-white overflow-hidden max-w-full relative">
      {/* Invisible Drawer Trigger Zone (Top edge) */}
      <div 
        className="absolute left-0 right-0 top-0 h-4 z-40 hidden lg:block cursor-ns-resize"
        onMouseEnter={() => setIsTopDrawerHovered(true)}
      />

      {/* SECTION 1: Score Window */}
      <div 
        className={`w-full shrink-0 transition-all duration-300 ease-in-out grid bg-white relative z-30
          ${isTopDrawerHovered || isTopDrawerPinned ? 'grid-rows-[1fr] opacity-100 border-b border-gray-800 shadow-2xl' : 'grid-rows-[0fr] opacity-0 border-b-0 shadow-none'}
        `}
        onMouseLeave={() => setIsTopDrawerHovered(false)}
      >
        <div className="overflow-hidden w-full max-w-full relative">
          <button
            onClick={() => setIsTopDrawerPinned(!isTopDrawerPinned)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors p-1 z-50 bg-white/80 rounded"
            title={isTopDrawerPinned ? "Unpin score" : "Pin score"}
          >
            {isTopDrawerPinned ? <Pin size={16} className="text-emerald-500" /> : <PinOff size={16} />}
          </button>
          <div
            ref={sheetScrollRef}
            className={`${isGpFile ? "" : "h-48 min-h-[180px]"} w-full overflow-x-auto overflow-y-hidden bg-white text-black scrollbar-hide`}
            style={isGpFile ? { height: `${gpScorePaneHeightPx}px`, minHeight: `${gpScorePaneHeightPx}px` } : undefined}
          >
          {!isGpFile ? (
            <div ref={osmdRef} className="h-full flex items-center min-w-max" />
          ) : (
            <AlphaTabViewer
              ref={alphaTabRef}
              fileData={rawFileContent as Uint8Array}
              keyCount={keyCount}
              isPlaybackActive={isPlaying}
              trackIndex={selectedGpTrackIndex}
              transpose={transpose}
              onScoreLoaded={handleGpScoreLoaded}
              onReadyChange={setIsGpPlaybackReady}
              onTimeUpdate={() => {
                // AlphaTab emits position updates during score load; ignore them before
                // our scheduler starts so a newly loaded score remains at Play/lead-in.
                if (isPlayingRef.current) {
                  scrollSheetToCursor();
                }
              }}
              onPlaybackFinished={() => stopPlayback(true)}
              onRenderedHeightChange={setGpScoreHeightPx}
            />
          )}
          </div>
        </div>
      </div>
      <div className="flex-1 w-full overflow-hidden bg-gray-950 relative">
        {/* Invisible Drawer Trigger Zone (Left edge) */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-6 z-40 hidden lg:block cursor-ew-resize"
          onMouseEnter={() => setIsDrawerHovered(true)}
        />
        {/* Invisible Drawer Trigger Zone (Right edge) */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-6 z-40 hidden lg:block cursor-ew-resize"
          onMouseEnter={() => setIsRightDrawerHovered(true)}
        />
        
        <div className="h-full w-full p-4 sm:p-6 overflow-hidden flex flex-col">
          <div className="flex flex-col lg:flex-row gap-4 h-full items-start w-full">
            
            {/* COLUMN 1: Score & Track Settings (Left) */}
            <div 
              className={`transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 lg:h-full
                ${isDrawerHovered || isDrawerPinned ? 'lg:w-[288px] lg:opacity-100' : 'lg:w-0 lg:opacity-0'}
              `}
              onMouseLeave={() => setIsDrawerHovered(false)}
            >
              {/* Force the inner panel to maintain its width even while the container shrinks, to avoid layout reflows inside it */}
              <div className="w-full lg:w-72 h-full">
                <ScoreSettingsPanel
                  availablePresets={availablePresets}
                  canUseProcessedScore={canUseProcessedScore}
                  fileName={fileName}
                  gpTracks={gpTracks}
                  keyCount={keyCount}
                  melodicaRanges={melodicaRangeOptions}
                  isGpFile={isGpFile}
                  isPinned={isDrawerPinned}
                  onDownloadMelodicaNotes={downloadMelodicaNotes}
                  onDownloadTransposedXml={downloadTransposedXml}
                  onFileChange={handleFileChange}
                  onGpTrackChange={(trackIndex) => handleGpTrackChange(trackIndex, () => stopPlayback(true))}
                  onMelodicaRangeChange={setSelectedKeyCount}
                  onSelectedPresetChange={setSelectedPreset}
                  onSoundFontChange={(soundFont) => {
                    setSelectedSf(soundFont);
                    stopPlayback();
                  }}
                  onTogglePin={() => setIsDrawerPinned(!isDrawerPinned)}
                  routeStatus={routeStatus}
                  routeStatusClassNames={routeStatusClassNames}
                  selectedGpTrackIndex={selectedGpTrackIndex}
                  selectedPreset={selectedPreset}
                  selectedSoundFont={selectedSf}
                  soundFonts={SOUNDFONTS}
                />
              </div>
            </div>

            {/* COLUMN 2: Note Highway (Center) */}
            <div 
              className="flex-[1_1_auto] w-full h-full overflow-hidden flex flex-col min-w-0 order-first lg:order-none cursor-pointer relative"
              onClick={togglePlayback}
              onContextMenu={(e) => {
                e.preventDefault();
                const areAllPinned = isDrawerPinned && isRightDrawerPinned && isTopDrawerPinned;
                const targetState = !areAllPinned;
                setIsDrawerPinned(targetState);
                setIsRightDrawerPinned(targetState);
                setIsTopDrawerPinned(targetState);
                window.dispatchEvent(new CustomEvent("toggle-all-panels", { detail: { pinned: targetState } }));
              }}
              onWheel={(e) => {
                if (e.deltaY < 0) {
                  handleSetTempo(Math.min(240, tempo + 5));
                } else if (e.deltaY > 0) {
                  handleSetTempo(Math.max(20, tempo - 5));
                }
              }}
            >
              {/* Temporary BPM Overlay */}
              <div 
                className={`absolute inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-500 ease-in-out
                  ${isBpmOverlayVisible ? 'opacity-100' : 'opacity-0'}
                `}
              >
                <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700 shadow-2xl rounded-2xl p-6 flex flex-col items-center gap-2 transform scale-110">
                  <Gauge size={48} className="text-emerald-500 opacity-80" />
                  <span className="text-4xl font-black tracking-tighter text-white">
                    {tempo} <span className="text-xl text-emerald-500/80">BPM</span>
                  </span>
                </div>
              </div>

              <NoteHighway
                clarity={clarity}
                detectedNote={detectedNote}
                isPlaying={isPlaying}
                keyCount={keyCount}
                lastHitIndex={lastHitIndex}
                pitchError={pitchError}
                shortestNoteDurationMs={shortestNoteDurationMs}
                showNoteNames={showNoteNames}
                visibleGameEvents={visibleGameEvents}
                visualPlayheadMs={visualPlayheadMs}
                isGp={isGpFile}
                fingerAssignments={fingerMap}
                showNumbers={showNumbers}
                phantomStates={phantomStates}
                isWaiting={isWaiting}
              />
            </div>

            {/* COLUMN 3: Transpose & Optimizer (Right) */}
            <div 
              className={`transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 lg:h-full
                ${isRightDrawerHovered || isRightDrawerPinned ? 'lg:w-[288px] lg:opacity-100' : 'lg:w-0 lg:opacity-0'}
              `}
              onMouseLeave={() => setIsRightDrawerHovered(false)}
            >
              {/* Force the inner panel to maintain its width even while the container shrinks */}
              <div className="w-full lg:w-72 h-full">
                <TransposeControls
                  onAutoTranspose={autoTransposeWithFilters}
                  onResetTranspose={() => setTranspose(0)}
                  onFingeringGuideChange={setFingeringGuide}
                  onShowNoteNamesChange={setShowNoteNames}
                  onStudyModeChange={setIsStudyMode}
                  onTransposeChange={handleTransposeChange}
                  optimalVariantsCount={optimalVariantsCount}
                  fingeringGuide={fingeringGuide}
                  isStudyMode={isStudyMode}
                  showNoteNames={showNoteNames}
                  transpose={transpose}
                  isPinned={isRightDrawerPinned}
                  onTogglePin={() => setIsRightDrawerPinned(!isRightDrawerPinned)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicXML;

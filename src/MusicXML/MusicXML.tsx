import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { freqToNoteAndCents, harmonicaKeys, normalizeHarmonicaKey } from "../utils/utils";
import { useTranslation } from "react-i18next";
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

type RouteStatusTone = "info" | "success" | "error";
type RouteStatus = { tone: RouteStatusTone; message: string; };

const routeStatusClassNames: Record<RouteStatusTone, string> = {
  info: "border-cyan-800 bg-cyan-950/60 text-cyan-100",
  success: "border-emerald-800 bg-emerald-950/60 text-emerald-100",
  error: "border-red-800 bg-red-950/70 text-red-200",
};

const SOUNDFONTS = [
    { label: "General MIDI (Large)", value: "MS_Basic.sf3" },
    { label: "Harmonica Essentials", value: "Harmonica_Essentials.sf2" },
    { label: "Florestan Harmonica", value: "022_Florestan_Harmonica.sf2" },
    { label: "Monsoons Harmonica (C)", value: "Monsoons Hohner C Harmonica.sf2" },
];

const sanitizeFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const sanitizeBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const sanitizeString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const TestFileLoader: React.FC = () => {
  const { t } = useTranslation();
  const setPlaybackToolbarState = useSetPlaybackToolbarState();
  
  // PERSISTENT STATES
  const [transpose, setTranspose] = usePersistentState<number>("harptrainer_transpose", 0, { sanitize: sanitizeFiniteNumber });
  const [selectedKey, setSelectedKey] = usePersistentState<string>("harptrainer_harmonica_key", "C4", { sanitize: sanitizeString });
  const [noOverblowOrDraw, setNoOverblowOrDraw] = usePersistentState<boolean>("harptrainer_no_overblow", true, { sanitize: sanitizeBoolean });
  const [noBend, setNoBend] = usePersistentState<boolean>("harptrainer_no_bend", false, { sanitize: sanitizeBoolean });
  const [showNoteNames, setShowNoteNames] = usePersistentState<boolean>("harptrainer_show_note_names", true, { sanitize: sanitizeBoolean });
  const [userTempoBpm, setUserTempoBpm] = usePersistentState<number | null>("harptrainer_user_tempo", null, { sanitize: sanitizeNullableTempo });

  const handleSetTempo = useCallback((newTempo: number) => {
    setUserTempoBpm(newTempo);
  }, [setUserTempoBpm]);
  const [selectedSf, setSelectedSf] = usePersistentState<string>("harptrainer_soundfont", "022_Florestan_Harmonica.sf2", { sanitize: sanitizeString });
  const [selectedPreset, setSelectedPreset] = usePersistentState<string>("harptrainer_preset", "0:22", { sanitize: sanitizeString }); // Default to Harmonica
  const harmonicaKey = normalizeHarmonicaKey(selectedKey);

  // VOLATILE STATES
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
    harmonicaKey,
    noBend,
    noOverblowOrDraw,
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
    harmonicaKey,
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
  
  const { pitch, clarity, error: pitchError } = usePitchDetector(0.82, isPlaying && playbackEvents.length > 0, { allowedMidiNumbers: playableMidiNumbers, minRms: 0.012, stableFrames: 2 });
  const detectedNote = useMemo(() => pitch ? freqToNoteAndCents(Number(pitch)) : null, [pitch]);
  const { accuracy, gameStats, lastHitIndex, resetScoring } = useNoteHighwayScoring({ currentGameTimeMs, currentGameEvent, detectedNote, playbackEvents, playbackTimeline, targetEventIndex });
  const canUseProcessedScore = (Boolean(fileContent) || (isGpFile && Boolean(rawFileContent))) && isSheetReady && !hasSheetRenderError;
  const canPlayback = canUseProcessedScore && playbackEvents.length > 0;

  const { downloadHarpTabs, downloadTransposedXml } = useScoreDownloads({
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

  const { autoTransposeWithFilters, optimalVariantsCount } = useTransposeOptimizer({
    gpOriginalMidiNumbers,
    harmonicaKey,
    isGpFile,
    noBend,
    noOverblowOrDraw,
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
    <div className="h-full w-full flex flex-col bg-gray-950 text-white overflow-hidden max-w-full">
      {/* SECTION 1: Score Window */}
      <div className="w-full shrink-0 border-b border-gray-800 bg-white shadow-2xl overflow-hidden max-w-full">
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
              harmonicaKey={harmonicaKey}
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
      <div className="flex-1 w-full overflow-hidden bg-gray-950">
        <div className="h-full max-w-screen-2xl mx-auto p-4 sm:p-6 overflow-hidden flex flex-col">
          <div className="flex flex-col lg:flex-row gap-4 h-full items-start w-full">
            {/* COLUMN 1: Score & Track Settings (Left) */}
            <ScoreSettingsPanel
              availablePresets={availablePresets}
              canUseProcessedScore={canUseProcessedScore}
              fileName={fileName}
              gpTracks={gpTracks}
              harmonicaKey={harmonicaKey}
              harmonicaKeys={harmonicaKeys}
              isGpFile={isGpFile}
              onDownloadHarpTabs={downloadHarpTabs}
              onDownloadTransposedXml={downloadTransposedXml}
              onFileChange={handleFileChange}
              onGpTrackChange={(trackIndex) => handleGpTrackChange(trackIndex, () => stopPlayback(true))}
              onHarmonicaKeyChange={setSelectedKey}
              onSelectedPresetChange={setSelectedPreset}
              onSoundFontChange={(soundFont) => {
                setSelectedSf(soundFont);
                stopPlayback();
              }}
              routeStatus={routeStatus}
              routeStatusClassNames={routeStatusClassNames}
              selectedGpTrackIndex={selectedGpTrackIndex}
              selectedPreset={selectedPreset}
              selectedSoundFont={selectedSf}
              soundFonts={SOUNDFONTS}
              t={t}
            />

            {/* COLUMN 2: Note Highway (Center) */}
            <div className="flex-1 w-full h-full overflow-hidden flex flex-col min-w-0 order-first lg:order-none">
              <NoteHighway
                clarity={clarity}
                detectedNote={detectedNote}
                isPlaying={isPlaying}
                lastHitIndex={lastHitIndex}
                pitchError={pitchError}
                shortestNoteDurationMs={shortestNoteDurationMs}
                showNoteNames={showNoteNames}
                visibleGameEvents={visibleGameEvents}
                visualPlayheadMs={visualPlayheadMs}
                playbackEvents={playbackEvents}
                playbackTimeline={playbackTimeline}
                isGp={isGpFile}
              />
            </div>

            {/* COLUMN 3: Transpose & Optimizer (Right) */}
            <TransposeControls
              noBend={noBend}
              noOverblowOrDraw={noOverblowOrDraw}
              onAutoTranspose={autoTransposeWithFilters}
              onNoBendChange={setNoBend}
              onNoOverblowOrDrawChange={setNoOverblowOrDraw}
              onResetTranspose={() => setTranspose(0)}
              onShowNoteNamesChange={setShowNoteNames}
              onTransposeChange={handleTransposeChange}
              optimalVariantsCount={optimalVariantsCount}
              showNoteNames={showNoteNames}
              transpose={transpose}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestFileLoader;

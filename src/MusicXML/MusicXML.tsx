import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  freqToNoteAndCents,
  melodicaRangeOptions,
  normalizeMelodicaKeyCount,
} from "../utils/utils";
import type { MelodicaKeyCount } from "../utils/utils";
import { usePitchDetector } from "../hooks/usePitchDetector";
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
import type { AlphaTabViewerRef } from "./AlphaTabViewer";
import {
  DEFAULT_TEMPO_BPM,
  getEffectiveTempoBpm,
  getTempoScale,
  sanitizeNullableTempo,
} from "./tempoModel";
import type { PlaybackEvent } from "./types";
import { assignFingers } from "./fingerAssigner";
import { usePhantomHand } from "./usePhantomHand";
import { releaseSynthesizer } from "./audioPlayback";
import { useMusicXmlPanels } from "./useMusicXmlPanels";
import { useStudyModePlayback } from "./useStudyModePlayback";
import { usePlaybackToolbarSync } from "./usePlaybackToolbarSync";
import { useMusicXmlKeyboardShortcuts } from "./useMusicXmlKeyboardShortcuts";
import { useBpmOverlay } from "./useBpmOverlay";
import { useEndStatsOverlay } from "./useEndStatsOverlay";
import {
  EndStatsOverlay,
  MusicXmlWorkspace,
  ScoreWindowPanel,
} from "./MusicXmlRoutePanels";

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
  // PERSISTENT STATES
  const [transpose, setTranspose] = usePersistentState<number>("melodicatrainer_transpose", 0, { legacyKeys: LEGACY_STORAGE_KEYS.transpose, sanitize: sanitizeFiniteNumber });
  const [selectedKeyCount, setSelectedKeyCount] = usePersistentState<MelodicaKeyCount>("melodicatrainer_key_count", 32, { sanitize: sanitizeMelodicaKeyCount });
  const [showNoteNames, setShowNoteNames] = usePersistentState<boolean>("melodicatrainer_show_note_names", true, { legacyKeys: LEGACY_STORAGE_KEYS.showNoteNames, sanitize: sanitizeBoolean });
  const [fingeringGuide, setFingeringGuide] = usePersistentState<string>("melodicatrainer_fingering_guide", "numbers", { sanitize: sanitizeString });
  const [isStudyMode, setIsStudyMode] = usePersistentState<boolean>("melodicatrainer_study_mode", false, { sanitize: sanitizeBoolean });
  const [userTempoBpm, setUserTempoBpm] = usePersistentState<number | null>("melodicatrainer_user_tempo", null, { legacyKeys: LEGACY_STORAGE_KEYS.tempo, sanitize: sanitizeNullableTempo });

  const handleSetTempo = useCallback((newTempo: number) => {
    setUserTempoBpm(newTempo);
  }, [setUserTempoBpm]);
  const [selectedSf, setSelectedSf] = usePersistentState<string>("melodicatrainer_soundfont", "melodica.sf2", { legacyKeys: LEGACY_STORAGE_KEYS.soundfont, sanitize: sanitizeSoundFont });
  const [selectedPreset, setSelectedPreset] = usePersistentState<string>("melodicatrainer_preset", "0:0", { legacyKeys: LEGACY_STORAGE_KEYS.preset, sanitize: sanitizeString });
  const keyCount = normalizeMelodicaKeyCount(selectedKeyCount);
  const panels = useMusicXmlPanels();

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
  const [hasSheetRenderError, setHasSheetRenderError] = useState(false);
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
    setIsSheetReady,
    setPlaybackEvents,
    setRouteStatus,
    transpose,
  });
  const handleOsmdRendered = useCallback(() => {
    setHasSheetRenderError(false);
    setIsSheetReady(true);
  }, []);
  const handleOsmdRenderError = useCallback((err: unknown) => {
    console.error("OSMD render error:", err);
    setHasSheetRenderError(true);
    setIsSheetReady(false);
    setRouteStatus({
      tone: "error",
      message: "Failed to render MusicXML score.",
    });
  }, []);
  const { osmdInstanceRef, osmdRef } = useOsmdScore({
    displayFileContent,
    isGpFile,
    onRenderError: handleOsmdRenderError,
    onRendered: handleOsmdRendered,
  });
  
  const tempoScale = getTempoScale({ detectedTempoBpm, userTempoBpm });
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
  

  const { fingerStates: phantomStates, activeMidi, activeFinger } = usePhantomHand(
    fingerAssignments ?? [],
    playbackEvents,
    playbackTimeline,
    currentGameTimeMs,
    showVirtualHand,
  );

  const { pitch, clarity, error: pitchError } = usePitchDetector(0.82, isPlaying && playbackEvents.length > 0, { allowedMidiNumbers: playableMidiNumbers, minRms: 0.012, stableFrames: 2 });
  const detectedNote = useMemo(() => pitch ? freqToNoteAndCents(Number(pitch)) : null, [pitch]);
  const {
    handleStudyModeHit,
    isWaiting,
    studyModeFreezeRef,
    studyModeNextIndexRef,
  } = useStudyModePlayback({
    currentEventIndex,
    currentGameTimeMs,
    gameClockStartMsRef,
    isPlaying,
    isStudyMode,
    playbackEvents,
    playbackTimeline,
    setCurrentEventIndex,
  });

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
    callbacks: {
      resetScoring,
      setCurrentEventIndex,
      setCurrentGameTimeMs,
      setIsPlaying,
      setRouteStatus,
      stopGpCursorAnimation,
    },
    refs: {
      alphaTabRef,
      audioContextRef,
      cursorEventIndexRef,
      gameClockFrameRef,
      gameClockOffsetMsRef,
      gameClockStartMsRef,
      isPlayingRef,
      moveCursorThroughEventRef,
      osmdInstanceRef,
      playbackRunRef,
      playbackTimerRef,
      sheetScrollRef,
      studyModeFreezeRef,
      tempoScaleRef,
    },
    state: {
      canPlayback,
      currentEventIndex,
      currentGameTimeMs,
      fileName,
      isGpFile,
      isGpPlaybackReady,
      isPlaying,
      isSheetReady,
      playbackEvents,
      playbackTimeline,
      selectedPreset,
      selectedSf,
      shortestNoteDurationMs,
    },
  });
  const handleRestartPlayback = useCallback(() => stopPlayback(true), [stopPlayback]);

  useEffect(() => {
    moveCursorThroughEventRef.current = moveCursorThroughEvent;
  }, [moveCursorThroughEvent]);

  // Sync tempo to AlphaTab
  useEffect(() => {
    if (isGpFile && alphaTabRef.current) {
        alphaTabRef.current.setTempo(tempoScale);
    }
  }, [tempoScale, isGpFile]);

  usePlaybackToolbarSync({
    accuracy,
    canPlayback,
    currentGameTimeMs,
    gameStats,
    isPlaying,
    onRestartPlayback: handleRestartPlayback,
    onSetTempo: handleSetTempo,
    onTogglePlayback: togglePlayback,
    progress,
    tempo,
  });

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Handle unmount only
  useEffect(() => () => {
    stopPlayback(true);
    releaseSynthesizer();
    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }, [stopPlayback]);

  useMusicXmlKeyboardShortcuts({
    onResetPlayback: handleRestartPlayback,
    onSetTempo: handleSetTempo,
    onTogglePlayback: togglePlayback,
    tempo,
  });

  const isBpmOverlayVisible = useBpmOverlay(tempo);
  const { dismissEndStats, showEndStats } = useEndStatsOverlay({
    isPlaying,
    topDrawerHidden: panels.topDrawerHidden,
  });

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
      <ScoreWindowPanel
        alphaTabProps={{
          fileData: rawFileContent as Uint8Array,
          isPlaybackActive: isPlaying,
          keyCount,
          onPlaybackFinished: handleRestartPlayback,
          onReadyChange: setIsGpPlaybackReady,
          onRenderedHeightChange: setGpScoreHeightPx,
          onScoreLoaded: handleGpScoreLoaded,
          onTimeUpdate: () => {
            if (isPlayingRef.current) {
              scrollSheetToCursor();
            }
          },
          trackIndex: selectedGpTrackIndex,
          transpose,
        }}
        alphaTabRef={alphaTabRef}
        gpScorePaneHeightPx={gpScorePaneHeightPx}
        isGpFile={isGpFile}
        isTopDrawerHovered={panels.isTopDrawerHovered}
        isTopDrawerPinned={panels.isTopDrawerPinned}
        onTopDrawerHoverChange={panels.setIsTopDrawerHovered}
        onToggleTopPinned={() => panels.setIsTopDrawerPinned(!panels.isTopDrawerPinned)}
        osmdRef={osmdRef}
        sheetScrollRef={sheetScrollRef}
      />

      <MusicXmlWorkspace
        isBpmOverlayVisible={isBpmOverlayVisible}
        isDrawerHovered={panels.isDrawerHovered}
        isDrawerPinned={panels.isDrawerPinned}
        isRightDrawerHovered={panels.isRightDrawerHovered}
        isRightDrawerPinned={panels.isRightDrawerPinned}
        noteHighwayProps={{
          activeFinger,
          activeMidi,
          clarity,
          detectedNote,
          fingerAssignments: fingerMap,
          isPlaying,
          isWaiting,
          keyCount,
          lastHitIndex,
          phantomStates,
          pitchError,
          shortestNoteDurationMs,
          showNoteNames,
          showNumbers,
          showVirtualHand,
          visibleGameEvents,
          visualPlayheadMs,
        }}
        onCenterContextMenu={panels.toggleAllPanels}
        onCenterWheel={(deltaY) => {
          if (deltaY < 0) {
            handleSetTempo(Math.min(240, tempo + 5));
          } else if (deltaY > 0) {
            handleSetTempo(Math.max(20, tempo - 5));
          }
        }}
        onDrawerHoverChange={panels.setIsDrawerHovered}
        onRightDrawerHoverChange={panels.setIsRightDrawerHovered}
        onTogglePlayback={togglePlayback}
        scoreSettingsProps={{
          availablePresets,
          canUseProcessedScore,
          fileName,
          gpTracks,
          isGpFile,
          isPinned: panels.isDrawerPinned,
          keyCount,
          melodicaRanges: melodicaRangeOptions,
          onDownloadMelodicaNotes: downloadMelodicaNotes,
          onDownloadTransposedXml: downloadTransposedXml,
          onFileChange: handleFileChange,
          onGpTrackChange: (trackIndex) => handleGpTrackChange(trackIndex, handleRestartPlayback),
          onMelodicaRangeChange: setSelectedKeyCount,
          onSelectedPresetChange: setSelectedPreset,
          onSoundFontChange: (soundFont) => {
            setSelectedSf(soundFont);
            stopPlayback();
          },
          onTogglePin: () => panels.setIsDrawerPinned(!panels.isDrawerPinned),
          routeStatus,
          routeStatusClassNames,
          selectedGpTrackIndex,
          selectedPreset,
          selectedSoundFont: selectedSf,
          soundFonts: SOUNDFONTS,
        }}
        tempo={tempo}
        transposeControlsProps={{
          fingeringGuide,
          isPinned: panels.isRightDrawerPinned,
          isStudyMode,
          onAutoTranspose: autoTransposeWithFilters,
          onFingeringGuideChange: setFingeringGuide,
          onResetTranspose: () => setTranspose(0),
          onShowNoteNamesChange: setShowNoteNames,
          onStudyModeChange: setIsStudyMode,
          onTogglePin: () => panels.setIsRightDrawerPinned(!panels.isRightDrawerPinned),
          onTransposeChange: handleTransposeChange,
          optimalVariantsCount,
          showNoteNames,
          transpose,
        }}
      />

      {showEndStats && (
        <EndStatsOverlay
          accuracy={accuracy}
          gameStats={gameStats}
          onDismiss={dismissEndStats}
        />
      )}
    </div>
  );
};

export default MusicXML;

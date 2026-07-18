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
import type { LibraryEntry } from "./scoreLibrary";
import {
  downloadScoreLibraryFile,
  getScoreLibraryDownloadErrorMessage,
  ScoreLibraryDownloadError,
} from "./scoreLibraryDownload";
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
import { useUserScoreLibrary } from "./UserScoreLibraryContext";
import { getUserScoreFile } from "./userScoreLibrary";
import { usePlaybackToolbarSync } from "./usePlaybackToolbarSync";
import { useMusicXmlKeyboardShortcuts } from "./useMusicXmlKeyboardShortcuts";
import { useBpmOverlay } from "./useBpmOverlay";
import { useEndStatsOverlay } from "./useEndStatsOverlay";
import { useMidiScore } from "./useMidiScore";
import { getMusicXmlFileErrorMessage } from "./musicXmlFile";
import { getMidiFileErrorMessage } from "./midiParser";
import {
  sanitizeMidiQuantizationMode,
} from "./midiNotation";
import type { MidiQuantizationMode } from "./midiNotation";
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
  const userLibrary = useUserScoreLibrary();
  // PERSISTENT STATES
  const [transpose, setTranspose] = usePersistentState<number>("melodicatrainer_transpose", 0, { legacyKeys: LEGACY_STORAGE_KEYS.transpose, sanitize: sanitizeFiniteNumber });
  const [selectedKeyCount, setSelectedKeyCount] = usePersistentState<MelodicaKeyCount>("melodicatrainer_key_count", 32, { sanitize: sanitizeMelodicaKeyCount });
  const [showNoteNames, setShowNoteNames] = usePersistentState<boolean>("melodicatrainer_show_note_names", true, { legacyKeys: LEGACY_STORAGE_KEYS.showNoteNames, sanitize: sanitizeBoolean });
  const [fingeringGuide, setFingeringGuide] = usePersistentState<string>("melodicatrainer_fingering_guide", "numbers", { sanitize: sanitizeString });
  const [isStudyMode, setIsStudyMode] = usePersistentState<boolean>("melodicatrainer_study_mode", false, { sanitize: sanitizeBoolean });
  const [userTempoBpm, setUserTempoBpm] = usePersistentState<number | null>("melodicatrainer_user_tempo", null, { legacyKeys: LEGACY_STORAGE_KEYS.tempo, sanitize: sanitizeNullableTempo });
  const [midiQuantizationMode, setMidiQuantizationMode] =
    usePersistentState<MidiQuantizationMode>(
      "melodicatrainer_midi_quantization",
      "auto",
      { sanitize: sanitizeMidiQuantizationMode },
    );

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
  const {
    fileName,
    isGpFile,
    isMidiFile,
    loadScoreFile,
    rawFileContent,
    scoreFormat,
  } = useScoreFileLoader({
    onDefaultLoadError: handleDefaultScoreLoadError,
  });
  const [detectedTempoBpm, setDetectedTempoBpm] = useState(DEFAULT_TEMPO_BPM);
  const [isLooping, setIsLooping] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [currentGameTimeMs, setCurrentGameTimeMs] = useState(0);
  const [isSheetReady, setIsSheetReady] = useState(false);
  const [hasSheetRenderError, setHasSheetRenderError] = useState(false);
  const [playbackEvents, setPlaybackEvents] = useState<PlaybackEvent[]>([]);
  const [playbackCompletionId, setPlaybackCompletionId] = useState(0);

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
    rawFileContent,
    scoreFormat,
    setDetectedTempoBpm,
    setIsSheetReady,
    setPlaybackEvents,
    setRouteStatus,
    transpose,
  });

  const {
    handleMidiPartChange,
    midiDisplayFileContent,
    midiNotationStatus,
    midiNotationWarnings,
    midiOriginalMidiNumbers,
    midiParts,
    midiScore,
    resetMidiScore,
    resolvedMidiQuantization,
    selectedMidiPart,
    selectedMidiPartId,
  } = useMidiScore({
    fileName,
    isMidiFile,
    keyCount,
    quantizationMode: midiQuantizationMode,
    rawFileContent,
    setDetectedTempoBpm,
    setIsSheetReady,
    setPlaybackEvents,
    setRouteStatus,
    setTranspose,
    transpose,
  });

  const handleOsmdRendered = useCallback(() => {
    setHasSheetRenderError(false);
    setIsSheetReady(true);
  }, []);
  const handleOsmdRenderError = useCallback((err: unknown) => {
    console.error("OSMD render error:", err);
    setHasSheetRenderError(true);
    if (scoreFormat === "midi") {
      setRouteStatus({
        tone: "info",
        message: "MIDI playback is ready, but approximate notation could not be rendered.",
      });
      return;
    }
    setIsSheetReady(false);
    setRouteStatus({
      tone: "error",
      message: "Failed to render MusicXML score.",
    });
  }, [scoreFormat]);
  const { osmdInstanceRef, osmdRef } = useOsmdScore({
    displayFileContent: scoreFormat === "midi"
      ? midiDisplayFileContent
      : displayFileContent,
    onRenderError: handleOsmdRenderError,
    onRendered: handleOsmdRendered,
    scoreFormat,
  });
  useEffect(() => {
    if (scoreFormat === "midi" && midiDisplayFileContent) {
      setHasSheetRenderError(false);
    }
  }, [midiDisplayFileContent, scoreFormat]);
  
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
  const canUseProcessedScore = scoreFormat === "midi"
    ? Boolean(rawFileContent) && playbackEvents.length > 0
    : (
        Boolean(fileContent) || (isGpFile && Boolean(rawFileContent))
      ) && isSheetReady && (scoreFormat !== "musicxml" || !hasSheetRenderError);
  const canPlayback = canUseProcessedScore && playbackEvents.length > 0;

  const { downloadMelodicaNotes, downloadTransposedXml } = useScoreDownloads({
    fileContent,
    fileName,
  });

  const { moveCursorThroughEvent, scrollSheetToCursor, stopGpCursorAnimation } = useScoreCursor({
    alphaTabRef,
    cursorEventIndexRef,
    gpCursorFrameRef,
    isPlayingRef,
    osmdInstanceRef,
    playbackEvents,
    scoreFormat,
    sheetScrollRef,
  });

  const { stopPlayback, togglePlayback } = useScorePlayback({
    callbacks: {
      onPlaybackComplete: () => setPlaybackCompletionId((id) => id + 1),
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
      studyModeNextIndexRef,
      tempoScaleRef,
    },
    state: {
      canPlayback,
      currentEventIndex,
      currentGameTimeMs,
      fileName,
      isGpFile,
      isGpPlaybackReady,
      isLooping,
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
  const handleToggleLoop = useCallback(() => setIsLooping((value) => !value), []);
  const stopPlaybackRef = useRef(stopPlayback);

  useEffect(() => {
    moveCursorThroughEventRef.current = moveCursorThroughEvent;
  }, [moveCursorThroughEvent]);

  useEffect(() => {
    stopPlaybackRef.current = stopPlayback;
  }, [stopPlayback]);

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
    isLooping,
    isPlaying,
    onRestartPlayback: handleRestartPlayback,
    onSetTempo: handleSetTempo,
    onToggleLoop: handleToggleLoop,
    onTogglePlayback: togglePlayback,
    progress,
    tempo,
  });

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Handle unmount only
  useEffect(() => () => {
    stopPlaybackRef.current(true);
    releaseSynthesizer();
    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }, []);

  useMusicXmlKeyboardShortcuts({
    onResetPlayback: handleRestartPlayback,
    onSetTempo: handleSetTempo,
    onTogglePlayback: togglePlayback,
    tempo,
  });

  const isBpmOverlayVisible = useBpmOverlay(tempo);
  const { dismissEndStats, showEndStats } = useEndStatsOverlay({
    playbackCompletionId,
  });

  const { autoTransposeWithFilters, optimalVariantsCount } = useTransposeOptimizer({
    keyCount,
    originalMidiNumbers: isMidiFile ? midiOriginalMidiNumbers : gpOriginalMidiNumbers,
    playbackEvents,
    rawFileContent,
    scoreFormat,
    setTranspose,
    transpose,
  });

  const handleTransposeChange = (value: string) => {
    const semitones = Number.parseInt(value, 10);
    setTranspose(Number.isFinite(semitones) ? semitones : 0);
  };

  const handleImportError = useCallback((error: unknown) => {
    setRouteStatus({
      tone: "error",
      message: getMidiFileErrorMessage(error) ??
        getMusicXmlFileErrorMessage(error) ??
        "Failed to load score file.",
    });
  }, []);

  const { handleFileChange, importScoreFile } = useScoreFileImport({
    loadScoreFile,
    onImportError: handleImportError,
    resetGpScore,
    resetMidiScore,
    setPlaybackEvents,
    setIsSheetReady,
    setUserTempoBpm,
    setDetectedTempoBpm,
    setTranspose,
    stopPlayback,
  });

  const handleLibraryScoreLoad = useCallback(
    async (entry: LibraryEntry, signal: AbortSignal) => {
      setRouteStatus({
        tone: "info",
        message: entry.sourceKind === "public"
          ? `Downloading ${entry.title}...`
          : `Opening ${entry.title}...`,
      });

      try {
        const file = entry.sourceKind === "public"
          ? await downloadScoreLibraryFile(entry, { signal })
          : userLibrary.directoryHandle
            ? await getUserScoreFile(userLibrary.directoryHandle, entry)
            : (() => { throw new Error("Reconnect the local library folder in Settings."); })();
        if (signal.aborted) throw new DOMException("Loading cancelled.", "AbortError");
        await importScoreFile(file);
        setRouteStatus({
          tone: "success",
          message: `${entry.title} loaded from ${entry.sourceKind === "public" ? "Score Library" : "your local folder"}.`,
        });
      } catch (error) {
        if (
          error instanceof ScoreLibraryDownloadError &&
          error.reason === "cancelled"
        ) {
          setRouteStatus({ tone: "info", message: "Library download cancelled." });
        } else {
          setRouteStatus({
            tone: "error",
            message: entry.sourceKind === "public"
              ? getScoreLibraryDownloadErrorMessage(error)
              : error instanceof Error
                ? error.message
                : "Could not load that local score.",
          });
        }
        throw error;
      }
    },
    [importScoreFile, userLibrary.directoryHandle],
  );

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
        midiSummary={midiScore && selectedMidiPart ? {
          durationSeconds: selectedMidiPart.durationSeconds,
          fileName: midiScore.fileName,
          initialTempoBpm: midiScore.initialTempoBpm,
          noteCount: selectedMidiPart.noteCount,
          partLabel: `${selectedMidiPart.name} — Ch. ${selectedMidiPart.channel + 1}`,
          tempoChangeCount: Math.max(0, midiScore.tempoChanges.length - 1),
        } : null}
        midiNotationStatus={scoreFormat === "midi" && hasSheetRenderError
          ? "unavailable"
          : midiNotationStatus}
        midiNotationWarnings={midiNotationWarnings}
        isTopDrawerHovered={panels.isTopDrawerHovered}
        isTopDrawerPinned={panels.isTopDrawerPinned}
        onTopDrawerHoverChange={panels.setIsTopDrawerHovered}
        onToggleTopPinned={() => panels.setIsTopDrawerPinned(!panels.isTopDrawerPinned)}
        osmdRef={osmdRef}
        scoreFormat={scoreFormat}
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
          isPinned: panels.isDrawerPinned,
          keyCount,
          melodicaRanges: melodicaRangeOptions,
          midiParts,
          midiNotationStatus: scoreFormat === "midi" && hasSheetRenderError
            ? "unavailable"
            : midiNotationStatus,
          midiNotationWarnings,
          midiQuantizationMode,
          onDownloadMelodicaNotes: downloadMelodicaNotes,
          onDownloadTransposedXml: downloadTransposedXml,
          onFileChange: handleFileChange,
          onGpTrackChange: (trackIndex) => handleGpTrackChange(trackIndex, handleRestartPlayback),
          onLibraryScoreLoad: handleLibraryScoreLoad,
          onMidiPartChange: (partId) => {
            stopPlayback(true);
            handleMidiPartChange(partId);
          },
          onMidiQuantizationChange: (mode) => {
            stopPlayback(true);
            setMidiQuantizationMode(mode);
          },
          onMelodicaRangeChange: setSelectedKeyCount,
          onSelectedPresetChange: setSelectedPreset,
          onSoundFontChange: (soundFont) => {
            setSelectedSf(soundFont);
            stopPlayback();
          },
          onTogglePin: () => panels.setIsDrawerPinned(!panels.isDrawerPinned),
          routeStatus,
          routeStatusClassNames,
          scoreFormat,
          selectedGpTrackIndex,
          selectedMidiPartId,
          resolvedMidiQuantization,
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

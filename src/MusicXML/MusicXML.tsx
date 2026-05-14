import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { freqToNoteAndCents, harmonicaKeys, normalizeHarmonicaKey } from "../utils/utils";
import { useTranslation } from "react-i18next";
import { usePitchDetector } from "../hooks/usePitchDetector";
import {
  ensureAudioContext,
  initSynthesizer,
  getAvailablePresets,
  changeInstrument,
} from "./audioPlayback";
import {
  createFirstStaffDisplayXml,
  injectHarmonicaTabs,
  findAutoTransposeIntervals,
  findBestTransposeIntervals,
  exportHarpTabsText,
} from "./musicXmlTransform";
import { NoteHighway } from "./NoteHighway";
import { parsePlaybackEvents } from "./playbackParser";
import {
  createPlaybackTimeline,
  getPlayableMidiNumbers,
  getTargetEventIndex,
  getVisibleGameEvents,
} from "./playbackTimeline";
import { styleSheetCursor } from "./sheetCursor";
import { useNoteHighwayScoring } from "./useNoteHighwayScoring";
import { getInterpolatedGpCursorTick } from "./gpCursor";
import { usePersistentState } from "../hooks/usePersistentState";
import { useScoreFileLoader } from "./useScoreFileLoader";
import { useOsmdScore } from "./useOsmdScore";
import { useGpScore } from "./useGpScore";
import { useScorePlayback } from "./useScorePlayback";
import { ScoreSettingsPanel } from "./ScoreSettingsPanel";
import { TransposeControls } from "./TransposeControls";
import AlphaTabViewer from "./AlphaTabViewer";
import type { AlphaTabViewerRef } from "./AlphaTabViewer";
import { useSetPlaybackToolbarState } from "../PlaybackToolbarContext";
import {
  DEFAULT_TEMPO_BPM,
  getEffectiveTempoBpm,
  getResetTempoState,
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

type AvailablePreset = ReturnType<typeof getAvailablePresets>[number];

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
  const [fileContent, setFileContent] = useState<string | null>(null);
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
  const [availablePresets, setAvailablePresets] = useState<AvailablePreset[]>([]);
  const [playbackEvents, setPlaybackEvents] = useState<PlaybackEvent[]>([]);

  const tempo = getEffectiveTempoBpm({ detectedTempoBpm, userTempoBpm });

  const alphaTabRef = useRef<AlphaTabViewerRef>(null);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
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

  const displayFileContent = useMemo(() => (fileContent ? createFirstStaffDisplayXml(fileContent) : null), [fileContent]);
  const handleOsmdRendered = useCallback(() => {
    setIsSheetReady(true);
  }, []);
  const { osmdInstanceRef, osmdRef } = useOsmdScore({
    displayFileContent,
    isGpFile,
    onRendered: handleOsmdRendered,
  });
  
  // Update playbackEvents when file content or other params change (for OSMD)
  useEffect(() => {
    if (isGpFile || !displayFileContent) return;
    const playback = parsePlaybackEvents(displayFileContent);
    setPlaybackEvents(playback.events);
    if (playback.detectedTempo) {
        setDetectedTempoBpm(playback.detectedTempo);
    }
  }, [displayFileContent, isGpFile]);

  const playableMidiNumbers = useMemo(() => getPlayableMidiNumbers(playbackEvents), [playbackEvents]);
  
  const tempoScale = tempo / 100; // Simplified for both
  const tempoScaleRef = useRef(tempoScale);
  useEffect(() => { tempoScaleRef.current = tempoScale; }, [tempoScale]);

  // Compute the timeline.
  const playbackTimeline = useMemo(() => createPlaybackTimeline(playbackEvents, 1), [playbackEvents]);
  // Find the shortest note duration to scale the highway grid.
  const shortestNoteDurationMs = useMemo(() => {
    if (playbackTimeline.length === 0) return 250; 
    let minDuration = Number.POSITIVE_INFINITY;
    
    playbackTimeline.forEach((timing, idx) => {
        // ONLY consider events that have notes (ignore rests for scaling)
        const event = playbackEvents[idx];
        if (event && event.notes.length > 0 && timing.durationMs > 10) {
            if (timing.durationMs < minDuration) {
                minDuration = timing.durationMs;
            }
        }
    });
    
    return minDuration === Number.POSITIVE_INFINITY ? 250 : minDuration;
  }, [playbackTimeline, playbackEvents]);

  const visualPlayheadMs = currentGameTimeMs;
  const progress = playbackEvents.length > 0 ? Math.min(100, Math.round((currentEventIndex / playbackEvents.length) * 100)) : 0;
  const visibleGameEvents = useMemo(() => getVisibleGameEvents(playbackEvents, playbackTimeline, visualPlayheadMs, shortestNoteDurationMs), [playbackEvents, playbackTimeline, visualPlayheadMs, shortestNoteDurationMs]);
  const targetEventIndex = useMemo(() => getTargetEventIndex(visibleGameEvents, visualPlayheadMs), [visibleGameEvents, visualPlayheadMs]);
  const currentGameEvent = playbackEvents[targetEventIndex ?? currentEventIndex];
  
  const { pitch, clarity, error: pitchError } = usePitchDetector(0.82, isPlaying && playbackEvents.length > 0, { allowedMidiNumbers: playableMidiNumbers, minRms: 0.012, stableFrames: 2 });
  const detectedNote = useMemo(() => pitch ? freqToNoteAndCents(Number(pitch)) : null, [pitch]);
  const { accuracy, gameStats, lastHitIndex, resetScoring } = useNoteHighwayScoring({ currentGameTimeMs, currentGameEvent, detectedNote, playbackEvents, playbackTimeline, targetEventIndex });
  const canUseProcessedScore = (Boolean(fileContent) || (isGpFile && Boolean(rawFileContent))) && isSheetReady && !hasSheetRenderError;
  const canPlayback = canUseProcessedScore && playbackEvents.length > 0;

  const downloadTransposedXml = useCallback(() => {
    if (!fileContent) return;
    const blob = new Blob([fileContent], { type: "application/vnd.recordare.musicxml+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName ? `transposed_${fileName}` : "transposed.musicxml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [fileContent, fileName]);

  const downloadHarpTabs = useCallback(() => {
    if (!fileContent) return;
    const tabs = exportHarpTabsText(fileContent);
    const blob = new Blob([tabs], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName ? `${fileName.replace(/\.[^/.]+$/, "")}_tabs.txt` : "tabs.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [fileContent, fileName]);

  const { stopGpCursorAnimation, stopPlayback, togglePlayback } = useScorePlayback({
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
    gpCursorFrameRef,
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
    setAvailablePresets,
    setCurrentEventIndex,
    setCurrentGameTimeMs,
    setIsPlaying,
    setRouteStatus,
    sheetScrollRef,
    shortestNoteDurationMs,
    tempoScaleRef,
  });

  const scrollSheetToCursor = useCallback(() => {
    const sheet = sheetScrollRef.current;
    if (!sheet) return;

    const cursorElement = isGpFile 
        ? alphaTabRef.current?.getCursorElement() 
        : osmdInstanceRef.current?.cursor?.cursorElement;

    if (!cursorElement) return;

    window.requestAnimationFrame(() => {
      const sheetRect = sheet.getBoundingClientRect();
      const cursorRect = cursorElement.getBoundingClientRect();
      const targetLeft = sheet.clientWidth * 0.4;
      const offset = cursorRect.left - sheetRect.left - targetLeft;
      sheet.scrollTo({ left: Math.max(0, sheet.scrollLeft + offset), behavior: "smooth" });
    });
  }, [isGpFile, osmdInstanceRef]);

  const moveCursorInstantlyToEvent = useCallback((eventIndex: number) => {
    const cursor = osmdInstanceRef.current?.cursor;
    if (!cursor) return;
    cursor.cursorElement.style.transition = "none";
    if (cursorEventIndexRef.current === null || eventIndex < cursorEventIndexRef.current) {
      cursor.reset();
      cursorEventIndexRef.current = 0;
    }
    cursor.show();
    for (let i = cursorEventIndexRef.current; i < eventIndex; i++) cursor.next();
    cursorEventIndexRef.current = eventIndex;
    styleSheetCursor(cursor.cursorElement, 0);
    scrollSheetToCursor();
  }, [scrollSheetToCursor, osmdInstanceRef]);

  const animateGpCursorThroughEvent = useCallback((eventIndex: number, durationMs: number) => {
    if (!isGpFile) return;

    stopGpCursorAnimation();

    const event = playbackEvents[eventIndex];
    const startTick = event?.originalTick;
    if (startTick === undefined) return;

    const api = alphaTabRef.current;
    if (!api) return;

    const nextEvent = playbackEvents[eventIndex + 1];
    if (nextEvent?.originalTick === undefined || nextEvent.originalTick <= startTick || durationMs <= 0) {
      api.setTickPosition(startTick);
      return;
    }

    const startedAt = performance.now();

    const step = (now: number) => {
      const elapsedMs = now - startedAt;
      const tick = getInterpolatedGpCursorTick({
        event,
        nextEvent,
        elapsedMs,
        durationMs,
      });

      if (tick !== null) {
        api.setTickPosition(tick);
      }

      const progress = Math.min(1, elapsedMs / durationMs);
      if (progress < 1 && isPlayingRef.current) {
        gpCursorFrameRef.current = window.requestAnimationFrame(step);
      } else {
        gpCursorFrameRef.current = null;
      }
    };

    api.setTickPosition(startTick);
    gpCursorFrameRef.current = window.requestAnimationFrame(step);
  }, [isGpFile, playbackEvents, stopGpCursorAnimation]);

  const moveCursorThroughEvent = useCallback((eventIndex: number, durationMs: number) => {
    const event = playbackEvents[eventIndex];
    if (!event) return;
    moveCursorInstantlyToEvent(event.sourceEventIndex);
    
    // AlphaTab Sync
    animateGpCursorThroughEvent(eventIndex, durationMs);

    const nextEvent = playbackEvents[eventIndex + 1];
    if (nextEvent && nextEvent.sourceEventIndex > event.sourceEventIndex) {
        const cursor = osmdInstanceRef.current?.cursor;
        if (cursor) {
            styleSheetCursor(cursor.cursorElement, durationMs);
            cursor.next();
        }
        cursorEventIndexRef.current = nextEvent.sourceEventIndex;
        scrollSheetToCursor();
    }
  }, [playbackEvents, moveCursorInstantlyToEvent, scrollSheetToCursor, animateGpCursorThroughEvent, osmdInstanceRef]);

  useEffect(() => {
    moveCursorThroughEventRef.current = moveCursorThroughEvent;
  }, [moveCursorThroughEvent]);

  // Handle live instrument change
  useEffect(() => {
      if (availablePresets.length > 0) {
          const [bank, program] = selectedPreset.split(":").map(Number);
          changeInstrument(program, bank);
      }
  }, [selectedPreset, availablePresets]);

  // Warm up synth and fetch presets when soundfont changes
  useEffect(() => {
    const audioContext = ensureAudioContext(audioContextRef.current);
    audioContextRef.current = audioContext;
    
    initSynthesizer(audioContext, selectedSf)
      .then(() => {
          const presets = getAvailablePresets();
          setAvailablePresets(presets);
      })
      .catch(err => {
          console.error("Failed to pre-load soundfont:", err);
      });
  }, [selectedSf]);

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

  useEffect(() => {
    if (!rawFileContent || isGpFile) return;
    try {
      const injected = injectHarmonicaTabs(rawFileContent as string, { selectedKey: harmonicaKey, transpose });
      setFileContent(injected);
    } catch (e) {
      console.error(e);
    }
  }, [rawFileContent, harmonicaKey, transpose, isGpFile]);

  // Handle unmount only
  useEffect(() => () => stopPlayback(true), [stopPlayback]);

  const optimalVariantsCount = useMemo(() => {
    if (!rawFileContent) return 0;
    
    let midiNumbers: number[] = [];
    if (isGpFile) {
        midiNumbers = gpOriginalMidiNumbers;
    } else {
        if (playbackEvents.length === 0) return 0;
        // For MusicXML, we need to parse if possible, or use current events
        midiNumbers = Array.from(getPlayableMidiNumbers(playbackEvents)).map(m => m - transpose);
    }
    
    if (midiNumbers.length === 0) return 0;
    
    const bests = findBestTransposeIntervals(midiNumbers, { 
        selectedKey: harmonicaKey,
        noOverblowOrDraw, 
        noBend 
    });
    return bests.length;
  }, [rawFileContent, playbackEvents, harmonicaKey, noOverblowOrDraw, noBend, isGpFile, transpose, gpOriginalMidiNumbers]);

  const autoTransposeWithFilters = () => {
    if (!rawFileContent) return;
    
    if (isGpFile) {
        console.log("AutoTranspose: Analyzing GP track for optimization (Cycling)...");
        const originalMidiNumbers = gpOriginalMidiNumbers;
        if (originalMidiNumbers.length === 0) return;

        // 2. Find all absolute best intervals relative to ORIGINAL file
        const bestAbsoluteIntervals = findBestTransposeIntervals(originalMidiNumbers, { 
            selectedKey: harmonicaKey,
            noOverblowOrDraw, 
            noBend 
        });

        console.log(`AutoTranspose: Found ${bestAbsoluteIntervals.length} optimal positions:`, bestAbsoluteIntervals);

        if (bestAbsoluteIntervals.length > 0) {
            // 3. Find current transpose in the list
            const currentIdx = bestAbsoluteIntervals.indexOf(transpose);
            let nextTranspose;

            if (currentIdx !== -1 && bestAbsoluteIntervals.length > 1) {
                // Already at one of the best spots, cycle to the next index
                nextTranspose = bestAbsoluteIntervals[(currentIdx + 1) % bestAbsoluteIntervals.length];
                console.log(`AutoTranspose: Cycling to next absolute position: ${nextTranspose}`);
            } else {
                // Not at a best spot, or only one exists, pick the first
                nextTranspose = bestAbsoluteIntervals[0];
                console.log(`AutoTranspose: Picking closest absolute position: ${nextTranspose}`);
            }

            setTranspose(nextTranspose);
        }
        return;
    }

    // MusicXML Cycling
    const bests = findAutoTransposeIntervals(rawFileContent as string, { selectedKey: harmonicaKey, noOverblowOrDraw, noBend });
    if (bests.length > 0) {
        const currentIdx = bests.indexOf(transpose);
        const nextTranspose = (currentIdx !== -1 && bests.length > 1) 
            ? bests[(currentIdx + 1) % bests.length] 
            : bests[0];
        setTranspose(nextTranspose);
    }
  };

  const handleTransposeChange = (value: string) => {
    const semitones = Number.parseInt(value, 10);
    setTranspose(Number.isFinite(semitones) ? semitones : 0);
  };

  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      stopPlayback(true);
      const loadedFile = await loadScoreFile(file);
      resetGpScore(loadedFile.isGpFile);
      setPlaybackEvents([]);
      setIsSheetReady(false);
      const resetTempoState = getResetTempoState();
      setUserTempoBpm(resetTempoState.userTempoBpm);
      setDetectedTempoBpm(resetTempoState.detectedTempoBpm);
      setTranspose(0);
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = "";
    }
  }, [
    loadScoreFile,
    resetGpScore,
    setPlaybackEvents,
    setIsSheetReady,
    setUserTempoBpm,
    setDetectedTempoBpm,
    setTranspose,
    stopPlayback,
  ]);

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
              trackIndex={selectedGpTrackIndex}
              transpose={transpose}
              onScoreLoaded={handleGpScoreLoaded}
              onReadyChange={setIsGpPlaybackReady}
              onTimeUpdate={() => {
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CursorType, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { freqToNoteAndCents, harmonicaKeys, normalizeHarmonicaKey } from "../utils/utils";
import { useTranslation } from "react-i18next";
import { usePitchDetector } from "../hooks/usePitchDetector";
import {
  ensureAudioContext,
  getAudioOutputLatencyMs,
  initSynthesizer,
  playPlaybackNotes,
  stopAudioNodes,
  getAvailablePresets,
  changeInstrument,
} from "./audioPlayback";
import { readMusicXmlFile } from "./musicXmlFile";
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
import { getGpEventIndexAtOriginalTick, getInterpolatedGpCursorTick } from "./gpCursor";
import { usePersistentState } from "../hooks/usePersistentState";
import AlphaTabViewer from "./AlphaTabViewer";
import type { AlphaTabViewerRef } from "./AlphaTabViewer";
import type { MenuProps } from "../Menu";
import type { PlaybackEvent, PlaybackNote } from "./types";

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

const DEFAULT_GP_SCORE_HEIGHT_PX = 128;
const MIN_GP_SCORE_HEIGHT_PX = 72;
const GP_SCORE_BOTTOM_PADDING_PX = 2;

type AvailablePreset = ReturnType<typeof getAvailablePresets>[number];
type MusicXMLProps = { setGlobalState?: (state: MenuProps | null) => void; };

const TestFileLoader: React.FC<MusicXMLProps> = ({ setGlobalState }) => {
  const { t } = useTranslation();
  
  // PERSISTENT STATES
  const [rawFileContent, setRawFileContent] = usePersistentState<string | Uint8Array | null>("harptrainer_raw_content", null);
  const [transpose, setTranspose] = usePersistentState<number>("harptrainer_transpose", 0);
  const [fileName, setFileName] = usePersistentState<string | null>("harptrainer_file_name", null);
  const [selectedKey, setSelectedKey] = usePersistentState<string>("harptrainer_harmonica_key", "C4");
  const [noOverblowOrDraw, setNoOverblowOrDraw] = usePersistentState<boolean>("harptrainer_no_overblow", true);
  const [noBend, setNoBend] = usePersistentState<boolean>("harptrainer_no_bend", false);
  const [showNoteNames, setShowNoteNames] = usePersistentState<boolean>("harptrainer_show_note_names", true);
  const [tempo, setTempo] = usePersistentState<number>("harptrainer_tempo", 90);
  const [selectedSf, setSelectedSf] = usePersistentState<string>("harptrainer_soundfont", "022_Florestan_Harmonica.sf2");
  const [selectedPreset, setSelectedPreset] = usePersistentState<string>("harptrainer_preset", "0:22"); // Default to Harmonica
  const harmonicaKey = normalizeHarmonicaKey(selectedKey);

  // VOLATILE STATES
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [routeStatus, setRouteStatus] = useState<RouteStatus | null>({ tone: "info", message: "Ready." });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [currentGameTimeMs, setCurrentGameTimeMs] = useState(0);
  const [isSheetReady, setIsSheetReady] = useState(false);
  const [hasSheetRenderError] = useState(false);
  const [isGpPlaybackReady, setIsGpPlaybackReady] = useState(false);
  const [availablePresets, setAvailablePresets] = useState<AvailablePreset[]>([]);
  const [playbackEvents, setPlaybackEvents] = useState<PlaybackEvent[]>([]);
  const [gpOriginalMidiNumbers, setGpOriginalMidiNumbers] = useState<number[]>([]);
  const [gpTracks, setGpTracks] = useState<{ index: number; name: string }[]>([]);
  const [selectedGpTrackIndex, setSelectedGpTrackIndex] = useState<number>(0);
  const [gpScoreHeightPx, setGpScoreHeightPx] = useState(DEFAULT_GP_SCORE_HEIGHT_PX);

  const isGpFile = useMemo(() => fileName ? /\.(gp|gp3|gp4|gp5|gpx)$/i.test(fileName) : false, [fileName]);
  const gpScorePaneHeightPx = Math.max(
    MIN_GP_SCORE_HEIGHT_PX,
    Math.ceil(gpScoreHeightPx) + GP_SCORE_BOTTOM_PADDING_PX
  );

  const osmdRef = useRef<HTMLDivElement>(null);
  const alphaTabRef = useRef<AlphaTabViewerRef>(null);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const osmdInstance = useRef<OpenSheetMusicDisplay | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackTimerRef = useRef<number | null>(null);
  const playbackRunRef = useRef(0);
  const activeAudioNodesRef = useRef(new Set<AudioScheduledSourceNode>());
  const cursorEventIndexRef = useRef<number | null>(null);
  const gameClockFrameRef = useRef<number | null>(null);
  const gameClockStartMsRef = useRef( performance.now());
  const gameClockOffsetMsRef = useRef(0);
  const gpCursorFrameRef = useRef<number | null>(null);
  const sheetRenderRunRef = useRef(0);
  const isPlayingRef = useRef(false);
  const shouldAutoTransposeGpRef = useRef(false);

  const displayFileContent = useMemo(() => (fileContent ? createFirstStaffDisplayXml(fileContent) : null), [fileContent]);
  
  // Update playbackEvents when file content or other params change (for OSMD)
  useEffect(() => {
    if (isGpFile || !displayFileContent) return;
    const playback = parsePlaybackEvents(displayFileContent);
    setPlaybackEvents(playback.events);
    if (playback.detectedTempo) {
        setTempo(playback.detectedTempo);
    }
  }, [displayFileContent, isGpFile, setTempo]);

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

  const stopGpCursorAnimation = useCallback(() => {
    if (gpCursorFrameRef.current !== null) {
      window.cancelAnimationFrame(gpCursorFrameRef.current);
      gpCursorFrameRef.current = null;
    }
  }, []);

  const clearPlaybackResources = useCallback(() => {
    if (playbackTimerRef.current !== null) window.clearTimeout(playbackTimerRef.current);
    if (gameClockFrameRef.current !== null) window.cancelAnimationFrame(gameClockFrameRef.current);
    stopGpCursorAnimation();
    stopAudioNodes(activeAudioNodesRef.current);
  }, [stopGpCursorAnimation]);

  const stopPlayback = useCallback((reset = false, shouldResetScoring = true) => {
    playbackRunRef.current += 1;
    clearPlaybackResources();
    if (isGpFile) {
        alphaTabRef.current?.stop();
    }
    setIsPlaying(false);
    if (reset) {
      setCurrentEventIndex(0);
      setCurrentGameTimeMs(0);
      if (shouldResetScoring) {
        resetScoring();
      }
      cursorEventIndexRef.current = null;
      osmdInstance.current?.cursor?.reset();
      osmdInstance.current?.cursor?.hide();
      alphaTabRef.current?.setTickPosition(0);
      if (sheetScrollRef.current) sheetScrollRef.current.scrollLeft = 0;
    }
  }, [clearPlaybackResources, resetScoring, isGpFile]);

  const playNotes = useCallback((notes: PlaybackNote[], tempoBpm: number) => {
    const audioContext = ensureAudioContext(audioContextRef.current);
    audioContextRef.current = audioContext;
    playPlaybackNotes(audioContext, activeAudioNodesRef.current, notes, tempoBpm);
  }, []);

  const scrollSheetToCursor = useCallback(() => {
    const sheet = sheetScrollRef.current;
    const cursorElement = osmdInstance.current?.cursor?.cursorElement;
    if (!sheet || !cursorElement) return;
    window.requestAnimationFrame(() => {
      const sheetRect = sheet.getBoundingClientRect();
      const cursorRect = cursorElement.getBoundingClientRect();
      const targetLeft = sheet.clientWidth * 0.4;
      const offset = cursorRect.left - sheetRect.left - targetLeft;
      sheet.scrollTo({ left: Math.max(0, sheet.scrollLeft + offset), behavior: "smooth" });
    });
  }, []);

  const moveCursorInstantlyToEvent = useCallback((eventIndex: number) => {
    const cursor = osmdInstance.current?.cursor;
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
  }, [scrollSheetToCursor]);

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
        const cursor = osmdInstance.current?.cursor;
        if (cursor) {
            styleSheetCursor(cursor.cursorElement, durationMs);
            cursor.next();
        }
        cursorEventIndexRef.current = nextEvent.sourceEventIndex;
        scrollSheetToCursor();
    }
  }, [playbackEvents, moveCursorInstantlyToEvent, scrollSheetToCursor, animateGpCursorThroughEvent]);

  const schedulePlayback = useCallback((startIndex: number, runId: number) => {
    const event = playbackEvents[startIndex];
    if (!event) { 
      const msPerPx = shortestNoteDurationMs / 40;
      const trailMs = (520 * msPerPx) * 0.5;
      setTimeout(() => stopPlayback(true, false), trailMs / tempoScaleRef.current); 
      return; 
    }
    const effTempo = Math.max(20, event.tempoBpm * tempoScaleRef.current);
    const durMs = Math.max(80, (60000 / effTempo) * event.durationBeats);
    gameClockOffsetMsRef.current = (playbackTimeline[startIndex]?.startMs ?? 0) - getAudioOutputLatencyMs(audioContextRef.current) * tempoScaleRef.current;
    gameClockStartMsRef.current = performance.now();
    setCurrentEventIndex(startIndex);
    moveCursorThroughEvent(startIndex, durMs);
    playNotes(event.notes, effTempo);
    playbackTimerRef.current = window.setTimeout(() => {
      if (playbackRunRef.current !== runId) return;
      schedulePlayback(startIndex + 1, runId);
    }, durMs);
  }, [playbackEvents, playbackTimeline, moveCursorThroughEvent, playNotes, stopPlayback, shortestNoteDurationMs]);

  const togglePlayback = useCallback(async () => {
    const playbackReady = canPlayback && (isGpFile ? isGpPlaybackReady : true);
    
    console.log("Toggle playback triggered", { 
        isPlaying: isPlayingRef.current, 
        canPlayback: playbackReady, 
        isGpFile,
        isSheetReady,
        eventsCount: playbackEvents.length,
        alphaTabRef: !!alphaTabRef.current,
        isGpPlaybackReady
    });

    if (isPlayingRef.current) {
      stopPlayback();
      return;
    }

    if (!playbackReady) {
        console.warn("Playback not ready", { 
            isSheetReady, 
            hasEvents: playbackEvents.length > 0,
            hasAlphaTab: !!alphaTabRef.current,
            isGpPlaybackReady
        });
        return;
    }

    try {
      setRouteStatus({ tone: "info", message: "Initializing audio engine..." });
      const audioContext = ensureAudioContext(audioContextRef.current);
      audioContextRef.current = audioContext;
      await audioContext.resume();

      // Initialize SoundFont Synth
      await initSynthesizer(audioContext, selectedSf);
      
      const presets = getAvailablePresets();
      setAvailablePresets(presets);
      
      // Sync instrument
      const [bank, program] = selectedPreset.split(":").map(Number);
      changeInstrument(program, bank);

      setRouteStatus({ tone: "success", message: fileName ? `Ready: ${fileName}.` : "Score ready." });

      const startIndex =
        currentEventIndex >= playbackEvents.length ? 0 : currentEventIndex;
      if (startIndex === 0) {
        resetScoring();
      }
      
      // Calculate PRECISE resume point
      const currentPosMs = currentGameTimeMs;
      gameClockOffsetMsRef.current = currentPosMs;
      gameClockStartMsRef.current = performance.now();
      
      const runId = playbackRunRef.current + 1;
      playbackRunRef.current = runId;
      setIsPlaying(true);
      schedulePlayback(startIndex, runId);
    } catch (err) {
      console.error("Playback error:", err);
      setRouteStatus({ tone: "error", message: "Failed to initialize high-quality sound." });
    }
  }, [
    currentEventIndex,
    currentGameTimeMs,
    canPlayback,
    playbackEvents.length,
    playbackTimeline,
    resetScoring,
    schedulePlayback,
    stopPlayback,
    fileName,
    selectedSf,
    selectedPreset,
    isGpFile,
    isGpPlaybackReady
  ]);

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
    if (setGlobalState) {
      setGlobalState({
        isPlaying,
        isPaused: !isPlaying && currentGameTimeMs > 0,
        onTogglePlayback: togglePlayback,
        onRestartPlayback: () => stopPlayback(true),
        tempo,
        setTempo,
        progress,
        gameStats,
        accuracy,
        canPlayback,
      });
    }
    return () => setGlobalState?.(null);
  }, [setGlobalState, isPlaying, currentGameTimeMs, tempo, progress, gameStats, accuracy, canPlayback, togglePlayback, stopPlayback]);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    const updateClock = () => {
      setCurrentGameTimeMs(gameClockOffsetMsRef.current + (performance.now() - gameClockStartMsRef.current) * tempoScaleRef.current);
      gameClockFrameRef.current = window.requestAnimationFrame(updateClock);
    };
    gameClockFrameRef.current = window.requestAnimationFrame(updateClock);
    return () => { if (gameClockFrameRef.current !== null) window.cancelAnimationFrame(gameClockFrameRef.current); };
  }, [isPlaying]);

  useEffect(() => {
    if (!rawFileContent) {
      fetch(`${import.meta.env.BASE_URL}IntroSong.musicxml`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load IntroSong.musicxml");
          return res.text();
        })
        .then((text) => {
          setFileName("IntroSong.musicxml");
          setRawFileContent(text);
        })
        .catch((err) => {
          console.error("Intro song load error:", err);
          setRouteStatus({
            tone: "error",
            message: "Failed to load default song. Try loading a file manually.",
          });
        });
    }
  }, []);

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

  useEffect(() => {
    if (isGpFile || !displayFileContent || !osmdRef.current) return;
    const renderRun = sheetRenderRunRef.current + 1;
    sheetRenderRunRef.current = renderRun;
    if (!osmdInstance.current) {
      osmdInstance.current = new OpenSheetMusicDisplay(osmdRef.current, {
        backend: "svg", drawTitle: true, drawComposer: true, drawFingerings: true,
        fingeringPosition: "below", autoResize: false, followCursor: true, renderSingleHorizontalStaffline: true,
        cursorsOptions: [{ type: CursorType.ThinLeft, color: "#10b981", alpha: 0.85, follow: true }],
      });
    }
    osmdInstance.current.load(displayFileContent).then(() => {
      if (sheetRenderRunRef.current !== renderRun) return;
      osmdInstance.current?.render();
      setIsSheetReady(true);
    });
  }, [displayFileContent, isGpFile]);

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

  const findBestGpTranspose = (originalMidiNumbers: number[]) => {
    if (originalMidiNumbers.length === 0) return null;

    const intervals = findBestTransposeIntervals(originalMidiNumbers, {
      selectedKey: harmonicaKey,
      noOverblowOrDraw,
      noBend,
    });

    return intervals[0] ?? null;
  };

  const handleTransposeChange = (value: string) => {
    const semitones = Number.parseInt(value, 10);
    setTranspose(Number.isFinite(semitones) ? semitones : 0);
  };

  return (
    <div className="h-full w-full flex flex-col bg-gray-950 text-white overflow-hidden max-w-full">
      {/* SECTION 1: Score Window */}
      <div className="w-full shrink-0 border-b border-gray-800 bg-white shadow-2xl overflow-hidden max-w-full">
        <div
          ref={sheetScrollRef}
          className={`${isGpFile ? "" : "h-48 min-h-[180px]"} w-full overflow-x-auto overflow-y-hidden bg-white text-black`}
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
              onScoreLoaded={(events, _score, tracks, scoreTempo) => {
                  console.log(`MusicXML: Score loaded. Extracted tempo: ${scoreTempo}`);
                  const originalMidiNumbers = Array.from(getPlayableMidiNumbers(events)).map(m => m - transpose);
                  setGpOriginalMidiNumbers(originalMidiNumbers);

                  if (shouldAutoTransposeGpRef.current) {
                      shouldAutoTransposeGpRef.current = false;
                      const bestTranspose = findBestGpTranspose(originalMidiNumbers);
                      if (bestTranspose !== null && bestTranspose !== transpose) {
                          console.log(`MusicXML: Auto-transposing GP score by ${bestTranspose} semitones.`);
                          setTranspose(bestTranspose);
                          setRouteStatus({ tone: "info", message: `Auto transposed Guitar Pro score by ${bestTranspose} semitones.` });
                          return;
                      }
                  }

                  setPlaybackEvents(events);
                  setGpTracks(tracks || []);
                  if (scoreTempo) {
                      setTempo(scoreTempo);
                  }
                  setCurrentEventIndex(0);
                  setCurrentGameTimeMs(0);
                  cursorEventIndexRef.current = null;
                  setIsSheetReady(true);
                  setRouteStatus({ tone: "success", message: "Guitar Pro score loaded." });
              }}
              onReadyChange={setIsGpPlaybackReady}
              onTimeUpdate={(tickOrMs) => {
                  if (isPlayingRef.current) return;
                  
                  if (isGpFile) {
                      const actualIdx = getGpEventIndexAtOriginalTick(playbackEvents, tickOrMs);
                      const timing = playbackTimeline[actualIdx];
                      if (timing) {
                          setCurrentGameTimeMs(timing.startMs);
                          setCurrentEventIndex(actualIdx);
                      }
                  } else {
                      setCurrentGameTimeMs(tickOrMs);
                      const index = playbackTimeline.findIndex(t => tickOrMs >= t.startMs && tickOrMs <= t.endMs);
                      if (index !== -1) setCurrentEventIndex(index);
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
          <div className="flex flex-col lg:flex-row gap-6 h-full items-start w-full">
            <div className="w-full lg:w-80 shrink-0 bg-gray-900 rounded-lg shadow-xl p-5 space-y-4 border border-gray-700 overflow-y-auto max-h-full">
              {routeStatus && <div className={`rounded border px-3 py-2 text-sm ${routeStatusClassNames[routeStatus.tone]}`}>{routeStatus.message}</div>}
              <div>
                <label className="block mb-1 text-gray-300 font-medium text-sm">Harmonica Key:</label>
                <select value={harmonicaKey} onChange={(e) => setSelectedKey(e.target.value)} className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 w-full text-white text-sm">
                  {harmonicaKeys.map((k) => <option key={k.value} value={k.value}>{t(k.label)}</option>)}
                </select>
              </div>

              <div>
                  <label className="block mb-1 text-gray-300 font-medium text-sm">SoundFont:</label>
                  <select 
                      value={selectedSf} 
                      onChange={(e) => {
                          setSelectedSf(e.target.value);
                          stopPlayback(); // Changing SF requires re-init
                      }} 
                      className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 w-full text-white text-sm"
                  >
                  {SOUNDFONTS.map((sf) => <option key={sf.value} value={sf.value}>{sf.label}</option>)}
                  </select>
              </div>

              {availablePresets.length > 0 && (
                  <div>
                      <label className="block mb-1 text-gray-300 font-medium text-sm">Instrument:</label>
                      <select 
                          value={selectedPreset} 
                          onChange={(e) => setSelectedPreset(e.target.value)} 
                          className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 w-full text-white text-sm"
                      >
                      {availablePresets.map((p, idx) => (
                          <option key={`${p.bank}:${p.program}:${idx}`} value={`${p.bank}:${p.program}`}>
                              {p.name} ({p.bank}:{p.program})
                          </option>
                      ))}
                      </select>
                  </div>
              )}

              <div>
                  <label className="block mb-1 text-gray-300 font-medium text-sm">Transpose:</label>
                  <input
                    type="number"
                    value={transpose}
                    onChange={(e) => handleTransposeChange(e.target.value)}
                    className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 w-full text-white text-sm"
                  />
              </div>

              <div className="pt-2">
                <label className="inline-block cursor-pointer text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition w-full text-sm font-bold">
                  📂 Load XML/GP
                  <input
                    type="file"
                    accept=".xml,.musicxml,.mxl,.gp,.gp3,.gp4,.gp5,.gpx"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        stopPlayback(true); // EXPLICIT RESET FOR NEW FILE
                        const content = await readMusicXmlFile(file);
                        const nextIsGpFile = /\.(gp|gp3|gp4|gp5|gpx)$/i.test(file.name);
                        shouldAutoTransposeGpRef.current = nextIsGpFile;
                        setGpOriginalMidiNumbers([]);
                        setPlaybackEvents([]);
                        setGpTracks([]);
                        setSelectedGpTrackIndex(0);
                        setGpScoreHeightPx(DEFAULT_GP_SCORE_HEIGHT_PX);
                        setIsSheetReady(false);
                        setIsGpPlaybackReady(false);
                        setFileName(file.name);
                        setTranspose(0); // Reset transpose for new file
                        setRawFileContent(content);
                      } catch (err) {
                        console.error(err);
                      } finally {
                        e.target.value = "";
                      }
                    }}
                    className="hidden"
                  />
                </label>
                {fileName && <p className="mt-1 text-[10px] text-gray-500 truncate text-center">Loaded: {fileName}</p>}
              </div>

              {!isGpFile && (
                <div className="pt-2 space-y-2">
                    <button
                    onClick={downloadTransposedXml}
                    disabled={!canUseProcessedScore}
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded transition w-full text-xs font-bold uppercase"
                    >
                    💾 Transposed XML
                    </button>
                    <button
                    onClick={downloadHarpTabs}
                    disabled={!canUseProcessedScore}
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded transition w-full text-xs font-bold uppercase"
                    >
                    📝 HarpTabs text
                    </button>
                </div>
              )}

              {(isGpFile || !isGpFile) && (
                <div className="rounded border border-gray-700 bg-gray-950 p-3 space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase">Auto transpose</p>
                    <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" checked={noOverblowOrDraw} onChange={(e) => setNoOverblowOrDraw(e.target.checked)} />No Overblow/Draw</label>
                    <label className="flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" checked={noBend} onChange={(e) => setNoBend(e.target.checked)} />No Bends</label>
                    {!isGpFile && <label className="flex items-center gap-2 text-xs text-emerald-400 font-bold"><input type="checkbox" checked={showNoteNames} onChange={(e) => setShowNoteNames(e.target.checked)} />Show Note Names</label>}
                    </div>
                    <button 
                        onClick={autoTransposeWithFilters} 
                        className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded transition w-full text-xs font-bold uppercase"
                    >
                        🎯 Optimize {optimalVariantsCount > 0 ? `(${optimalVariantsCount} variants)` : ''}
                    </button>
                </div>
              )}
              {isGpFile && (
                  <div className="rounded border border-gray-700 bg-gray-950 p-3 space-y-3">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-2">GP Features</p>
                      
                      {gpTracks.length > 0 && (
                          <div>
                            <label className="block mb-1 text-gray-300 font-medium text-sm">Select Track:</label>
                            <select 
                                value={selectedGpTrackIndex} 
                                onChange={(e) => {
                                    shouldAutoTransposeGpRef.current = true;
                                    setSelectedGpTrackIndex(Number(e.target.value));
                                    stopPlayback(true);
                                }} 
                                className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 w-full text-white text-sm"
                            >
                                {gpTracks.map((t) => (
                                    <option key={t.index} value={t.index}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                          </div>
                      )}

                      <label className="flex items-center gap-2 text-xs text-emerald-400 font-bold"><input type="checkbox" checked={showNoteNames} onChange={(e) => setShowNoteNames(e.target.checked)} />Show Note Names</label>
                  </div>
              )}
            </div>
            <div className="flex-1 w-full h-full overflow-hidden flex flex-col min-w-0">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestFileLoader;

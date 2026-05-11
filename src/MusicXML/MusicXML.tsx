import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CursorType, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { freqToNoteAndCents, harmonicaKeys } from "../utils/utils";
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
  findAutoTransposeInterval,
} from "./musicXmlTransform";
import { NoteHighway } from "./NoteHighway";
import { parsePlaybackEvents } from "./playbackParser";
import {
  createPlaybackTimeline,
  getPlayableMidiNumbers,
  getTargetEventIndex,
  getVisibleGameEvents,
  getLaneKeys,
} from "./playbackTimeline";
import { styleSheetCursor } from "./sheetCursor";
import { useNoteHighwayScoring } from "./useNoteHighwayScoring";
import { usePersistentState } from "../hooks/usePersistentState";

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

type MusicXMLProps = { setGlobalState?: (state: any) => void; };

const TestFileLoader: React.FC<MusicXMLProps> = ({ setGlobalState }) => {
  const { t } = useTranslation();
  
  // PERSISTENT STATES
  const [rawFileContent, setRawFileContent] = usePersistentState<string | null>("harptrainer_raw_content", null);
  const [transpose, setTranspose] = usePersistentState<number>("harptrainer_transpose", 0);
  const [fileName, setFileName] = usePersistentState<string | null>("harptrainer_file_name", null);
  const [selectedKey, setSelectedKey] = usePersistentState<string>("harptrainer_harmonica_key", "C4");
  const [noOverblowOrDraw, setNoOverblowOrDraw] = usePersistentState<boolean>("harptrainer_no_overblow", true);
  const [noBend, setNoBend] = usePersistentState<boolean>("harptrainer_no_bend", false);
  const [showNoteNames, setShowNoteNames] = usePersistentState<boolean>("harptrainer_show_note_names", true);
  const [tempo, setTempo] = usePersistentState<number>("harptrainer_tempo", 90);
  const [selectedSf, setSelectedSf] = usePersistentState<string>("harptrainer_soundfont", "022_Florestan_Harmonica.sf2");
  const [selectedPreset, setSelectedPreset] = usePersistentState<string>("harptrainer_preset", "0:22"); // Default to Harmonica

  // VOLATILE STATES
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [routeStatus, setRouteStatus] = useState<RouteStatus | null>({ tone: "info", message: "Ready." });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [currentGameTimeMs, setCurrentGameTimeMs] = useState(0);
  const [isSheetReady, setIsSheetReady] = useState(false);
  const [hasSheetRenderError, setHasSheetRenderError] = useState(false);
  const [availablePresets, setAvailablePresets] = useState<any[]>([]);

  const osmdRef = useRef<HTMLDivElement>(null);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const osmdInstance = useRef<OpenSheetMusicDisplay | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackTimerRef = useRef<number | null>(null);
  const playbackRunRef = useRef(0);
  const activeAudioNodesRef = useRef(new Set<AudioScheduledSourceNode>());
  const cursorEventIndexRef = useRef<number | null>(null);
  const gameClockFrameRef = useRef<number | null>(null);
  const gameClockStartMsRef = useRef(0);
  const gameClockOffsetMsRef = useRef(0);
  const sheetRenderRunRef = useRef(0);
  const isPlayingRef = useRef(false);

  const displayFileContent = useMemo(() => (fileContent ? createFirstStaffDisplayXml(fileContent) : null), [fileContent]);
  const playback = useMemo(() => (displayFileContent ? parsePlaybackEvents(displayFileContent) : null), [displayFileContent]);
  const playbackEvents = useMemo(() => playback?.events ?? [], [playback]);
  const playableMidiNumbers = useMemo(() => getPlayableMidiNumbers(playbackEvents), [playbackEvents]);
  
  const tempoScale = tempo / (playback?.detectedTempo || tempo || 90);
  const tempoScaleRef = useRef(tempoScale);
  useEffect(() => { tempoScaleRef.current = tempoScale; }, [tempoScale]);

  // Compute the timeline at a fixed 1x tempo to create a static 'punch card' geometry
  const playbackTimeline = useMemo(() => createPlaybackTimeline(playbackEvents, 1), [playbackEvents]);
  const playbackEndMs = playbackTimeline[playbackTimeline.length - 1]?.endMs ?? 0;
  
  // Find the shortest note duration to scale the highway grid
  const shortestNoteDurationMs = useMemo(() => {
    if (playbackTimeline.length === 0) return 250; // Default
    let minDuration = Number.POSITIVE_INFINITY;
    playbackTimeline.forEach(timing => {
        if (timing.durationMs > 0 && timing.durationMs < minDuration) {
            minDuration = timing.durationMs;
        }
    });
    return minDuration === Number.POSITIVE_INFINITY ? 250 : minDuration;
  }, [playbackTimeline]);

  const laneKeys = useMemo(() => getLaneKeys(playbackEvents), [playbackEvents]);
  
  const visualPlayheadMs = isPlaying ? currentGameTimeMs : currentEventIndex >= playbackEvents.length ? playbackEndMs : playbackTimeline[currentEventIndex]?.startMs ?? 0;
  const progress = playbackEvents.length > 0 ? Math.min(100, Math.round((currentEventIndex / playbackEvents.length) * 100)) : 0;
  const visibleGameEvents = useMemo(() => getVisibleGameEvents(playbackEvents, playbackTimeline, visualPlayheadMs), [playbackEvents, playbackTimeline, visualPlayheadMs]);
  const targetEventIndex = useMemo(() => getTargetEventIndex(visibleGameEvents, visualPlayheadMs), [visibleGameEvents, visualPlayheadMs]);
  const currentGameEvent = playbackEvents[targetEventIndex ?? currentEventIndex];
  
  const { pitch, clarity, error: pitchError } = usePitchDetector(0.82, isPlaying && playbackEvents.length > 0, { allowedMidiNumbers: playableMidiNumbers, minRms: 0.012, stableFrames: 2 });
  const detectedNote = useMemo(() => pitch ? freqToNoteAndCents(Number(pitch)) : null, [pitch]);
  const { accuracy, gameStats, lastHitIndex, resetScoring } = useNoteHighwayScoring({ currentEventIndex, currentGameEvent, detectedNote, playbackEvents, targetEventIndex });
  const canUseProcessedScore = Boolean(fileContent) && isSheetReady && !hasSheetRenderError;
  const canPlayback = canUseProcessedScore && playbackEvents.length > 0;

  const clearPlaybackResources = useCallback(() => {
    if (playbackTimerRef.current !== null) window.clearTimeout(playbackTimerRef.current);
    if (gameClockFrameRef.current !== null) window.cancelAnimationFrame(gameClockFrameRef.current);
    stopAudioNodes(activeAudioNodesRef.current);
  }, []);

  const stopPlayback = useCallback((reset = false, shouldResetScoring = true) => {
    playbackRunRef.current += 1;
    clearPlaybackResources();
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
      if (sheetScrollRef.current) sheetScrollRef.current.scrollLeft = 0;
    }
  }, [clearPlaybackResources, resetScoring]);

  const playNotes = useCallback((notes: any[], tempoBpm: number) => {
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

  const moveCursorThroughEvent = useCallback((eventIndex: number, durationMs: number) => {
    const event = playbackEvents[eventIndex];
    if (!event) return;
    moveCursorInstantlyToEvent(event.sourceEventIndex);
    const nextEvent = playbackEvents[eventIndex + 1];
    if (nextEvent && nextEvent.sourceEventIndex > event.sourceEventIndex) {
        styleSheetCursor(osmdInstance.current!.cursor!.cursorElement, durationMs);
        osmdInstance.current!.cursor!.next();
        cursorEventIndexRef.current = nextEvent.sourceEventIndex;
        scrollSheetToCursor();
    }
  }, [playbackEvents, moveCursorInstantlyToEvent, scrollSheetToCursor]);

  const schedulePlayback = useCallback((startIndex: number, runId: number) => {
    const event = playbackEvents[startIndex];
    if (!event) { 
      // End of melody reached: Reset position but KEEP scoring visible
      setTimeout(() => stopPlayback(true, false), 500); 
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
  }, [playbackEvents, playbackTimeline, moveCursorThroughEvent, playNotes, stopPlayback]);

  const togglePlayback = useCallback(async () => {
    if (isPlayingRef.current) {
      stopPlayback();
      return;
    }

    if (!canPlayback) return;

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
      gameClockOffsetMsRef.current =
        (playbackTimeline[startIndex]?.startMs ?? 0) -
        getAudioOutputLatencyMs(audioContextRef.current) * tempoScaleRef.current;
      gameClockStartMsRef.current = performance.now();
      setCurrentGameTimeMs(gameClockOffsetMsRef.current);
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
    canPlayback,
    playbackEvents.length,
    playbackTimeline,
    resetScoring,
    schedulePlayback,
    stopPlayback,
    fileName,
    selectedSf,
    selectedPreset,
  ]);

  // Handle live instrument change
  useEffect(() => {
      if (availablePresets.length > 0) {
          const [bank, program] = selectedPreset.split(":").map(Number);
          changeInstrument(program, bank);
      }
  }, [selectedPreset, availablePresets]);

  // SYNC STATE TO GLOBAL MENU
  useEffect(() => {
    if (setGlobalState) {
      setGlobalState({
        isPlaying,
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
  }, [setGlobalState, isPlaying, tempo, progress, gameStats, accuracy, canPlayback, togglePlayback, stopPlayback]);

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
    if (!rawFileContent) return;
    try {
      const injected = injectHarmonicaTabs(rawFileContent, { selectedKey, transpose });
      setFileContent(injected);
    } catch (e) {
      console.error(e);
    }
  }, [rawFileContent, selectedKey, transpose]);

  useEffect(() => {
    if (!playback) return;
    stopPlayback(true);
  }, [playback, stopPlayback]);

  useEffect(() => () => stopPlayback(true), [stopPlayback]);

  useEffect(() => {
    if (!displayFileContent || !osmdRef.current) return;
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
  }, [displayFileContent]);

  const autoTransposeWithFilters = () => {
    if (!rawFileContent) return;
    const interval = findAutoTransposeInterval(rawFileContent, { selectedKey, noOverblowOrDraw, noBend });
    if (interval !== null) setTranspose(interval);
  };

  return (
    <div className="h-full w-full flex flex-col bg-gray-950 text-white overflow-hidden max-w-full">
      {/* SECTION 1: Score Window */}
      <div className="w-full shrink-0 border-b border-gray-800 bg-white shadow-2xl overflow-hidden max-w-full">
        <div ref={sheetScrollRef} className="h-48 min-h-[180px] w-full overflow-x-auto overflow-y-hidden bg-white text-black">
          <div ref={osmdRef} className="h-full flex items-center min-w-max" />
        </div>
      </div>
      <div className="flex-1 w-full overflow-hidden bg-gray-950">
        <div className="h-full max-w-screen-2xl mx-auto p-4 sm:p-6 overflow-hidden flex flex-col">
          <div className="flex flex-col lg:flex-row gap-6 h-full items-start w-full">
            <div className="w-full lg:w-80 shrink-0 bg-gray-900 rounded-lg shadow-xl p-5 space-y-4 border border-gray-700 overflow-y-auto max-h-full">
              {routeStatus && <div className={`rounded border px-3 py-2 text-sm ${routeStatusClassNames[routeStatus.tone]}`}>{routeStatus.message}</div>}
              <div>
                <label className="block mb-1 text-gray-300 font-medium text-sm">Harmonica Key:</label>
                <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 w-full text-white text-sm">
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
                    {availablePresets.map((p) => (
                        <option key={`${p.bank}:${p.program}`} value={`${p.bank}:${p.program}`}>
                            {p.name} ({p.bank}:{p.program})
                        </option>
                    ))}
                    </select>
                </div>
              )}

              <div>
                <label className="block mb-1 text-gray-300 font-medium text-sm">Transpose:</label>
                <input type="number" value={transpose} onChange={(e) => setTranspose(parseInt(e.target.value, 10) || 0)} className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 w-full text-white text-sm" />
              </div>
              <div className="pt-2">
                <label className="inline-block cursor-pointer text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition w-full text-sm font-bold">
                  📂 Load XML
                  <input
                    type="file"
                    accept=".xml,.musicxml,.mxl"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const content = await readMusicXmlFile(file);
                        setFileName(file.name);
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
              <div className="rounded border border-gray-700 bg-gray-950 p-3 space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase">Auto transpose</p>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" checked={noOverblowOrDraw} onChange={(e) => setNoOverblowOrDraw(e.target.checked)} />No Overblow/Draw</label>
                  <label className="flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" checked={noBend} onChange={(e) => setNoBend(e.target.checked)} />No Bends</label>
                  <label className="flex items-center gap-2 text-xs text-emerald-400 font-bold"><input type="checkbox" checked={showNoteNames} onChange={(e) => setShowNoteNames(e.target.checked)} />Show Note Names</label>
                </div>
                <button onClick={autoTransposeWithFilters} className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded transition w-full text-xs font-bold uppercase">🎯 Optimize</button>
              </div>
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
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestFileLoader;

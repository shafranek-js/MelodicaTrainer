import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CursorType, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { freqToNoteAndCents, harmonicaKeys } from "../utils/utils";
import { Note } from "tonal";
import { useTranslation } from "react-i18next";
import { Gauge, Pause, Play, RotateCcw } from "lucide-react";
import { usePitchDetector } from "../hooks/usePitchDetector";
import { ensureAudioContext, playPlaybackNotes, stopAudioNodes } from "./audioPlayback";
import { readMusicXmlFile } from "./musicXmlFile";
import {
  findAutoTransposeInterval,
  injectHarmonicaTabs,
} from "./musicXmlTransform";
import { NoteHighway } from "./NoteHighway";
import { parsePlaybackEvents } from "./playbackParser";
import {
  createPlaybackTimeline,
  getLaneKeys,
  getPlayableMidiNumbers,
  getTargetEventIndex,
  getVisibleGameEvents,
} from "./playbackTimeline";
import { styleSheetCursor } from "./sheetCursor";
import type { GameStats, PlaybackNote } from "./types";

const TestFileLoader: React.FC = () => {
  const { t } = useTranslation();
  const [rawFileContent, setRawFileContent] = useState<string | null>(null);
  const [transpose, setTranspose] = useState<number>(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>("C4");
  const [noOverblowOrDraw, setNoOverblowOrDraw] = useState(true);
  const [noBend, setNoBend] = useState(false);
  const [tempo, setTempo] = useState(90);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [currentTab, setCurrentTab] = useState("");
  const [currentGameTimeMs, setCurrentGameTimeMs] = useState(0);
  const [gameStats, setGameStats] = useState<GameStats>({
    hits: 0,
    misses: 0,
    streak: 0,
  });
  const [lastHitIndex, setLastHitIndex] = useState<number | null>(null);

  const osmdRef = useRef<HTMLDivElement>(null);
  const osmdInstance = useRef<OpenSheetMusicDisplay | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackTimerRef = useRef<number | null>(null);
  const playbackRunRef = useRef(0);
  const activeAudioNodesRef = useRef<AudioScheduledSourceNode[]>([]);
  const cursorEventIndexRef = useRef<number | null>(null);
  const scoredEventIndexRef = useRef<number | null>(null);
  const previousEventIndexRef = useRef(0);
  const gameClockFrameRef = useRef<number | null>(null);
  const gameClockStartMsRef = useRef(0);
  const gameClockOffsetMsRef = useRef(0);

  const playback = useMemo(
    () => (fileContent ? parsePlaybackEvents(fileContent) : null),
    [fileContent]
  );
  const playbackEvents = useMemo(() => playback?.events ?? [], [playback]);
  const playableMidiNumbers = useMemo(
    () => getPlayableMidiNumbers(playbackEvents),
    [playbackEvents]
  );
  const tempoScale = tempo / (playback?.detectedTempo || tempo || 90);
  const playbackTimeline = useMemo(
    () => createPlaybackTimeline(playbackEvents, tempoScale),
    [playbackEvents, tempoScale]
  );
  const laneKeys = useMemo(() => getLaneKeys(playbackEvents), [playbackEvents]);
  const visualPlayheadMs =
    isPlaying
      ? currentGameTimeMs
      : playbackTimeline[currentEventIndex]?.startMs ?? 0;
  const progress =
    playbackEvents.length > 0
      ? Math.round((currentEventIndex / playbackEvents.length) * 100)
      : 0;
  const visibleGameEvents = useMemo(
    () =>
      getVisibleGameEvents(playbackEvents, playbackTimeline, visualPlayheadMs),
    [playbackEvents, playbackTimeline, visualPlayheadMs]
  );
  const targetEventIndex = useMemo(
    () => getTargetEventIndex(visibleGameEvents, visualPlayheadMs),
    [visibleGameEvents, visualPlayheadMs]
  );
  const currentGameEvent = playbackEvents[targetEventIndex ?? currentEventIndex];
  const currentTargetMidiNumbers = useMemo(
    () =>
      new Set(
        (currentGameEvent?.notes ?? [])
          .map((note) => Note.midi(note.name))
          .filter((midi): midi is number => midi !== null)
      ),
    [currentGameEvent]
  );
  const { pitch, clarity, error: pitchError } = usePitchDetector(
    0.82,
    isPlaying && playbackEvents.length > 0,
    {
      allowedMidiNumbers: playableMidiNumbers,
      minRms: 0.012,
      stableFrames: 2,
    }
  );
  const detectedNote = useMemo(() => {
    if (!pitch) return null;
    return freqToNoteAndCents(Number(pitch));
  }, [pitch]);
  const detectedMidi = detectedNote ? Note.midi(detectedNote.note) : null;
  const isCurrentHit =
    targetEventIndex !== null &&
    detectedMidi !== null &&
    currentTargetMidiNumbers.has(detectedMidi) &&
    Math.abs(detectedNote?.cents ?? 99) <= 35;
  const accuracy =
    gameStats.hits + gameStats.misses > 0
      ? Math.round((gameStats.hits / (gameStats.hits + gameStats.misses)) * 100)
      : 0;

  const stopPlayback = useCallback((reset = false) => {
    playbackRunRef.current += 1;

    if (playbackTimerRef.current !== null) {
      window.clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    if (gameClockFrameRef.current !== null) {
      window.cancelAnimationFrame(gameClockFrameRef.current);
      gameClockFrameRef.current = null;
    }

    stopAudioNodes(activeAudioNodesRef.current);
    activeAudioNodesRef.current = [];
    setIsPlaying(false);

    if (reset) {
      setCurrentEventIndex(0);
      setCurrentTab("");
      setCurrentGameTimeMs(0);
      setGameStats({ hits: 0, misses: 0, streak: 0 });
      setLastHitIndex(null);
      scoredEventIndexRef.current = null;
      previousEventIndexRef.current = 0;
      cursorEventIndexRef.current = null;
      osmdInstance.current?.cursor?.reset();
      osmdInstance.current?.cursor?.hide();
    }
  }, []);

  const playNotes = useCallback((notes: PlaybackNote[], tempoBpm: number) => {
    const audioContext = ensureAudioContext(audioContextRef.current);
    audioContextRef.current = audioContext;
    playPlaybackNotes(
      audioContext,
      activeAudioNodesRef.current,
      notes,
      tempoBpm
    );
  }, []);

  const moveCursorInstantlyToEvent = useCallback((eventIndex: number) => {
    const cursor = osmdInstance.current?.cursor;
    if (!cursor) return;

    cursor.cursorElement.style.transition = "none";

    if (
      cursorEventIndexRef.current === null ||
      eventIndex < cursorEventIndexRef.current
    ) {
      cursor.reset();
      cursorEventIndexRef.current = 0;
    }

    cursor.show();
    for (let index = cursorEventIndexRef.current; index < eventIndex; index += 1) {
      cursor.next();
    }
    cursorEventIndexRef.current = eventIndex;
    styleSheetCursor(cursor.cursorElement, 0);
    void cursor.cursorElement.offsetHeight;
  }, []);

  const animateCursorToEvent = useCallback(
    (eventIndex: number, durationMs: number) => {
      const cursor = osmdInstance.current?.cursor;
      if (!cursor || cursorEventIndexRef.current === null) return;
      if (eventIndex <= cursorEventIndexRef.current) return;

      styleSheetCursor(cursor.cursorElement, durationMs);
      void cursor.cursorElement.offsetHeight;

      for (
        let index = cursorEventIndexRef.current;
        index < eventIndex;
        index += 1
      ) {
        cursor.next();
      }
      cursorEventIndexRef.current = eventIndex;

      window.requestAnimationFrame(() => {
        styleSheetCursor(cursor.cursorElement, durationMs);
      });
    },
    []
  );

  const moveCursorThroughEvent = useCallback(
    (eventIndex: number, durationMs: number) => {
      moveCursorInstantlyToEvent(eventIndex);

      const nextEventIndex = eventIndex + 1;
      if (nextEventIndex < playbackEvents.length) {
        animateCursorToEvent(nextEventIndex, durationMs);
      }
    },
    [animateCursorToEvent, moveCursorInstantlyToEvent, playbackEvents.length]
  );

  const schedulePlayback = useCallback(
    (startIndex: number, runId: number) => {
      const event = playbackEvents[startIndex];
      if (!event) {
        stopPlayback(true);
        return;
      }

      const effectiveTempo = Math.max(20, event.tempoBpm * tempoScale);
      const durationMs = Math.max(
        80,
        (60000 / effectiveTempo) * event.durationBeats
      );
      const eventStartMs = playbackTimeline[startIndex]?.startMs ?? 0;

      gameClockOffsetMsRef.current = eventStartMs;
      gameClockStartMsRef.current = performance.now();
      setCurrentGameTimeMs(eventStartMs);
      setCurrentEventIndex(startIndex);
      setCurrentTab(event.tabs.join("  "));
      moveCursorThroughEvent(startIndex, durationMs);
      playNotes(event.notes, effectiveTempo);

      playbackTimerRef.current = window.setTimeout(() => {
        if (playbackRunRef.current !== runId) return;
        schedulePlayback(startIndex + 1, runId);
      }, durationMs);
    },
    [
      moveCursorThroughEvent,
      playNotes,
      playbackEvents,
      playbackTimeline,
      stopPlayback,
      tempoScale,
    ]
  );

  const togglePlayback = useCallback(async () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    if (!playbackEvents.length) return;

    audioContextRef.current = ensureAudioContext(audioContextRef.current);
    await audioContextRef.current.resume();

    const startIndex =
      currentEventIndex >= playbackEvents.length ? 0 : currentEventIndex;
    if (startIndex === 0) {
      setGameStats({ hits: 0, misses: 0, streak: 0 });
      setLastHitIndex(null);
      scoredEventIndexRef.current = null;
      previousEventIndexRef.current = 0;
    }
    gameClockOffsetMsRef.current = playbackTimeline[startIndex]?.startMs ?? 0;
    gameClockStartMsRef.current = performance.now();
    setCurrentGameTimeMs(gameClockOffsetMsRef.current);
    const runId = playbackRunRef.current + 1;
    playbackRunRef.current = runId;
    setIsPlaying(true);
    schedulePlayback(startIndex, runId);
  }, [
    currentEventIndex,
    isPlaying,
    playbackEvents.length,
    playbackTimeline,
    schedulePlayback,
    stopPlayback,
  ]);

  useEffect(() => {
    if (!isPlaying) return;

    const updateClock = () => {
      setCurrentGameTimeMs(
        gameClockOffsetMsRef.current +
          (performance.now() - gameClockStartMsRef.current)
      );
      gameClockFrameRef.current = window.requestAnimationFrame(updateClock);
    };

    gameClockFrameRef.current = window.requestAnimationFrame(updateClock);

    return () => {
      if (gameClockFrameRef.current !== null) {
        window.cancelAnimationFrame(gameClockFrameRef.current);
        gameClockFrameRef.current = null;
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    if (
      targetEventIndex === null ||
      !isCurrentHit ||
      scoredEventIndexRef.current === targetEventIndex
    ) {
      return;
    }

    scoredEventIndexRef.current = targetEventIndex;
    setLastHitIndex(targetEventIndex);
    setGameStats((stats) => ({
      ...stats,
      hits: stats.hits + 1,
      streak: stats.streak + 1,
    }));
  }, [isCurrentHit, targetEventIndex]);

  useEffect(() => {
    const previousIndex = previousEventIndexRef.current;
    if (currentEventIndex <= previousIndex) {
      previousEventIndexRef.current = currentEventIndex;
      return;
    }

    const previousEvent = playbackEvents[previousIndex];
    const shouldScoreMiss =
      previousEvent?.notes.length &&
      scoredEventIndexRef.current !== previousIndex;

    if (shouldScoreMiss) {
      setGameStats((stats) => ({
        ...stats,
        misses: stats.misses + 1,
        streak: 0,
      }));
    }

    previousEventIndexRef.current = currentEventIndex;
  }, [currentEventIndex, playbackEvents]);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}IntroSong.musicxml`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load default musicxml");
        return res.text();
      })
      .then((text) => {
        setFileName("IntroSong.musicxml");
        setRawFileContent(text);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
      });
  }, []);

  const autoTransposeWithFilters = () => {
    if (!rawFileContent) return;

    const interval = findAutoTransposeInterval(rawFileContent, {
      selectedKey,
      noOverblowOrDraw,
      noBend,
    });

    if (interval !== null) {
      setTranspose(interval);
      return;
    }

    alert("Couldn't find a transposition matching your selected filters.");
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const content = await readMusicXmlFile(file);
      setRawFileContent(content);
    } catch (error) {
      console.error("MusicXML file load error:", error);
      setFileName(null);
      setRawFileContent(null);
      alert("Couldn't load that MusicXML file. Check that the file is valid.");
    }
  };

  const buildHarmonicaTabXml = useCallback(
    (xml: string): string => injectHarmonicaTabs(xml, { selectedKey, transpose }),
    [selectedKey, transpose]
  );

  const downloadProcessedFile = useCallback(() => {
    if (!fileContent) return;

    const blob = new Blob([fileContent], {
      type: "application/vnd.recordare.musicxml+xml",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const baseName = fileName?.replace(/\.(mxl|musicxml|xml)$/i, "") || "score";

    link.href = url;
    link.download = `${baseName}-notebender.musicxml`;
    link.click();
    URL.revokeObjectURL(url);
  }, [fileContent, fileName]);

  useEffect(() => {
    if (!rawFileContent) return;
    const injected = buildHarmonicaTabXml(rawFileContent);
    setFileContent(injected);
  }, [rawFileContent, buildHarmonicaTabXml]);

  useEffect(() => {
    if (!playback) return;

    stopPlayback(true);
    setTempo(Math.round(playback.detectedTempo));
  }, [playback, stopPlayback]);

  useEffect(() => () => stopPlayback(true), [stopPlayback]);

  useEffect(() => {
    if (!fileContent || !osmdRef.current) return;

    if (!osmdInstance.current) {
      osmdInstance.current = new OpenSheetMusicDisplay(osmdRef.current, {
        backend: "svg",
        drawTitle: true,
        drawComposer: true,
        drawFingerings: true,
        fingeringPosition: "below",
        autoResize: true,
        followCursor: true,
        cursorsOptions: [
          {
            type: CursorType.ThinLeft,
            color: "#10b981",
            alpha: 0.85,
            follow: true,
          },
        ],
      });
    }

    osmdInstance.current
      .load(fileContent)
      .then(() => {
        osmdInstance.current?.render();
        osmdInstance.current?.cursor?.hide();
      })
      .catch((err) => console.error("OSMD Load Error:", err));
  }, [fileContent]);
  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center">
        🎼 MusicXML Viewer with Harmonica Tabs
      </h1>

      <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
        {/* Configuration Sidebar */}
        <div className="w-full lg:w-80 bg-gray-900 rounded-lg shadow p-6 space-y-5 border border-gray-700">
          {/* Key Selector */}
          <div>
            <label
              htmlFor="harmonicaKey"
              className="block mb-1 text-gray-300 font-medium"
            >
              Select Harmonica Key:
            </label>
            <select
              id="harmonicaKey"
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-3 py-2 w-full text-white"
            >
              {harmonicaKeys.map((key) => (
                <option key={key.value} value={key.value}>
                  {t(key.label)}
                </option>
              ))}
            </select>
          </div>

          {/* Transpose Input */}
          <div>
            <label className="block mb-1 text-gray-300 font-medium">
              Transpose (semitones):
            </label>
            <input
              type="number"
              value={transpose}
              onChange={(e) => setTranspose(parseInt(e.target.value, 10) || 0)}
              className="bg-gray-800 border border-gray-600 rounded px-3 py-2 w-full text-white"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block mb-1 text-gray-300 font-medium">
              Upload MusicXML File:
            </label>
            <label className="inline-block cursor-pointer text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
              📂 Browse MusicXML File
              <input
                type="file"
                accept=".xml,.musicxml,.mxl"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {fileName && (
              <p className="mt-1 text-sm text-gray-500">Loaded: {fileName}</p>
            )}
          </div>

          <button
            onClick={autoTransposeWithFilters}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition w-full"
          >
            🎯 Auto Transpose (Apply Filters)
          </button>

          <button
            type="button"
            onClick={downloadProcessedFile}
            disabled={!fileContent}
            className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-gray-700 disabled:text-gray-400 text-white px-4 py-2 rounded transition w-full"
          >
            Download Transposed MusicXML
          </button>

          <div className="rounded border border-gray-700 bg-gray-950 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-300">
                Tab playback
              </span>
              <span className="text-xs text-gray-500">
                {playbackEvents.length} notes
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlayback}
                disabled={!playbackEvents.length}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-400"
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                aria-label="Restart playback"
                title="Restart playback"
                onClick={() => stopPlayback(true)}
                disabled={!playbackEvents.length}
                className="inline-flex h-10 w-10 items-center justify-center rounded border border-gray-700 bg-gray-800 text-gray-100 transition hover:bg-gray-700 disabled:text-gray-500"
              >
                <RotateCcw size={18} />
              </button>
            </div>

            <label className="block text-sm text-gray-300">
              <span className="mb-1 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <Gauge size={16} />
                  Tempo
                </span>
                <span>{tempo} bpm</span>
              </span>
              <input
                type="range"
                min="40"
                max="180"
                value={tempo}
                onChange={(event) => setTempo(Number(event.target.value))}
                className="w-full accent-emerald-500"
              />
            </label>

            <div className="h-2 overflow-hidden rounded bg-gray-800">
              <div
                className="h-full bg-emerald-500 transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="min-h-8 rounded border border-gray-800 bg-gray-900 px-3 py-2 text-center text-xl font-bold tracking-normal text-emerald-300">
              {currentTab || "-"}
            </div>
          </div>

          {/* Filter Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={noOverblowOrDraw}
                onChange={(e) => setNoOverblowOrDraw(e.target.checked)}
                className="accent-blue-600"
              />
              No Overblow or Overdraw Notes
            </label>
            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={noBend}
                onChange={(e) => setNoBend(e.target.checked)}
                className="accent-blue-600"
              />
              No Bends
            </label>
          </div>
        </div>

        <div className="grid w-full flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_520px]">
          {/* Sheet Music Viewer */}
          <div className="w-full overflow-x-auto rounded bg-white p-4 text-black shadow min-h-[60vh]">
            <div ref={osmdRef} />
          </div>

          <NoteHighway
            accuracy={accuracy}
            clarity={clarity}
            currentEventIndex={currentEventIndex}
            currentTab={currentTab}
            detectedNote={detectedNote}
            gameStats={gameStats}
            isPlaying={isPlaying}
            laneKeys={laneKeys}
            lastHitIndex={lastHitIndex}
            pitchError={pitchError}
            visibleGameEvents={visibleGameEvents}
            visualPlayheadMs={visualPlayheadMs}
          />
        </div>
      </div>
    </div>
  );
};

export default TestFileLoader;

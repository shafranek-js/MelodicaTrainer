import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CursorType, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import JSZip from "jszip";
import {
  freqToNoteAndCents,
  getHarmonicaHoleForNote,
  harmonicaKeys,
} from "../utils/utils";
import { Note } from "tonal";
import { useTranslation } from "react-i18next";
import { Gauge, Mic, Pause, Play, RotateCcw, Target } from "lucide-react";
import { usePitchDetector } from "../hooks/usePitchDetector";

const keySignatureTonicsByFifths = new Map(
  Array.from({ length: 15 }, (_, index) => {
    const fifths = index - 7;
    return [fifths, (fifths * 7 + 1200) % 12];
  })
);

const getPitchNoteName = (pitch: Element): string | null => {
  const step = pitch.getElementsByTagName("step")[0]?.textContent ?? "";
  const alter = pitch.getElementsByTagName("alter")[0]?.textContent;
  const octave = pitch.getElementsByTagName("octave")[0]?.textContent ?? "";

  if (!step || !octave) return null;

  const accidental = Number(alter || 0);
  return `${step}${"#".repeat(Math.max(accidental, 0))}${"b".repeat(
    Math.max(-accidental, 0)
  )}${octave}`;
};

type PlaybackNote = {
  name: string;
  durationBeats: number;
  velocity: number;
  articulation: "normal" | "staccato" | "tenuto" | "accent";
  tieStart: boolean;
  tieStop: boolean;
  shouldPlay: boolean;
};

type PlaybackEvent = {
  durationBeats: number;
  tempoBpm: number;
  notes: PlaybackNote[];
  tabs: string[];
};

type GameStats = {
  hits: number;
  misses: number;
  streak: number;
};

type PlaybackTiming = {
  startMs: number;
  durationMs: number;
  endMs: number;
};

const getTabHole = (tab: string) => {
  const match = tab.match(/^-?\d+/);
  if (!match) return null;

  return Math.abs(Number(match[0]));
};

const getChildNumber = (
  parent: Element,
  tagName: string,
  fallback: number
) => {
  const value = Number(parent.getElementsByTagName(tagName)[0]?.textContent);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const getTabFromNote = (note: Element) =>
  note.getElementsByTagName("fingering")[0]?.textContent?.trim() || "";

const dynamicVelocities: Record<string, number> = {
  ppp: 0.25,
  pp: 0.32,
  p: 0.42,
  mp: 0.52,
  mf: 0.68,
  f: 0.82,
  ff: 0.94,
  fff: 1,
};

const getDynamicVelocity = (direction: Element) => {
  const dynamics = direction.getElementsByTagName("dynamics")[0];
  const dynamic = Array.from(dynamics?.children ?? []).find(
    (child) => child.tagName in dynamicVelocities
  );

  return dynamic ? dynamicVelocities[dynamic.tagName] : null;
};

const getNoteArticulation = (
  note: Element
): PlaybackNote["articulation"] => {
  const articulations = note.getElementsByTagName("articulations")[0];
  if (!articulations) return "normal";
  if (articulations.getElementsByTagName("accent")[0]) return "accent";
  if (articulations.getElementsByTagName("staccato")[0]) return "staccato";
  if (articulations.getElementsByTagName("tenuto")[0]) return "tenuto";

  return "normal";
};

const getNoteVelocity = (note: Element, currentVelocity: number) => {
  const velocity = Number(note.getAttribute("dynamics"));
  if (Number.isFinite(velocity) && velocity > 0) {
    return Math.min(1, Math.max(0.15, velocity / 100));
  }

  return currentVelocity;
};

const getTies = (note: Element) => {
  const tieTypes = Array.from(note.getElementsByTagName("tie")).map((tie) =>
    tie.getAttribute("type")
  );

  return {
    tieStart: tieTypes.includes("start"),
    tieStop: tieTypes.includes("stop"),
  };
};

const resolveTiedNotes = (events: PlaybackEvent[]) => {
  events.forEach((event, eventIndex) => {
    event.notes.forEach((note) => {
      if (note.tieStop) {
        note.shouldPlay = false;
      }

      if (!note.tieStart || note.tieStop) return;

      for (
        let nextEventIndex = eventIndex + 1;
        nextEventIndex < events.length;
        nextEventIndex += 1
      ) {
        const tiedNote = events[nextEventIndex].notes.find(
          (candidate) => candidate.name === note.name && candidate.tieStop
        );

        if (!tiedNote) break;

        note.durationBeats += events[nextEventIndex].durationBeats;
        tiedNote.shouldPlay = false;

        if (!tiedNote.tieStart) break;
      }
    });
  });

  return events;
};

const parsePlaybackEvents = (xml: string) => {
  const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
  const events: PlaybackEvent[] = [];
  let divisions = 1;
  let detectedTempo = 90;
  let currentTempo = detectedTempo;
  let currentVelocity = dynamicVelocities.mf;

  Array.from(xmlDoc.getElementsByTagName("sound")).some((sound) => {
    const tempo = Number(sound.getAttribute("tempo"));
    if (!Number.isFinite(tempo) || tempo <= 0) return false;

    detectedTempo = tempo;
    return true;
  });

  Array.from(xmlDoc.getElementsByTagName("measure")).forEach((measure) => {
    const attributes = measure.getElementsByTagName("attributes")[0];
    if (attributes) {
      divisions = getChildNumber(attributes, "divisions", divisions);
    }

    Array.from(measure.children).forEach((child) => {
      if (child.tagName === "direction") {
        const sound = child.getElementsByTagName("sound")[0];
        const tempo = Number(sound?.getAttribute("tempo"));
        const dynamics = Number(sound?.getAttribute("dynamics"));
        const dynamicVelocity = getDynamicVelocity(child);

        if (Number.isFinite(tempo) && tempo > 0) {
          currentTempo = tempo;
        }
        if (Number.isFinite(dynamics) && dynamics > 0) {
          currentVelocity = Math.min(1, Math.max(0.15, dynamics / 100));
        }
        if (dynamicVelocity !== null) {
          currentVelocity = dynamicVelocity;
        }
        return;
      }

      if (child.tagName !== "note") return;

      const duration = getChildNumber(child, "duration", divisions);
      const durationBeats = duration / divisions;
      const pitch = child.getElementsByTagName("pitch")[0];
      const noteName = pitch ? getPitchNoteName(pitch) : null;
      const isChord = Boolean(child.getElementsByTagName("chord")[0]);
      const isRest = Boolean(child.getElementsByTagName("rest")[0]);
      const tab = getTabFromNote(child);
      const ties = getTies(child);
      const note = noteName
        ? {
            name: noteName,
            durationBeats,
            velocity: getNoteVelocity(child, currentVelocity),
            articulation: getNoteArticulation(child),
            shouldPlay: true,
            ...ties,
          }
        : null;

      if (isChord && events.length) {
        if (note) events[events.length - 1].notes.push(note);
        if (tab) events[events.length - 1].tabs.push(tab);
        return;
      }

      events.push({
        durationBeats,
        tempoBpm: currentTempo,
        notes: note && !isRest ? [note] : [],
        tabs: tab ? [tab] : [],
      });
    });
  });

  return { events: resolveTiedNotes(events), detectedTempo };
};

const ensureAudioContext = (audioContext: AudioContext | null) => {
  if (audioContext) return audioContext;

  return new AudioContext();
};

const stopAudioNodes = (nodes: AudioScheduledSourceNode[]) => {
  nodes.forEach((node) => {
    try {
      node.stop();
    } catch {
      // Already stopped.
    }
    node.disconnect();
  });
};

const transposeNoteName = (
  noteName: string,
  semitones: number
): string | null => {
  const midi = Note.midi(noteName);
  if (midi === null) return null;

  return Note.fromMidiSharps(midi + semitones);
};

const upsertTextElement = (
  xmlDoc: XMLDocument,
  parent: Element,
  tagName: string,
  text: string,
  before?: Element
) => {
  let element = parent.getElementsByTagName(tagName)[0];

  if (!element) {
    element = xmlDoc.createElement(tagName);
    parent.insertBefore(element, before || null);
  }

  element.textContent = text;
  return element;
};

const writePitch = (
  xmlDoc: XMLDocument,
  pitch: Element,
  noteName: string
) => {
  const note = Note.get(noteName);
  if (note.empty || note.oct === undefined) return;

  const octaveElement = upsertTextElement(
    xmlDoc,
    pitch,
    "octave",
    String(note.oct)
  );
  const existingAlter = pitch.getElementsByTagName("alter")[0];

  upsertTextElement(
    xmlDoc,
    pitch,
    "step",
    note.letter,
    existingAlter || octaveElement
  );

  if (note.alt === 0) {
    existingAlter?.remove();
  } else if (existingAlter) {
    existingAlter.textContent = String(note.alt);
  } else {
    upsertTextElement(xmlDoc, pitch, "alter", String(note.alt), octaveElement);
  }
};

const transposeKeySignatureFifths = (
  originalFifths: number,
  semitones: number
) => {
  const originalChroma = keySignatureTonicsByFifths.get(originalFifths);
  if (originalChroma === undefined) return originalFifths;

  const targetChroma = (originalChroma + semitones + 1200) % 12;
  const candidates = Array.from(keySignatureTonicsByFifths.entries()).filter(
    ([, chroma]) => chroma === targetChroma
  );

  return candidates.reduce((best, [fifths]) =>
    Math.abs(fifths) < Math.abs(best) ? fifths : best
  , candidates[0]?.[0] ?? originalFifths);
};

const transposeKeySignatures = (xmlDoc: XMLDocument, semitones: number) => {
  Array.from(xmlDoc.getElementsByTagName("key")).forEach((key) => {
    const fifthsElement = key.getElementsByTagName("fifths")[0];
    if (!fifthsElement?.textContent) return;

    const fifths = Number(fifthsElement.textContent);
    if (!Number.isFinite(fifths)) return;

    fifthsElement.textContent = String(
      transposeKeySignatureFifths(fifths, semitones)
    );
  });
};

const getContainerScorePath = (containerXml: string) => {
  const xmlDoc = new DOMParser().parseFromString(
    containerXml,
    "application/xml"
  );
  const rootFile = xmlDoc.getElementsByTagName("rootfile")[0];

  return rootFile?.getAttribute("full-path") || null;
};

const extractCompressedMusicXml = async (file: File) => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const containerFile = zip.file("META-INF/container.xml");
  const containerScorePath = containerFile
    ? getContainerScorePath(await containerFile.async("text"))
    : null;
  const candidatePaths = [
    containerScorePath,
    ...Object.values(zip.files)
      .filter(
        (entry) =>
          !entry.dir &&
          /\.(musicxml|xml)$/i.test(entry.name) &&
          entry.name !== "META-INF/container.xml"
      )
      .map((entry) => entry.name),
  ].filter((path, index, paths): path is string =>
    Boolean(path && paths.indexOf(path) === index)
  );

  for (const path of candidatePaths) {
    const scoreFile = zip.file(path);
    if (scoreFile) return scoreFile.async("text");
  }

  throw new Error("No MusicXML score was found inside the MXL file.");
};

const readMusicXmlFile = (file: File) => {
  if (/\.mxl$/i.test(file.name)) return extractCompressedMusicXml(file);

  return file.text();
};

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
  const playableMidiNumbers = useMemo(() => {
    const midiNumbers = playbackEvents
      .flatMap((event) => event.notes)
      .map((note) => Note.midi(note.name))
      .filter((midi): midi is number => midi !== null);

    return new Set(midiNumbers);
  }, [playbackEvents]);
  const tempoScale = tempo / (playback?.detectedTempo || tempo || 90);
  const playbackTimeline = useMemo(() => {
    let cursorMs = 0;

    return playbackEvents.map((event): PlaybackTiming => {
      const effectiveTempo = Math.max(20, event.tempoBpm * tempoScale);
      const durationMs = Math.max(
        80,
        (60000 / effectiveTempo) * event.durationBeats
      );
      const timing = {
        startMs: cursorMs,
        durationMs,
        endMs: cursorMs + durationMs,
      };

      cursorMs = timing.endMs;
      return timing;
    });
  }, [playbackEvents, tempoScale]);
  const laneKeys = useMemo(() => {
    const holes = new Set<number>();

    playbackEvents.forEach((event) => {
      event.tabs.forEach((tab) => {
        const hole = getTabHole(tab);
        if (hole !== null) holes.add(hole);
      });
    });

    return Array.from(holes).sort((a, b) => a - b);
  }, [playbackEvents]);
  const visualPlayheadMs =
    isPlaying
      ? currentGameTimeMs
      : playbackTimeline[currentEventIndex]?.startMs ?? 0;
  const progress =
    playbackEvents.length > 0
      ? Math.round((currentEventIndex / playbackEvents.length) * 100)
      : 0;
  const currentGameEvent = playbackEvents[currentEventIndex];
  const currentTargetNotes = currentGameEvent?.notes ?? [];
  const currentTargetMidiNumbers = useMemo(
    () =>
      new Set(
        currentTargetNotes
          .map((note) => Note.midi(note.name))
          .filter((midi): midi is number => midi !== null)
      ),
    [currentTargetNotes]
  );
  const visibleGameEvents = useMemo(
    () =>
      playbackEvents
        .map((event, index) => ({
          event,
          index,
          timing: playbackTimeline[index],
        }))
        .filter(({ timing }) => {
          if (!timing) return false;
          return (
            timing.endMs >= visualPlayheadMs - 550 &&
            timing.startMs <= visualPlayheadMs + 5200
          );
        }),
    [playbackEvents, playbackTimeline, visualPlayheadMs]
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

    notes.forEach((note) => {
      if (!note.shouldPlay) return;

      const frequency = Note.freq(note.name);
      if (!frequency) return;

      const mainOscillator = audioContext.createOscillator();
      const bodyOscillator = audioContext.createOscillator();
      const filter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      const durationMs = Math.max(
        80,
        (60000 / tempoBpm) * note.durationBeats
      );
      const articulationRatio =
        note.tieStart
          ? 1
          : note.articulation === "staccato"
          ? 0.42
          : note.articulation === "tenuto"
            ? 0.98
            : 0.86;
      const accentBoost = note.articulation === "accent" ? 1.18 : 1;
      const noteSeconds = Math.max(0.08, (durationMs / 1000) * articulationRatio);
      const peakGain = Math.min(0.2, 0.045 * note.velocity * accentBoost);
      const attack = note.tieStop ? 0.004 : 0.018;

      mainOscillator.type = "triangle";
      bodyOscillator.type = "sine";
      mainOscillator.frequency.setValueAtTime(frequency, now);
      bodyOscillator.frequency.setValueAtTime(frequency * 2, now);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2400 + note.velocity * 1800, now);
      filter.Q.setValueAtTime(0.9, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + attack);
      gain.gain.setTargetAtTime(peakGain * 0.72, now + attack, 0.08);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + Math.max(0.05, noteSeconds)
      );

      mainOscillator.connect(filter);
      bodyOscillator.connect(filter);
      filter.connect(gain);
      gain.connect(audioContext.destination);
      mainOscillator.start(now);
      bodyOscillator.start(now);
      mainOscillator.stop(now + noteSeconds + 0.02);
      bodyOscillator.stop(now + noteSeconds + 0.02);
      activeAudioNodesRef.current.push(mainOscillator, bodyOscillator);
    });
  }, []);

  const moveCursorToEvent = useCallback((eventIndex: number, durationMs: number) => {
    const cursor = osmdInstance.current?.cursor;
    if (!cursor) return;

    const cursorElement = cursor.cursorElement;
    cursorElement.style.transition = `left ${durationMs}ms linear, top 160ms linear, height 160ms linear`;
    cursorElement.style.backgroundColor = "rgba(16, 185, 129, 0.78)";
    cursorElement.style.boxShadow = "0 0 0 1px rgba(6, 95, 70, 0.55), 0 0 12px rgba(16, 185, 129, 0.55)";
    cursorElement.style.width = "3px";

    if (
      cursorEventIndexRef.current === null ||
      eventIndex <= cursorEventIndexRef.current
    ) {
      cursor.reset();
      cursorEventIndexRef.current = 0;
    }

    cursor.show();
    for (let index = cursorEventIndexRef.current; index < eventIndex; index += 1) {
      cursor.next();
    }
    cursorEventIndexRef.current = eventIndex;
  }, []);

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
      setCurrentEventIndex(startIndex);
      setCurrentTab(event.tabs.join("  "));
      moveCursorToEvent(startIndex, durationMs);
      playNotes(event.notes, effectiveTempo);

      playbackTimerRef.current = window.setTimeout(() => {
        if (playbackRunRef.current !== runId) return;
        schedulePlayback(startIndex + 1, runId);
      }, durationMs);
    },
    [moveCursorToEvent, playNotes, playbackEvents, stopPlayback, tempoScale]
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
    if (!isCurrentHit || scoredEventIndexRef.current === currentEventIndex) {
      return;
    }

    scoredEventIndexRef.current = currentEventIndex;
    setLastHitIndex(currentEventIndex);
    setGameStats((stats) => ({
      ...stats,
      hits: stats.hits + 1,
      streak: stats.streak + 1,
    }));
  }, [currentEventIndex, isCurrentHit]);

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

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(rawFileContent, "application/xml");
    const noteElements = Array.from(xmlDoc.getElementsByTagName("note"));

    for (let interval = -36; interval <= 36; interval++) {
      let hasInvalidNotes = false;

      for (const note of noteElements) {
        const pitch = note.getElementsByTagName("pitch")[0];
        if (!pitch) continue;

        const originalNote = getPitchNoteName(pitch);
        if (!originalNote) continue;

        const transposed = transposeNoteName(originalNote, interval);
        if (!transposed) continue;

        const tab = getHarmonicaHoleForNote(selectedKey, transposed);

        if (!tab) {
          hasInvalidNotes = true;
          break;
        }

        if (noOverblowOrDraw && tab.endsWith("o")) {
          hasInvalidNotes = true;
          break;
        }

        if (noBend && tab.endsWith("'")) {
          hasInvalidNotes = true;
          break;
        }
      }

      if (!hasInvalidNotes) {
        setTranspose(interval);
        return;
      }
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

  const injectHarmonicaTabs = useCallback((xml: string): string => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "application/xml");
    const noteElements = xmlDoc.getElementsByTagName("note");
    transposeKeySignatures(xmlDoc, transpose);

    Array.from(noteElements).forEach((note) => {
      const pitch = note.getElementsByTagName("pitch")[0];
      if (!pitch) return;

      const originalNote = getPitchNoteName(pitch);
      if (!originalNote) return;

      const transposedNote = transposeNoteName(originalNote, transpose);
      if (!transposedNote) return;

      writePitch(xmlDoc, pitch, transposedNote);
      note.removeAttribute("default-y");
      note.removeAttribute("relative-y");

      const tab = getHarmonicaHoleForNote(selectedKey, transposedNote);
      if (!tab) return;

      // ➕ Now add your custom notations
      const notations = xmlDoc.createElement("notations");
      const technical = xmlDoc.createElement("technical");
      const fingering = xmlDoc.createElement("fingering");
      fingering.setAttribute("placement", "below");
      fingering.textContent = tab;

      technical.appendChild(fingering);
      notations.appendChild(technical);
      note.appendChild(notations);
    });

    return new XMLSerializer().serializeToString(xmlDoc);
  }, [selectedKey, transpose]);

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
    const injected = injectHarmonicaTabs(rawFileContent);
    setFileContent(injected);
  }, [rawFileContent, injectHarmonicaTabs]);

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

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 shadow">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Target size={18} className="text-emerald-300" />
                <span className="text-sm font-semibold text-gray-100">
                  Note highway
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded border border-gray-700 bg-gray-950 px-2 py-1 text-gray-300">
                  Hits {gameStats.hits}
                </span>
                <span className="rounded border border-gray-700 bg-gray-950 px-2 py-1 text-gray-300">
                  Miss {gameStats.misses}
                </span>
                <span className="rounded border border-gray-700 bg-gray-950 px-2 py-1 text-emerald-300">
                  Streak {gameStats.streak}
                </span>
                <span className="rounded border border-gray-700 bg-gray-950 px-2 py-1 text-gray-300">
                  {accuracy}% accuracy
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[128px_minmax(0,1fr)] xl:grid-cols-[116px_minmax(0,1fr)]">
              <div className="rounded border border-gray-800 bg-gray-950 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-gray-500">
                  Tab
                </div>
                <div className="mb-3 rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-3 text-center text-2xl font-bold text-emerald-200">
                  {currentTab || "-"}
                </div>
                <div className="space-y-2">
                  {visibleGameEvents
                    .filter(({ index }) => index > currentEventIndex)
                    .slice(0, 7)
                    .map(({ event, index }) => (
                      <div
                        key={`tab-${index}`}
                        className="flex min-h-8 items-center justify-center rounded border border-gray-800 bg-gray-900 px-2 text-sm font-semibold text-gray-300"
                      >
                        {event.tabs.join("  ") || "rest"}
                      </div>
                    ))}
                </div>
              </div>

              <div className="relative h-[520px] overflow-hidden rounded border border-gray-800 bg-gray-950">
                {Array.from({ length: Math.max(laneKeys.length - 1, 0) }).map((_, lane) => (
                  <div
                    key={lane}
                    className="absolute bottom-0 top-0 border-l border-gray-800"
                    style={{ left: `${((lane + 1) / laneKeys.length) * 100}%` }}
                  />
                ))}
                {laneKeys.map((hole, lane) => (
                  <div
                    key={`lane-label-${hole}`}
                    className="absolute top-2 -translate-x-1/2 text-[10px] font-semibold text-gray-600"
                    style={{ left: `${((lane + 0.5) / laneKeys.length) * 100}%` }}
                  >
                    {hole}
                  </div>
                ))}
                {!laneKeys.length && (
                  <div className="absolute inset-x-0 top-2 text-center text-[10px] font-semibold text-gray-600">
                    No tab lanes
                  </div>
                )}

                <div className="absolute left-0 right-0 top-[78%] h-[3px] bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.8)]" />
                <div className="absolute left-2 right-2 top-[calc(78%_-_28px)] h-14 rounded-full border-2 border-emerald-300/80 bg-emerald-400/10" />

                {visibleGameEvents.flatMap(({ event, index, timing }) =>
                  event.notes.length
                    ? event.notes.map((note, noteIndex) => {
                        const tab = event.tabs[noteIndex] || event.tabs[0] || "";
                        const hole = getTabHole(tab);
                        const laneCount = Math.max(laneKeys.length, 1);
                        const laneIndex =
                          hole === null ? noteIndex % laneCount : laneKeys.indexOf(hole);
                        const safeLaneIndex =
                          laneIndex >= 0 ? laneIndex : noteIndex % laneCount;
                        const left = ((safeLaneIndex + 0.5) / laneCount) * 100;
                        const timeToHitMs = timing.startMs - visualPlayheadMs;
                        const top = 78 - (timeToHitMs / 5200) * 78;
                        const isActive = index === currentEventIndex;
                        const wasHit = lastHitIndex === index;

                        return (
                          <div
                            key={`${index}-${note.name}-${noteIndex}`}
                            className={`absolute flex h-12 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border text-sm font-bold ${
                              wasHit
                                ? "scale-110 border-emerald-200 bg-emerald-400 text-black shadow-[0_0_22px_rgba(52,211,153,0.9)]"
                                : isActive
                                  ? "border-cyan-200 bg-cyan-400 text-black"
                                  : "border-gray-600 bg-gray-800 text-gray-100"
                            }`}
                            style={{
                              left: `${left}%`,
                              top: `${top}%`,
                              width: `min(56px, calc(${100 / laneCount}% - 8px))`,
                              opacity: top < -4 || top > 94 ? 0 : 1,
                            }}
                          >
                            {tab || Note.pitchClass(note.name)}
                          </div>
                        );
                      })
                    : [
                        <div
                          key={`${index}-rest`}
                          className="absolute left-1/2 h-2 w-16 -translate-x-1/2 rounded bg-gray-700"
                          style={{
                            top: `${78 - ((timing.startMs - visualPlayheadMs) / 5200) * 78}%`,
                          }}
                        />,
                      ]
                )}

                <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-300">
                  <span className="inline-flex items-center gap-2 rounded border border-gray-800 bg-gray-900/90 px-2 py-1">
                    <Mic size={14} />
                    {pitchError
                      ? "Mic unavailable"
                      : detectedNote
                        ? `${Note.pitchClass(detectedNote.note)} ${detectedNote.cents > 0 ? "+" : ""}${Math.round(detectedNote.cents)}c`
                        : isPlaying
                          ? "Listening"
                          : "Press play"}
                  </span>
                  <span className="rounded border border-gray-800 bg-gray-900/90 px-2 py-1">
                    Clarity {clarity || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestFileLoader;

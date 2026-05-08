import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { getHarmonicaHoleForNote, harmonicaKeys } from "../utils/utils";
import { Note } from "tonal";
import { useTranslation } from "react-i18next";
import { Gauge, Pause, Play, RotateCcw } from "lucide-react";

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

type PlaybackEvent = {
  durationBeats: number;
  notes: string[];
  tabs: string[];
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

const parsePlaybackEvents = (xml: string) => {
  const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
  const events: PlaybackEvent[] = [];
  let divisions = 1;
  let detectedTempo = 90;

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
      if (child.tagName !== "note") return;

      const duration = getChildNumber(child, "duration", divisions);
      const durationBeats = duration / divisions;
      const pitch = child.getElementsByTagName("pitch")[0];
      const noteName = pitch ? getPitchNoteName(pitch) : null;
      const isChord = Boolean(child.getElementsByTagName("chord")[0]);
      const tab = getTabFromNote(child);

      if (isChord && events.length) {
        if (noteName) events[events.length - 1].notes.push(noteName);
        if (tab) events[events.length - 1].tabs.push(tab);
        return;
      }

      events.push({
        durationBeats,
        notes: noteName ? [noteName] : [],
        tabs: tab ? [tab] : [],
      });
    });
  });

  return { events, detectedTempo };
};

const ensureAudioContext = (audioContext: AudioContext | null) => {
  if (audioContext) return audioContext;

  return new AudioContext();
};

const stopOscillators = (oscillators: OscillatorNode[]) => {
  oscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch {
      // Already stopped.
    }
    oscillator.disconnect();
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

  const osmdRef = useRef<HTMLDivElement>(null);
  const osmdInstance = useRef<OpenSheetMusicDisplay | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackTimerRef = useRef<number | null>(null);
  const playbackRunRef = useRef(0);
  const activeOscillatorsRef = useRef<OscillatorNode[]>([]);

  const playback = useMemo(
    () => (fileContent ? parsePlaybackEvents(fileContent) : null),
    [fileContent]
  );
  const playbackEvents = playback?.events ?? [];
  const progress =
    playbackEvents.length > 0
      ? Math.round((currentEventIndex / playbackEvents.length) * 100)
      : 0;

  const stopPlayback = useCallback((reset = false) => {
    playbackRunRef.current += 1;

    if (playbackTimerRef.current !== null) {
      window.clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    stopOscillators(activeOscillatorsRef.current);
    activeOscillatorsRef.current = [];
    setIsPlaying(false);

    if (reset) {
      setCurrentEventIndex(0);
      setCurrentTab("");
      osmdInstance.current?.cursor?.reset();
      osmdInstance.current?.cursor?.hide();
    }
  }, []);

  const playNotes = useCallback((notes: string[], durationMs: number) => {
    const audioContext = ensureAudioContext(audioContextRef.current);
    audioContextRef.current = audioContext;
    activeOscillatorsRef.current = [];

    notes.forEach((noteName) => {
      const frequency = Note.freq(noteName);
      if (!frequency) return;

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      const noteSeconds = Math.max(0.08, durationMs / 1000);

      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + noteSeconds * 0.9);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + noteSeconds);
      activeOscillatorsRef.current.push(oscillator);
    });
  }, []);

  const moveCursorToEvent = useCallback((eventIndex: number) => {
    const cursor = osmdInstance.current?.cursor;
    if (!cursor) return;

    cursor.reset();
    cursor.show();
    for (let index = 0; index < eventIndex; index += 1) {
      cursor.next();
    }
  }, []);

  const schedulePlayback = useCallback(
    (startIndex: number, runId: number) => {
      const event = playbackEvents[startIndex];
      if (!event) {
        stopPlayback(true);
        return;
      }

      const durationMs = Math.max(80, (60000 / tempo) * event.durationBeats);
      setCurrentEventIndex(startIndex);
      setCurrentTab(event.tabs.join("  "));
      moveCursorToEvent(startIndex);
      stopOscillators(activeOscillatorsRef.current);
      playNotes(event.notes, durationMs);

      playbackTimerRef.current = window.setTimeout(() => {
        if (playbackRunRef.current !== runId) return;
        schedulePlayback(startIndex + 1, runId);
      }, durationMs);
    },
    [moveCursorToEvent, playNotes, playbackEvents, stopPlayback, tempo]
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
    const runId = playbackRunRef.current + 1;
    playbackRunRef.current = runId;
    setIsPlaying(true);
    schedulePlayback(startIndex, runId);
  }, [
    currentEventIndex,
    isPlaying,
    playbackEvents.length,
    schedulePlayback,
    stopPlayback,
  ]);
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
    const content = await file.text();
    setRawFileContent(content);
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
    const baseName = fileName?.replace(/\.(musicxml|xml)$/i, "") || "score";

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
                accept=".xml,.musicxml"
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

        {/* Sheet Music Viewer */}
        <div className="flex-1 w-full bg-white text-black rounded shadow overflow-x-auto p-4 min-h-[60vh]">
          <div ref={osmdRef} />
        </div>
      </div>
    </div>
  );
};

export default TestFileLoader;

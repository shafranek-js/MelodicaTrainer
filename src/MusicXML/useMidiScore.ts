import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findBestMelodicaTransposeIntervals } from "./musicXmlTransform";
import {
  buildMidiPlaybackEvents,
  getMidiFileErrorMessage,
  parseMidiFile,
} from "./midiParser";
import type { MidiPartInfo, ParsedMidiScore } from "./midiParser";
import {
  generateMidiNotation,
} from "./midiNotation";
import type {
  MidiNotationResult,
  MidiNotationStatus,
  MidiQuantizationMode,
} from "./midiNotation";
import { injectMelodicaLabels } from "./musicXmlTransform";
import type { MelodicaKeyCount } from "../utils/utils";
import type { ScoreFileContent } from "./useScoreFileLoader";
import type { PlaybackEvent } from "./types";

type RouteStatus = {
  tone: "info" | "success" | "error";
  message: string;
};

type UseMidiScoreOptions = {
  fileName: string | null;
  isMidiFile: boolean;
  keyCount: MelodicaKeyCount;
  quantizationMode: MidiQuantizationMode;
  rawFileContent: ScoreFileContent | null;
  setDetectedTempoBpm: (tempoBpm: number) => void;
  setIsSheetReady: (isReady: boolean) => void;
  setPlaybackEvents: (events: PlaybackEvent[]) => void;
  setRouteStatus: (status: RouteStatus) => void;
  setTranspose: (transpose: number) => void;
  transpose: number;
};

type ParsedMidiResult = {
  error: unknown | null;
  score: ParsedMidiScore | null;
};

export const useMidiScore = ({
  fileName,
  isMidiFile,
  keyCount,
  quantizationMode,
  rawFileContent,
  setDetectedTempoBpm,
  setIsSheetReady,
  setPlaybackEvents,
  setRouteStatus,
  setTranspose,
  transpose,
}: UseMidiScoreOptions) => {
  const [selectedMidiPartId, setSelectedMidiPartId] = useState<string | null>(null);
  const shouldAutoTransposeRef = useRef(false);

  const parsedResult = useMemo<ParsedMidiResult>(() => {
    if (!isMidiFile || !(rawFileContent instanceof Uint8Array)) {
      return { error: null, score: null };
    }

    try {
      return {
        error: null,
        score: parseMidiFile(rawFileContent, fileName ?? "score.mid"),
      };
    } catch (error) {
      return { error, score: null };
    }
  }, [fileName, isMidiFile, rawFileContent]);

  useEffect(() => {
    if (!isMidiFile) {
      setSelectedMidiPartId(null);
      return;
    }

    if (parsedResult.error || !parsedResult.score) {
      setSelectedMidiPartId(null);
      setPlaybackEvents([]);
      setIsSheetReady(false);
      setRouteStatus({
        tone: "error",
        message: getMidiFileErrorMessage(parsedResult.error) ?? "Failed to prepare MIDI file.",
      });
      return;
    }

    shouldAutoTransposeRef.current = true;
    setSelectedMidiPartId(parsedResult.score.parts[0].id);
    setDetectedTempoBpm(parsedResult.score.initialTempoBpm);
    setIsSheetReady(true);
  }, [
    isMidiFile,
    parsedResult,
    setDetectedTempoBpm,
    setIsSheetReady,
    setPlaybackEvents,
    setRouteStatus,
  ]);

  const selectedMidiPart = useMemo(
    () => parsedResult.score?.parts.find((part) => part.id === selectedMidiPartId) ?? null,
    [parsedResult.score, selectedMidiPartId],
  );

  const notationResult = useMemo<MidiNotationResult | null>(() => {
    if (!isMidiFile || !parsedResult.score || !selectedMidiPart) return null;
    try {
      return generateMidiNotation(
        parsedResult.score,
        selectedMidiPart.id,
        quantizationMode,
      );
    } catch (error) {
      console.error("MIDI notation generation error:", error);
      return null;
    }
  }, [isMidiFile, parsedResult.score, quantizationMode, selectedMidiPart]);

  const midiDisplayFileContent = useMemo(() => {
    if (!notationResult) return null;
    try {
      return injectMelodicaLabels(notationResult.musicXml, {
        keyCount,
        transpose,
      });
    } catch (error) {
      console.error("MIDI notation transform error:", error);
      return null;
    }
  }, [keyCount, notationResult, transpose]);

  const midiNotationStatus: MidiNotationStatus = !isMidiFile
    ? "unavailable"
    : parsedResult.score && !selectedMidiPart
      ? "preparing"
      : midiDisplayFileContent
        ? "ready"
        : "unavailable";

  useEffect(() => {
    if (!isMidiFile || !parsedResult.score || !selectedMidiPart) return;

    let appliedTranspose = transpose;
    if (shouldAutoTransposeRef.current) {
      shouldAutoTransposeRef.current = false;
      appliedTranspose = findBestMelodicaTransposeIntervals(
        selectedMidiPart.originalMidiNumbers,
        { keyCount },
      )[0] ?? 0;
      if (appliedTranspose !== transpose) {
        setTranspose(appliedTranspose);
      }
    }

    const events = buildMidiPlaybackEvents(
      parsedResult.score,
      selectedMidiPart.id,
      appliedTranspose,
      keyCount,
      notationResult
        ? {
            cursorIndexByTick: notationResult.cursorIndexByTick,
            visualBoundaryTicks: notationResult.visualBoundaryTicks,
          }
        : undefined,
    );
    setPlaybackEvents(events);
    setIsSheetReady(events.length > 0);
    setRouteStatus({
      tone: events.length > 0 ? "success" : "error",
      message: events.length > 0
        ? notationResult
          ? `MIDI part loaded: ${selectedMidiPart.name} — Ch. ${selectedMidiPart.channel + 1}.`
          : "MIDI playback is ready, but approximate notation is unavailable."
        : "The selected MIDI part has no playable notes.",
    });
  }, [
    isMidiFile,
    keyCount,
    notationResult,
    parsedResult.score,
    selectedMidiPart,
    setIsSheetReady,
    setPlaybackEvents,
    setRouteStatus,
    setTranspose,
    transpose,
  ]);

  const handleMidiPartChange = useCallback((partId: string) => {
    if (!parsedResult.score?.parts.some((part) => part.id === partId)) return;
    shouldAutoTransposeRef.current = true;
    setSelectedMidiPartId(partId);
  }, [parsedResult.score]);

  const resetMidiScore = useCallback(() => {
    shouldAutoTransposeRef.current = false;
    setSelectedMidiPartId(null);
  }, []);

  return {
    handleMidiPartChange,
    midiOriginalMidiNumbers: selectedMidiPart?.originalMidiNumbers ?? [],
    midiDisplayFileContent,
    midiNotationStatus,
    midiNotationWarnings: notationResult?.warnings ?? [],
    midiParts: parsedResult.score?.parts ?? ([] as MidiPartInfo[]),
    midiScore: parsedResult.score,
    resolvedMidiQuantization: notationResult?.resolvedQuantization ?? null,
    resetMidiScore,
    selectedMidiPart,
    selectedMidiPartId,
  };
};

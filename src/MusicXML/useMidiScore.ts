import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findBestMelodicaTransposeIntervals } from "./musicXmlTransform";
import {
  buildMidiPlaybackEvents,
  getMidiFileErrorMessage,
  parseMidiFile,
} from "./midiParser";
import type { MidiPartInfo, ParsedMidiScore } from "./midiParser";
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
    );
    setPlaybackEvents(events);
    setIsSheetReady(events.length > 0);
    setRouteStatus({
      tone: events.length > 0 ? "success" : "error",
      message: events.length > 0
        ? `MIDI part loaded: ${selectedMidiPart.name} — Ch. ${selectedMidiPart.channel + 1}.`
        : "The selected MIDI part has no playable notes.",
    });
  }, [
    isMidiFile,
    keyCount,
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
    midiParts: parsedResult.score?.parts ?? ([] as MidiPartInfo[]),
    midiScore: parsedResult.score,
    resetMidiScore,
    selectedMidiPart,
    selectedMidiPartId,
  };
};

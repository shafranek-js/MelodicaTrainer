import { useCallback, useMemo, useRef, useState } from "react";
import { findBestMelodicaTransposeIntervals } from "./musicXmlTransform";
import { getPlayableMidiNumbers } from "./playbackTimeline";
import { musicXmlDebugLogger } from "./debugLogger";
import type { PlaybackEvent } from "./types";
import type { MutableRefObject } from "react";
import type * as alphaTab from "@coderline/alphatab";
import type { MelodicaKeyCount } from "../utils/utils";
import type { AccompanimentTrack } from "./accompaniment";

const DEFAULT_GP_SCORE_HEIGHT_PX = 128;
const MIN_GP_SCORE_HEIGHT_PX = 72;
const GP_SCORE_BOTTOM_PADDING_PX = 2;

type RouteStatus = {
  tone: "info" | "success" | "error";
  message: string;
};

type TrackInfo = {
  index: number;
  name: string;
};

type UseGpScoreOptions = {
  cursorEventIndexRef: MutableRefObject<number | null>;
  keyCount: MelodicaKeyCount;
  setCurrentEventIndex: (index: number) => void;
  setCurrentGameTimeMs: (timeMs: number) => void;
  setDetectedTempoBpm: (tempoBpm: number) => void;
  setIsSheetReady: (isReady: boolean) => void;
  setPlaybackEvents: (events: PlaybackEvent[]) => void;
  setRouteStatus: (status: RouteStatus) => void;
  setTranspose: (transpose: number) => void;
  transpose: number;
};

export const useGpScore = ({
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
}: UseGpScoreOptions) => {
  const [gpOriginalMidiNumbers, setGpOriginalMidiNumbers] = useState<number[]>([]);
  const [gpAccompanimentTracks, setGpAccompanimentTracks] = useState<AccompanimentTrack[]>([]);
  const [gpAccompanimentWarnings, setGpAccompanimentWarnings] = useState<string[]>([]);
  const [gpTracks, setGpTracks] = useState<TrackInfo[]>([]);
  const [selectedGpTrackIndex, setSelectedGpTrackIndex] = useState(0);
  const [gpScoreHeightPx, setGpScoreHeightPx] = useState(DEFAULT_GP_SCORE_HEIGHT_PX);
  const [isGpPlaybackReady, setIsGpPlaybackReady] = useState(false);
  const shouldAutoTransposeGpRef = useRef(false);

  const gpScorePaneHeightPx = useMemo(
    () => Math.max(MIN_GP_SCORE_HEIGHT_PX, Math.ceil(gpScoreHeightPx) + GP_SCORE_BOTTOM_PADDING_PX),
    [gpScoreHeightPx]
  );

  const findBestGpTranspose = useCallback((originalMidiNumbers: number[]) => {
    if (originalMidiNumbers.length === 0) return null;

    const intervals = findBestMelodicaTransposeIntervals(originalMidiNumbers, {
      keyCount,
    });

    return intervals[0] ?? null;
  }, [keyCount]);

  const handleGpScoreLoaded = useCallback((
    events: PlaybackEvent[],
    _score: alphaTab.model.Score,
    tracks: TrackInfo[],
    scoreTempo: number,
    accompanimentTracks: AccompanimentTrack[],
    accompanimentWarnings: string[],
  ) => {
    musicXmlDebugLogger.log(`MusicXML: Score loaded. Extracted tempo: ${scoreTempo}`);
    const originalMidiNumbers = Array.from(getPlayableMidiNumbers(events)).map((m) => m - transpose);
    setGpOriginalMidiNumbers(originalMidiNumbers);

    if (shouldAutoTransposeGpRef.current) {
      shouldAutoTransposeGpRef.current = false;
      const bestTranspose = findBestGpTranspose(originalMidiNumbers);
      if (bestTranspose !== null && bestTranspose !== transpose) {
        musicXmlDebugLogger.log(`MusicXML: Auto-transposing GP score by ${bestTranspose} semitones.`);
        setTranspose(bestTranspose);
        setRouteStatus({ tone: "info", message: `Auto transposed Guitar Pro score by ${bestTranspose} semitones.` });
        return;
      }
    }

    setPlaybackEvents(events);
    setGpAccompanimentTracks(accompanimentTracks);
    setGpAccompanimentWarnings(accompanimentWarnings);
    setGpTracks(tracks || []);
    if (scoreTempo) {
      setDetectedTempoBpm(scoreTempo);
    }
    setCurrentEventIndex(0);
    setCurrentGameTimeMs(0);
    cursorEventIndexRef.current = null;
    setIsSheetReady(true);
    setRouteStatus({ tone: "success", message: "Guitar Pro score loaded." });
  }, [
    cursorEventIndexRef,
    findBestGpTranspose,
    setCurrentEventIndex,
    setCurrentGameTimeMs,
    setDetectedTempoBpm,
    setIsSheetReady,
    setPlaybackEvents,
    setRouteStatus,
    setTranspose,
    transpose,
  ]);

  const handleGpTrackChange = useCallback((trackIndex: number, stopPlayback: () => void) => {
    shouldAutoTransposeGpRef.current = true;
    setSelectedGpTrackIndex(trackIndex);
    stopPlayback();
  }, []);

  const resetGpScore = useCallback((shouldAutoTranspose: boolean) => {
    shouldAutoTransposeGpRef.current = shouldAutoTranspose;
    setGpOriginalMidiNumbers([]);
    setGpAccompanimentTracks([]);
    setGpAccompanimentWarnings([]);
    setGpTracks([]);
    setSelectedGpTrackIndex(0);
    setGpScoreHeightPx(DEFAULT_GP_SCORE_HEIGHT_PX);
    setIsGpPlaybackReady(false);
  }, []);

  return {
    gpAccompanimentTracks,
    gpAccompanimentWarnings,
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
  };
};

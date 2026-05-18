import { useEffect, useMemo, useState } from "react";
import {
  createFirstStaffDisplayXml,
  injectMelodicaLabels,
} from "./musicXmlTransform";
import { parsePlaybackEvents } from "./playbackParser";
import type { MelodicaKeyCount } from "../utils/utils";
import type { PlaybackEvent } from "./types";
import type { ScoreFileContent } from "./useScoreFileLoader";

type UseMusicXmlScoreOptions = {
  keyCount: MelodicaKeyCount;
  isGpFile: boolean;
  rawFileContent: ScoreFileContent | null;
  setDetectedTempoBpm: (tempoBpm: number) => void;
  setIsSheetReady: (isReady: boolean) => void;
  setPlaybackEvents: (events: PlaybackEvent[]) => void;
  setRouteStatus: (status: { tone: "info" | "success" | "error"; message: string }) => void;
  transpose: number;
};

export const useMusicXmlScore = ({
  keyCount,
  isGpFile,
  rawFileContent,
  setDetectedTempoBpm,
  setIsSheetReady,
  setPlaybackEvents,
  setRouteStatus,
  transpose,
}: UseMusicXmlScoreOptions) => {
  const [fileContent, setFileContent] = useState<string | null>(null);

  const displayFileContent = useMemo(
    () => (fileContent ? createFirstStaffDisplayXml(fileContent) : null),
    [fileContent]
  );

  useEffect(() => {
    if (isGpFile) {
      setFileContent(null);
      return;
    }

    if (typeof rawFileContent !== "string") {
      setFileContent(null);
      return;
    }

    try {
      setFileContent(
        injectMelodicaLabels(rawFileContent, {
          keyCount,
          transpose,
        })
      );
    } catch (err) {
      console.error(err);
      setFileContent(null);
      setPlaybackEvents([]);
      setIsSheetReady(false);
      setRouteStatus({
        tone: "error",
        message: "Failed to prepare MusicXML score.",
      });
    }
  }, [
    isGpFile,
    keyCount,
    rawFileContent,
    setIsSheetReady,
    setPlaybackEvents,
    setRouteStatus,
    transpose,
  ]);

  useEffect(() => {
    if (isGpFile || !displayFileContent) return;

    try {
      const playback = parsePlaybackEvents(displayFileContent);
      setPlaybackEvents(playback.events);
      if (playback.detectedTempo) {
        setDetectedTempoBpm(playback.detectedTempo);
      }
    } catch (err) {
      console.error(err);
      setPlaybackEvents([]);
      setIsSheetReady(false);
      setRouteStatus({
        tone: "error",
        message: "Failed to parse MusicXML playback events.",
      });
    }
  }, [
    displayFileContent,
    isGpFile,
    setDetectedTempoBpm,
    setIsSheetReady,
    setPlaybackEvents,
    setRouteStatus,
  ]);

  return { displayFileContent, fileContent };
};

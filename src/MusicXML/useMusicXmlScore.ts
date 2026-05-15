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
  setPlaybackEvents: (events: PlaybackEvent[]) => void;
  transpose: number;
};

export const useMusicXmlScore = ({
  keyCount,
  isGpFile,
  rawFileContent,
  setDetectedTempoBpm,
  setPlaybackEvents,
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

    if (typeof rawFileContent !== "string") return;

    try {
      setFileContent(
        injectMelodicaLabels(rawFileContent, {
          keyCount,
          transpose,
        })
      );
    } catch (err) {
      console.error(err);
    }
  }, [isGpFile, keyCount, rawFileContent, transpose]);

  useEffect(() => {
    if (isGpFile || !displayFileContent) return;

    const playback = parsePlaybackEvents(displayFileContent);
    setPlaybackEvents(playback.events);
    if (playback.detectedTempo) {
      setDetectedTempoBpm(playback.detectedTempo);
    }
  }, [displayFileContent, isGpFile, setDetectedTempoBpm, setPlaybackEvents]);

  return { displayFileContent, fileContent };
};

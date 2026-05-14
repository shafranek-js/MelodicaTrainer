import { useEffect, useMemo, useState } from "react";
import {
  createFirstStaffDisplayXml,
  injectHarmonicaTabs,
} from "./musicXmlTransform";
import { parsePlaybackEvents } from "./playbackParser";
import type { PlaybackEvent } from "./types";
import type { ScoreFileContent } from "./useScoreFileLoader";

type UseMusicXmlScoreOptions = {
  harmonicaKey: string;
  isGpFile: boolean;
  rawFileContent: ScoreFileContent | null;
  setDetectedTempoBpm: (tempoBpm: number) => void;
  setPlaybackEvents: (events: PlaybackEvent[]) => void;
  transpose: number;
};

export const useMusicXmlScore = ({
  harmonicaKey,
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
        injectHarmonicaTabs(rawFileContent, {
          selectedKey: harmonicaKey,
          transpose,
        })
      );
    } catch (err) {
      console.error(err);
    }
  }, [harmonicaKey, isGpFile, rawFileContent, transpose]);

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

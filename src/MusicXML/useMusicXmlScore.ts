import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createFirstStaffDisplayXml,
  getMusicXmlParts,
  getMusicXmlStaves,
  injectMelodicaLabels,
  selectMusicXmlPart,
} from "./musicXmlTransform";
import { parsePlaybackEvents } from "./playbackParser";
import { buildMusicXmlAccompaniment } from "./musicXmlAccompaniment";
import type { MelodicaKeyCount } from "../utils/utils";
import type { PlaybackEvent } from "./types";
import type { ScoreFileContent } from "./useScoreFileLoader";
import type { ScoreFormat } from "./scoreFormat";

type UseMusicXmlScoreOptions = {
  keyCount: MelodicaKeyCount;
  scoreFormat: ScoreFormat | null;
  rawFileContent: ScoreFileContent | null;
  setDetectedTempoBpm: (tempoBpm: number) => void;
  setIsSheetReady: (isReady: boolean) => void;
  setPlaybackEvents: (events: PlaybackEvent[]) => void;
  setRouteStatus: (status: { tone: "info" | "success" | "error"; message: string }) => void;
  transpose: number;
};

export const useMusicXmlScore = ({
  keyCount,
  scoreFormat,
  rawFileContent,
  setDetectedTempoBpm,
  setIsSheetReady,
  setPlaybackEvents,
  setRouteStatus,
  transpose,
}: UseMusicXmlScoreOptions) => {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [partSelection, setPartSelection] = useState<{
    partId: string;
    source: string;
  } | null>(null);
  const [staffSelection, setStaffSelection] = useState<{
    partId: string;
    source: string;
    staffId: string;
  } | null>(null);

  const musicXmlParts = useMemo(() => {
    if (scoreFormat !== "musicxml" || typeof rawFileContent !== "string") {
      return [];
    }

    try {
      return getMusicXmlParts(rawFileContent);
    } catch {
      return [];
    }
  }, [rawFileContent, scoreFormat]);

  const selectedMusicXmlPartId =
    partSelection?.source === rawFileContent &&
    musicXmlParts.some((part) => part.id === partSelection.partId)
      ? partSelection.partId
      : musicXmlParts[0]?.id ?? null;

  const handleMusicXmlPartChange = useCallback((partId: string) => {
    if (typeof rawFileContent !== "string") return;
    setPartSelection({ partId, source: rawFileContent });
    setStaffSelection(null);
  }, [rawFileContent]);

  const selectedRawFileContent = useMemo(() => {
    if (typeof rawFileContent !== "string" || !selectedMusicXmlPartId) {
      return rawFileContent;
    }
    return selectMusicXmlPart(rawFileContent, selectedMusicXmlPartId);
  }, [rawFileContent, selectedMusicXmlPartId]);

  const musicXmlStaves = useMemo(() => {
    if (scoreFormat !== "musicxml" || typeof selectedRawFileContent !== "string") {
      return [];
    }

    try {
      return getMusicXmlStaves(selectedRawFileContent);
    } catch {
      return [];
    }
  }, [scoreFormat, selectedRawFileContent]);

  const selectedMusicXmlStaffId =
    staffSelection?.source === rawFileContent &&
    staffSelection.partId === selectedMusicXmlPartId &&
    musicXmlStaves.some((staff) => staff.id === staffSelection.staffId)
      ? staffSelection.staffId
      : musicXmlStaves[0]?.id ?? null;
  const selectedMusicXmlStaffNumber = selectedMusicXmlStaffId === "implicit"
    ? null
    : selectedMusicXmlStaffId;

  const handleMusicXmlStaffChange = useCallback((staffId: string) => {
    if (typeof rawFileContent !== "string" || !selectedMusicXmlPartId) return;
    setStaffSelection({
      partId: selectedMusicXmlPartId,
      source: rawFileContent,
      staffId,
    });
  }, [rawFileContent, selectedMusicXmlPartId]);

  const displayFileContent = useMemo(
    () => fileContent
      ? createFirstStaffDisplayXml(fileContent, selectedMusicXmlStaffNumber)
      : null,
    [fileContent, selectedMusicXmlStaffNumber],
  );

  const musicXmlAccompaniment = useMemo(() => {
    const empty = { tracks: [], warnings: [] };
    if (
      scoreFormat !== "musicxml" ||
      typeof rawFileContent !== "string" ||
      !selectedMusicXmlPartId ||
      !selectedMusicXmlStaffId ||
      !fileContent
    ) {
      return empty;
    }

    return buildMusicXmlAccompaniment({
      primaryFileContent: fileContent,
      rawFileContent,
      selectedPartId: selectedMusicXmlPartId,
      selectedStaffId: selectedMusicXmlStaffId,
      selectedStaffNumber: selectedMusicXmlStaffNumber,
      transpose,
    });
  }, [
    fileContent,
    rawFileContent,
    scoreFormat,
    selectedMusicXmlPartId,
    selectedMusicXmlStaffId,
    selectedMusicXmlStaffNumber,
    transpose,
  ]);

  useEffect(() => {
    if (scoreFormat !== "musicxml") {
      setFileContent(null);
      return;
    }

    if (typeof selectedRawFileContent !== "string") {
      setFileContent(null);
      return;
    }

    try {
      setFileContent(
        injectMelodicaLabels(selectedRawFileContent, {
          keyCount,
          staffNumber: selectedMusicXmlStaffNumber,
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
    scoreFormat,
    keyCount,
    selectedRawFileContent,
    selectedMusicXmlStaffNumber,
    setIsSheetReady,
    setPlaybackEvents,
    setRouteStatus,
    transpose,
  ]);

  useEffect(() => {
    if (scoreFormat !== "musicxml" || !fileContent) return;

    try {
      const playback = parsePlaybackEvents(fileContent, {
        staffNumber: selectedMusicXmlStaffNumber,
      });
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
    fileContent,
    scoreFormat,
    selectedMusicXmlStaffNumber,
    setDetectedTempoBpm,
    setIsSheetReady,
    setPlaybackEvents,
    setRouteStatus,
  ]);

  return {
    displayFileContent,
    fileContent,
    handleMusicXmlPartChange,
    handleMusicXmlStaffChange,
    musicXmlAccompanimentTracks: musicXmlAccompaniment.tracks,
    musicXmlAccompanimentWarnings: musicXmlAccompaniment.warnings,
    musicXmlParts,
    musicXmlStaves,
    selectedMusicXmlPartId,
    selectedMusicXmlStaffId,
  };
};

import { useCallback, useEffect, useRef, useState } from "react";
import {
  finishMidiRecording,
  startMidiRecording,
} from "./audioPlayback";
import { hasRecordedNotes } from "./midiRecording";
import type { MidiRecording } from "./midiRecording";
import {
  downloadRecordingBlob,
  getRecordingFileName,
  renderRecordingMp3,
} from "./recordingExport";

export type RecordingState = "error" | "exporting" | "idle" | "recording";

type UseMidiRecordingOptions = {
  fileName: string | null;
  soundFont: string;
};

export const useMidiRecording = ({
  fileName,
  soundFont,
}: UseMidiRecordingOptions) => {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const startedAtRef = useRef(0);
  const mountedRef = useRef(true);
  const exportSettingsRef = useRef({ fileName, soundFont });
  exportSettingsRef.current = { fileName, soundFont };

  const exportRecording = useCallback(async (
    recording: MidiRecording,
    updateState: boolean,
  ) => {
    const settings = exportSettingsRef.current;
    try {
      const blob = await renderRecordingMp3(recording, settings.soundFont);
      downloadRecordingBlob(blob, getRecordingFileName(settings.fileName));
      if (updateState && mountedRef.current) {
        setRecordingState("idle");
        setRecordingError(null);
      }
    } catch (error) {
      if (updateState && mountedRef.current) {
        setRecordingState("error");
        setRecordingError(
          error instanceof Error ? error.message : "Could not export the MP3 recording.",
        );
      } else {
        console.error("Could not export the MP3 recording.", error);
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recording = finishMidiRecording();
    if (!recording || !hasRecordedNotes(recording)) {
      setRecordingDurationMs(0);
      setRecordingState("error");
      setRecordingError("Nothing was recorded.");
      return;
    }
    setRecordingDurationMs(recording.durationMs);
    setRecordingState("exporting");
    setRecordingError(null);
    void exportRecording(recording, true);
  }, [exportRecording]);

  const toggleRecording = useCallback(() => {
    if (recordingState === "exporting") return;
    if (recordingState === "recording") {
      stopRecording();
      return;
    }
    if (!startMidiRecording()) return;
    startedAtRef.current = performance.now();
    setRecordingDurationMs(0);
    setRecordingError(null);
    setRecordingState("recording");
  }, [recordingState, stopRecording]);

  useEffect(() => {
    if (recordingState !== "recording") return;
    const updateDuration = () => {
      setRecordingDurationMs(Math.max(0, performance.now() - startedAtRef.current));
    };
    updateDuration();
    const timerId = window.setInterval(updateDuration, 250);
    return () => window.clearInterval(timerId);
  }, [recordingState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recording = finishMidiRecording();
      if (recording && hasRecordedNotes(recording)) {
        void exportRecording(recording, false);
      }
    };
  }, [exportRecording]);

  return {
    recordingDurationMs,
    recordingError,
    recordingState,
    toggleRecording,
  };
};

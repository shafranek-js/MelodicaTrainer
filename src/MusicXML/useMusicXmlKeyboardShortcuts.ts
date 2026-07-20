import { useEffect } from "react";

type UseMusicXmlKeyboardShortcutsOptions = {
  onResetPlayback: () => void;
  onSetTempo: (tempo: number) => void;
  onTogglePlayback: () => void;
  tempo: number;
  onToggleRecording?: () => void;
  recordingState?: string;
};

export const useMusicXmlKeyboardShortcuts = ({
  onResetPlayback,
  onSetTempo,
  onTogglePlayback,
  tempo,
  onToggleRecording,
  recordingState,
}: UseMusicXmlKeyboardShortcutsOptions) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        onTogglePlayback();
      } else if (e.code === "Escape") {
        e.preventDefault();
        if (recordingState === "recording") {
          onToggleRecording?.();
        } else {
          onResetPlayback();
        }
      } else if (e.key === "+" || e.key === "=") {
        onSetTempo(Math.min(240, tempo + 5));
      } else if (e.key === "-" || e.key === "_") {
        onSetTempo(Math.max(20, tempo - 5));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onResetPlayback, onSetTempo, onTogglePlayback, tempo, onToggleRecording, recordingState]);
};

import { useEffect, useRef, useState } from "react";

type UseEndStatsOverlayOptions = {
  playbackCompletionId: number;
};

export const shouldShowEndStatsOverlay = ({
  lastShownCompletionId,
  playbackCompletionId,
}: {
  lastShownCompletionId: number;
  playbackCompletionId: number;
}) =>
  playbackCompletionId > 0 &&
  playbackCompletionId !== lastShownCompletionId;

export const useEndStatsOverlay = ({
  playbackCompletionId,
}: UseEndStatsOverlayOptions) => {
  const [showEndStats, setShowEndStats] = useState(false);
  const lastShownCompletionIdRef = useRef(playbackCompletionId);

  useEffect(() => {
    if (
      shouldShowEndStatsOverlay({
        lastShownCompletionId: lastShownCompletionIdRef.current,
        playbackCompletionId,
      })
    ) {
      setShowEndStats(true);
    }

    lastShownCompletionIdRef.current = playbackCompletionId;
  }, [playbackCompletionId]);

  useEffect(() => {
    if (!showEndStats) return;
    const dismiss = () => setShowEndStats(false);
    window.addEventListener("keydown", dismiss);
    window.addEventListener("click", dismiss);
    return () => {
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("click", dismiss);
    };
  }, [showEndStats]);

  return {
    dismissEndStats: () => setShowEndStats(false),
    showEndStats,
  };
};

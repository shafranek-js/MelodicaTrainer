import { useEffect, useRef, useState } from "react";

type UseEndStatsOverlayOptions = {
  playbackCompletionId: number;
  topDrawerHidden: boolean;
};

export const shouldShowEndStatsOverlay = ({
  lastShownCompletionId,
  playbackCompletionId,
  topDrawerHidden,
}: {
  lastShownCompletionId: number;
  playbackCompletionId: number;
  topDrawerHidden: boolean;
}) =>
  playbackCompletionId > 0 &&
  playbackCompletionId !== lastShownCompletionId &&
  topDrawerHidden;

export const useEndStatsOverlay = ({
  playbackCompletionId,
  topDrawerHidden,
}: UseEndStatsOverlayOptions) => {
  const [showEndStats, setShowEndStats] = useState(false);
  const lastShownCompletionIdRef = useRef(playbackCompletionId);

  useEffect(() => {
    if (
      shouldShowEndStatsOverlay({
        lastShownCompletionId: lastShownCompletionIdRef.current,
        playbackCompletionId,
        topDrawerHidden,
      })
    ) {
      setShowEndStats(true);
    }

    lastShownCompletionIdRef.current = playbackCompletionId;
  }, [playbackCompletionId, topDrawerHidden]);

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
